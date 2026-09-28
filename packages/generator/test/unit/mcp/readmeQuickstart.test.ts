import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import express from 'express'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { Client } from '@modelcontextprotocol/client'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/client'
import { McpServer, type AuthInfo } from '@modelcontextprotocol/server'
import { chmodSync } from 'node:fs'
import { execFileSync, spawnSync } from 'node:child_process'
import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

/**
 * The README MCP quickstart, executed against the REAL stack: prisma 6 +
 * prisma-guard 1.33 (the article-labs/guard environment), a generated guard
 * client with `guard.extension()`, a real Postgres, the emitted express API
 * with `mcp = true`, `requireBearerAuth`-verified requests, and the official
 * SDK client. The snippet in README.md mirrors this test.
 */

const DATABASE_URL =
  process.env.PARITY_DATABASE_URL ??
  'postgresql://postgres:parity@127.0.0.1:55433/parity'

const TSC = resolve(
  __dirname,
  '../../../../../node_modules/typescript/lib/tsc.js',
)
const WORK = resolve(__dirname, '../../../.readme-qs')
const ARTICLE_GUARD_DIR = resolve(process.cwd(), '../../article-labs/guard')
const PRISMA_BIN = resolve(
  ARTICLE_GUARD_DIR,
  'node_modules/prisma/build/index.js',
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

model User {
  id     String @id @default(cuid())
  email  String @unique
  siteId String
  posts  Post[]
}

model Post {
  id       String @id @default(cuid())
  title    String
  author   User   @relation(fields: [authorId], references: [id])
  authorId String
}
`

// exactly the README's route config: guard shapes with a FORCED tenant,
// including the opt-in tenant-forced create + update write tools
const userConfig = (force: (v: string) => unknown) => ({
  addModelPrefix: false,
  disableOpenApi: true,
  findMany: {
    shape: {
      where: { siteId: { equals: force('tenant-a') } },
      take: { max: 50 },
    },
  },
  create: {
    shape: { data: { email: true, siteId: force('tenant-a') } },
  },
  update: {
    shape: {
      where: { id: true, siteId: force('tenant-a') },
      data: { email: true },
    },
  },
})

const servers: Server[] = []
const disconnects: Array<() => Promise<void>> = []
let port = 0
let otherTenantUserId = ''
type UserRow = { id: string; email: string; siteId: string }
let findUsers: (() => Promise<UserRow[]>) | undefined

/**
 * Self-contained: a plain `npx vitest` on a clean checkout has no dist/, so
 * compile the generator (tsc emit + bin chmod — the same steps `yarn build`
 * runs) before the fixture spawns it.
 */
function buildGenerator(): void {
  const generatorDir = process.cwd()
  execFileSync(process.execPath, [TSC, '-p', generatorDir], { stdio: 'pipe' })
  chmodSync(resolve(generatorDir, 'dist/bin.js'), 0o755)
}

beforeAll(async () => {
  buildGenerator()
  process.env.DATABASE_URL = DATABASE_URL

  await mkdir(WORK, { recursive: true })
  // the guard RUNTIME (1.33, matching the generator) plus zod and the prisma
  // client, resolvable from the work dir
  await mkdir(resolve(WORK, 'node_modules'), { recursive: true })
  await cp(
    resolve(ARTICLE_GUARD_DIR, 'node_modules/prisma-guard'),
    resolve(WORK, 'node_modules/prisma-guard'),
    {
      recursive: true,
    },
  )
  await cp(
    resolve(ARTICLE_GUARD_DIR, 'node_modules/zod'),
    resolve(WORK, 'node_modules/zod'),
    {
      recursive: true,
    },
  )
  await cp(
    resolve(ARTICLE_GUARD_DIR, 'node_modules/@prisma'),
    resolve(WORK, 'node_modules/@prisma'),
    {
      recursive: true,
    },
  )

  const env = {
    ...process.env,
    DATABASE_URL,
    // generator-by-name resolution: the article env's prisma-guard 1.33 must
    // win over the repository's hoisted 1.28
    PATH:
      resolve(ARTICLE_GUARD_DIR, 'node_modules/.bin') +
      ':' +
      (process.env.PATH ?? ''),
  }
  // schema lives under the ARTICLE env (prisma-guard resolves the prisma
  // client runtime against ITS node_modules); outputs are ABSOLUTE so the
  // generated guard client and API land in the work dir. The repo root is
  // never touched — the earlier run proved prisma walks up into the repo
  // workspace when the schema sits under packages/.
  const qsDir = resolve(ARTICLE_GUARD_DIR, 'readme-qs')
  await mkdir(qsDir, { recursive: true })
  const schemaPath = resolve(qsDir, 'schema.prisma')
  await writeFile(
    schemaPath,
    SCHEMA.replace('${GUARD_OUT}', resolve(WORK, 'guard'))
      .replace('${API_BIN}', resolve(process.cwd(), 'dist/bin.js'))
      .replace('${API_OUT}', resolve(WORK, 'api')),
    'utf8',
  )
  const generate = spawnSync(
    process.execPath,
    [PRISMA_BIN, 'generate', '--schema', schemaPath],
    { cwd: ARTICLE_GUARD_DIR, env, encoding: 'utf8' },
  )
  if (generate.status !== 0) {
    throw new Error(
      'readme quickstart generate failed:\n' +
        (generate.stdout ?? '') +
        (generate.stderr ?? ''),
    )
  }
  execFileSync(
    process.execPath,
    [PRISMA_BIN, 'db', 'push', '--schema', schemaPath, '--accept-data-loss'],
    { cwd: ARTICLE_GUARD_DIR, env, stdio: 'pipe' },
  )

  // README imports: PrismaClient, the generated guard client, force
  const prismaMod = (await import(
    pathToFileURL(
      resolve(ARTICLE_GUARD_DIR, 'node_modules/@prisma/client/index.js'),
    ).href
  )) as typeof import('@prisma/client')
  const guardMod = (await import(
    pathToFileURL(resolve(WORK, 'guard/client.js')).href
  )) as { guard: { extension: () => unknown } }
  const guardRuntime = (await import(
    pathToFileURL(
      resolve(WORK, 'node_modules/prisma-guard/dist/runtime/index.js'),
    ).href
  )) as { force: (v: string) => unknown }

  // `new PrismaClient().$extends(guard.extension())`
  const base = new prismaMod.PrismaClient()
  const prisma = (
    base as unknown as { $extends: (e: unknown) => unknown }
  ).$extends(
    (guardMod.guard as unknown as { extension: () => unknown }).extension(),
  ) as {
    $disconnect: () => Promise<void>
    user: Record<string, unknown>
    post: Record<string, unknown>
  }
  const findManyUsers = prisma.user.findMany as (
    a: unknown,
  ) => Promise<UserRow[]>
  findUsers = () => findManyUsers({ orderBy: { email: 'asc' } })
  disconnects.push(() => prisma.$disconnect())
  await (prisma.post.deleteMany as () => Promise<unknown>)()
  await (prisma.user.deleteMany as () => Promise<unknown>)()
  const createUser = prisma.user.create as (a: {
    data: { email: string; siteId: string }
  }) => Promise<{ id: string }>
  await createUser({ data: { email: 'readme@test', siteId: 'tenant-a' } })
  // tenant B exists and MUST be excluded by the forced-tenant guard shape,
  // and MUST NOT be writable through the tenant-a write tools
  const other = await createUser({
    data: { email: 'other@test', siteId: 'tenant-b' },
  })
  otherTenantUserId = other.id

  // emitted tool factory + registry
  const mcpMod = (await import(
    pathToFileURL(resolve(WORK, 'api/User/UserMcp.js')).href
  )) as Record<
    'userFindManyTool' | 'userCreateTool' | 'userUpdateTool',
    (o: {
      config: unknown
    }) => import('../../../src/copy/mcpRuntime').McpToolContribution
  >
  const registry = (await import(
    pathToFileURL(resolve(WORK, 'api/mcp.js')).href
  )) as {
    registerMcpToolsOnServer: (
      server: McpServer,
      options: Record<string, unknown>,
    ) => void
  }

  // README buildServer, verbatim
  const buildServer = (authInfo: AuthInfo): McpServer => {
    const server = new McpServer({ name: 'my-api', version: '1.0.0' })
    registry.registerMcpToolsOnServer(server, {
      tools: [
        mcpMod.userFindManyTool({ config: userConfig(guardRuntime.force) }),
        mcpMod.userCreateTool({ config: userConfig(guardRuntime.force) }),
        mcpMod.userUpdateTool({ config: userConfig(guardRuntime.force) }),
      ],
      resolveCaller: (info: AuthInfo) => info.clientId,
      authorize: ({ principal }: { principal: AuthInfo }) => {
        if (!principal) throw new Error('unauthenticated')
      },
      defaultLimit: 20,
      maxLimit: 100,
      maxResultBytes: 262_144,
      prisma,
      authInfo,
    })
    return server
  }

  const { createMcpHandler } = await import('@modelcontextprotocol/server')
  const { toNodeHandler } = await import('@modelcontextprotocol/node')
  const { requireBearerAuth } = await import('@modelcontextprotocol/express')

  const mcpHandler = createMcpHandler((ctx) =>
    buildServer(ctx.authInfo as AuthInfo),
  )
  const node = toNodeHandler(mcpHandler)

  const app = express()
  app.use(express.json())
  app.use(
    '/mcp',
    requireBearerAuth({
      verifier: {
        verifyAccessToken: async (token: string) => {
          if (token !== 'readme-token') throw new Error('invalid token')
          return {
            token,
            clientId: 'tenant-a',
            scopes: ['mcp'],
            expiresAt: Date.now() + 3_600_000,
          }
        },
      },
    }),
  )
  app.all('/mcp', (req, res) => void node(req, res, req.body))

  const server = createServer(app)
  servers.push(server)
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  port = (server.address() as AddressInfo).port
}, 300_000)

afterAll(async () => {
  await Promise.all(
    servers.map((s) => new Promise<void>((r) => s.close(() => r()))),
  )
  for (const d of disconnects) await d()
  if (!process.env.PARITY_KEEP_WORK_DIR) {
    await rm(WORK, { recursive: true, force: true })
    await rm(resolve(ARTICLE_GUARD_DIR, 'readme-qs'), {
      recursive: true,
      force: true,
    })
  }
})

describe('README MCP quickstart, executed on the real stack', () => {
  it('lists and calls the guarded tool through /mcp', async () => {
    const client = new Client({ name: 'readme-client', version: '1.0.0' })
    const transport = new StreamableHTTPClientTransport(
      new URL(`http://127.0.0.1:${port}/mcp`),
      {
        requestInit: {
          headers: { authorization: 'Bearer readme-token' },
        },
      },
    )
    await client.connect(transport)
    try {
      const listed = await client.listTools()
      expect(listed.tools.map((t) => t.name)).toEqual([
        'user_find_many',
        'user_create',
        'user_update',
      ])

      const called = await client.callTool({
        name: 'user_find_many',
        arguments: { take: 10 },
      })
      expect(called.isError).toBeFalsy()
      const text = (r: unknown) =>
        (r as { content: Array<{ type: string; text?: string }> }).content[0]
          ?.text ?? ''
      const parsed = JSON.parse(text(called)) as UserRow[]
      // the forced tenant value reached the database query
      expect(parsed).toHaveLength(1)
      expect(parsed[0]).toMatchObject({
        email: 'readme@test',
        siteId: 'tenant-a',
      })

      // THE WRITE WORKFLOW: an authenticated agent creates a record through
      // the guarded pipeline, then updates it — the tenant is server-owned
      const created = await client.callTool({
        name: 'user_create',
        arguments: { data: { email: 'agent@test' } },
      })
      expect(created.isError).toBeFalsy()
      const createdUser = JSON.parse(text(created)) as UserRow
      expect(createdUser).toMatchObject({
        email: 'agent@test',
        siteId: 'tenant-a',
      })

      const updated = await client.callTool({
        name: 'user_update',
        arguments: {
          where: { id: createdUser.id },
          data: { email: 'agent2@test' },
        },
      })
      expect(updated.isError).toBeFalsy()
      expect(JSON.parse(text(updated))).toMatchObject({
        id: createdUser.id,
        email: 'agent2@test',
      })

      // the other tenant's row is unreachable: selector id + forced siteId
      const attack = await client.callTool({
        name: 'user_update',
        arguments: {
          where: { id: otherTenantUserId },
          data: { email: 'pwned@test' },
        },
      })
      expect(attack.isError).toBe(true)
      expect(JSON.parse(text(attack)).status).toBe(404)

      // a client-chosen tenant is not an input
      const spoof = await client.callTool({
        name: 'user_create',
        arguments: { data: { email: 'x@test', siteId: 'tenant-b' } },
      })
      expect(spoof.isError).toBe(true)

      expect((await findUsers?.())?.map((u) => [u.email, u.siteId])).toEqual([
        ['agent2@test', 'tenant-a'],
        ['other@test', 'tenant-b'],
        ['readme@test', 'tenant-a'],
      ])
    } finally {
      await client.close()
    }
  }, 60_000)
})
