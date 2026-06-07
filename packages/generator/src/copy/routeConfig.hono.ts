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

export type HonoHookHandler<Env extends { Variables: Record<string, unknown> } = { Variables: Record<string, unknown> }> = (
  c: Context<Env>,
  next: Next,
) => Promise<Response | void> | Response | void

export type OperationConfig<TShape = Record<string, unknown>> =
  BaseOperationConfig<HonoHookHandler, TShape>

export type RouteConfig<TShape = Record<string, unknown>, TCtx = unknown> =
  BaseRouteConfig<HonoHookHandler, Context, TShape, TCtx>