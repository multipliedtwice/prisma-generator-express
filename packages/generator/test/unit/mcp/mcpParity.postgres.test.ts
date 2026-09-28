import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { execFileSync } from 'node:child_process'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { rm } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { force } from 'prisma-guard'
import express from 'express'
import { Client } from '@modelcontextprotocol/client'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/client'
import {
  McpServer,
  createMcpHandler,
  type AuthInfo,
} from '@modelcontextprotocol/server'
import { toNodeHandler } from '@modelcontextprotocol/node'
import {
  ARTICLE_GUARD_DIR,
  PRISMA_BIN,
  generateWithArticleGuard,
  importFrom,
} from './articleGuardStack'
/**
 * REST versus MCP parity on a REAL Postgres, with the prisma-guard extension
 * ACTIVE — the guard-dropped SQLite harness cannot substitute for this gate.
 *
 * Same route configuration feeds both transports; the assertions are the
 * phase-S parity definition: same variant resolution, guard enforcement,
 * pagination behaviour, operation core result and classified error.
 */

const DATABASE_URL =
  process.env.PARITY_DATABASE_URL ??
  'postgresql://postgres:parity@127.0.0.1:55433/parity'

const WORK_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../.parity-pg',
)

const SCHEMA = `datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

generator guard {
  provider = "prisma-guard"
  output   = "\${GUARD_OUT}"
}

generator api {
  provider = "\${API_BIN}"
  output   = "\${API_OUT}"
  target   = "express"
  mcp      = true
}

model Ticket {
  id      String  @id @default(cuid())
  title   String
  siteId  String
  hidden  Boolean @default(false)

  @@index([siteId])
}

model Page {
  id        String  @id @default(cuid())
  siteId    String
  slug      String
  title     String
  published Boolean @default(false)
  views     BigInt?

  @@unique([siteId, slug])
}
`

const authInfo: AuthInfo = {
  token: 'parity-token',
  clientId: 'tenant-a',
  scopes: ['mcp'],
  expiresAt: Date.now() + 3_600_000,
} as AuthInfo

/** The ONE route configuration both transports share. */
const routeConfig = () => ({
  addModelPrefix: false,
  disableOpenApi: true,
  queryBuilder: false,
  findMany: {
    variants: {
      'tenant-a': {
        shape: {
          where: { siteId: { equals: force('tenant-a') } },
          take: { max: 25 },
        },
      },
    },
  },
  guard: { variantHeader: 'x-api-variant' },
})

const TENANTS = ['tenant-a', 'tenant-b'] as const

/**
 * The CMS Page contract: every write is tenant-forced through per-tenant
 * STATIC variants. Unique-where ops select by `id` WITH the forced siteId
 * (extended unique where) or by the compound `siteId_slug` selector with the
 * forced siteId; bulk ops filter on the forced siteId. A caller routed to
 * tenant-b can therefore never reach a tenant-a row.
 */
function tenantPageShapes(t: string) {
  const data = { slug: true, title: true, siteId: force(t) }
  const scope = { siteId: { equals: force(t) } }
  return {
    findMany: { where: scope, take: { max: 50 } },
    create: { data },
    createMany: { data },
    createManyAndReturn: {
      data,
      select: { id: true, slug: true, siteId: true },
    },
    update: {
      where: { id: true, siteId: force(t) },
      data: { title: true, published: true, views: true },
    },
    updateMany: {
      where: { ...scope, slug: { startsWith: true } },
      data: { published: true },
    },
    updateManyAndReturn: {
      where: scope,
      data: { published: true },
      select: { id: true, siteId: true, published: true },
    },
    upsert: {
      where: { siteId_slug: { siteId: force(t), slug: true } },
      create: data,
      update: { title: true },
    },
    delete: { where: { id: true, siteId: force(t) } },
    deleteMany: { where: { ...scope, slug: { startsWith: true } } },
  }
}

type OverrideCall = { transport: string; input: unknown; context: unknown }
const overrideCalls: OverrideCall[] = []

const PAGE_OPS = [
  'findMany',
  'create',
  'createMany',
  'createManyAndReturn',
  'update',
  'updateMany',
  'updateManyAndReturn',
  'upsert',
  'delete',
  'deleteMany',
] as const

/** The ONE Page route configuration both transports share. */
const pageConfig = (transport: string) => {
  const ops: Record<string, unknown> = {}
  for (const op of PAGE_OPS) {
    ops[op] = {
      variants: Object.fromEntries(
        TENANTS.map((t) => [t, { shape: tenantPageShapes(t)[op] }]),
      ),
      // update carries an operation override on BOTH transports: the
      // override/context parity gate
      ...(op === 'update'
        ? {
            override: async (o: {
              input: unknown
              context: unknown
              core: () => Promise<unknown>
            }) => {
              overrideCalls.push({
                transport,
                input: o.input,
                context: o.context,
              })
              return o.core()
            },
          }
        : {}),
    }
  }
  return {
    addModelPrefix: false,
    disableOpenApi: true,
    queryBuilder: false,
    guard: { variantHeader: 'x-api-variant' },
    resolveContext: (req: express.Request) => ({
      tenant: req.header('x-api-variant'),
    }),
    ...ops,
  }
}

/** Verified principals the MCP test auth accepts (header x-principal). */
const PRINCIPAL_CALLERS: Record<string, string> = {
  'tenant-a': 'tenant-a',
  'tenant-b': 'tenant-b',
  // routed like tenant-a but denied every write by `authorize`
  'tenant-a-readonly': 'tenant-a',
}

type Loaded = {
  restApp: express.Express
  mcpApp: express.Express
  prisma: {
    $disconnect: () => Promise<void>
    ticket: Record<string, unknown>
    page: Record<string, unknown>
  }
}

let loaded: Loaded | undefined
let restPort = 0
let mcpPort = 0
const servers: Server[] = []

async function dynamicImport<T>(modulePath: string): Promise<T> {
  return importFrom<T>(WORK_DIR, modulePath)
}

beforeAll(async () => {
  // the PrismaClient below reads the URL from the environment, like the CLI
  process.env.DATABASE_URL = DATABASE_URL
  // 1. generate with the article-verified prisma 6 + prisma-guard 1.33
  // environment and THIS worktree's generator build
  const { schemaPath: SCHEMA_PATH, env } = await generateWithArticleGuard({
    workDir: WORK_DIR,
    schemaDirName: 'parity',
    schema: SCHEMA,
    databaseUrl: DATABASE_URL,
    label: 'parity',
  })
  execFileSync(
    process.execPath,
    [
      PRISMA_BIN,
      'db',
      'push',
      '--schema',
      SCHEMA_PATH,
      '--skip-generate',
      '--accept-data-loss',
    ],
    { cwd: ARTICLE_GUARD_DIR, env, stdio: 'pipe' },
  )

  // 2. seed
  const { PrismaClient } = (await import(
    pathToFileURL(
      resolve(ARTICLE_GUARD_DIR, 'node_modules/@prisma/client/index.js'),
    ).href
  )) as typeof import('@prisma/client')
  const guardMod = await dynamicImport<{
    guard: {
      extension: () => unknown
    }
  }>('guard/client')
  // env DATABASE_URL is already set for the spawned CLI; the client picks it
  // up from process.env the same way
  const base = new PrismaClient()
  const prisma = (
    base as unknown as { $extends: (e: unknown) => unknown }
  ).$extends(
    (guardMod.guard as unknown as { extension: () => unknown }).extension(),
  ) as Loaded['prisma']
  const deleteMany = prisma.ticket.deleteMany as () => Promise<unknown>
  const create = prisma.ticket.create as (args: {
    data: { title: string; siteId: string; hidden: boolean }
  }) => Promise<unknown>
  await deleteMany()
  await create({ data: { title: 'a-1', siteId: 'tenant-a', hidden: false } })
  await create({ data: { title: 'a-2', siteId: 'tenant-a', hidden: false } })
  await create({ data: { title: 'b-1', siteId: 'tenant-b', hidden: false } })

  // 3. REST app from the EMITTED router
  const routerMod = await dynamicImport<{
    TicketRouter: (config: unknown) => express.RequestHandler
  }>('api/Ticket/TicketRouter')
  const pageRouterMod = await dynamicImport<{
    PageRouter: (config: unknown) => express.RequestHandler
  }>('api/Page/PageRouter')
  const restApp = express()
  restApp.use(express.json())
  restApp.use((req, _res, next) => {
    ;(req as unknown as { prisma: unknown }).prisma = prisma
    next()
  })
  restApp.use('/pages', pageRouterMod.PageRouter(pageConfig('rest')))
  restApp.use(routerMod.TicketRouter(routeConfig()))

  // 4. MCP app: the emitted registry + mount glue equivalents
  type Factory = (options: { config: unknown }) => unknown
  const mcpMod = await dynamicImport<{ ticketFindManyTool: Factory }>(
    'api/Ticket/TicketMcp',
  )
  const pageMcpMod =
    await dynamicImport<Record<string, Factory>>('api/Page/PageMcp')
  const mcpRuntimeMod = await dynamicImport<{
    registerMcpTools: (
      server: McpServer,
      options: Record<string, unknown>,
    ) => void
    McpAuthorizationError: new (message: string) => Error
  }>('api/mcpRuntime')
  const { registerMcpTools, McpAuthorizationError } = mcpRuntimeMod
  const resolveCaller = (info: AuthInfo) => PRINCIPAL_CALLERS[info?.clientId]
  const handler = createMcpHandler((ctx) => {
    const server = new McpServer({ name: 'parity-api', version: '1.0.0' })
    const pageTools = PAGE_OPS.map((op) => {
      const factory =
        pageMcpMod['page' + op.charAt(0).toUpperCase() + op.slice(1) + 'Tool']
      if (!factory) throw new Error('missing emitted factory for ' + op)
      return factory({ config: pageConfig('mcp') })
    })
    registerMcpTools(server, {
      prisma,
      resolveCaller,
      authorize: ({
        principal,
        operation,
      }: {
        principal: AuthInfo
        operation: string
      }) => {
        if (
          principal.clientId === 'tenant-a-readonly' &&
          !operation.startsWith('find')
        ) {
          throw new McpAuthorizationError('read-only principal: writes denied')
        }
      },
      resolveContext: (info: AuthInfo) => ({ tenant: resolveCaller(info) }),
      defaultLimit: 5,
      maxLimit: 25,
      maxResultBytes: 1_000_000,
      authInfo: ctx.authInfo,
      tools: [
        mcpMod.ticketFindManyTool({ config: routeConfig() }),
        ...pageTools,
      ],
    })
    return server
  })
  const node = toNodeHandler(handler)
  const mcpApp = express()
  mcpApp.use(express.json())
  mcpApp.use((req, _res, next) => {
    const principal = req.header('x-principal') ?? 'tenant-a'
    ;(req as unknown as { auth: AuthInfo }).auth = {
      ...authInfo,
      clientId: principal,
    }
    next()
  })
  mcpApp.all('/mcp', (req, res) => void node(req, res, req.body))

  loaded = { restApp, mcpApp, prisma }

  for (const [app, setter] of [
    [restApp, (p: number) => (restPort = p)],
    [mcpApp, (p: number) => (mcpPort = p)],
  ] as const) {
    const server = createServer(app)
    servers.push(server)
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
    setter((server.address() as AddressInfo).port)
  }
}, 300_000)

afterAll(async () => {
  await Promise.all(
    servers.map((s) => new Promise<void>((r) => s.close(() => r()))),
  )
  await loaded?.prisma.$disconnect()
  if (!process.env.PARITY_KEEP_WORK_DIR) {
    await rm(WORK_DIR, { recursive: true, force: true })
  }
})

async function restFindMany(
  query: string,
): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`http://127.0.0.1:${restPort}/${query}`, {
    headers: { 'x-api-variant': 'tenant-a' },
  })
  return { status: res.status, body: await res.json() }
}

async function restPage(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  tenant: string,
  body?: unknown,
): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`http://127.0.0.1:${restPort}/pages${path}`, {
    method,
    headers: {
      'x-api-variant': tenant,
      'content-type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  return { status: res.status, body: text ? JSON.parse(text) : undefined }
}

async function withClient<T>(
  principal: string,
  fn: (client: Client) => Promise<T>,
): Promise<T> {
  const client = new Client({ name: 'parity-client', version: '1.0.0' })
  const transport = new StreamableHTTPClientTransport(
    new URL(`http://127.0.0.1:${mcpPort}/mcp`),
    { requestInit: { headers: { 'x-principal': principal } } },
  )
  await client.connect(transport)
  try {
    return await fn(client)
  } finally {
    await client.close()
  }
}

async function mcpCall(
  name: string,
  args: Record<string, unknown>,
  principal = 'tenant-a',
): Promise<{
  isError?: boolean
  text: string
}> {
  return withClient(principal, async (client) => {
    const result = await client.callTool({ name, arguments: args })
    const block = (result.content as Array<{ type: string; text?: string }>)[0]
    return { isError: result.isError === true, text: block?.text ?? '' }
  })
}

async function mcpFindMany(args: Record<string, unknown>): Promise<{
  isError?: boolean
  text: string
}> {
  return mcpCall('ticket_find_many', args)
}

async function mcpListTools(
  principal = 'tenant-a',
): Promise<Array<Record<string, unknown>>> {
  return withClient(principal, async (client) => {
    const listed = await client.listTools()
    return listed.tools as unknown as Array<Record<string, unknown>>
  })
}

describe('REST vs MCP parity on Postgres, guard active', () => {
  it('returns the same rows under the same forced tenant scope', async () => {
    const rest = await restFindMany('?take=10')
    expect(rest.status).toBe(200)
    const restRows = rest.body as Array<{ title: string; siteId: string }>
    expect(restRows.map((r) => r.title)).toEqual(['a-1', 'a-2'])

    const mcp = await mcpFindMany({ take: 10 })
    expect(mcp.isError).toBeFalsy()
    expect(JSON.parse(mcp.text).map((r: { title: string }) => r.title)).toEqual(
      ['a-1', 'a-2'],
    )
  })

  it('enforces the same guard take bound (shape take.max wins over REST-less pagination)', async () => {
    // MCP with take above shape max: pre-guard clamp to maxLimit 25 passes the
    // registration contract, then prisma-guard REJECTS above shape max (verified
    // upstream behaviour: reject, not clamp) — REST hits the same wall.
    const rest = await restFindMany('?take=100')
    expect(rest.status).toBe(400)

    const mcp = await mcpFindMany({ take: 100 })
    expect(mcp.isError).toBe(true)
    // rejection happens at the narrowed tool schema (SDK-level validation) or,
    // if a transport let it through, as our classified 400
    const parsed = (() => {
      try {
        return JSON.parse(mcp.text) as { status?: number }
      } catch {
        return null
      }
    })()
    expect(parsed === null || parsed.status === 400).toBe(true)
  })

  it('applies the same pagination default when take is omitted', async () => {
    // REST has no pagination config: unbounded take stays undefined for Prisma;
    // MCP injects defaultLimit — parity is over the RETURNED ROWS under the
    // same forced scope, which both bound identically here (2 rows)
    const rest = await restFindMany('')
    expect(rest.status).toBe(200)

    const mcp = await mcpFindMany({})
    expect(mcp.isError).toBeFalsy()
    const mcpRows = JSON.parse(mcp.text) as Array<{ title: string }>
    expect(mcpRows.map((r) => r.title)).toEqual(
      (rest.body as Array<{ title: string }>).map((r) => r.title),
    )
  })

  it('classifies an unknown query field identically (400 both)', async () => {
    const rest = await restFindMany(
      '?where=' + encodeURIComponent('{"nope":1}'),
    )
    expect(rest.status).toBe(400)

    const mcp = await mcpFindMany({ where: { nope: 1 } })
    expect(mcp.isError).toBe(true)
    // the closed, model-aware schema rejects the undeclared field in the SDK
    // layer ("Input validation..."); the classification matches REST's 400
    expect(mcp.text.startsWith('Input validation')).toBe(true)
  })

  it('the variant key resolves the same way from header (REST) and AuthInfo (MCP)', async () => {
    // wrong caller on REST: 400 unknown-caller
    const res = await fetch(`http://127.0.0.1:${restPort}/?take=1`, {
      headers: { 'x-api-variant': 'tenant-zz' },
    })
    expect(res.status).toBe(400)

    // an unknown principal routes to NO variant: zero tools (fail closed)
    expect(await mcpListTools('tenant-zz')).toEqual([])
    // tenant-a: the Ticket read tool plus every Page tool
    const names = (await mcpListTools('tenant-a')).map((t) => t.name)
    expect(names).toEqual([
      'ticket_find_many',
      'page_find_many',
      'page_create',
      'page_create_many',
      'page_create_many_and_return',
      'page_update',
      'page_update_many',
      'page_update_many_and_return',
      'page_upsert',
      'page_delete',
      'page_delete_many',
    ])
    // tenant-b has no Ticket variant, so only its Page tools register
    expect((await mcpListTools('tenant-b')).map((t) => t.name)).toEqual(
      names.filter((n) => n !== 'ticket_find_many'),
    )
  })
})

type PageRow = {
  id: string
  siteId: string
  slug: string
  title: string
  published: boolean
  views: bigint | null
}

type PageDelegate = {
  deleteMany: () => Promise<unknown>
  create: (a: { data: Record<string, unknown> }) => Promise<PageRow>
  findMany: (a?: unknown) => Promise<PageRow[]>
  count: (a?: unknown) => Promise<number>
}

function pageDelegate(): PageDelegate {
  if (!loaded) throw new Error('parity stack not loaded')
  return loaded.prisma.page as unknown as PageDelegate
}

/** Every row, ordered — the zero-write / isolation gates compare snapshots. */
const snapshot = () =>
  pageDelegate().findMany({ orderBy: [{ siteId: 'asc' }, { slug: 'asc' }] })

async function seedPages(): Promise<{ a: PageRow; b: PageRow }> {
  const a = await pageDelegate().create({
    data: { siteId: 'tenant-a', slug: 'home', title: 'A home' },
  })
  const b = await pageDelegate().create({
    data: { siteId: 'tenant-b', slug: 'home', title: 'B home' },
  })
  return { a, b }
}

const json = (r: { text: string }) =>
  JSON.parse(r.text) as Record<string, unknown>

describe('Page writes: REST vs MCP parity on Postgres, guard active', () => {
  beforeEach(async () => {
    await pageDelegate().deleteMany()
    overrideCalls.length = 0
  })

  it('create: the agent creates a Page; forced siteId merged server-side on both transports', async () => {
    const rest = await restPage('POST', '/', 'tenant-a', {
      data: { slug: 'about', title: 'About (REST)' },
    })
    expect(rest.status).toBe(201)
    expect(rest.body).toMatchObject({ siteId: 'tenant-a', slug: 'about' })

    const mcp = await mcpCall('page_create', {
      data: { slug: 'contact', title: 'Contact (MCP)' },
    })
    expect(mcp.isError).toBeFalsy()
    expect(json(mcp)).toMatchObject({ siteId: 'tenant-a', slug: 'contact' })

    // a client-sent tenant is refused on both: guard strict data (REST 400),
    // closed tool schema (MCP)
    const restEvil = await restPage('POST', '/', 'tenant-a', {
      data: { slug: 'x', title: 'x', siteId: 'tenant-b' },
    })
    expect(restEvil.status).toBe(400)
    const mcpEvil = await mcpCall('page_create', {
      data: { slug: 'x', title: 'x', siteId: 'tenant-b' },
    })
    expect(mcpEvil.isError).toBe(true)
    expect(await pageDelegate().count({ where: { siteId: 'tenant-b' } })).toBe(
      0,
    )
  })

  it('create conflict classifies identically (compound unique -> 409 both)', async () => {
    await seedPages()
    const rest = await restPage('POST', '/', 'tenant-a', {
      data: { slug: 'home', title: 'dup' },
    })
    expect(rest.status).toBe(409)
    const mcp = await mcpCall('page_create', {
      data: { slug: 'home', title: 'dup' },
    })
    expect(mcp.isError).toBe(true)
    expect(json(mcp).status).toBe(409)
  })

  it('createMany and createManyAndReturn: same counts and projections, all tenant-forced', async () => {
    const rest = await restPage('POST', '/many', 'tenant-a', {
      data: [
        { slug: 'r1', title: 'r1' },
        { slug: 'r2', title: 'r2' },
      ],
    })
    expect(rest.status).toBe(201)
    expect(rest.body).toEqual({ count: 2 })
    const mcp = await mcpCall('page_create_many', {
      data: [
        { slug: 'm1', title: 'm1' },
        { slug: 'm2', title: 'm2' },
      ],
    })
    expect(mcp.isError).toBeFalsy()
    expect(json(mcp)).toEqual({ count: 2 })

    // the shape configures a projection; the body selects within it
    const restRet = await restPage('POST', '/many/return', 'tenant-a', {
      data: [{ slug: 'r3', title: 'r3' }],
      select: { slug: true, siteId: true },
    })
    expect(restRet.status).toBe(201)
    const mcpRet = await mcpCall('page_create_many_and_return', {
      data: [{ slug: 'm3', title: 'm3' }],
      select: { slug: true, siteId: true },
    })
    expect(mcpRet.isError).toBeFalsy()
    expect(restRet.body).toEqual([{ slug: 'r3', siteId: 'tenant-a' }])
    expect(JSON.parse(mcpRet.text)).toEqual([
      { slug: 'm3', siteId: 'tenant-a' },
    ])
    expect(await pageDelegate().count({ where: { siteId: 'tenant-a' } })).toBe(
      6,
    )
  })

  it('update by id: identical body gives an identical result and identical override input/context on both transports', async () => {
    const { a } = await seedPages()
    const body = { where: { id: a.id }, data: { title: 'A v2', views: '42' } }
    const rest = await restPage('PUT', '/', 'tenant-a', body)
    expect(rest.status).toBe(200)
    expect(rest.body).toMatchObject({ id: a.id, title: 'A v2', views: '42' })

    const mcp = await mcpCall('page_update', body)
    expect(mcp.isError).toBeFalsy()
    // same row, same data applied twice: the returned records are equal
    expect(json(mcp)).toEqual(rest.body)

    // optional BigInt accepts null on the MCP surface too
    const cleared = await mcpCall('page_update', {
      where: { id: a.id },
      data: { views: null },
    })
    expect(json(cleared)).toMatchObject({ id: a.id, views: null })

    // the operation override ran per call with the same input and the same
    // resolved application context
    expect(overrideCalls.map((c) => c.transport)).toEqual([
      'rest',
      'mcp',
      'mcp',
    ])
    expect(overrideCalls[0]?.input).toEqual(overrideCalls[1]?.input)
    expect(overrideCalls[0]?.context).toEqual({ tenant: 'tenant-a' })
    expect(overrideCalls[1]?.context).toEqual(overrideCalls[0]?.context)
  })

  it('updateMany / updateManyAndReturn touch only the caller tenant', async () => {
    await seedPages()
    const rest = await restPage('PUT', '/many', 'tenant-a', {
      where: { slug: { startsWith: 'h' } },
      data: { published: true },
    })
    expect(rest.status).toBe(200)
    expect(rest.body).toEqual({ count: 1 })

    const mcp = await mcpCall(
      'page_update_many',
      { where: { slug: { startsWith: 'h' } }, data: { published: true } },
      'tenant-b',
    )
    expect(mcp.isError).toBeFalsy()
    expect(json(mcp)).toEqual({ count: 1 })

    // updateManyAndReturn on BOTH transports: same projection, same rows,
    // each scoped to its caller's tenant
    const select = { siteId: true, published: true }
    const restRet = await restPage('PUT', '/many/return', 'tenant-a', {
      where: {},
      data: { published: false },
      select,
    })
    expect(restRet.status).toBe(200)
    expect(restRet.body).toEqual([{ siteId: 'tenant-a', published: false }])
    const ret = await mcpCall(
      'page_update_many_and_return',
      { where: {}, data: { published: false }, select },
      'tenant-b',
    )
    expect(ret.isError).toBeFalsy()
    expect(JSON.parse(ret.text)).toEqual([
      { siteId: 'tenant-b', published: false },
    ])
    const rows = await snapshot()
    expect(rows.map((r) => [r.siteId, r.published])).toEqual([
      ['tenant-a', false],
      ['tenant-b', false],
    ])
  })

  it('upsert: update path and create path; the compound selector keeps tenants apart', async () => {
    await seedPages()
    const restUpd = await restPage('PATCH', '/', 'tenant-a', {
      where: { siteId_slug: { slug: 'home' } },
      create: { slug: 'home', title: 'ignored' },
      update: { title: 'A home v2' },
    })
    expect(restUpd.status).toBe(200)
    expect(restUpd.body).toMatchObject({
      siteId: 'tenant-a',
      title: 'A home v2',
    })

    const mcpUpd = await mcpCall(
      'page_upsert',
      {
        where: { siteId_slug: { slug: 'home' } },
        create: { slug: 'home', title: 'ignored' },
        update: { title: 'B home v2' },
      },
      'tenant-b',
    )
    expect(mcpUpd.isError).toBeFalsy()
    expect(json(mcpUpd)).toMatchObject({
      siteId: 'tenant-b',
      title: 'B home v2',
    })

    const mcpIns = await mcpCall('page_upsert', {
      where: { siteId_slug: { slug: 'blog' } },
      create: { slug: 'blog', title: 'Blog' },
      update: { title: 'ignored' },
    })
    expect(mcpIns.isError).toBeFalsy()
    expect(json(mcpIns)).toMatchObject({ siteId: 'tenant-a', slug: 'blog' })

    const rows = await snapshot()
    expect(rows.map((r) => [r.siteId, r.slug, r.title])).toEqual([
      ['tenant-a', 'blog', 'Blog'],
      ['tenant-a', 'home', 'A home v2'],
      ['tenant-b', 'home', 'B home v2'],
    ])
  })

  it('delete and deleteMany: same result, 404 parity, only the caller tenant', async () => {
    const { a, b } = await seedPages()
    const rest = await restPage('DELETE', '/', 'tenant-a', {
      where: { id: a.id },
    })
    expect(rest.status).toBe(200)
    expect(rest.body).toMatchObject({ id: a.id })
    const restAgain = await restPage('DELETE', '/', 'tenant-a', {
      where: { id: a.id },
    })
    expect(restAgain.status).toBe(404)

    const mcp = await mcpCall(
      'page_delete',
      { where: { id: b.id } },
      'tenant-b',
    )
    expect(mcp.isError).toBeFalsy()
    expect(json(mcp)).toMatchObject({ id: b.id })
    const mcpAgain = await mcpCall(
      'page_delete',
      { where: { id: b.id } },
      'tenant-b',
    )
    expect(mcpAgain.isError).toBe(true)
    expect(json(mcpAgain).status).toBe(404)

    // deleteMany on BOTH transports, each tenant-scoped
    await seedPages()
    const restMany = await restPage('DELETE', '/many', 'tenant-a', {
      where: { slug: { startsWith: '' } },
    })
    expect(restMany.status).toBe(200)
    expect(restMany.body).toEqual({ count: 1 })
    expect((await snapshot()).map((r) => r.siteId)).toEqual(['tenant-b'])
    const many = await mcpCall(
      'page_delete_many',
      { where: { slug: { startsWith: '' } } },
      'tenant-b',
    )
    expect(many.isError).toBeFalsy()
    expect(json(many)).toEqual({ count: 1 })
    expect(await snapshot()).toEqual([])

    // a whole-tenant bulk delete by omission is refused: the shape has a
    // client filter, so MCP demands a client condition (REST would merge
    // the forced tenant into {} and delete every tenant row)
    await seedPages()
    const omitted = await mcpCall('page_delete_many', { where: {} }, 'tenant-b')
    expect(omitted.isError).toBe(true)
    expect(await pageDelegate().count({ where: { siteId: 'tenant-b' } })).toBe(
      1,
    )
  })
})

describe('Page writes: cross-tenant attacks change nothing', () => {
  beforeEach(async () => {
    await pageDelegate().deleteMany()
  })

  it('tenant-b cannot update or delete a tenant-a page by id (404 on both transports)', async () => {
    const { a } = await seedPages()
    const before = await snapshot()

    const restUpd = await restPage('PUT', '/', 'tenant-b', {
      where: { id: a.id },
      data: { title: 'pwned' },
    })
    expect(restUpd.status).toBe(404)
    const mcpUpd = await mcpCall(
      'page_update',
      { where: { id: a.id }, data: { title: 'pwned' } },
      'tenant-b',
    )
    expect(mcpUpd.isError).toBe(true)
    expect(json(mcpUpd).status).toBe(404)

    const restDel = await restPage('DELETE', '/', 'tenant-b', {
      where: { id: a.id },
    })
    expect(restDel.status).toBe(404)
    const mcpDel = await mcpCall(
      'page_delete',
      { where: { id: a.id } },
      'tenant-b',
    )
    expect(mcpDel.isError).toBe(true)
    expect(json(mcpDel).status).toBe(404)

    // a client-sent siteId is not an input at all
    const mcpSpoof = await mcpCall(
      'page_update',
      { where: { id: a.id, siteId: 'tenant-a' }, data: { title: 'pwned' } },
      'tenant-b',
    )
    expect(mcpSpoof.isError).toBe(true)

    expect(await snapshot()).toEqual(before)
  })

  it('tenant-b bulk writes and upserts never reach tenant-a rows', async () => {
    await seedPages()
    const tenantARows = async () =>
      (await snapshot()).filter((r) => r.siteId === 'tenant-a')
    const before = await tenantARows()

    for (const [name, args] of [
      [
        'page_update_many',
        { where: { slug: { startsWith: '' } }, data: { published: true } },
      ],
      ['page_update_many_and_return', { where: {}, data: { published: true } }],
      [
        'page_upsert',
        {
          where: { siteId_slug: { slug: 'home' } },
          create: { slug: 'home', title: 'x' },
          update: { title: 'pwned' },
        },
      ],
      ['page_delete_many', { where: { slug: { startsWith: '' } } }],
    ] as const) {
      const result = await mcpCall(name, args, 'tenant-b')
      expect(result.isError, name).toBeFalsy()
    }
    expect(await tenantARows()).toEqual(before)
  })
})

describe('Page writes: authorization denial performs zero writes', () => {
  beforeEach(async () => {
    await pageDelegate().deleteMany()
  })

  it('a principal denied by authorize gets isError and the database is unchanged', async () => {
    const { a } = await seedPages()
    const before = await snapshot()
    const principal = 'tenant-a-readonly'

    const calls: Array<[string, Record<string, unknown>]> = [
      ['page_create', { data: { slug: 'new', title: 'new' } }],
      ['page_create_many', { data: [{ slug: 'n1', title: 'n1' }] }],
      ['page_create_many_and_return', { data: [{ slug: 'n2', title: 'n2' }] }],
      ['page_update', { where: { id: a.id }, data: { title: 'pwned' } }],
      [
        'page_update_many',
        { where: { slug: { startsWith: '' } }, data: { published: true } },
      ],
      ['page_update_many_and_return', { where: {}, data: { published: true } }],
      [
        'page_upsert',
        {
          where: { siteId_slug: { slug: 'home' } },
          create: { slug: 'home', title: 'x' },
          update: { title: 'pwned' },
        },
      ],
      ['page_delete', { where: { id: a.id } }],
      ['page_delete_many', { where: { slug: { startsWith: '' } } }],
    ]
    for (const [name, args] of calls) {
      const result = await mcpCall(name, args, principal)
      expect(result.isError, name).toBe(true)
      expect(json(result).message, name).toBe(
        'read-only principal: writes denied',
      )
    }
    expect(await snapshot()).toEqual(before)

    // reads stay allowed for the same principal
    const read = await mcpCall('page_find_many', {}, principal)
    expect(read.isError).toBeFalsy()
  })

  it('annotations ride on the wire exactly as the metadata states, for every Page tool', async () => {
    const tools = await mcpListTools('tenant-a')
    const hints = Object.fromEntries(tools.map((t) => [t.name, t.annotations]))
    const h = (
      readOnly: boolean,
      destructive: boolean,
      idempotent: boolean,
    ) => ({
      readOnlyHint: readOnly,
      destructiveHint: destructive,
      idempotentHint: idempotent,
      openWorldHint: false,
    })
    expect(hints).toEqual({
      ticket_find_many: h(true, false, true),
      page_find_many: h(true, false, true),
      page_create: h(false, false, false),
      page_create_many: h(false, false, false),
      page_create_many_and_return: h(false, false, false),
      page_update: h(false, true, false),
      page_update_many: h(false, true, false),
      page_update_many_and_return: h(false, true, false),
      page_upsert: h(false, true, true),
      page_delete: h(false, true, true),
      page_delete_many: h(false, true, true),
    })
  })
})
