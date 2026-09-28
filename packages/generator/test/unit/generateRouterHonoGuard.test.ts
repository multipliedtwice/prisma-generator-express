import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
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

/** Copied verbatim into the generated output: the shipped orchestration. */
const parts = readFileSync(
  resolve(__dirname, '../../src/copy/routerParts.ts'),
  'utf8',
)

const emit = (dropGuard: boolean) =>
  generateHonoRouterFunction({
    model,
    enums: [],
    guardShapesImport: null,
    importStyle: 'esm' as never,
    writeStrategy: 'transaction' as never,
    dropGuard,
    pathCase: 'raw' as never,
  })

describe('guard dropping is decided at generation time — under allowE2EGuardBypass', () => {
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
      expect(
        line,
        `E2E still reachable with dropGuard=${dropGuard}`,
      ).not.toContain('E2E')
      expect(line).not.toContain('_env')
    }
  })

  it('reaches the env bypass only through its OWN control', () => {
    /**
     * 1.64.2 removed the bypass outright, which broke consumers who relied on it.
     * It is back, gated on `allowE2EGuardBypass` alone — not on a shared switch,
     * so turning off the bypass does not also change hook ordering or refuse a
     * route. Since PGE_DROP_GUARD the raw environment strings live once in the
     * shared misc runtime (`resolveDropGuardEnv`), never in a model router.
     */
    const out = emit(false)
    const line = out
      .split('\n')
      .find((l) => l.includes('resolveDropGuardEnv(_env)'))

    expect(line, 'the env bypass call is gone entirely').toBeDefined()
    expect(line, 'the bypass is not gated on its own control').toContain(
      'POLICY.allowE2EGuardBypass',
    )
  })

  it('emits the generation-time decision verbatim', () => {
    expect(emit(false)).toContain('const DROP_GUARD = false')
    expect(emit(true)).toContain('const DROP_GUARD = true')
  })

  it('mentions no raw environment variable; the gated helper call is the only path', () => {
    /**
     * Was "one E2E mention behind its control". With `resolveDropGuardEnv` the
     * raw strings moved into the shared runtime once, so a model router must
     * contain zero of them and exactly one gated helper call.
     */
    const mentions = emit(false)
      .split('\n')
      .filter((l) => /\bE2E\b/.test(l))
      .filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l))
    expect(mentions, 'a raw env string leaked into the router').toHaveLength(0)

    const calls = emit(false)
      .split('\n')
      .filter((l) => l.includes('resolveDropGuardEnv(_env)'))
    expect(calls, 'the helper call appears more than once').toHaveLength(1)
    expect(calls[0]).toContain('POLICY.allowE2EGuardBypass')
  })
})

describe('a dynamic shape is resolved once, and the validated value travels on', () => {
  const out = emit(false)

  it('routes the shape through the shared prepareGuardOperation stage', () => {
    /**
     * Phase S moved resolution and validation into the shared pipeline so the
     * property "resolved exactly once, validated value travels on" holds for
     * every transport, not just this emitter. The router delegates to the
     * shipped routerParts runtime, which hands the stage the policy containing
     * `validateResolvedShapes` and stores only the stage's result.
     */
    expect(parts).toContain('await prepareGuardOperation(routed, {')
    expect(parts).toContain('resolveGuardPolicy(')
    expect(parts).not.toContain('resolveGuardShapeOnce')
    expect(out).not.toContain('resolveGuardShapeOnce')
  })

  it('hands prisma-guard the RESOLVED value, never the original shape', () => {
    // `vars.set('guardShape', …)` is what reaches `delegate.guard(ctx.guardShape, …)`.
    expect(parts).toContain("vars.set('guardShape', guard.guardShape)")
    expect(
      parts,
      'the unresolved shape is still passed downstream',
    ).not.toContain("vars.set('guardShape', opConfig.guardShape)")
  })

  it('gives the dropped-guard path the same resolved value', () => {
    // Otherwise applyDroppedGuard resolves it again, which is the same gap by
    // another route. The shared stage owns both branches; the router runtime
    // passes the execution policy, never a bare dropGuard boolean.
    const middleware = parts.slice(
      parts.indexOf('export function createShapeMiddleware'),
      parts.indexOf('export function createSettleGuard'),
    )
    expect(middleware).not.toContain('applyDroppedGuard')
  })

  it('builds the context resolver once and shares it with both branches', () => {
    const middleware = parts.slice(
      parts.indexOf('export function createShapeMiddleware'),
      parts.indexOf('export function createSettleGuard'),
    )
    const resolvers = [...middleware.matchAll(/memoizeContext\(/g)]
    expect(
      resolvers,
      'more than one context resolver is built per request',
    ).toHaveLength(1)
  })

  for (const { name, factory } of [
    { name: 'read', factory: 'export function createReadRoute' },
    { name: 'write', factory: 'export function createWriteRoute' },
  ]) {
    it(`the ${name} handler refuses an unusable shape with a 500, before its hooks`, () => {
      /**
       * A shape function that returned something unusable is a DEPLOYMENT fault,
       * not a caller fault — 500 — and it must be refused before any hook can
       * answer the request and before Prisma is reached. The ordering lives in
       * the shipped routerParts runtime; the emitted router forwards its
       * guardResolutionOrder control there.
       */
      const body = parts.slice(parts.indexOf(factory))

      const settled = body.indexOf(
        'if (input.settleBeforeHooks) settleGuard(c)',
      )
      const hooks = body.indexOf('input.opConfig.operationBefore')

      expect(
        settled,
        `${name}: no before-hooks guard settlement`,
      ).toBeGreaterThan(-1)
      expect(
        settled,
        `${name}: a hook can answer despite an unusable guard`,
      ).toBeLessThan(hooks)

      // ...and the legacy ordering is still emitted, after the hooks.
      const legacy = body.indexOf(
        'if (!input.settleBeforeHooks) settleGuard(c)',
      )
      expect(legacy, `${name}: no after-hooks ordering`).toBeGreaterThan(hooks)

      // and the emitter forwards the control instead of deciding it
      expect(out).toContain('settleBeforeHooks: SETTLE_BEFORE_HOOKS')
    })
  }
})

describe('updateEach is refused — but only when enableUpdateEach is false', () => {
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
    // Gated: the throw is reached only when the route is switched off.
    expect(out).toMatch(
      /if \(!POLICY\.enableUpdateEach\) \{\s*\n\s*throw new Error\(/,
    )
  })

  it('still registers the route when the flag is absent', () => {
    /**
     * The 1.64.2 regression, stated as a test: removing the endpoint outright
     * broke every consumer using it. It is back on the default path, warning
     * and all, and unreachable only for those who opted in.
     */
    expect(out, 'the updateEach route was not restored').toContain("'/each'")
    expect(out).toContain(
      'createUpdateEachRoute<TCtx, TPrisma, TEnv>({ config, opConfig, handler: ArticleUpdateEach, dropGuard })',
    )
    expect(out).toContain('should be protected by authentication middleware')
  })

  it('keeps the development-only warning on the legacy path, where it belongs', () => {
    /**
     * Scoped to GUARD warnings deliberately. The router still warns about the
     * query-builder UI not auto-starting, which is a developer notice about
     * tooling and not a control standing in for one — the distinction being the
     * whole point of this test.
     */
    /**
     * The warning is not a security control and never was — that is why
     * requireGuard refuses the route outright. But on the default path it is the
     * behaviour consumers have, so it stays, and it is unreachable for anyone who
     * opted in because the throw precedes it.
     */
    const block = out.slice(out.indexOf('if (config.updateEach) {'))
    expect(block).toContain('should be protected by authentication middleware')
    expect(block.indexOf('if (!POLICY.enableUpdateEach)')).toBeLessThan(
      block.indexOf('should be protected by authentication middleware'),
    )

    const warnings = [...out.matchAll(/console\.warn\(\s*\n?\s*'([^']*)/g)].map(
      (m) => m[1],
    )
    for (const warning of warnings) {
      expect(
        warning,
        `a warning is standing in for a guard: ${warning}`,
      ).not.toMatch(/guard|auth|bypass|unguarded/i)
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
    { name: 'read', factory: 'export function createReadRoute' },
    { name: 'write', factory: 'export function createWriteRoute' },
  ]

  for (const { name, factory } of handlers) {
    it(`the ${name} handler raises a variant failure before its before-hooks`, () => {
      const body = parts.slice(parts.indexOf(factory))
      expect(
        parts.indexOf(factory),
        `${factory} not found — this test is checking nothing`,
      ).toBeGreaterThan(-1)

      const strict = body.indexOf('if (input.settleBeforeHooks) settleGuard(c)')
      const legacy = body.indexOf(
        'if (!input.settleBeforeHooks) settleGuard(c)',
      )
      const hooks = body.indexOf('input.opConfig.operationBefore')

      expect(
        hooks,
        'no operation before-hooks in this handler',
      ).toBeGreaterThan(-1)
      expect(
        strict,
        'no before-hooks settlement in this handler',
      ).toBeGreaterThan(-1)
      expect(
        strict,
        `${name}: a hook can answer before the variant is resolved`,
      ).toBeLessThan(hooks)

      /**
       * ...and the 1.64.1 ordering is preserved for everyone else. Moving the
       * check earlier for all consumers is what made 1.64.2 a breaking change:
       * a before-hook that legitimately answered first — an auth gate, a cache —
       * stopped being reached.
       */
      expect(
        legacy,
        `${name}: the legacy ordering was not preserved`,
      ).toBeGreaterThan(hooks)
    })
  }

  it('still runs variant hooks after resolution, which is the point of them', () => {
    // Resolution moving earlier must not have moved the per-variant hooks with
    // it: those depend on the resolved key. Ordering lives in routerParts.
    const body = parts.slice(parts.indexOf('export function createReadRoute'))

    expect(
      body.indexOf("(c as unknown as HandlerContext).get('guardVariantKey')"),
    ).toBeGreaterThan(
      body.indexOf('if (input.settleBeforeHooks) settleGuard(c)'),
    )
    expect(body).toContain('variantHooks')
  })
})
