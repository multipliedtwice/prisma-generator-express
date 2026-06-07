import type { Request, RequestHandler } from 'express'
import type {
  BaseOperationConfig,
  BaseRouteConfig,
  ProgressiveStage,
  ProgressiveVariantConfig,
  QueryBuilderConfig,
  OpenApiServerConfig,
  OpenApiSecuritySchemeConfig,
} from './routeConfig'

export type {
  QueryBuilderConfig,
  OpenApiServerConfig,
  OpenApiSecuritySchemeConfig,
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

export type ReadOperationConfig<TShape = Record<string, unknown>, TCtx = unknown> =
  BaseOperationConfig<RequestHandler, TShape> & {
    progressive?: Record<string, ProgressiveVariantConfig>
    progressiveStages?: Record<string, ProgressiveStage<TCtx>>
  }

type ReadOperationOverrides<TShape, TCtx> = {
  findFirst?: ReadOperationConfig<TShape, TCtx>
  findFirstOrThrow?: ReadOperationConfig<TShape, TCtx>
  findUnique?: ReadOperationConfig<TShape, TCtx>
  findUniqueOrThrow?: ReadOperationConfig<TShape, TCtx>
  findMany?: ReadOperationConfig<TShape, TCtx>
  findManyPaginated?: ReadOperationConfig<TShape, TCtx>
  count?: ReadOperationConfig<TShape, TCtx>
  aggregate?: ReadOperationConfig<TShape, TCtx>
  groupBy?: ReadOperationConfig<TShape, TCtx>
}

export type RouteConfig<TShape = Record<string, unknown>, TCtx = unknown> =
  BaseRouteConfig<RequestHandler, Request, TShape, TCtx> &
    ReadOperationOverrides<TShape, TCtx>