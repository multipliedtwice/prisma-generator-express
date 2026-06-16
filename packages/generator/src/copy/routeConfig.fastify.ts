import type { FastifyRequest, FastifyReply } from 'fastify'
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

export type FastifyHookHandler = (
  request: FastifyRequest,
  reply: FastifyReply,
) => Promise<unknown> | unknown

export type OperationConfig<TShape = Record<string, unknown>> =
  BaseOperationConfig<FastifyHookHandler, TShape>

export type RouteConfig<TShape = Record<string, unknown>, TCtx = unknown> =
  BaseRouteConfig<FastifyHookHandler, FastifyRequest, TShape, TCtx>