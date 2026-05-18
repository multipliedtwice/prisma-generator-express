import { Request, RequestHandler } from 'express'
import {
  BaseOperationConfig,
  BaseRouteConfig,
  QueryBuilderConfig,
  OpenApiServerConfig,
  OpenApiSecuritySchemeConfig,
} from './routeConfig'

export type { QueryBuilderConfig, OpenApiServerConfig, OpenApiSecuritySchemeConfig }

export type OperationConfig<TShape = Record<string, any>> =
  BaseOperationConfig<RequestHandler, TShape>

export type RouteConfig<TShape = Record<string, any>> =
  BaseRouteConfig<RequestHandler, Request, TShape>