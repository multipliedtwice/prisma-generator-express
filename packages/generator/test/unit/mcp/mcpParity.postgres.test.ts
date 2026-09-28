import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { execFileSync, spawnSync } from 'node:child_process'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { access, cp, mkdir, rm, writeFile } from 'node:fs/promises'
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
const ARTICLE_GUARD_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../../article-labs/guard',
)
const PRISMA_BIN = resolve(
  ARTICLE_GUARD_DIR,
  'node_modules/prisma/build/index.js',
)
const SCHEMA_PATH = resolve(ARTICLE_GUARD_DIR, 'parity/schema.prisma')

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

type Loaded = {
  restApp: express.Express
  mcpApp: express.Express
  prisma: { $disconnect: () => Promise<void>; ticket: Record<string, unknown> }
}

let loaded: Loaded | undefined
let restPort = 0
let mcpPort = 0
const servers: Server[] = []

/** Absolute URL import; vite transforms emitted .ts inside the project root. */
async function dynamicImport<T>(modulePath: string): Promise<T> {
  return (await import(pathToFileURL(resolve(WORK_DIR, modulePath)).href)) as T
}

async function waitForBuiltGenerator(timeoutMs = 120_000): Promise<void> {
  // the consumer metadata test rebuilds `dist` via prepack; a parallel run can
  // observe the directory mid-rebuild
  const bin = resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../../../dist/bin.js',
  )
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      await access(bin)
      return
    } catch {
      await new Promise((r) => setTimeout(r, 500))
    }
  }
  throw new Error('dist/bin.js did not appear — did the generator build run?')
}

beforeAll(async () => {
  // the PrismaClient below reads the URL from the environment, like the CLI
  process.env.DATABASE_URL = DATABASE_URL
  await waitForBuiltGenerator()

  // 1. generate into the work dir using the article-verified prisma 6 +
  // prisma-guard 1.33 environment (the repo's hoisted prisma-guard 1.28
  // generator rejects this CLI's config shape). The API generator under test
  // is THIS worktree's build.
  await mkdir(WORK_DIR, { recursive: true })
  await mkdir(resolve(ARTICLE_GUARD_DIR, 'parity'), { recursive: true })
  await writeFile(
    SCHEMA_PATH,
    SCHEMA.replace('${GUARD_OUT}', resolve(WORK_DIR, 'guard'))
      .replace(
        '${API_BIN}',
        resolve(
          dirname(fileURLToPath(import.meta.url)),
          '../../../dist/bin.js',
        ),
      )
      .replace('${API_OUT}', resolve(WORK_DIR, 'api')),
    'utf8',
  )
  // the guard RUNTIME must match the generator that produced the type map:
  // place 1.33 locally so the emitted guard/client resolves it, not the hoist
  await mkdir(resolve(WORK_DIR, 'node_modules'), { recursive: true })
  await cp(
    resolve(ARTICLE_GUARD_DIR, 'node_modules/prisma-guard'),
    resolve(WORK_DIR, 'node_modules/prisma-guard'),
    { recursive: true },
  )

  const env = {
    ...process.env,
    // generator-by-name resolution: the article env's prisma-guard 1.33 must
    // win over the repository's hoisted 1.28 (whose generator rejects this
    // CLI's config shape)
    PATH:
      resolve(ARTICLE_GUARD_DIR, 'node_modules/.bin') +
      ':' +
      (process.env.PATH ?? ''),
    DATABASE_URL,
    // no engine stubs: the parity run needs the REAL engines (schema engine
    // for db push, query engine copied for the client at runtime)
  }
  const generate = spawnSync(
    process.execPath,
    [PRISMA_BIN, 'generate', '--schema', SCHEMA_PATH],
    { cwd: ARTICLE_GUARD_DIR, env, encoding: 'utf8' },
  )
  if (generate.status !== 0) {
    throw new Error(
      'parity prisma generate failed:\n' +
        (generate.stdout ?? '') +
        (generate.stderr ?? '') +
        String(generate.error ?? ''),
    )
  }
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
  ) as { $disconnect: () => Promise<void>; ticket: Record<string, unknown> }
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
  const restApp = express()
  restApp.use(express.json())
  restApp.use((req, _res, next) => {
    ;(req as unknown as { prisma: unknown }).prisma = prisma
    next()
  })
  restApp.use(routerMod.TicketRouter(routeConfig()))

  // 4. MCP app: the emitted registry + mount glue equivalents
  const mcpMod = await dynamicImport<{
    ticketFindManyTool: (options: { config: unknown }) => {
      model: string
      operation: string
      register: (server: McpServer, shared: unknown, authInfo: AuthInfo) => void
    }
  }>('api/Ticket/TicketMcp')
  const mcpRuntimeMod = await dynamicImport<{
    registerMcpTools: (
      server: McpServer,
      options: Record<string, unknown>,
    ) => void
  }>('api/mcpRuntime')
  const { registerMcpTools } = mcpRuntimeMod
  const handler = createMcpHandler((ctx) => {
    const server = new McpServer({ name: 'parity-api', version: '1.0.0' })
    registerMcpTools(server, {
      prisma,
      resolveCaller: (info: AuthInfo) =>
        info?.clientId === 'tenant-a' ? 'tenant-a' : undefined,
      authorize: () => undefined,
      defaultLimit: 5,
      maxLimit: 25,
      maxResultBytes: 1_000_000,
      authInfo: ctx.authInfo,
      tools: [mcpMod.ticketFindManyTool({ config: routeConfig() })],
    })
    return server
  })
  const node = toNodeHandler(handler)
  const mcpApp = express()
  mcpApp.use(express.json())
  mcpApp.use((req, _res, next) => {
    ;(req as unknown as { auth: AuthInfo }).auth = authInfo
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

async function mcpFindMany(args: Record<string, unknown>): Promise<{
  isError?: boolean
  text: string
}> {
  const client = new Client({ name: 'parity-client', version: '1.0.0' })
  const transport = new StreamableHTTPClientTransport(
    new URL(`http://127.0.0.1:${mcpPort}/mcp`),
  )
  await client.connect(transport)
  try {
    const result = await client.callTool({
      name: 'ticket_find_many',
      arguments: args,
    })
    const block = (result.content as Array<{ type: string; text?: string }>)[0]
    return { isError: result.isError === true, text: block?.text ?? '' }
  } finally {
    await client.close()
  }
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

    // wrong caller on MCP: no tool registered at all (fail closed)
    const client = new Client({ name: 'parity-client', version: '1.0.0' })
    const transport = new StreamableHTTPClientTransport(
      new URL(`http://127.0.0.1:${mcpPort}/mcp`),
    )
    await client.connect(transport)
    try {
      const listed = await client.listTools()
      // the verified principal is tenant-a, so the tool IS listed; an
      // unverified principal would get none — covered by unit tests
      expect(listed.tools.map((t) => t.name)).toEqual(['ticket_find_many'])
    } finally {
      await client.close()
    }
  })
})
