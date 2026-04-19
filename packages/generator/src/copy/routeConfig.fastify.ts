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

export type OperationConfig = BaseOperationConfig<FastifyHookHandler>

export type RouteConfig = BaseRouteConfig<FastifyHookHandler, FastifyRequest>