import { describe, it, expect } from 'vitest'
import {
  validateOperationConfig,
  HARDENED_GUARD_PROFILE,
  UPSTREAM_GUARD_DEFAULTS,
  resolveGuardPolicy,
} from '../../../src/copy/routeConfig'
import { generateHonoRouterFunction } from '../../../src/generators/generateRouterHono'
import type { DMMF } from '@prisma/generator-helper'

/**
 * PRE-1.64.2 CONFIGURATIONS STILL BUILD — the compatibility half of the controls.
 *
 * 1.64.2 shipped guard hardening as the DEFAULT of a published package. Every
 * refusal in it was correct in isolation and collectively it was a breaking
 * change: a configuration that had worked since long before stopped constructing
 * its router at all, on upgrade, with no flag to turn it off.
 *
 * So each hardening became its own option, all defaulting to the pre-1.64.2
 * behaviour. `routeConfigGuardRefusal.test.ts` covers the refusals with every
 * control on; `guardOptionIndependence.test.ts` covers each acting alone; this
 * file covers the promise that matters to everyone who did not ask for any of it
 * — that touching nothing changes nothing.
 *
 * Each case here is EXACTLY what 1.64.2 refused.
 */

const AT = 'Post.findMany'

describe('every 1.64.2 refusal is inert without the flag', () => {
  const cases: Array<{ name: string; config: unknown; strictError: RegExp }> = [
    {
      name: 'an operation with no configuration at all',
      config: undefined,
      strictError: /no guard configured/,
    },
    {
      name: 'a configuration carrying neither shape nor variants',
      config: { before: [] },
      strictError: /no guard configured/,
    },
    {
      name: 'an empty shape, which constrains nothing',
      config: { shape: {} },
      strictError: /shape is empty/,
    },
    {
      name: 'a shape mixing guard keys with a typo',
      config: { shape: { where: { id: 1 }, wheer: {} } },
      strictError: /mixes guard keys/,
    },
    {
      name: 'a shape that is not an object or a function',
      config: { shape: 'nonsense' },
      strictError: /must be an object or a function/,
    },
    {
      name: 'a variant named "default" that was never opted into',
      config: { variants: { default: { shape: { where: {} } } } },
      strictError: /allowDefaultVariant/,
    },
    {
      name: 'an empty variant shape',
      config: { variants: { public: { shape: {} } } },
      strictError: /shape is empty/,
    },
  ]

  for (const { name, config, strictError } of cases) {
    it(`accepts ${name}`, () => {
      expect(() =>
        validateOperationConfig(config as Parameters<typeof validateOperationConfig>[0], AT),
      ).not.toThrow()
    })

    it(`accepts ${name} with the upstream defaults written out explicitly`, () => {
      // Explicit and absent must not diverge — a consumer who writes their choice
      // out to document it gets the same behaviour as one who omits it.
      expect(() =>
        validateOperationConfig(
          config as Parameters<typeof validateOperationConfig>[0],
          AT,
          UPSTREAM_GUARD_DEFAULTS,
        ),
      ).not.toThrow()
    })

    it(`refuses ${name} under the hardened profile`, () => {
      // The same input, the same call, one argument different. If this ever stops
      // throwing, the controls have quietly stopped doing anything.
      expect(() =>
        validateOperationConfig(
          config as Parameters<typeof validateOperationConfig>[0],
          AT,
          HARDENED_GUARD_PROFILE,
        ),
      ).toThrow(strictError)
    })
  }
})

describe('the checks that predate 1.64.2 still run in BOTH modes', () => {
  /**
   * Restoring the default must not have restored too much. These four were
   * refusals in 1.64.1, so removing them would be a breaking change in the other
   * direction — a configuration that used to be rejected silently starting to
   * build.
   */
  const legacyRefusals: Array<{ name: string; config: unknown; error: RegExp }> = [
    {
      name: 'shape and variants both defined',
      config: { shape: { where: {} }, variants: { a: { shape: { where: {} } } } },
      error: /cannot both be defined/,
    },
    {
      name: 'variants that are not an object',
      config: { variants: [] },
      error: /non-array object/,
    },
    {
      name: 'an empty variants map',
      config: { variants: {} },
      error: /at least one entry/,
    },
    {
      name: 'a variant named with a reserved guard key',
      config: { variants: { where: { shape: { where: {} } } } },
      error: /collides with a reserved guard shape key/,
    },
    {
      name: 'a variant entry that is not an object',
      config: { variants: { public: 'nope' } },
      error: /must be an object with a shape/,
    },
    {
      name: 'a variant entry with no shape',
      config: { variants: { public: { before: [] } } },
      error: /missing "shape"/,
    },
  ]

  for (const { name, config, error } of legacyRefusals) {
    for (const [label, policy] of [
      ['upstream defaults', UPSTREAM_GUARD_DEFAULTS],
      ['hardened profile', HARDENED_GUARD_PROFILE],
    ] as const) {
      it(`refuses ${name} under the ${label}`, () => {
        expect(() =>
          validateOperationConfig(
            config as Parameters<typeof validateOperationConfig>[0],
            AT,
            policy,
          ),
        ).toThrow(error)
      })
    }
  }
})

describe('a function shape stays opaque in both modes', () => {
  // It cannot be inspected at construction time, so it was accepted in 1.64.1 and
  // is still accepted under the flag. What the flag adds is a check on what it
  // RETURNS, per request — which is a runtime concern, not this one.
  for (const [label, policy] of [
    ['upstream defaults', UPSTREAM_GUARD_DEFAULTS],
    ['hardened profile', HARDENED_GUARD_PROFILE],
  ] as const) {
    it(`accepts a function shape under the ${label}`, () => {
      expect(() =>
        validateOperationConfig({ shape: () => ({ where: {} }) }, AT, policy),
      ).not.toThrow()
    })
  }
})

describe('the emitted router keeps the 1.64.1 runtime shape', () => {
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

  it('registers updateEach, which 1.64.2 removed outright', () => {
    expect(out, 'the updateEach route is still missing').toContain("'/each'")
    expect(out).toContain('PostUpdateEach(c as unknown as HandlerContext)')
  })

  it('still honours the E2E bypass for consumers who never opted in', () => {
    expect(out).toContain("_env.E2E === 'true'")
    const line = out.split('\n').find((l) => l.includes("_env.E2E === 'true'"))
    expect(line, 'the bypass is not gated on its own control').toContain(
      'policy.allowE2EGuardBypass',
    )
  })

  it('runs operation hooks before settling the guard, as 1.64.1 did', () => {
    const body = out.slice(out.indexOf('const handleRead ='), out.indexOf('const handleWrite ='))
    const hooks = body.indexOf('runBeforeHooks<TEnv>(opConfig.operationBefore')
    const legacy = body.indexOf('if (!SETTLE_BEFORE_HOOKS) settleGuard(c)')

    expect(legacy, 'the legacy ordering is gone').toBeGreaterThan(-1)
    expect(legacy, 'hooks no longer run first on the default path').toBeGreaterThan(hooks)
  })

  it('passes the raw shape through when the flag is off', () => {
    // 1.64.1 resolved a function shape at the point of use. Pre-resolving it for
    // everyone would change how many times a consumer's function is called.
    expect(out).toContain('let effectiveShape: unknown = opConfig.guardShape')
    expect(out).toContain('if (policy.validateResolvedShapes) {')
  })

  it('resolves every control through one defaulting function', () => {
    // One resolver and one table of defaults, rather than `config.x === true`
    // scattered per option — so GUARD_OPTION_METADATA cannot advertise a default
    // the router does not actually apply.
    expect(out).toContain('resolveGuardPolicy(config)')
  })
})
