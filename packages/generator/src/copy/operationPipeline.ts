import { HttpError, mapError } from './errorMapper'
import { formatGuardVariantResolutionError } from './guardVariantError'
import { isPlainObject } from './misc'
import {
  applyDroppedGuard,
  type ContextResolver,
  type OpKind,
} from './projectionDefaults'
import {
  resolveOperationVariantKey,
  resolveGuardShapeOnce,
  type NormalizedGuardRouting,
  type PaginationConfig,
  type FindManyPaginatedMode,
} from './routeConfig'
import type { GuardVariantResolution } from './guardVariantRouting'
import type {
  OperationContext,
  PrismaClientLike,
  RuntimeOperationOverride,
} from './operationRuntime'

/**
 * Transport-neutral orchestration shared by the Express, Fastify, Hono and MCP
 * emitters. Five stages: route, prepareGuard, settle, execute, classifyError.
 *
 * The pipeline never reads a request, a header or an authentication. Adapters
 * resolve the caller themselves and pass it in; `caller` is a routing key for
 * variant selection only, never an identity.
 */

/** Resolves application context at most once per request. */
export type GetContext<T = unknown> = () => Promise<T>

export function memoizeContext<T>(): GetContext<T>
export function memoizeContext<T>(resolver: () => T | undefined): GetContext<T>
export function memoizeContext(resolver?: () => unknown): GetContext {
  let cached: Promise<unknown> | undefined
  return () => (cached ??= Promise.resolve(resolver?.()))
}

/**
 * One request-scoped argument channel. Backed by adapter request storage
 * (Express `res.locals.parsedQuery` / `req.body`, the Fastify request, Hono
 * context vars). Dropped-guard transformations, framework hooks, overrides and
 * execution all observe the same storage through it, so guard transforms
 * cannot be dropped between stages.
 *
 * `read()` returns the STORED value — `undefined` when nothing was stored —
 * exactly like the storage it fronts; mutation of a stored object is visible
 * to every later stage.
 */
export type ArgsChannel = {
  read(): Record<string, unknown> | undefined
  write(next: Record<string, unknown>): void
}

/**
 * Runtime narrowing for the adapter boundary: request bags store the client
 * as `unknown` (Express `req.prisma`, the Fastify request, Hono vars), and
 * this is the ONE place that narrows it to the structural client contract the
 * pipeline types require. Missing client is the classic deployment fault —
 * classified 500, same message the operation core raises later.
 */
export function requirePrisma(value: unknown): PrismaClientLike {
  if (value === null || typeof value !== 'object') {
    throw new HttpError(
      500,
      'PrismaClient not found on request. Set req.prisma in middleware.',
    )
  }
  return value as PrismaClientLike
}

/** Ensure-style accessor over a channel: materialises and stores empties. */
export function ensureArgs(channel: ArgsChannel): Record<string, unknown> {
  const current = channel.read()
  if (current) return current
  const fresh: Record<string, unknown> = {}
  channel.write(fresh)
  return fresh
}

/** Minimal execution policy; `GuardPolicy` itself carries target defaults. */
export type PipelinePolicy = {
  dropGuard: boolean
  validateResolvedShapes: boolean
}

export type RouteStageOk = {
  ok: true
  variantKey: string | undefined
  caller: string | undefined
}

export type RouteStageResult = RouteStageOk | { ok: false; failure: HttpError }

export type GuardStageOk = {
  ok: true
  guardShape: Record<string, unknown> | undefined
}

export type GuardStageResult = GuardStageOk | { ok: false; failure: HttpError }

/**
 * Variant routing. Synchronous; no application context, no Prisma. A variant
 * failure is stored already classified as 400, so `settleStage` rethrows the
 * same classified error wherever the adapter chooses to settle it.
 */
export function routeOperation(input: {
  guardRouting: NormalizedGuardRouting
  caller: string | undefined
}): RouteStageResult {
  const resolution: GuardVariantResolution = resolveOperationVariantKey(
    input.guardRouting,
    input.caller,
  )
  if (!resolution.ok) {
    return {
      ok: false,
      failure: new HttpError(
        400,
        formatGuardVariantResolutionError(resolution),
      ),
    }
  }
  const variantKey =
    input.guardRouting.kind === 'named' ? resolution.key : undefined
  return {
    ok: true,
    variantKey,
    caller: typeof input.caller === 'string' ? input.caller : undefined,
  }
}

/**
 * Guard-shape preparation. Accepts only a successful route result at the type
 * level. Shape handling preserves upstream behaviour: default passes the raw
 * shape through unresolved; resolution happens only when the policy asks for
 * it (`validateResolvedShapes`, always on for MCP) or the guard is dropped
 * (local apply, written through the argument channels).
 *
 * Resolved-shape failures are stored classified as 500; `settleStage`
 * rethrows them unchanged.
 */
export async function prepareGuardOperation(
  routed: RouteStageOk,
  input: {
    guardShape: Record<string, unknown> | undefined
    opKind: OpKind
    policy: PipelinePolicy
    getContext: ContextResolver | undefined
    args: ArgsChannel
    writeArgs: ArgsChannel | undefined
  },
): Promise<GuardStageResult> {
  const { guardShape } = input
  if (!guardShape) return { ok: true, guardShape: undefined }

  try {
    if (input.policy.dropGuard) {
      await applyDroppedGuard(
        guardShape,
        routed.variantKey,
        input.getContext,
        input.opKind,
        {
          readQuery: input.args.read(),
          writeBody: input.writeArgs?.read(),
        },
        () => ensureArgs(input.args),
        input.writeArgs
          ? () => ensureArgs(input.writeArgs as ArgsChannel)
          : () => {
              throw new HttpError(
                500,
                'dropped guard requires a write argument channel for this operation',
              )
            },
      )
      return { ok: true, guardShape: undefined }
    }

    let effectiveShape: Record<string, unknown> = guardShape
    if (input.policy.validateResolvedShapes) {
      const resolution = await resolveGuardShapeOnce(
        guardShape,
        routed.variantKey,
        input.getContext,
      )
      if (!resolution.ok) {
        return {
          ok: false,
          failure: new HttpError(
            500,
            'guard shape could not be resolved: ' + resolution.problem,
          ),
        }
      }
      effectiveShape = isPlainObject(resolution.shape)
        ? resolution.shape
        : guardShape
    }
    return { ok: true, guardShape: effectiveShape }
  } catch (error) {
    return { ok: false, failure: mapError(error) }
  }
}

/**
 * Rethrows the stored classified failure without reclassification. Placement
 * is the adapter's behavioural choice (default order, Hono `before-hooks`,
 * MCP before authorize continuation).
 */
export function settleStage(
  result: RouteStageResult | GuardStageResult,
): asserts result is RouteStageOk | GuardStageOk {
  if (!result.ok) throw result.failure
}

/** Shared error classification; encoding stays per transport. */
export function classifyError(error: unknown): HttpError {
  return mapError(error)
}

export type ExecuteDeps<TPrisma extends PrismaClientLike = PrismaClientLike> = {
  core: (ctx: OperationContext) => Promise<unknown>
  args: ArgsChannel
  body?: unknown
  /** The caller's client; typed so `TPrisma` flows through the shared stage. */
  prisma: TPrisma
  postgres?: unknown
  sqlite?: unknown
  pagination?: PaginationConfig
  override?: RuntimeOperationOverride
  getContext: (() => unknown | Promise<unknown>) | undefined
  findManyPaginatedMode?: FindManyPaginatedMode
}

/**
 * Execution. Reads the argument channel at call time, so every write the
 * dropped-guard transformation made is what reaches the operation core — the
 * same core, pagination, override and transformResult path REST uses.
 */
export async function executeOperation<
  TPrisma extends PrismaClientLike = PrismaClientLike,
>(
  routed: { variantKey?: string; caller?: string },
  guard: { guardShape?: Record<string, unknown> },
  deps: ExecuteDeps<TPrisma>,
): Promise<unknown> {
  const ctx: OperationContext = {
    prisma: deps.prisma,
    postgres: deps.postgres,
    sqlite: deps.sqlite,
    parsedQuery: deps.args.read() ?? {},
    body: deps.body,
    guardShape: guard.guardShape,
    guardCaller: routed.caller,
    guardVariantKey: routed.variantKey,
    paginationConfig: deps.pagination,
    operationOverride: deps.override,
    resolveOperationContext: deps.getContext,
    findManyPaginatedMode: deps.findManyPaginatedMode,
  }
  return deps.core(ctx)
}
