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
  PrismaClientLike,
} from './routeConfig'

export type {
  QueryBuilderConfig,
  OpenApiServerConfig,
  OpenApiSecuritySchemeConfig,
  WriteStrategy,
  FindManyPaginatedMode,
  PaginationConfig,
  PaginationCountSource,
  PrismaClientLike,
}

export type FastifyHookHandler = (
  request: FastifyRequest,
  reply: FastifyReply,
) => Promise<unknown> | unknown

export type OperationConfig<TShape = Record<string, unknown>> =
  BaseOperationConfig<FastifyHookHandler, TShape>

export type RouteConfig<
  TShape = Record<string, unknown>,
  TCtx = unknown,
> = BaseRouteConfig<FastifyHookHandler, FastifyRequest, TShape, TCtx> & {
  /**
   * Honour `PGE_DROP_GUARD=true` in the environment as a guard bypass
   * (deprecated alias: `E2E=true`). **Default `false` for this target.**
   *
   * Only the explicit `true` enables it; false or omitted means the
   * environment cannot drop guards. The generation-time `dropGuard` literal
   * is independent of this control and unchanged.
   */
  allowE2EGuardBypass?: boolean
}
