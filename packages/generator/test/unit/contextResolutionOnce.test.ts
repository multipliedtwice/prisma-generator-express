import { describe, it, expect, afterAll } from 'vitest'
import { Hono } from 'hono'
import {
  ARTICLE_MODEL,
  importEmittedRouter,
  recordingDelegate,
  writeEmittedRouterProject,
} from './emittedRouterProject'

/**
 * Phase S accept criteria, executed against a real emitted router: application
 * context resolves EXACTLY ONCE per request, shared between the guard-shape
 * resolution, the operation core and any override — the memoized `getContext`
 * instance travels through the whole pipeline.
 */
describe('context resolves exactly once per request', () => {
  const cleanups: Array<() => Promise<void>> = []
  afterAll(async () => {
    for (const cleanup of cleanups) await cleanup()
  })

  it('one dynamic-shape resolution and one core execution share one resolveContext call', async () => {
    const project = await writeEmittedRouterProject({
      target: 'hono',
      model: ARTICLE_MODEL,
    })
    cleanups.push(project.cleanup)

    const mod = await importEmittedRouter(project.routerPath)
    const factory = mod.ArticleRouter as (
      config: Record<string, unknown>,
    ) => unknown

    let resolveCalls = 0
    const { prisma, guardCalls, findManyCalls } = recordingDelegate()

    const app = (factory as (config: Record<string, unknown>) => unknown)({
      addModelPrefix: false,
      disableOpenApi: true,
      queryBuilder: false,
      // forces the pipeline to resolve the dynamic shape itself, which is the
      // path that consumes application context before execution
      validateResolvedShapes: true,
      findMany: {
        shape: (ctx: { tenantId: string }) => ({
          where: { site_id: ctx.tenantId },
          take: 10,
        }),
      },
      resolveContext: () => {
        resolveCalls++
        return { tenantId: 'tenant-a' }
      },
    }) as { request: (path: string) => Promise<Response> }

    const wrapped = new Hono<{
      Variables: { prisma: Record<string, unknown> }
    }>()
    wrapped.use('*', async (c, next) => {
      c.set('prisma', prisma)
      await next()
    })
    wrapped.route('/', app as never)

    const res = await wrapped.request('/')
    expect(res.status).toBe(200)

    // the dynamic shape ran once (guard active), the core ran once, and the
    // context resolver behind both ran exactly once
    expect(guardCalls).toHaveLength(1)
    expect(findManyCalls).toHaveLength(1)
    expect(resolveCalls).toBe(1)
  })
})
