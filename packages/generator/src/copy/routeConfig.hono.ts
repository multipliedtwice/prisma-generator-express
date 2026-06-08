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

export type HonoEnvBase = {
  Variables: Record<string, unknown>
  Bindings?: Record<string, unknown>
}

export type HonoInternalVariables = {
  prisma?: unknown
  postgres?: unknown
  sqlite?: unknown
  parsedQuery?: Record<string, unknown>
  body?: unknown
  routeConfig?: { pagination?: unknown }
  guardShape?: Record<string, unknown>
  guardCaller?: string
  resultData?: unknown
  resultStatus?: number
}

export type GeneratedHonoEnv<TEnv extends HonoEnvBase = HonoEnvBase> = {
  Variables: HonoInternalVariables & TEnv['Variables']
  Bindings: TEnv['Bindings']
}

export type HonoHookHandler<TEnv extends HonoEnvBase = HonoEnvBase> = (
  c: Context<GeneratedHonoEnv<TEnv>>,
  next: Next,
) => Promise<Response | void> | Response | void

export type OperationConfig<
  TShape = Record<string, unknown>,
  TEnv extends HonoEnvBase = HonoEnvBase,
> = BaseOperationConfig<HonoHookHandler<TEnv>, TShape>

export type RouteConfig<
  TShape = Record<string, unknown>,
  TCtx = unknown,
  TEnv extends HonoEnvBase = HonoEnvBase,
> = BaseRouteConfig<HonoHookHandler<TEnv>, Context<GeneratedHonoEnv<TEnv>>, TShape, TCtx>