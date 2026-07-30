import { describe, it, expect } from 'vitest'
import {
  validateOperationConfig,
  normalizeOperation,
  resolveOperationVariantKey,
} from '../../../src/copy/routeConfig'

/**
 * Guard configuration must be present, meaningful, and deliberate.
 *
 * The generated handler applies its guard under `if (opConfig.guardShape)`, so
 * an operation nobody configured reached Prisma with whatever `where`, `select`
 * and `include` the request supplied — no warning, and nothing structurally
 * distinguishing it from a configured operation. These refusals move that
 * failure to router construction, which on an edge runtime is boot: a deployment
 * that forgot a guard fails to start instead of serving unguarded routes.
 *
 * Every case here is a configuration that used to be accepted.
 */

const AT = 'Article.findMany'

const shape = { where: { published: true } }

describe('an operation with no guard is refused', () => {
  it('refuses an absent configuration', () => {
    expect(() => validateOperationConfig(undefined, AT)).toThrow(/no guard configured/)
  })

  it('refuses a configuration carrying neither shape nor variants', () => {
    // `before`/`after` hooks alone are not a guard.
    expect(() => validateOperationConfig({ before: [] } as never, AT)).toThrow(
      /Define "shape" or "variants"/,
    )
  })

  it('names the operation, so a large config says which one is wrong', () => {
    expect(() => validateOperationConfig(undefined, 'Article.findMany')).toThrow(
      /^Article\.findMany:/,
    )
  })

  it('accepts a real shape', () => {
    expect(() => validateOperationConfig({ shape }, AT)).not.toThrow()
  })

  it('accepts a function shape, which cannot be inspected here', () => {
    // Resolved per request against the caller's context; there is nothing to
    // check at construction time, and refusing it would ban the useful case.
    expect(() => validateOperationConfig({ shape: () => shape }, AT)).not.toThrow()
  })
})

describe('a shape that constrains nothing is refused', () => {
  it('refuses an empty shape', () => {
    // Reads as "guarded" to a reviewer and lets everything through.
    expect(() => validateOperationConfig({ shape: {} }, AT)).toThrow(/constrains nothing/)
  })

  it('refuses a shape that is not an object or function', () => {
    for (const bad of [null, 42, 'where', true, []]) {
      expect(() => validateOperationConfig({ shape: bad }, AT), String(bad)).toThrow(
        /shape must be an object or a function/,
      )
    }
  })
})

describe('a shape mixing guard keys with non-guard keys is refused', () => {
  it('refuses the typo that silently becomes a variant map', () => {
    /**
     * `classifyGuardRouting` decides by whether EVERY key is reserved, so one
     * stray key reclassifies the operation as variant-routed — after which every
     * request that does not name a variant gets a 400 for a reason no message
     * explains. `wheer` is the whole bug.
     */
    expect(() =>
      validateOperationConfig({ shape: { where: { a: 1 }, wheer: { b: 2 } } }, AT),
    ).toThrow(/mixes guard keys/)
  })

  it('names both sides, so the typo is visible in the message', () => {
    try {
      validateOperationConfig({ shape: { where: {}, iclude: {} } }, AT)
      throw new Error('should have thrown')
    } catch (error) {
      expect((error as Error).message).toContain('where')
      expect((error as Error).message).toContain('iclude')
    }
  })

  it('still accepts an all-guard-key shape', () => {
    expect(() =>
      validateOperationConfig({ shape: { where: {}, select: { id: true } } }, AT),
    ).not.toThrow()
  })

  it('still accepts an all-variant shape, which is the legacy variant form', () => {
    expect(() =>
      validateOperationConfig({ shape: { admin: {}, public: {} } }, AT),
    ).not.toThrow()
  })
})

describe('a `default` variant must be asked for', () => {
  /**
   * `default` answers a missing, blank AND unknown caller, turning three
   * fail-closed paths into a pass at once. Legitimate when it is the most
   * restrictive variant, dangerous when it is the most permissive — which is how
   * the word reads — and nothing can tell which from the shape.
   */
  const variants = { default: { shape }, admin: { shape } }

  it('refuses a `default` variant that was not opted into', () => {
    expect(() => validateOperationConfig({ variants }, AT)).toThrow(
      /Set allowDefaultVariant: true/,
    )
  })

  it('explains what it catches, not just that it is refused', () => {
    try {
      validateOperationConfig({ variants }, AT)
      throw new Error('should have thrown')
    } catch (error) {
      expect((error as Error).message).toMatch(/unrecognised, blank and missing caller/)
      expect((error as Error).message).toMatch(/most restrictive/)
    }
  })

  it('accepts it once opted into', () => {
    expect(() =>
      validateOperationConfig({ variants, allowDefaultVariant: true }, AT),
    ).not.toThrow()
  })

  it('refuses the opt-in when there is no `default` variant to opt into', () => {
    // A stale flag left behind after a rename would otherwise sit there
    // suggesting a fallback exists.
    expect(() =>
      validateOperationConfig(
        { variants: { admin: { shape } }, allowDefaultVariant: true },
        AT,
      ),
    ).toThrow(/no "default" variant exists/)
  })

  it('does not change what `default` DOES once allowed', () => {
    // The opt-in governs whether the configuration is accepted, not the routing.
    const op = normalizeOperation({ variants, allowDefaultVariant: true } as never)

    for (const caller of [undefined, '', '  ', 'unknown']) {
      expect(resolveOperationVariantKey(op.guardRouting, caller)).toEqual({
        ok: true,
        key: 'default',
      })
    }
  })

  it('does not rescue an AMBIGUOUS caller, which still fails closed', () => {
    /**
     * The limit of `default`, and worth pinning: it is consulted only after
     * pattern matching finds zero matches. Two patterns matching is a
     * configuration nobody thought through, and resolving it either way — or to
     * `default` — would be a guess.
     */
    const op = normalizeOperation({
      variants: {
        default: { shape },
        ':role/read': { shape },
        'admin/:action': { shape },
      },
      allowDefaultVariant: true,
    } as never)

    const resolved = resolveOperationVariantKey(op.guardRouting, 'admin/read')

    expect(resolved.ok).toBe(false)
    expect((resolved as { code: string }).code).toBe('ambiguous-caller')
  })
})
