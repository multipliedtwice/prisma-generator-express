import type { FastifyRequest, FastifyReply } from 'fastify'
import type {
  BaseOperationConfig,
  BaseRouteConfig,
  QueryBuilderConfig,
  OpenApiServerConfig,
  OpenApiSecuritySchemeConfig,
} from './routeConfig'

export type {
  QueryBuilderConfig,
  OpenApiServerConfig,
  OpenApiSecuritySchemeConfig,
}

export type FastifyHookHandler = (
  request: FastifyRequest,
  reply: FastifyReply,
) => Promise<void> | void

export type OperationConfig<TShape = Record<string, unknown>> =
  BaseOperationConfig<FastifyHookHandler, TShape>

export type RouteConfig<TShape = Record<string, unknown>, TCtx = unknown> =
  BaseRouteConfig<FastifyHookHandler, FastifyRequest, TShape, TCtx>