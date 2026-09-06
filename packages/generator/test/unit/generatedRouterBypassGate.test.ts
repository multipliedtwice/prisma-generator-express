import { describe, it, expect, afterAll, afterEach } from 'vitest'
import type { AddressInfo } from 'node:net'
import { createServer, type Server } from 'node:http'
import express from 'express'
import fastify from 'fastify'
import {
  ARTICLE_MODEL,
  importEmittedRouter,
  recordingDelegate,
  writeEmittedRouterProject,
} from './emittedRouterProject'

/**
 * THE ENVIRONMENT BYPASS REQUIRES THE EXPLICIT GATE — ON EVERY TARGET.
 *
 * At f6411dc the Express and Fastify routers emitted
 *
 *     const DROP_GUARD = <literal> || resolveDropGuardEnv(_env)
 *
 * at module scope, with no gate at all: `allowE2EGuardBypass: false` did not
 * disable the environment bypass for those targets, and neither did omitting
 * it. The accepted decision (SPEC-ACCESS.md §8.3.1): every upstream target that
 * supports the runtime E2E bypass requires the explicit
 * `allowE2EGuardBypass: true`; false OR OMITTED means the environment cannot
 * drop guards. The generation-time `dropGuard` literal is separate and keeps
 * its meaning.
 *
 * These are runtime proofs against REAL emitted routers running the REAL copied
 * runtime, distinguished by an observable that cannot lie about which path ran:
 * the kept path calls THROUGH `delegate.guard(shape, …)`, the dropped path
 * never touches `guard` and calls the operation with the forced query.
 */
const GUARD_SHAPE = { where: { site_id: 'tenant-1' } }

type GateCase = { gate: boolean | undefined; env: string | undefined; dropped: boolean }
const CASES: GateCase[] = [
  { gate: true, env: 'true', dropped: true },
  { gate: false, env: 'true', dropped: false },
  { gate: undefined, env: 'true', dropped: false },
  { gate: true, env: undefined, dropped: false },
]

const label = (c: GateCase) =>
  `allowE2EGuardBypass ${c.gate === undefined ? 'omitted' : c.gate} with PGE_DROP_GUARD${
    c.env === undefined ? ' unset' : `=${c.env}`
  } ${c.dropped ? 'DROPS the guard' : 'keeps the guard'}`

const cleanups: Array<() => Promise<void>> = []
afterAll(async () => {
  for (const cleanup of cleanups) await cleanup()
})

const envBefore = process.env.PGE_DROP_GUARD
afterEach(() => {
  if (envBefore === undefined) delete process.env.PGE_DROP_GUARD
  else process.env.PGE_DROP_GUARD = envBefore
})

function setEnv(value: string | undefined): void {
  if (value === undefined) delete process.env.PGE_DROP_GUARD
  else process.env.PGE_DROP_GUARD = value
}

function findManyConfig(gate: boolean | undefined): Record<string, unknown> {
  return {
    addModelPrefix: false,
    findMany: { shape: GUARD_SHAPE },
    ...(gate === undefined ? {} : { allowE2EGuardBypass: gate }),
  }
}

describe('Fastify: the env bypass is honoured only under the explicit gate', () => {
  let routerPath: string | undefined
  const router = async () => {
    if (routerPath === undefined) {
      const project = await writeEmittedRouterProject({ target: 'fastify', model: ARTICLE_MODEL })
      cleanups.push(project.cleanup)
      routerPath = project.routerPath
    }
    return importEmittedRouter(routerPath)
  }

  for (const gateCase of CASES) {
    it(label(gateCase), async () => {
      const mod = await router()
      const factory = mod.ArticleRouter as (
        instance: unknown,
        config: Record<string, unknown>,
      ) => Promise<void>
      const { prisma, guardCalls, findManyCalls } = recordingDelegate()

      const app = fastify()
      app.addHook('onRequest', async (request) => {
        Object.assign(request, { prisma })
      })
      setEnv(gateCase.env)
      await factory(app, findManyConfig(gateCase.gate))
      const response = await app.inject({ method: 'GET', url: '/' })
      await app.close()

      expect(response.statusCode).toBe(200)
      if (gateCase.dropped) {
        expect(guardCalls, 'the dropped path still consulted the guard').toEqual([])
        expect(findManyCalls.length).toBeGreaterThan(0)
      } else {
        expect(guardCalls, 'the guard was bypassed').toEqual([GUARD_SHAPE])
      }
    })
  }
})

describe('Express: the env bypass is honoured only under the explicit gate', () => {
  let routerPath: string | undefined
  const router = async () => {
    if (routerPath === undefined) {
      const project = await writeEmittedRouterProject({ target: 'express', model: ARTICLE_MODEL })
      cleanups.push(project.cleanup)
      routerPath = project.routerPath
    }
    return importEmittedRouter(routerPath)
  }

  const drive = async (server: Server): Promise<number> => {
    await new Promise<void>((resolve) => server.listen(0, resolve))
    const { port } = server.address() as AddressInfo
    const response = await fetch(`http://127.0.0.1:${port}/`)
    await response.arrayBuffer()
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    )
    return response.status
  }

  for (const gateCase of CASES) {
    it(label(gateCase), async () => {
      const mod = await router()
      const factory = mod.ArticleRouter as (config: Record<string, unknown>) => unknown
      const { prisma, guardCalls, findManyCalls } = recordingDelegate()

      const app = express()
      app.use((request, _response, next) => {
        Object.assign(request, { prisma })
        next()
      })
      setEnv(gateCase.env)
      app.use(factory(findManyConfig(gateCase.gate)) as express.Router)
      const status = await drive(createServer(app))

      expect(status).toBe(200)
      if (gateCase.dropped) {
        expect(guardCalls, 'the dropped path still consulted the guard').toEqual([])
        expect(findManyCalls.length).toBeGreaterThan(0)
      } else {
        expect(guardCalls, 'the guard was bypassed').toEqual([GUARD_SHAPE])
      }
    })
  }
})
