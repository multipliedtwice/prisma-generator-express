import type { FastifyRequest, FastifyReply } from 'fastify'
import {
  BaseOperationConfig,
  BaseRouteConfig,
  QueryBuilderConfig,
  OpenApiServerConfig,
  OpenApiSecuritySchemeConfig,
} from './routeConfig'

export type { QueryBuilderConfig, OpenApiServerConfig, OpenApiSecuritySchemeConfig }

export type FastifyHookHandler = (
  request: FastifyRequest,
  reply: FastifyReply,
) => Promise<void> | void

export type OperationConfig<TShape = Record<string, any>> =
  BaseOperationConfig<FastifyHookHandler, TShape>

export type RouteConfig<TShape = Record<string, any>> =
  BaseRouteConfig<FastifyHookHandler, FastifyRequest, TShape>