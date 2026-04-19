import { Request, RequestHandler } from 'express'
import {
  BaseOperationConfig,
  BaseRouteConfig,
  QueryBuilderConfig,
  OpenApiServerConfig,
  OpenApiSecuritySchemeConfig,
} from './routeConfig'

export type { QueryBuilderConfig, OpenApiServerConfig, OpenApiSecuritySchemeConfig }

export type OperationConfig = BaseOperationConfig<RequestHandler>

export type RouteConfig = BaseRouteConfig<RequestHandler, Request>