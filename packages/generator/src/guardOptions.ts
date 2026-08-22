/**
 * PUBLIC, COMPILED METADATA for the Hono guard controls.
 *
 * **Why this file exists separately from `src/copy/routeConfig.ts`.**
 * `src/copy/**` is excluded from the TypeScript build (`tsconfig.json`) because
 * those files are copied verbatim into a generated project rather than compiled
 * into this package. So anything defined only there is absent from `dist` and
 * unreachable through the package entry point — which made the first version of
 * this metadata unusable by the very consumer it was written for.
 *
 * This module is compiled, exported from `src/index.ts`, and therefore importable
 * as `require('prisma-generator-express').GUARD_OPTION_METADATA` from an
 * installed package. `test/consumer/packedMetadata.test.ts` proves that by packing
 * the tarball and importing it the way a consumer would.
 *
 * **Scope, stated narrowly.** This is authoritative for the seven M8.7 GUARD
 * controls and nothing else. The generator has many other public settings that
 * change the emitted API — `dropGuard`, the target, the write strategy, the
 * pagination mode, prefixes, OpenAPI options, the query-builder toggle — and none
 * of them are described here yet. A configuration UI cannot build a complete
 * screen from this file alone, and should not pretend otherwise.
 *
 * **Duplication is deliberate and guarded.** The runtime defaults live in
 * `src/copy/routeConfig.ts` because the generated project needs them with no
 * dependency on this package. They cannot import each other across the compile
 * boundary, so the values appear twice and
 * `test/unit/copy/guardOptionIndependence.test.ts` asserts the two agree, against
 * the resolver the router actually runs. Drift fails a test rather than shipping a
 * UI that advertises a default the code does not apply.
 */

export type GuardResolutionOrder = 'after-hooks' | 'before-hooks'

export type GuardPolicy = {
  requireGuardShape: boolean
  validateGuardShapes: boolean
  requireDefaultVariantOptIn: boolean
  enableUpdateEach: boolean
  guardResolutionOrder: GuardResolutionOrder
  allowE2EGuardBypass: boolean
  validateResolvedShapes: boolean
}

/**
 * The public package's pre-1.64.2 behaviour, exactly.
 *
 * An unset option resolves to the value here. Changing one changes what every
 * consumer who configured nothing gets on upgrade, which is the failure 1.64.2
 * shipped and this table exists to prevent.
 */
export const UPSTREAM_GUARD_DEFAULTS: Readonly<GuardPolicy> = Object.freeze({
  requireGuardShape: false,
  validateGuardShapes: false,
  requireDefaultVariantOptIn: false,
  enableUpdateEach: true,
  guardResolutionOrder: 'after-hooks',
  allowE2EGuardBypass: true,
  validateResolvedShapes: false,
})

/**
 * Every control at its most restrictive — a SHORTCUT, not a mode.
 *
 * Spread it, change what you disagree with, store the result. There is
 * deliberately no `preset: 'hardened'` option anywhere in this package: a stored
 * preset NAME would let a future version silently change what an existing
 * configuration does, which is the same class of mistake as 1.64.2.
 */
export const HARDENED_GUARD_PROFILE: Readonly<GuardPolicy> = Object.freeze({
  requireGuardShape: true,
  validateGuardShapes: true,
  requireDefaultVariantOptIn: true,
  enableUpdateEach: false,
  guardResolutionOrder: 'before-hooks',
  allowE2EGuardBypass: false,
  validateResolvedShapes: true,
})

export type GuardOptionMetadata = {
  name: keyof GuardPolicy
  type: 'boolean' | 'enum'
  values?: readonly string[]
  default: boolean | string
  hardened: boolean | string
  label: string
  description: string
  /** Present where the permissive value can emit an unguarded or caller-selected route. */
  warning: string
  /** The target whose generated router reads this control. */
  target: 'hono'
}

/**
 * Machine-readable description of the seven guard controls.
 *
 * `target: 'hono'` on every entry is not decoration. These options are declared
 * on the Hono route configuration only, because only the Hono generator reads
 * them; declaring them on the shared base made Express and Fastify accept them in
 * TypeScript and ignore them at runtime, which is a false public API.
 */
export const GUARD_OPTION_METADATA: readonly GuardOptionMetadata[] =
  Object.freeze([
    {
      name: 'requireGuardShape',
      type: 'boolean',
      default: UPSTREAM_GUARD_DEFAULTS.requireGuardShape,
      hardened: HARDENED_GUARD_PROFILE.requireGuardShape,
      label: 'Require a guard on every enabled operation',
      description:
        'Refuses at router construction when an operation defines neither "shape" nor "variants".',
      warning:
        "Off, an operation nobody configured passes the caller's own where/select/include straight to Prisma.",
      target: 'hono',
    },
    {
      name: 'validateGuardShapes',
      type: 'boolean',
      default: UPSTREAM_GUARD_DEFAULTS.validateGuardShapes,
      hardened: HARDENED_GUARD_PROFILE.validateGuardShapes,
      label: 'Validate guard shapes',
      description:
        'Refuses an empty shape, and one mixing guard keys with non-guard keys, at the top level and inside variants.',
      warning:
        'Off, "shape: {}" reads as guarded and constrains nothing. On, strict validation may reject existing route configs.',
      target: 'hono',
    },
    {
      name: 'requireDefaultVariantOptIn',
      type: 'boolean',
      default: UPSTREAM_GUARD_DEFAULTS.requireDefaultVariantOptIn,
      hardened: HARDENED_GUARD_PROFILE.requireDefaultVariantOptIn,
      label: 'Require confirmation for a "default" variant',
      description:
        'A variant named "default" must set allowDefaultVariant: true to be accepted.',
      warning:
        'A "default" variant answers every unrecognised, blank and missing caller.',
      target: 'hono',
    },
    {
      name: 'enableUpdateEach',
      type: 'boolean',
      default: UPSTREAM_GUARD_DEFAULTS.enableUpdateEach,
      hardened: HARDENED_GUARD_PROFILE.enableUpdateEach,
      label: 'Register the updateEach batch route',
      description:
        'Mounts POST <base>/each. Set false to refuse it at router construction.',
      warning:
        'updateEach bypasses guard shapes entirely; only a development-only warning stands between it and an unguarded mass update.',
      target: 'hono',
    },
    {
      name: 'guardResolutionOrder',
      type: 'enum',
      values: Object.freeze(['after-hooks', 'before-hooks']),
      default: UPSTREAM_GUARD_DEFAULTS.guardResolutionOrder,
      hardened: HARDENED_GUARD_PROFILE.guardResolutionOrder,
      label: 'When guard failures are raised',
      description:
        'after-hooks is the upstream behaviour; before-hooks settles variant and shape resolution before any operation hook runs.',
      warning:
        'With after-hooks, a hook that returns a Response can answer a request whose guard was never established.',
      target: 'hono',
    },
    {
      name: 'allowE2EGuardBypass',
      type: 'boolean',
      default: UPSTREAM_GUARD_DEFAULTS.allowE2EGuardBypass,
      hardened: HARDENED_GUARD_PROFILE.allowE2EGuardBypass,
      label: 'Honour the PGE_DROP_GUARD environment guard bypass',
      description:
        'Treats PGE_DROP_GUARD=true in the environment as a request to drop the guard. Deprecated alias: E2E=true.',
      warning:
        'A runtime variable can weaken a deployed artifact after generation. On an edge runtime this is an ordinary config var.',
      target: 'hono',
    },
    {
      name: 'validateResolvedShapes',
      type: 'boolean',
      default: UPSTREAM_GUARD_DEFAULTS.validateResolvedShapes,
      hardened: HARDENED_GUARD_PROFILE.validateResolvedShapes,
      label: 'Validate what a shape function returns',
      description:
        'Checks a dynamically resolved shape before use and fails the request with 500 if it is unusable. Also resolves it exactly once.',
      warning:
        'Off, a shape function returning {} or undefined runs the operation unguarded, once per request.',
      target: 'hono',
    },
  ])

/**
 * What this metadata does NOT cover.
 *
 * Exported so a consumer can display the gap rather than infer completeness from
 * silence, and so a test can assert the claim is narrow. Every name here is a
 * public setting that changes the emitted API and has no entry above.
 */
export const GUARD_METADATA_SCOPE = Object.freeze({
  covers: 'the seven M8.7 guard controls on the Hono target',
  complete: false,
  notDescribedYet: Object.freeze([
    'dropGuard',
    'target',
    'writeStrategy',
    'findManyPaginated / pagination mode',
    'pagination.countSource',
    'addModelPrefix / customUrlPrefix / specBasePath',
    'disableOpenApi and the OpenAPI metadata options',
    'disablePostReads',
    'queryBuilder',
    'guard.resolveVariant / guard.variantHeader',
  ]),
})

/** Fill in the defaults. Absent means upstream, never an opinion. */
export function resolveGuardPolicy(
  config: Partial<GuardPolicy> | undefined,
): GuardPolicy {
  return {
    requireGuardShape:
      config?.requireGuardShape ?? UPSTREAM_GUARD_DEFAULTS.requireGuardShape,
    validateGuardShapes:
      config?.validateGuardShapes ??
      UPSTREAM_GUARD_DEFAULTS.validateGuardShapes,
    requireDefaultVariantOptIn:
      config?.requireDefaultVariantOptIn ??
      UPSTREAM_GUARD_DEFAULTS.requireDefaultVariantOptIn,
    enableUpdateEach:
      config?.enableUpdateEach ?? UPSTREAM_GUARD_DEFAULTS.enableUpdateEach,
    guardResolutionOrder:
      config?.guardResolutionOrder ??
      UPSTREAM_GUARD_DEFAULTS.guardResolutionOrder,
    allowE2EGuardBypass:
      config?.allowE2EGuardBypass ??
      UPSTREAM_GUARD_DEFAULTS.allowE2EGuardBypass,
    validateResolvedShapes:
      config?.validateResolvedShapes ??
      UPSTREAM_GUARD_DEFAULTS.validateResolvedShapes,
  }
}
