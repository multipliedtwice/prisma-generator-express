import type { Request, RequestHandler } from 'express'
import type {
  BaseOperationConfig,
  BaseRouteConfig,
  ProgressiveStage,
  ProgressiveVariantConfig,
  PrismaClientLike,
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
  PrismaClientLike,
}

export type {
  ProgressivePatch,
  ProgressiveStopResult,
  ProgressiveStageResult,
  ProgressiveStageContext,
  ProgressiveStage,
  ProgressiveVariantConfig,
  ManualProgressiveVariantConfig,
  AutoIncludeProgressiveVariantConfig,
} from './routeConfig'

export type OperationConfig<TShape = Record<string, unknown>> =
  BaseOperationConfig<RequestHandler, TShape>

export type ReadOperationConfig<
  TShape = Record<string, unknown>,
  TCtx = unknown,
  TPrisma extends PrismaClientLike = PrismaClientLike,
> = BaseOperationConfig<RequestHandler, TShape> & {
  progressive?: Record<string, ProgressiveVariantConfig>
  progressiveStages?: Record<string, ProgressiveStage<TCtx, TPrisma>>
}

type ReadOperationOverrides<TShape, TCtx, TPrisma extends PrismaClientLike> = {
  findFirst?: ReadOperationConfig<TShape, TCtx, TPrisma> | false
  findFirstOrThrow?: ReadOperationConfig<TShape, TCtx, TPrisma> | false
  findUnique?: ReadOperationConfig<TShape, TCtx, TPrisma> | false
  findUniqueOrThrow?: ReadOperationConfig<TShape, TCtx, TPrisma> | false
  findMany?: ReadOperationConfig<TShape, TCtx, TPrisma> | false
  findManyPaginated?: ReadOperationConfig<TShape, TCtx, TPrisma> | false
  count?: ReadOperationConfig<TShape, TCtx, TPrisma> | false
  aggregate?: ReadOperationConfig<TShape, TCtx, TPrisma> | false
  groupBy?: ReadOperationConfig<TShape, TCtx, TPrisma> | false
}

export type RouteConfig<
  TShape = Record<string, unknown>,
  TCtx = unknown,
  TPrisma extends PrismaClientLike = PrismaClientLike,
> = BaseRouteConfig<RequestHandler, Request, TShape, TCtx> &
  ReadOperationOverrides<TShape, TCtx, TPrisma>
