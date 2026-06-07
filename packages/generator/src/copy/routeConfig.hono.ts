import type { Context, Next } from 'hono'
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

export type HonoHookHandler<Env extends { Variables: any } = any> = (
  c: Context<Env>,
  next: Next,
) => Promise<Response | void> | Response | void

export type OperationConfig<TShape = Record<string, any>> =
  BaseOperationConfig<HonoHookHandler, TShape>

export type RouteConfig<TShape = Record<string, any>, TCtx = unknown> =
  BaseRouteConfig<HonoHookHandler, Context, TShape, TCtx>