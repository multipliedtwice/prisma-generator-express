import { describe, it, expect, afterAll } from 'vitest'
import { normalizeOperation } from '../../src/copy/routeConfig'
import {
  ARTICLE_MODEL,
  importEmittedRouter,
  writeEmittedRouterProject,
} from './emittedRouterProject'

/**
 * CONSTRUCTING THE EMITTED HONO ROUTER WITH UNCONFIGURED OPERATIONS.
 *
 * The regression this pins down: `normalizeOperation`'s unconfigured branch
 * read `disablePostReads` through a bare cast while every other field went
 * through `?.` — so `normalizeOperation(undefined)` threw
 * `TypeError: Cannot read properties of undefined (reading 'disablePostReads')`.
 *
 * REACHABLE FROM THE REAL ARTIFACT, which is what this file executes: the
 * emitted router's `opFor` reads `config[key]` and passes it straight in, so it
 * is `undefined` for every operation a consumer enabled without configuring —
 * `enableAll: true` and nothing else is the plainest such consumer. A graduated
 * artifact is a Hono Worker, so before the fix the throw landed at module
 * evaluation: boot, serving nothing. Reproduced against this exact construction
 * before the `?.` was added, then the expectation flipped to the claim.
 */
describe('a real emitted Hono router with unconfigured operations', () => {
  const cleanups: Array<() => Promise<void>> = []
  afterAll(async () => {
    for (const cleanup of cleanups) await cleanup()
  })

  it('constructs — enableAll with no per-operation config wires every route', async () => {
    const project = await writeEmittedRouterProject({
      target: 'hono',
      model: ARTICLE_MODEL,
    })
    cleanups.push(project.cleanup)

    const mod = await importEmittedRouter(project.routerPath)
    const factory = mod.ArticleRouter
    if (typeof factory !== 'function')
      throw new Error('the emitted router exports no factory')

    const app = (factory as (config: Record<string, unknown>) => unknown)({
      enableAll: true,
    })
    expect(app, 'construction returned nothing').toBeTruthy()
  })
})

describe('§8.3 claim 2 — normalizeOperation on a missing config (the artifact runtime)', () => {
  /**
   * `src/copy/routeConfig.ts` IS the artifact runtime — vendored byte-for-byte
   * into every generated project — so these are claims about what a graduated
   * router does, not about a test double.
   */
  it('normalizes `undefined` instead of throwing, with no guard and no opinions', () => {
    const op = normalizeOperation(undefined)

    expect(op.guardRouting).toEqual({ kind: 'none' })
    expect(
      op.guardShape,
      'an unconfigured operation carries no shape',
    ).toBeUndefined()
    expect(
      op.disablePostReads,
      'absent config invented a POST-reads opinion',
    ).toBeUndefined()
    expect(op.operationBefore).toEqual([])
    expect(op.operationAfter).toEqual([])
    expect(op.variantHooks).toEqual({})
  })

  it('reads disablePostReads through the config type, identically in both branches', () => {
    expect(
      normalizeOperation({ disablePostReads: true }).disablePostReads,
    ).toBe(true)
    expect(
      normalizeOperation({
        variants: { admin: { shape: {} } },
        disablePostReads: true,
      }).disablePostReads,
    ).toBe(true)
  })
})
