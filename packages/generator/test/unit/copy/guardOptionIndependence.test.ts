import { describe, it, expect } from 'vitest'
import {
  validateOperationConfig,
  resolveGuardPolicy,
  UPSTREAM_GUARD_DEFAULTS,
  HARDENED_GUARD_PROFILE,
} from '../../../src/copy/routeConfig'
import type { GuardPolicy } from '../../../src/copy/routeConfig'
import {
  GUARD_OPTION_METADATA,
  GUARD_METADATA_SCOPE,
  UPSTREAM_GUARD_DEFAULTS as COMPILED_DEFAULTS,
  HARDENED_GUARD_PROFILE as COMPILED_HARDENED,
  resolveGuardPolicy as compiledResolve,
} from '../../../src/guardOptions'
import { generateHonoRouterFunction } from '../../../src/generators/generateRouterHono'
import type { DMMF } from '@prisma/generator-helper'

/**
 * EACH CONTROL ACTS ALONE.
 *
 * This is the property the single `requireGuard` switch could not offer, and the
 * reason it was rejected. Seven unrelated decisions behind one flag means a
 * consumer who wants a missing-guard refusal is also forced to accept a
 * hook-ordering change and to lose a route they may be using.
 *
 * `routeConfigGuardRefusal.test.ts` turns everything on and checks the refusals
 * work. `guardCompatibility.test.ts` turns everything off and checks nothing
 * changed. Neither can catch two options being secretly wired to each other —
 * that is what this file is for: enable exactly ONE, assert its behaviour
 * changed, and assert the other six did not.
 */

const AT = 'Post.findMany'

/** Enable exactly one control, everything else upstream. */
const only = (name: keyof GuardPolicy, value: boolean | string): Partial<GuardPolicy> => ({
  ...UPSTREAM_GUARD_DEFAULTS,
  [name]: value,
})

/**
 * A configuration that EVERY validation control would reject, for a different
 * reason each. Used to prove that enabling one control refuses its own case and
 * leaves the others' cases alone.
 */
const CASES = {
  requireGuardShape: { config: undefined, error: /no guard configured/ },
  validateGuardShapes: { config: { shape: {} }, error: /shape is empty/ },
  requireDefaultVariantOptIn: {
    config: { variants: { default: { shape: { where: {} } } } },
    error: /allowDefaultVariant/,
  },
} as const

describe('the three construction-time controls do not imply one another', () => {
  const names = Object.keys(CASES) as Array<keyof typeof CASES>

  for (const enabled of names) {
    for (const target of names) {
      const { config, error } = CASES[target]

      if (enabled === target) {
        it(`${enabled} refuses its own case`, () => {
          expect(() =>
            validateOperationConfig(
              config as Parameters<typeof validateOperationConfig>[0],
              AT,
              only(enabled, true)
            )
          ).toThrow(error)
        })
      } else {
        it(`${enabled} does NOT refuse the ${target} case`, () => {
          /**
           * The failure this catches: wiring two checks to the same flag, or to
           * each other. A consumer who asked for one refusal and got two would
           * find it at boot, in production, on upgrade.
           */
          expect(() =>
            validateOperationConfig(
              config as Parameters<typeof validateOperationConfig>[0],
              AT,
              only(enabled, true)
            )
          ).not.toThrow()
        })
      }
    }
  }
})

describe('validateGuardShapes reaches variants without requireDefaultVariantOptIn', () => {
  it('refuses an empty variant shape on its own', () => {
    expect(() =>
      validateOperationConfig(
        { variants: { public: { shape: {} } } },
        AT,
        only('validateGuardShapes', true)
      )
    ).toThrow(/shape is empty/)
  })

  it('but still accepts a "default" variant, which is the other control', () => {
    expect(() =>
      validateOperationConfig(
        { variants: { default: { shape: { where: {} } } } },
        AT,
        only('validateGuardShapes', true)
      )
    ).not.toThrow()
  })
})

describe('requireDefaultVariantOptIn does not drag in shape validation', () => {
  it('accepts an empty variant shape while confirming the default variant', () => {
    expect(() =>
      validateOperationConfig(
        { variants: { default: { shape: {} } }, allowDefaultVariant: true },
        AT,
        only('requireDefaultVariantOptIn', true)
      )
    ).not.toThrow()
  })
})

describe('the defaults are the upstream behaviour, stated once', () => {
  it('resolves to upstream values when nothing is set', () => {
    expect(resolveGuardPolicy(undefined)).toEqual(UPSTREAM_GUARD_DEFAULTS)
    expect(resolveGuardPolicy({})).toEqual(UPSTREAM_GUARD_DEFAULTS)
  })

  it('pins each default explicitly, so a change here is a deliberate edit', () => {
    /**
     * Written out rather than compared to the constant. Comparing the constant to
     * itself proves nothing; these literals are what "pre-1.64.2 behaviour" means,
     * and changing one silently changes what every unconfigured consumer gets.
     */
    expect(UPSTREAM_GUARD_DEFAULTS).toEqual({
      requireGuardShape: false,
      validateGuardShapes: false,
      requireDefaultVariantOptIn: false,
      enableUpdateEach: true,
      guardResolutionOrder: 'after-hooks',
      allowE2EGuardBypass: true,
      validateResolvedShapes: false,
    })
  })

  it('overrides only what is given', () => {
    const policy = resolveGuardPolicy({ enableUpdateEach: false })

    expect(policy.enableUpdateEach).toBe(false)
    expect(policy.requireGuardShape).toBe(UPSTREAM_GUARD_DEFAULTS.requireGuardShape)
    expect(policy.guardResolutionOrder).toBe(UPSTREAM_GUARD_DEFAULTS.guardResolutionOrder)
  })
})

describe('the hardened profile is a set of values, not a mode', () => {
  it('names every control, so applying it stores individual settings', () => {
    /**
     * The rule it exists to satisfy: a preset may set several controls, but what
     * gets stored is the individual values. If the profile were partial, spreading
     * it would leave some controls at a default the user never saw.
     */
    expect(Object.keys(HARDENED_GUARD_PROFILE).sort()).toEqual(
      Object.keys(UPSTREAM_GUARD_DEFAULTS).sort()
    )
  })

  it('differs from upstream on every single control', () => {
    // A control that is identical in both is one the preset is not actually
    // deciding, and it would sit in a UI looking like a choice that does nothing.
    for (const key of Object.keys(UPSTREAM_GUARD_DEFAULTS) as Array<keyof GuardPolicy>) {
      expect(HARDENED_GUARD_PROFILE[key], `${key} is the same in both profiles`).not.toBe(
        UPSTREAM_GUARD_DEFAULTS[key]
      )
    }
  })

  it('is not accepted as a stored preset name', () => {
    /**
     * There is deliberately no `preset: 'hardened'`. A stored preset NAME would
     * let a future version of this package silently change what an existing
     * configuration does — the same class of mistake as 1.64.2 shipping hardening
     * as a default.
     */
    const policy = resolveGuardPolicy({ preset: 'hardened' } as never)
    expect(policy).toEqual(UPSTREAM_GUARD_DEFAULTS)
  })

  it('is frozen, so spreading is the only way to use it', () => {
    expect(Object.isFrozen(HARDENED_GUARD_PROFILE)).toBe(true)
    expect(Object.isFrozen(UPSTREAM_GUARD_DEFAULTS)).toBe(true)
  })
})

describe('the runtime copy and the compiled metadata agree', () => {
  /**
   * They are separate files by necessity: `src/copy/**` is excluded from the
   * build, because those files are copied into a generated project rather than
   * compiled into this package. So the runtime defaults cannot live in the
   * compiled module and the public metadata cannot live in the copied one — and
   * neither can import the other.
   *
   * Duplication with a test is the honest arrangement. Drift fails here instead
   * of shipping a UI that advertises a default the router does not apply.
   */
  it('declares the same defaults on both sides', () => {
    expect(COMPILED_DEFAULTS).toEqual(UPSTREAM_GUARD_DEFAULTS)
  })

  it('declares the same hardened profile on both sides', () => {
    expect(COMPILED_HARDENED).toEqual(HARDENED_GUARD_PROFILE)
  })

  it('resolves identically, which is the property that actually matters', () => {
    for (const partial of [
      {},
      { requireGuardShape: true },
      { enableUpdateEach: false },
      { guardResolutionOrder: 'before-hooks' as const },
      HARDENED_GUARD_PROFILE,
    ]) {
      expect(compiledResolve(partial)).toEqual(resolveGuardPolicy(partial))
    }
  })
})

describe('the metadata is machine-readable and cannot drift', () => {
  it('describes every control and no others', () => {
    expect(GUARD_OPTION_METADATA.map((o) => o.name).sort()).toEqual(
      Object.keys(UPSTREAM_GUARD_DEFAULTS).sort()
    )
  })

  it('reports the default the router actually applies', () => {
    /**
     * The requirement is that a UI reads names, types, defaults and descriptions
     * from here instead of hand-maintaining a second copy. That is only safe if
     * this cannot disagree with the resolver — so it is checked against the
     * RUNTIME `resolveGuardPolicy`, the one the generated router calls, not
     * against the constant the metadata was built from.
     */
    const applied = resolveGuardPolicy({})

    for (const option of GUARD_OPTION_METADATA) {
      expect(option.default, `${option.name} advertises the wrong default`).toBe(
        applied[option.name]
      )
      expect(option.hardened, `${option.name} advertises the wrong hardened value`).toBe(
        HARDENED_GUARD_PROFILE[option.name]
      )
    }
  })

  it('gives every control a label, a description and a declared type', () => {
    for (const option of GUARD_OPTION_METADATA) {
      expect(option.label, `${option.name} has no label`).toBeTruthy()
      expect(option.description.length, `${option.name} has no usable description`).toBeGreaterThan(
        20
      )
      expect(['boolean', 'enum']).toContain(option.type)
      if (option.type === 'enum') {
        expect(option.values, `${option.name} is an enum with no values`).toBeTruthy()
        expect(option.values).toContain(option.default as string)
        expect(option.values).toContain(option.hardened as string)
      }
    }
  })

  it('says plainly that it does NOT describe every public setting', () => {
    /**
     * SPEC.md §13 wants the graduation UI driven by package metadata for every
     * public setting that changes the emitted API. This covers seven guard
     * controls and no more, so the gap is declared rather than left to be
     * inferred from silence — a UI that assumed completeness would render a
     * settings screen that is quietly missing dropGuard, the target, the write
     * strategy and the pagination mode.
     */
    expect(GUARD_METADATA_SCOPE.complete).toBe(false)
    expect(GUARD_METADATA_SCOPE.notDescribedYet.length).toBeGreaterThan(5)
    expect(GUARD_METADATA_SCOPE.notDescribedYet).toContain('dropGuard')

    const described = new Set(GUARD_OPTION_METADATA.map((o) => o.name as string))
    for (const missing of GUARD_METADATA_SCOPE.notDescribedYet) {
      expect(described.has(missing), `${missing} is listed as missing but is described`).toBe(false)
    }
  })

  it('marks every control as belonging to the Hono target', () => {
    // These options are declared on the Hono route config only, because only the
    // Hono generator reads them. Saying so in the metadata stops a UI offering
    // them for an Express or Fastify project.
    for (const option of GUARD_OPTION_METADATA) {
      expect(option.target, `${option.name} does not name its target`).toBe('hono')
    }
  })

  it('warns on every control whose permissive value can emit an unguarded route', () => {
    // All seven qualify: each upstream default is the permissive one. A control
    // added later without a warning should fail this rather than ship silently.
    for (const option of GUARD_OPTION_METADATA) {
      expect(option.warning, `${option.name} has no warning text`).toBeTruthy()
    }
  })
})

describe('the emitted router reads each control separately', () => {
  const model = {
    name: 'Post',
    dbName: null,
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
        type: 'Int',
        isGenerated: false,
        isUpdatedAt: false,
      },
    ],
    primaryKey: null,
    uniqueFields: [],
    uniqueIndexes: [],
    isGenerated: false,
  } as unknown as DMMF.Model

  const out = generateHonoRouterFunction({
    model,
    enums: [],
    guardShapesImport: './guardShapes',
    importStyle: 'js',
    writeStrategy: 'regular',
    dropGuard: false,
  })

  it('has no single umbrella switch left', () => {
    expect(out, 'the umbrella flag is back').not.toMatch(/config\.requireGuard\b/)
    expect(out).not.toMatch(/\bREQUIRE_GUARD\b/)
  })

  it('gates each runtime behaviour on its own control', () => {
    expect(out, 'E2E bypass').toContain('policy.allowE2EGuardBypass')
    expect(out, 'resolved-shape validation').toContain('policy.validateResolvedShapes')
    expect(out, 'hook ordering').toContain("POLICY.guardResolutionOrder === 'before-hooks'")
    expect(out, 'updateEach').toContain('!POLICY.enableUpdateEach')
  })

  it('passes the whole policy to construction-time validation', () => {
    // Rather than three booleans threaded separately, which is how one of them
    // ends up forgotten at a call site.
    expect(out).toMatch(/validateOperationConfig\(raw, '.*' \+ String\(key\), POLICY\)/)
  })
})
