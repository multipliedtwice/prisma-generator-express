import type { Context } from 'hono'
import type { GuardVariantResolution } from './guardVariantRouting'
import type {
  BaseOperationConfig,
  BaseRouteConfig,
  QueryBuilderConfig,
  OpenApiServerConfig,
  OpenApiSecuritySchemeConfig,
  WriteStrategy,
  FindManyPaginatedMode,
  PaginationConfig,
  PaginationCountSource,
} from './routeConfig'

export type {
  QueryBuilderConfig,
  OpenApiServerConfig,
  OpenApiSecuritySchemeConfig,
  WriteStrategy,
  FindManyPaginatedMode,
  PaginationConfig,
  PaginationCountSource,
}

export type HonoEnvBase = {
  Variables: Record<string, unknown>
  Bindings?: Record<string, unknown>
}

export type HonoInternalVariables = {
  prisma?: unknown
  postgres?: unknown
  sqlite?: unknown
  parsedQuery?: Record<string, unknown>
  body?: unknown
  routeConfig?: { pagination?: PaginationConfig }
  guardShape?: Record<string, unknown>
  guardCaller?: string
  guardVariantKey?: string
  guardVariantFailure?: Extract<GuardVariantResolution, { ok: false }>
  /**
   * Set when `validateResolvedShapes` refuses what a shape function returned.
   *
   * It was written by the router and never declared here, so the emitted router
   * failed to typecheck at exactly the line that implements the control.
   */
  guardShapeFailure?: string
  resultData?: unknown
  resultStatus?: number
}

export type GeneratedHonoEnv<TEnv extends HonoEnvBase = HonoEnvBase> = {
  Variables: HonoInternalVariables & TEnv['Variables']
  Bindings: TEnv['Bindings']
}

export type HonoBeforeHook<TEnv extends HonoEnvBase = HonoEnvBase> = (
  c: Context<GeneratedHonoEnv<TEnv>>,
) => Promise<Response | void> | Response | void

export type HonoAfterHook<TEnv extends HonoEnvBase = HonoEnvBase> = (
  c: Context<GeneratedHonoEnv<TEnv>>,
) => Promise<Response | void> | Response | void

/** @deprecated use HonoBeforeHook or HonoAfterHook */
export type HonoHookHandler<TEnv extends HonoEnvBase = HonoEnvBase> = HonoBeforeHook<TEnv>

export type OperationConfig<
  TShape = Record<string, unknown>,
  TEnv extends HonoEnvBase = HonoEnvBase,
> = BaseOperationConfig<
  HonoBeforeHook<TEnv>,
  TShape,
  HonoAfterHook<TEnv>
>

export type UpdateEachConfig<TEnv extends HonoEnvBase = HonoEnvBase> = {
  before?: HonoBeforeHook<TEnv>[]
  after?: HonoAfterHook<TEnv>[]
}

type HonoOpKeys =
  | 'findUnique'
  | 'findUniqueOrThrow'
  | 'findFirst'
  | 'findFirstOrThrow'
  | 'findMany'
  | 'findManyPaginated'
  | 'create'
  | 'createMany'
  | 'createManyAndReturn'
  | 'update'
  | 'updateMany'
  | 'updateManyAndReturn'
  | 'upsert'
  | 'delete'
  | 'deleteMany'
  | 'aggregate'
  | 'count'
  | 'groupBy'
  | 'updateEach'

export type RouteConfig<
  TShape = Record<string, unknown>,
  TCtx = unknown,
  TEnv extends HonoEnvBase = HonoEnvBase,
> = Omit<
  BaseRouteConfig<
    HonoBeforeHook<TEnv>,
    Context<GeneratedHonoEnv<TEnv>>,
    TShape,
    TCtx,
    HonoAfterHook<TEnv>
  >,
  HonoOpKeys
> & {
  /**
   * SEVEN INDEPENDENT GUARD CONTROLS. Every default reproduces the public
   * package's pre-1.64.2 behaviour exactly.
   *
   * 1.64.2 shipped these behaviours ON by default, which was a breaking change
   * to a published package. The first correction put all seven behind one
   * `requireGuard` switch, which was also wrong: they are unrelated decisions,
   * and bundling them means a consumer who wants a missing-guard refusal is also
   * forced into a hook-ordering change and the removal of a route they may use.
   *
   * So each is its own option. An unset option means the upstream default — never
   * an opinionated value chosen on the consumer's behalf. `HARDENED_GUARD_PROFILE`
   * selects all seven together for those who want them, but it is a set of values
   * to spread, not a mode: what gets stored is the individual settings.
   *
   * `GUARD_OPTION_METADATA` describes these machine-readably, so a UI can render
   * them without a hand-maintained second copy of the defaults.
   */

  /**
   * Refuse an operation that configures no guard at all. **Default `false`.**
   *
   * With it off — the upstream default — an unconfigured operation is emitted and
   * passes the caller's own where/select/include straight to Prisma. On, router
   * construction throws, which on a Worker is boot.
   */
  requireGuardShape?: boolean

  /**
   * Validate that a shape constrains something. **Default `false`.**
   *
   * On, `shape: {}` and a shape mixing guard keys with non-guard keys (usually a
   * typo: `wheer`, `iclude`) are refused, at the top level and inside variants.
   */
  validateGuardShapes?: boolean

  /**
   * Require `allowDefaultVariant: true` on an operation carrying a variant named
   * `default`. **Default `false`.**
   *
   * A `default` variant answers every unrecognised, blank and missing caller.
   * That is safe when it is the most restrictive variant and dangerous when it is
   * the most permissive, and nothing can tell which from the shape.
   */
  requireDefaultVariantOptIn?: boolean

  /**
   * Register the `updateEach` batch route. **Default `true`.**
   *
   * It bypasses guard shapes by design — a batch of `{ where, data }` applied
   * directly — and is protected only by a development-only warning. Set `false`
   * to refuse it at router construction.
   */
  enableUpdateEach?: boolean

  /**
   * When guard failures are raised relative to operation `before` hooks.
   * **Default `'after-hooks'`.**
   *
   * `'after-hooks'` is upstream behaviour: a hook may answer the request before
   * variant resolution is settled. `'before-hooks'` settles the guard first, so a
   * hook cannot answer a request whose guard was never established.
   */
  guardResolutionOrder?: 'after-hooks' | 'before-hooks'

  /**
   * Honour `E2E=true` in the environment as a guard bypass. **Default `true`.**
   *
   * Upstream behaviour, and a real hazard on an edge runtime where that variable
   * is an ordinary config var — set on staging, copied forward, flagged as
   * security-relevant nowhere. `false` makes guard behaviour a property of the
   * artifact alone.
   */
  allowE2EGuardBypass?: boolean

  /**
   * Check what a shape FUNCTION returned before using it. **Default `false`.**
   *
   * A function shape is opaque at construction time. On, a resolved value that is
   * empty, not an object, or carrying non-guard keys fails the request with 500 —
   * a deployment fault, not a caller fault — instead of running unguarded. It
   * also resolves the function exactly once and passes the validated value on.
   */
  validateResolvedShapes?: boolean

  findUnique?: OperationConfig<TShape, TEnv> | false
  findUniqueOrThrow?: OperationConfig<TShape, TEnv> | false
  findFirst?: OperationConfig<TShape, TEnv> | false
  findFirstOrThrow?: OperationConfig<TShape, TEnv> | false
  findMany?: OperationConfig<TShape, TEnv> | false
  findManyPaginated?: OperationConfig<TShape, TEnv> | false
  create?: OperationConfig<TShape, TEnv> | false
  createMany?: OperationConfig<TShape, TEnv> | false
  createManyAndReturn?: OperationConfig<TShape, TEnv> | false
  update?: OperationConfig<TShape, TEnv> | false
  updateMany?: OperationConfig<TShape, TEnv> | false
  updateManyAndReturn?: OperationConfig<TShape, TEnv> | false
  upsert?: OperationConfig<TShape, TEnv> | false
  delete?: OperationConfig<TShape, TEnv> | false
  deleteMany?: OperationConfig<TShape, TEnv> | false
  aggregate?: OperationConfig<TShape, TEnv> | false
  count?: OperationConfig<TShape, TEnv> | false
  groupBy?: OperationConfig<TShape, TEnv> | false
  updateEach?: UpdateEachConfig<TEnv>
}