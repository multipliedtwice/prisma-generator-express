import type { Context } from 'hono'
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
> = Omit<BaseOperationConfig<HonoBeforeHook<TEnv>, TShape>, 'before' | 'after'> & {
  before?: HonoBeforeHook<TEnv>[]
  after?: HonoAfterHook<TEnv>[]
}

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
  BaseRouteConfig<HonoBeforeHook<TEnv>, Context<GeneratedHonoEnv<TEnv>>, TShape, TCtx>,
  HonoOpKeys
> & {
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