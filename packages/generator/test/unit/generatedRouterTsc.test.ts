import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { describe, it, expect, afterAll } from 'vitest'
import {
  ARTICLE_MODEL,
  writeEmittedRouterProject,
} from './emittedRouterProject'

/**
 * THE EMITTED TREE TYPECHECKS UNDER `tsc`, for every target.
 *
 * `generateRouterHonoTypecheck.test.ts` asserts properties of the emitted TEXT;
 * this compiles it. The distinction caught a real regression: the Hono router
 * imports `PrismaClientLike` from `routeConfig.target`, and f6411dc's
 * `routeConfig.hono.ts` stopped re-exporting it — so every graduated artifact
 * failed its own `npm run typecheck` (TS2459) while every text assertion here
 * stayed green. A consumer's artifact runs exactly this compiler over exactly
 * these files.
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

const CONSUMER_PRELUDE = `import type { PrismaClientLike } from './routeConfig'
import { ArticleRouter } from './Article/ArticleRouter'

type Ctx = { tenantId: string }
type ArticleRow = { id: string; site_id: string }
type ExtendedPrisma = PrismaClientLike & {
  article: {
    findMany: (args?: { where?: { site_id?: string }; take?: number }) => Promise<ArticleRow[]>
    count: (args?: { where?: { site_id?: string } }) => Promise<number>
  }
}
`

const CONSUMER_CONFIG = `{
  resolveContext: (): Ctx => ({ tenantId: 'tenant-a' }),
  findMany: {
    override: ({ context, core }) => {
      const tenant: string = context.tenantId
      return core()
    },
  },
}`

const CONSUMER_CALL: Record<'hono' | 'express' | 'fastify', string> = {
  hono: `ArticleRouter<Ctx, ExtendedPrisma>(${CONSUMER_CONFIG})\n`,
  express: `ArticleRouter<Ctx, ExtendedPrisma>(${CONSUMER_CONFIG})\n`,
  fastify: `import type { FastifyInstance } from 'fastify'\ndeclare const fastify: FastifyInstance\nvoid ArticleRouter<Ctx, ExtendedPrisma>(fastify, ${CONSUMER_CONFIG})\n`,
}

const cleanups: Array<() => Promise<void>> = []
afterAll(async () => {
  for (const cleanup of cleanups) await cleanup()
})

describe.each(['hono', 'express', 'fastify'] as const)(
  '%s emitted tree',
  (target) => {
    it('compiles under tsc --strict, exactly as the artifact typechecks itself', async () => {
      const project = await writeEmittedRouterProject({
        target,
        model: ARTICLE_MODEL,
      })
      cleanups.push(project.cleanup)
      const root = dirname(dirname(project.routerPath))
      writeFileSync(join(root, 'tsconfig.json'), TSCONFIG)
      writeFileSync(
        join(root, 'consumer.ts'),
        CONSUMER_PRELUDE + CONSUMER_CALL[target],
      )

      try {
        execFileSync('node', [TSC, '--noEmit', '-p', 'tsconfig.json'], {
          cwd: root,
          encoding: 'utf8',
          stdio: 'pipe',
        })
      } catch (error) {
        const failure = error as { stdout?: string; stderr?: string }
        expect.fail(
          `the emitted ${target} tree does not typecheck:\n${failure.stdout ?? ''}${failure.stderr ?? ''}`,
        )
      }
    }, 120_000)
  },
)
