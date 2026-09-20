import { afterAll, describe, expect, it } from 'vitest'
import express, { type RequestHandler } from 'express'
import fastify from 'fastify'
import { Hono } from 'hono'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { ARTICLE_MODEL, importEmittedRouter, recordingDelegate, writeEmittedRouterProject, type EmittedTarget } from './emittedRouterProject'
import type { RuntimeOperationOverride } from '../../src/copy/operationRuntime'

const cleanups: Array<() => Promise<void>> = []
afterAll(async () => { for (const cleanup of cleanups) await cleanup() })

async function request(target: EmittedTarget, config: Record<string, unknown>, prisma: Record<string, unknown>) {
  const project = await writeEmittedRouterProject({ target, model: ARTICLE_MODEL })
  cleanups.push(project.cleanup)
  const module = await importEmittedRouter(project.routerPath)
  if (target === 'hono') {
    const app = new Hono<{ Variables: { prisma: Record<string, unknown> } }>()
    app.use('*', async (c, next) => { c.set('prisma', prisma); await next() })
    const router = module.ArticleRouter as (config: Record<string, unknown>) => Hono
    app.route('/', router(config))
    const result = await app.request('/?take=2')
    return { status: result.status, body: await result.json() }
  }
  if (target === 'fastify') {
    const app = fastify()
    app.addHook('onRequest', async (req) => { Object.assign(req, { prisma }) })
    const router = module.ArticleRouter as (app: ReturnType<typeof fastify>, config: Record<string, unknown>) => Promise<void>
    try {
      await router(app, config)
      const result = await app.inject({ method: 'GET', url: '/?take=2' })
      return { status: result.statusCode, body: result.json() }
    } finally { await app.close() }
  }
  const app = express()
  app.use((req, _res, next) => { Object.assign(req, { prisma }); next() })
  const router = module.ArticleRouter as (config: Record<string, unknown>) => RequestHandler
  app.use(router(config))
  const server = createServer(app)
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  try {
    const result = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/?take=2`)
    return { status: result.status, body: await result.json() }
  } finally { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())) }
}

const shape = { where: { site_id: 'tenant-a' } }
for (const target of ['express', 'fastify', 'hono'] as const) {
  describe(`${target} generated override`, () => {
    it.each([true, false])('wrap=%s keeps typed input/context and exposes only the guarded operation', async (wrap) => {
      const recorded = recordingDelegate()
      const override: RuntimeOperationOverride = async ({ input, args, context, prisma, core }) => {
        expect(input).toBe(args)
        expect(input.take).toBe(2)
        expect(context).toEqual({ actor: 'editor' })
        expect(recorded.guardCalls.length).toBeGreaterThan(0)
        expect(Object.keys(prisma)).toEqual(['article'])
        expect(Object.keys(prisma.article)).toEqual(['findMany'])
        expect(Object.isFrozen(prisma.article)).toBe(true)
        return wrap ? await core() : [{ id: 'replacement', site_id: 'tenant-a' }]
      }
      const result = await request(target, { addModelPrefix: false, disableOpenApi: true, queryBuilder: false, resolveContext: () => ({ actor: 'editor' }), findMany: { shape, override } }, recorded.prisma)
      expect(result.status).toBe(200)
      expect(recorded.findManyCalls).toHaveLength(wrap ? 1 : 0)
      expect(result.body).toEqual(wrap ? [] : [{ id: 'replacement', site_id: 'tenant-a' }])
    })

    it('refuses a missing guard before calling replacement', async () => {
      let called = false
      const result = await request(target, { addModelPrefix: false, disableOpenApi: true, queryBuilder: false, findMany: { override: () => { called = true; return [] } } }, recordingDelegate().prisma)
      expect(result.status).toBe(500)
      expect(called).toBe(false)
    })

    it('resolves wildcard dynamic guards before replacement and normalizes a thrown override', async () => {
      const recorded = recordingDelegate()
      const order: string[] = []
      const result = await request(target, {
        addModelPrefix: false, disableOpenApi: true, queryBuilder: false,
        resolveContext: () => ({ tenant: 'tenant-a' }),
        guard: { resolveVariant: () => 'tenant/editor' },
        findMany: {
          variants: { 'tenant/:role': { shape: (context: { tenant: string }) => { order.push('guard'); return { where: { site_id: context.tenant } } } } },
          override: () => { order.push('override'); throw new Error('replacement failed') },
          after: [() => { order.push('after') }],
        },
      }, recorded.prisma)
      expect(result.status).toBe(500)
      expect(order).toEqual(['guard', 'override'])
      expect(recorded.findManyCalls).toHaveLength(0)
    })

    it('retains operation/variant order and terminal short circuit', async () => {
      for (const terminal of [false, true]) {
        const order: string[] = []
        const hook = (name: string) => target === 'express'
          ? ((_req, res, next) => { order.push(name); if (terminal && name === 'before') res.status(409).json({ stopped: true }); else next() }) satisfies RequestHandler
          : target === 'fastify'
            ? async (_req: object, reply: { code: (status: number) => { send: (body: object) => void } }) => { order.push(name); if (terminal && name === 'before') reply.code(409).send({ stopped: true }) }
            : () => { order.push(name); if (terminal && name === 'before') return new Response('{}', { status: 409 }) }
        const result = await request(target, { addModelPrefix: false, queryBuilder: false, disableOpenApi: true, guard: { resolveVariant: () => 'reader' }, findMany: {
          before: [hook('before')], after: [hook('after')],
          variants: { reader: { shape, before: [hook('variant-before')], after: [hook('variant-after')] } },
          override: async ({ core }: { core: () => Promise<unknown> }) => { order.push('override'); return core() },
        } }, recordingDelegate().prisma)
        expect(result.status).toBe(terminal ? 409 : 200)
        expect(order).toEqual(terminal ? ['before'] : ['before', 'variant-before', 'override', 'variant-after', 'after'])
      }
    })
  })
}
