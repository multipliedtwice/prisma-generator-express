import { writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { describe, it, expect, afterAll } from 'vitest'
import {
  ARTICLE_MODEL,
  writeEmittedRouterProject,
} from '../emittedRouterProject'

/**
 * The full emitted tree — REST files plus the MCP registry, mount glue,
 * runtime and per-model tool factories — compiles under tsc --strict for
 * every target, exactly as a consumer's artifact would.
 */
const TSC = createRequire(import.meta.url).resolve('typescript/lib/tsc.js')

const TSCONFIG = `{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true,
    "lib": ["ESNext", "DOM"],
    "types": ["node"]
  },
  "include": ["**/*.ts"]
}
`

// THE GUIDE EXAMPLE, COMPILED AND CONCRETE: docs/guide.md's MCP quickstart
// pattern must typecheck against the emitted artifact with a REAL route
// config — no `declare const` placeholders. Values mirror the README example.
const GUIDE_CONSUMER = `import { McpServer, type AuthInfo } from '@modelcontextprotocol/server'
import { registerMcpToolsOnServer } from './mcp'
import { McpAuthorizationError } from './mcpRuntime'
import {
  articleFindManyTool,
  articleFindUniqueTool,
} from './Article/ArticleMcp'
import type { ArticleRouteConfig } from './Article/ArticleRouter'
import type { PrismaClientLike } from './routeConfig'

const userConfig: ArticleRouteConfig = {
  findMany: {
    shape: {
      where: { site_id: { equals: 'tenant-a' } },
      take: { max: 50 },
    },
  },
  findUnique: {
    shape: {
      where: { site_id: 'tenant-a' },
    },
  },
}

const prisma: PrismaClientLike = {}

const buildServer = (authInfo: AuthInfo): McpServer => {
  const server = new McpServer({ name: 'my-api', version: '1.0.0' })
  registerMcpToolsOnServer(server, {
    tools: [
      articleFindManyTool({ config: userConfig }),
      articleFindUniqueTool({ config: userConfig }),
    ],
    resolveCaller: (info) => info.clientId,
    authorize: ({ principal }) => {
      if (!principal) throw new McpAuthorizationError('unauthenticated')
    },
    defaultLimit: 20,
    maxLimit: 100,
    maxResultBytes: 262_144,
    prisma,
    authInfo,
  })
  return server
}
void buildServer
`

const cleanups: Array<() => Promise<void>> = []
afterAll(async () => {
  for (const cleanup of cleanups) await cleanup()
})

describe.each(['express', 'fastify', 'hono'] as const)(
  '%s emitted tree with mcp=true',
  (target) => {
    it('compiles under tsc --strict including MCP files', async () => {
      const project = await writeEmittedRouterProject({
        target,
        model: ARTICLE_MODEL,
        mcp: true,
      })
      cleanups.push(project.cleanup)
      const root = dirname(dirname(project.routerPath))
      writeFileSync(join(root, 'tsconfig.json'), TSCONFIG)
      writeFileSync(join(root, 'guideConsumer.ts'), GUIDE_CONSUMER)

      const { execFileSync } = await import('node:child_process')
      try {
        const out = execFileSync(
          'node',
          [TSC, '--noEmit', '-p', 'tsconfig.json'],
          { cwd: root, encoding: 'utf8', stdio: 'pipe' },
        )
        expect(out).toBe('')
      } catch (error) {
        const failure = error as { stdout?: string; stderr?: string }
        expect.fail(
          `the emitted ${target} MCP tree does not typecheck:\n${failure.stdout ?? ''}${failure.stderr ?? ''}`,
        )
      }
    }, 180_000)
  },
)
