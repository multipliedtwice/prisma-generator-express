import { describe, it, expect } from 'vitest'
import type { DMMF } from '@prisma/generator-helper'
import { generateHonoRouterFunction } from '../../src/generators/generateRouterHono'

/**
 * Properties of the Hono router this generator EMITS.
 *
 * Output tests rather than unit tests, because both fixes below are about the
 * code that ships to a deployment rather than about a function anything here can
 * call. The emitted text is the artifact; asserting on it is asserting on what
 * runs.
 */

const model = {
  name: 'Article',
  dbName: null,
  schema: null,
  fields: [
    {
      name: 'id',
      kind: 'scalar',
      isList: false,
      isRequired: true,
      isUnique: false,
      isId: true,
      isReadOnly: false,
      hasDefaultValue: false,
      type: 'String',
      isGenerated: false,
      isUpdatedAt: false,
    },
  ],
  primaryKey: null,
  uniqueFields: [],
  uniqueIndexes: [],
  isGenerated: false,
} as unknown as DMMF.Model

const emit = (dropGuard: boolean) =>
  generateHonoRouterFunction({
    model,
    enums: [],
    guardShapesImport: null,
    importStyle: 'esm' as never,
    writeStrategy: 'transaction' as never,
    dropGuard,
  })

describe('guard dropping is decided at generation time, never at runtime', () => {
  /**
   * The emitted router computed
   *
   *     const DROP_GUARD = <flag> || _env.E2E === 'true'
   *
   * so `E2E=true` in a deployed environment downgraded enforcement even when the
   * generator had been told to keep the guard — and the modes are not
   * equivalent: with the guard, the shape goes to prisma-guard; with it dropped,
   * only projection defaults and forced `where` clauses are applied.
   *
   * On an edge runtime that is an ordinary config var. Set on staging, copied
   * forward, marked as security-relevant nowhere.
   */
  it('reads no environment variable when deciding whether to drop the guard', () => {
    for (const dropGuard of [true, false]) {
      const out = emit(dropGuard)
      const line = out.split('\n').find((l) => l.includes('const DROP_GUARD'))

      expect(line, 'DROP_GUARD is no longer emitted').toBeDefined()
      expect(line, `E2E still reachable with dropGuard=${dropGuard}`).not.toContain('E2E')
      expect(line).not.toContain('_env')
    }
  })

  it('emits the generation-time decision verbatim', () => {
    expect(emit(false)).toContain('const DROP_GUARD = false')
    expect(emit(true)).toContain('const DROP_GUARD = true')
  })

  it('mentions E2E nowhere in the emitted router', () => {
    // Belt and braces: no other path may reintroduce it under another name.
    expect(emit(false)).not.toMatch(/\bE2E\b/)
  })
})

describe('a dynamic shape is resolved once, and the validated value travels on', () => {
  const out = emit(false)

  it('routes the shape through resolveGuardShapeOnce', () => {
    /**
     * The resolution and its validation live in one function so that "resolved
     * exactly once" is a property something can test, rather than a claim in a
     * comment. An earlier version made exactly that claim inline while passing
     * the FUNCTION downstream for prisma-guard to resolve a second time.
     */
    expect(out).toContain(
      'await resolveGuardShapeOnce(opConfig.guardShape, resolvedKey, resolveCtx)',
    )
    expect(out).toContain('const effectiveShape = resolution.shape')
  })

  it('hands prisma-guard the RESOLVED value, never the original shape', () => {
    // `c.set('guardShape', …)` is what reaches `delegate.guard(ctx.guardShape, …)`.
    expect(out).toContain("c.set('guardShape', effectiveShape)")
    expect(out, 'the unresolved shape is still passed downstream').not.toContain(
      "c.set('guardShape', opConfig.guardShape)",
    )
  })

  it('gives the dropped-guard path the same resolved value', () => {
    // Otherwise applyDroppedGuard resolves it again, which is the same gap by
    // another route.
    expect(out).toContain('applyDroppedGuard(\n          effectiveShape,')
  })

  it('builds the context resolver once and shares it with both branches', () => {
    const middleware = out.slice(
      out.indexOf('function makeShapeMiddleware'),
      out.indexOf('const handleRead ='),
    )
    const resolvers = [...middleware.matchAll(/const resolveCtx\b/g)]
    expect(resolvers, 'more than one context resolver is built per request').toHaveLength(1)
  })

  for (const { name, from, to } of [
    { name: 'read', from: 'const handleRead =', to: 'const handleWrite =' },
    { name: 'write', from: 'const handleWrite =', to: 'const opFor =' },
  ]) {
    it(`the ${name} handler refuses an unusable shape with a 500, before its hooks`, () => {
      /**
       * A shape function that returned something unusable is a DEPLOYMENT fault,
       * not a caller fault — 500 — and it must be refused before any hook can
       * answer the request and before Prisma is reached.
       */
      const start = out.indexOf(from)
      const body = out.slice(start, out.indexOf(to, start))

      const shapeFailure = body.indexOf("c.get('guardShapeFailure')")
      const hooks = body.indexOf('runBeforeHooks<TEnv>(opConfig.operationBefore')

      expect(shapeFailure, `${name}: no shape-failure check`).toBeGreaterThan(-1)
      expect(body).toContain('new HTTPException(500')
      expect(shapeFailure, `${name}: a hook can answer despite an unusable guard`).toBeLessThan(
        hooks,
      )
    })
  }
})

describe('updateEach is not registered on this target', () => {
  const out = emit(false)

  it('refuses at construction rather than dropping it silently', () => {
    /**
     * The endpoint bypasses guard shapes by design — a batch of
     * `{ where, data }` items applied directly — and the only thing between it
     * and an unguarded mass mutation was a `console.warn` suppressed in
     * production. A warning is not a security boundary.
     *
     * Refusing loudly matters: a deployment that expects the route learns at
     * boot, not at the first 404 in a batch job nobody is watching.
     */
    expect(out).toContain('does not register updateEach')
    expect(out).toMatch(/if \(config\.updateEach\) \{\s*\n\s*throw new Error\(/)
  })

  it('registers no route for it', () => {
    expect(out, 'an updateEach route is still mounted').not.toContain("'/each'")
    expect(out).not.toContain('UpdateEach(c as unknown as HandlerContext)')
  })

  it('carries no development-only warning in place of a guard control', () => {
    /**
     * Scoped to GUARD warnings deliberately. The router still warns about the
     * query-builder UI not auto-starting, which is a developer notice about
     * tooling and not a control standing in for one — the distinction being the
     * whole point of this test.
     */
    expect(out).not.toContain('should be protected by authentication middleware')
    expect(out).not.toContain('bypasses guard shapes')

    const warnings = [...out.matchAll(/console\.warn\(\s*\n?\s*'([^']*)/g)].map((m) => m[1])
    for (const warning of warnings) {
      expect(warning, `a warning is standing in for a guard: ${warning}`).not.toMatch(
        /guard|auth|bypass|unguarded/i,
      )
    }
  })
})

describe('variant resolution is settled before any operation hook runs', () => {
  /**
   * The check used to sit after `operationBefore`, so a hook returning a
   * Response — an auth gate, a cache, a short-circuit for a known caller —
   * answered the request before anyone established which guard applied. A cached
   * response served for a request whose variant could not be resolved is a
   * response served under a guard nobody chose.
   */
  const out = emit(false)

  const handlers = [
    { name: 'read', from: 'const handleRead =', to: 'const handleWrite =' },
    { name: 'write', from: 'const handleWrite =', to: 'const opFor =' },
  ]

  for (const { name, from, to } of handlers) {
    it(`the ${name} handler raises a variant failure before its before-hooks`, () => {
      const start = out.indexOf(from)
      expect(start, `${from} not found — this test is checking nothing`).toBeGreaterThan(-1)
      const body = out.slice(start, out.indexOf(to, start))

      const failure = body.indexOf("c.get('guardVariantFailure')")
      const hooks = body.indexOf('runBeforeHooks<TEnv>(opConfig.operationBefore')

      expect(failure, 'no variant failure check in this handler').toBeGreaterThan(-1)
      expect(hooks, 'no operation before-hooks in this handler').toBeGreaterThan(-1)
      expect(failure, `${name}: a hook can answer before the variant is resolved`).toBeLessThan(
        hooks,
      )
    })
  }

  it('still runs variant hooks after resolution, which is the point of them', () => {
    // Resolution moving earlier must not have moved the per-variant hooks with
    // it: those depend on the resolved key.
    const start = out.indexOf('const handleRead =')
    const body = out.slice(start, out.indexOf('const handleWrite =', start))

    expect(body.indexOf("c.get('guardVariantKey')")).toBeGreaterThan(
      body.indexOf("c.get('guardVariantFailure')"),
    )
    expect(body).toContain('variantHooks')
  })
})
