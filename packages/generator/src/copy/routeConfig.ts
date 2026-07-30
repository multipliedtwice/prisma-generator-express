import { GUARD_SHAPE_CONFIG_KEYS } from './guardHelpers'
import { isPlainObject } from './misc'
import {
  resolveGuardVariantKey,
  type GuardVariantResolution,
} from './guardVariantRouting'

export interface QueryBuilderConfig {
  enabled?: boolean
  port?: number
  host?: string
  schemaPath?: string
  databaseUrl?: string
}

export interface OpenApiServerConfig {
  url: string
  description?: string
}

export interface OpenApiSecuritySchemeConfig {
  type: string
  scheme?: string
  bearerFormat?: string
  name?: string
  in?: string
  description?: string
}

export type WriteStrategy = 'regular' | 'throwOnNonReturning' | 'forceReturn'

export type FindManyPaginatedMode = 'transaction' | 'promiseAll'

export type PaginationCountSource =
  | { type?: 'delegate' }
  | {
      type: 'materializedView'
      relation: string
      schema?: string
      column?: string
      where?: Record<string, unknown>
    }

export interface PaginationConfig {
  defaultLimit?: number
  maxLimit?: number
  distinctCountLimit?: number
  countSource?: PaginationCountSource
}

export type ProgressivePatch = {
  key: string
  value: unknown
}

export type ProgressiveStopResult<T = unknown> = {
  stop: true
  data: T
}

export type ProgressiveStageResult<T = unknown> =
  | void
  | ProgressivePatch
  | ProgressivePatch[]
  | ProgressiveStopResult<T>

export type ProgressiveStageContext<TContext = unknown, TPrisma = any> = {
  ctx: TContext
  req: unknown
  res: unknown
  prisma: TPrisma
  variant: string
  accumulated: Record<string, unknown>
  signal: AbortSignal
}

export type ProgressiveStage<TContext = unknown, TPrisma = any, T = unknown> = (
  context: ProgressiveStageContext<TContext, TPrisma>,
) => Promise<ProgressiveStageResult<T>>

export type ManualProgressiveVariantConfig = {
  enabled?: boolean
  mode?: 'manual'
  stages: string[]
}

export type AutoIncludeProgressiveVariantConfig = {
  enabled?: boolean
  mode: 'autoInclude'
  fallback?: 'singleResult' | 'error'
}

export type ProgressiveVariantConfig =
  | ManualProgressiveVariantConfig
  | AutoIncludeProgressiveVariantConfig

export type VariantEntry<TShape, TBefore, TAfter> = {
  shape: TShape
  before?: TBefore[]
  after?: TAfter[]
}

type OperationShapeConfig<TShape, TBefore, TAfter> =
  | {
      shape?: TShape
      variants?: never
    }
  | {
      shape?: never
      variants: Record<string, VariantEntry<TShape, TBefore, TAfter>>
    }

export type BaseOperationConfig<
  TBefore,
  TShape = Record<string, unknown>,
  TAfter = TBefore,
> = OperationShapeConfig<TShape, TBefore, TAfter> & {
  before?: TBefore[]
  after?: TAfter[]
  pagination?: Partial<PaginationConfig>
}

export interface BaseUpdateEachConfig<TBefore, TAfter = TBefore> {
  before?: TBefore[]
  after?: TAfter[]
}

export interface BaseRouteConfig<
  TBefore,
  RequestType,
  TShape = Record<string, unknown>,
  TCtx = unknown,
  TAfter = TBefore,
> {
  enableAll?: boolean
  addModelPrefix?: boolean
  customUrlPrefix?: string
  specBasePath?: string
  disableOpenApi?: boolean
  disablePostReads?: boolean
  scalarCdnUrl?: string
  openApiTitle?: string
  openApiDescription?: string
  openApiVersion?: string
  openApiServers?: OpenApiServerConfig[]
  openApiSecuritySchemes?: Record<string, OpenApiSecuritySchemeConfig>
  openApiSecurity?: Record<string, string[]>[]
  guard?: {
    resolveVariant?: (request: RequestType) => string | undefined
    variantHeader?: string
  }
  resolveContext?: (request: RequestType) => TCtx | Promise<TCtx>
  queryBuilder?: QueryBuilderConfig | false
  pagination?: PaginationConfig
  findUnique?: BaseOperationConfig<TBefore, TShape, TAfter> | false
  findUniqueOrThrow?: BaseOperationConfig<TBefore, TShape, TAfter> | false
  findFirst?: BaseOperationConfig<TBefore, TShape, TAfter> | false
  findFirstOrThrow?: BaseOperationConfig<TBefore, TShape, TAfter> | false
  findMany?: BaseOperationConfig<TBefore, TShape, TAfter> | false
  findManyPaginated?: BaseOperationConfig<TBefore, TShape, TAfter> | false
  create?: BaseOperationConfig<TBefore, TShape, TAfter> | false
  createMany?: BaseOperationConfig<TBefore, TShape, TAfter> | false
  createManyAndReturn?: BaseOperationConfig<TBefore, TShape, TAfter> | false
  update?: BaseOperationConfig<TBefore, TShape, TAfter> | false
  updateMany?: BaseOperationConfig<TBefore, TShape, TAfter> | false
  updateManyAndReturn?: BaseOperationConfig<TBefore, TShape, TAfter> | false
  upsert?: BaseOperationConfig<TBefore, TShape, TAfter> | false
  delete?: BaseOperationConfig<TBefore, TShape, TAfter> | false
  deleteMany?: BaseOperationConfig<TBefore, TShape, TAfter> | false
  updateEach?: BaseUpdateEachConfig<TBefore, TAfter>
  aggregate?: BaseOperationConfig<TBefore, TShape, TAfter> | false
  count?: BaseOperationConfig<TBefore, TShape, TAfter> | false
  groupBy?: BaseOperationConfig<TBefore, TShape, TAfter> | false
}

export type OperationConfig = BaseOperationConfig<unknown>
export type RouteConfig = BaseRouteConfig<unknown, unknown>

export type NormalizedGuardRouting =
  | { kind: 'none' }
  | { kind: 'single' }
  | { kind: 'named'; keys: readonly string[] }

export type NormalizedVariantHooks<TBefore, TAfter> = Readonly<
  Record<
    string,
    {
      before: readonly TBefore[]
      after: readonly TAfter[]
    }
  >
>

export interface NormalizedOperationConfig<TBefore, TAfter> {
  guardShape?: Record<string, unknown>
  guardRouting: NormalizedGuardRouting
  operationBefore: readonly TBefore[]
  operationAfter: readonly TAfter[]
  variantHooks: NormalizedVariantHooks<TBefore, TAfter>
  pagination?: Readonly<Partial<PaginationConfig>>
}

type OperationConfigInput<TBefore, TAfter> = {
  before?: TBefore[]
  after?: TAfter[]
  shape?: unknown
  variants?: Record<
    string,
    {
      shape?: unknown
      before?: TBefore[]
      after?: TAfter[]
    }
  >
  pagination?: Partial<PaginationConfig>
}

function classifyGuardRouting(shape: unknown): NormalizedGuardRouting {
  if (shape === undefined) return { kind: 'none' }
  if (typeof shape === 'function') return { kind: 'single' }
  if (!isPlainObject(shape)) return { kind: 'single' }

  const keys = Object.keys(shape)
  const isSingle =
    keys.length === 0 ||
    keys.every((key) => GUARD_SHAPE_CONFIG_KEYS.has(key))

  return isSingle ? { kind: 'single' } : { kind: 'named', keys }
}

/**
 * A legacy `shape` must be a shape, and must constrain something.
 *
 * Two shapes that look configured and are not:
 *
 *   - `shape: {}` normalizes to a single shape with no constraints. It reads as
 *     "guarded" to a reviewer and lets everything through.
 *   - `shape: { where: …, admin: … }` mixes a reserved shape key with a
 *     non-reserved one. `classifyGuardRouting` decides by whether EVERY key is
 *     reserved, so one stray key silently reclassifies the whole operation as
 *     variant-routed — after which every request that does not name a variant
 *     gets a 400 for a reason no message explains. The commonest cause is a
 *     typo: `wheer`, `iclude`, `slect`.
 *
 * A function shape is opaque here and is accepted: it is resolved per request
 * and there is nothing to inspect at construction time.
 */
function validateShapeConfig(shape: unknown, location: string): void {
  if (typeof shape === 'function') return

  if (!isPlainObject(shape)) {
    throw new Error(
      location + ': shape must be an object or a function, got ' +
      (shape === null ? 'null' : Array.isArray(shape) ? 'array' : typeof shape),
    )
  }

  const keys = Object.keys(shape)
  if (keys.length === 0) {
    throw new Error(
      location + ': shape is empty, so it constrains nothing. Give it at least ' +
      'one guard key, or use variants.',
    )
  }

  const reserved = keys.filter((key) => GUARD_SHAPE_CONFIG_KEYS.has(key))
  if (reserved.length > 0 && reserved.length !== keys.length) {
    const stray = keys.filter((key) => !GUARD_SHAPE_CONFIG_KEYS.has(key))
    throw new Error(
      location + ': shape mixes guard keys (' + reserved.join(', ') + ') with ' +
      'non-guard keys (' + stray.join(', ') + '). A shape whose keys are not all ' +
      'guard keys is read as a VARIANT MAP, which is rarely intended — check for ' +
      'a typo, or split them into "variants".',
    )
  }
}

/**
 * Every emitted operation must carry a guard, and it must be one that constrains
 * something.
 *
 * An absent configuration used to return here silently, and the emitted handler
 * applies its guard under `if (opConfig.guardShape)` — so an operation nobody
 * configured reached Prisma with whatever `where`, `select` and `include` the
 * request supplied. Nothing warned, and the normalized operation was
 * structurally identical to a configured one apart from an absent shape, so
 * there was nothing to detect it by either.
 *
 * The refusal happens where the configuration is first visible — router
 * construction, which on a Worker is boot. A deployment that forgot a guard
 * fails to start instead of serving unguarded routes, which is the trade this
 * check exists to make.
 */
export function validateOperationConfig(
  config: { shape?: unknown; variants?: unknown; allowDefaultVariant?: unknown } | undefined,
  location: string,
): void {
  if (!config) {
    throw new Error(
      location + ': no guard configured. Every generated operation must define ' +
      '"shape" or "variants"; an unguarded operation would pass the caller\'s ' +
      'own where/select/include straight to Prisma.',
    )
  }

  const hasShape = config.shape !== undefined
  const hasVariants = config.variants !== undefined

  if (hasShape && hasVariants) {
    throw new Error(location + ': shape and variants cannot both be defined')
  }

  if (!hasShape && !hasVariants) {
    throw new Error(
      location + ': no guard configured. Define "shape" or "variants".',
    )
  }

  if (hasShape) {
    validateShapeConfig(config.shape, location)
    return
  }

  const variants = config.variants
  if (!isPlainObject(variants)) {
    throw new Error(location + ': variants must be a non-array object')
  }

  const entries = Object.entries(variants)
  if (entries.length === 0) {
    throw new Error(location + ': variants must contain at least one entry')
  }

  /**
   * A variant named `default` catches a missing, blank OR unknown caller, so it
   * turns three fail-closed paths into a pass at once. That is legitimate when
   * `default` is the most restrictive variant and dangerous when it is the most
   * permissive, which is how the word reads — and nothing can tell which from
   * the shape alone.
   *
   * So it must be asked for. `allowDefaultVariant: true` is a sentence the author
   * writes on purpose; a key called `default` is one they may have typed without
   * noticing what it catches.
   */
  if (Object.prototype.hasOwnProperty.call(variants, 'default')) {
    if (config.allowDefaultVariant !== true) {
      throw new Error(
        location + ': a variant named "default" answers every unrecognised, ' +
        'blank and missing caller. Set allowDefaultVariant: true to confirm ' +
        'that is intended, and make sure it is the most restrictive variant.',
      )
    }
  } else if (config.allowDefaultVariant !== undefined) {
    throw new Error(
      location + ': allowDefaultVariant is set but no "default" variant exists.',
    )
  }

  for (const [key, rawEntry] of entries) {
    if (GUARD_SHAPE_CONFIG_KEYS.has(key)) {
      throw new Error(
        location + ': variant name "' + key +
        '" collides with a reserved guard shape key',
      )
    }

    if (!isPlainObject(rawEntry)) {
      throw new Error(
        location + ': variant "' + key + '" must be an object with a shape',
      )
    }

    if (rawEntry.shape === undefined) {
      throw new Error(
        location + ': variant "' + key + '" is missing "shape"',
      )
    }

    /**
     * The SAME validation the legacy `shape` gets. Without this,
     * `variants: { public: { shape: {} } }` emitted a route that constrains
     * nothing — the exact hole the top-level check closes, reachable through a
     * different key. A guard is not more trustworthy for being written inside a
     * variant.
     */
    validateShapeConfig(rawEntry.shape, location + ' variant "' + key + '"')
  }
}

/**
 * What is wrong with a shape that has just been RESOLVED, or `null` if nothing.
 *
 * A function shape is opaque at construction time, so `validateShapeConfig`
 * accepts it and this is the second half of that bargain: whatever it returns is
 * checked before it is used. A function returning `{}`, `undefined`, or a map
 * with stray keys recreates the fail-open at request time, once per request,
 * where no configuration review will ever see it.
 *
 * Returns a description rather than throwing, because the caller is a request
 * handler: this is a 500 (the deployment is misconfigured), not an exception to
 * propagate as-is.
 */
export function describeResolvedGuardShape(resolved: unknown): string | null {
  if (resolved === null || resolved === undefined) {
    return 'the shape function returned nothing, so the operation would run unguarded'
  }

  if (!isPlainObject(resolved)) {
    return 'the shape function returned ' +
      (Array.isArray(resolved) ? 'an array' : typeof resolved) +
      ', which is not a guard shape'
  }

  const keys = Object.keys(resolved)
  if (keys.length === 0) {
    return 'the shape function returned an empty object, which constrains nothing'
  }

  const stray = keys.filter((key) => !GUARD_SHAPE_CONFIG_KEYS.has(key))
  if (stray.length > 0) {
    return 'the shape function returned non-guard keys (' + stray.join(', ') + ')'
  }

  return null
}

export function validateUpdateEachConfig(
  config: { variants?: unknown } | undefined,
  location: string,
): void {
  if (config?.variants !== undefined) {
    throw new Error(location + ': updateEach does not support variants')
  }
}

export function normalizeOperation<TBefore, TAfter>(
  config: OperationConfigInput<TBefore, TAfter> | undefined,
): NormalizedOperationConfig<TBefore, TAfter> {
  const operationBefore = config?.before ?? []
  const operationAfter = config?.after ?? []

  if (config?.variants !== undefined) {
    const entries = Object.entries(config.variants)

    return {
      guardShape: Object.fromEntries(
        entries.map(([key, entry]) => [key, entry.shape]),
      ),
      guardRouting: {
        kind: 'named',
        keys: entries.map(([key]) => key),
      },
      operationBefore,
      operationAfter,
      variantHooks: Object.fromEntries(
        entries.map(([key, entry]) => [
          key,
          {
            before: entry.before ?? [],
            after: entry.after ?? [],
          },
        ]),
      ),
      pagination: config.pagination,
    }
  }

  return {
    guardShape: config?.shape as Record<string, unknown> | undefined,
    guardRouting: classifyGuardRouting(config?.shape),
    operationBefore,
    operationAfter,
    variantHooks: {},
    pagination: config?.pagination,
  }
}

export function resolveOperationVariantKey(
  routing: NormalizedGuardRouting,
  caller: string | undefined,
): GuardVariantResolution {
  if (routing.kind === 'none' || routing.kind === 'single') {
    return resolveGuardVariantKey({ kind: 'single' })
  }

  return resolveGuardVariantKey({
    kind: 'named',
    keys: routing.keys,
    caller,
    reservedKeys: GUARD_SHAPE_CONFIG_KEYS,
  })
}

export function validateCountSourceWhere(
  cs: PaginationCountSource | undefined,
  location: string,
): void {
  if (!cs) return
  if ((cs as { type?: string }).type !== 'materializedView') return
  const where = (cs as { where?: Record<string, unknown> }).where
  if (!where) return
  for (const [key, value] of Object.entries(where)) {
    if (value === null) continue
    if (typeof value === 'object') {
      throw new Error(
        location + ': countSource.where["' + key + '"] must be scalar or null; got ' +
        (Array.isArray(value) ? 'array' : 'object'),
      )
    }
  }
}