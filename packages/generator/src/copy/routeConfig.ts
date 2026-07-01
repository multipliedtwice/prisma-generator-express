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

export interface BaseOperationConfig<HookHandler, TShape = Record<string, unknown>> {
  before?: HookHandler[]
  after?: HookHandler[]
  shape?: TShape
  pagination?: Partial<PaginationConfig>
}

export interface BaseUpdateEachConfig<HookHandler> {
  before?: HookHandler[]
  after?: HookHandler[]
}

export interface BaseRouteConfig<
  HookHandler,
  RequestType,
  TShape = Record<string, unknown>,
  TCtx = unknown,
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
  findUnique?: BaseOperationConfig<HookHandler, TShape> | false
  findUniqueOrThrow?: BaseOperationConfig<HookHandler, TShape> | false
  findFirst?: BaseOperationConfig<HookHandler, TShape> | false
  findFirstOrThrow?: BaseOperationConfig<HookHandler, TShape> | false
  findMany?: BaseOperationConfig<HookHandler, TShape> | false
  findManyPaginated?: BaseOperationConfig<HookHandler, TShape> | false
  create?: BaseOperationConfig<HookHandler, TShape> | false
  createMany?: BaseOperationConfig<HookHandler, TShape> | false
  createManyAndReturn?: BaseOperationConfig<HookHandler, TShape> | false
  update?: BaseOperationConfig<HookHandler, TShape> | false
  updateMany?: BaseOperationConfig<HookHandler, TShape> | false
  updateManyAndReturn?: BaseOperationConfig<HookHandler, TShape> | false
  upsert?: BaseOperationConfig<HookHandler, TShape> | false
  delete?: BaseOperationConfig<HookHandler, TShape> | false
  deleteMany?: BaseOperationConfig<HookHandler, TShape> | false
  updateEach?: BaseUpdateEachConfig<HookHandler>
  aggregate?: BaseOperationConfig<HookHandler, TShape> | false
  count?: BaseOperationConfig<HookHandler, TShape> | false
  groupBy?: BaseOperationConfig<HookHandler, TShape> | false
}

export type OperationConfig = BaseOperationConfig<unknown>
export type RouteConfig = BaseRouteConfig<unknown, unknown>

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