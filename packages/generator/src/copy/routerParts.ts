import type { Context } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { HTTPException } from 'hono/http-exception'
import { parseQueryParams } from './parseQueryParams'
import { sanitizeKeys, isPlainObject } from './misc'
import {
  normalizeOperation,
  resolveGuardPolicy,
  resolveOperationVariantKey,
  validateOperationConfig,
  type BaseRouteConfig,
  type GuardPolicy,
  type NormalizedOperationConfig,
  type PaginationConfig,
} from './routeConfig'
import type {
  HonoBeforeHook,
  HonoAfterHook,
  HonoEnvBase,
  GeneratedHonoEnv,
  HonoInternalVariables,
} from './routeConfig.hono'
import { mergePaginationConfig } from './pagination'
import { mapError } from './errorMapper'
import {
  routeOperation,
  prepareGuardOperation,
  settleStage,
  memoizeContext,
  type ArgsChannel,
} from './operationPipeline'
import { transformResult } from './operationRuntime'
import type { OpKind } from './projectionDefaults'

/**
 * Phase 9 static assembly boundary, Hono side.
 *
 * Every operation route is created here, one function per operation, reachable
 * only through the per-op named exports of a model's `*RouterParts.ts`. The
 * legacy router factory registers all of them; a bundle that imports only the
 * parts it serves omits the rest, and heavy features (OpenAPI renderer, the
 * query-builder UI, SSE/ndjson — Express-only — and materialized-view counting,
 * which pagination loads lazily) are unreachable unless a used part references
 * them.
 */

export type HandlerContext = Context<{ Variables: HonoInternalVariables }>

type JsonLike =
  | string
  | number
  | boolean
  | null
  | unknown[]
  | Record<string, unknown>

/**
 * The config surface a route needs, picked from the real BaseRouteConfig so
 * every emitted `*RouteConfig` is compatible by construction.
 */
export type HonoRouteConfigLike<TCtx, TEnv extends HonoEnvBase> = Pick<
  BaseRouteConfig<
    HonoBeforeHook<TEnv>,
    Context<GeneratedHonoEnv<TEnv>>,
    Record<string, unknown>,
    TCtx
  >,
  'resolveContext' | 'pagination' | 'guard' | 'disablePostReads'
> & {
  allowE2EGuardBypass?: boolean
}

export type HonoOpConfig<TEnv extends HonoEnvBase> = NormalizedOperationConfig<
  HonoBeforeHook<TEnv>,
  HonoAfterHook<TEnv>
>

export async function parseQueryMiddleware(c: HandlerContext): Promise<void> {
  const raw = c.req.query() as Record<string, unknown>
  if (raw && Object.keys(raw).length > 0) {
    c.set('parsedQuery', parseQueryParams(raw) as Record<string, unknown>)
  }
}

export async function parseBodyAsQueryMiddleware(
  c: HandlerContext,
): Promise<void> {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    throw new HTTPException(400, {
      message: 'Request body must be a JSON object',
    })
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HTTPException(400, {
      message: 'Request body must be a JSON object',
    })
  }
  c.set('parsedQuery', sanitizeKeys(body as Record<string, unknown>))
}

export async function parseWriteBodyMiddleware(
  c: HandlerContext,
): Promise<void> {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    throw new HTTPException(400, {
      message: 'Request body must be a JSON object',
    })
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HTTPException(400, {
      message: 'Request body must be a JSON object',
    })
  }
  c.set('body', body)
}

export async function parseUpdateEachBodyMiddleware(
  c: HandlerContext,
): Promise<void> {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    throw new HTTPException(400, {
      message: 'updateEach body must be an array of { where, data } items',
    })
  }
  if (!Array.isArray(body)) {
    throw new HTTPException(400, {
      message: 'updateEach body must be an array of { where, data } items',
    })
  }
  c.set('body', body)
}

function queryChannel(c: HandlerContext): ArgsChannel {
  return {
    read: () => c.get('parsedQuery'),
    write: (next) => c.set('parsedQuery', next),
  }
}

function bodyChannel(c: HandlerContext): ArgsChannel {
  return {
    read: () => {
      const body = c.get('body')
      return isPlainObject(body) ? body : undefined
    },
    write: (next) => c.set('body', next),
  }
}

export type HonoOperationConfigInput<TEnv extends HonoEnvBase> = {
  authorize?: HonoBeforeHook<TEnv>
  override?: import('./operationRuntime').RuntimeOperationOverride
  before?: HonoBeforeHook<TEnv>[]
  after?: HonoAfterHook<TEnv>[]
  shape?: unknown
  variants?: Record<
    string,
    {
      shape?: unknown
      before?: HonoBeforeHook<TEnv>[]
      after?: HonoAfterHook<TEnv>[]
    }
  >
  pagination?: Partial<PaginationConfig>
  disablePostReads?: boolean
}

export function normalizeHonoOperation<TEnv extends HonoEnvBase>(
  config: HonoOperationConfigInput<TEnv> | undefined,
): HonoOpConfig<TEnv> {
  return normalizeOperation<HonoBeforeHook<TEnv>, HonoAfterHook<TEnv>>(config)
}

/**
 * Validates and normalizes one operation config exactly as the legacy router
 * does, through the same shared code path.
 */
export function opConfigFor<TEnv extends HonoEnvBase>(
  raw: HonoOperationConfigInput<TEnv> | undefined,
  location: string,
  policy: Partial<GuardPolicy>,
): HonoOpConfig<TEnv> {
  validateOperationConfig(raw, location, policy)
  return normalizeHonoOperation<TEnv>(raw)
}

export function createShapeMiddleware<
  TCtx,
  TPrisma,
  TEnv extends HonoEnvBase,
>(input: {
  config: HonoRouteConfigLike<TCtx, TEnv>
  opConfig: HonoOpConfig<TEnv>
  opKind: OpKind
  dropGuard: boolean
}): (c: Context<GeneratedHonoEnv<TEnv>>) => Promise<void> {
  const policy = {
    dropGuard: input.dropGuard,
    validateResolvedShapes: resolveGuardPolicy(
      input.config as Partial<GuardPolicy>,
    ).validateResolvedShapes,
  }
  return async (c: Context<GeneratedHonoEnv<TEnv>>): Promise<void> => {
    const vars = c as unknown as HandlerContext
    vars.set('operationOverride', input.opConfig.override)
    const getContext = memoizeContext(() => input.config.resolveContext?.(c))
    vars.set('getContext', getContext)
    // legacy key, still populated for pre-existing typed hooks
    vars.set('resolveOperationContext', getContext)

    const merged = mergePaginationConfig(
      input.config.pagination,
      input.opConfig.pagination,
    )
    if (merged) vars.set('routeConfig', { pagination: merged })

    const headerName = input.config.guard?.variantHeader || 'x-api-variant'
    const headerValue = c.req.header(headerName)
    const caller =
      input.config.guard?.resolveVariant?.(c) ?? headerValue ?? undefined
    if (typeof caller === 'string') vars.set('guardCaller', caller)

    const resolution = resolveOperationVariantKey(
      input.opConfig.guardRouting,
      caller,
    )
    const routed = routeOperation({
      guardRouting: input.opConfig.guardRouting,
      caller,
    })
    if (!routed.ok) {
      // legacy key keeps the pre-1.x public shape for existing typed hooks
      if (!resolution.ok) vars.set('guardVariantFailure', resolution)
      vars.set('guardVariantStageFailure', routed)
      return
    }
    vars.set('guardVariantStageFailure', undefined)
    vars.set('guardVariantFailure', undefined)

    if (routed.variantKey !== undefined)
      vars.set('guardVariantKey', routed.variantKey)

    const guard = await prepareGuardOperation(routed, {
      guardShape: input.opConfig.guardShape,
      opKind: input.opKind,
      policy,
      getContext:
        typeof input.config.resolveContext === 'function'
          ? vars.get('getContext')
          : undefined,
      args: queryChannel(c as unknown as HandlerContext),
      writeArgs: bodyChannel(c as unknown as HandlerContext),
    })
    if (!guard.ok) {
      // legacy string key, still populated for pre-existing typed hooks
      vars.set(
        'guardShapeFailure',
        guard.failure.message.replace(
          'guard shape could not be resolved: ',
          '',
        ),
      )
      vars.set('guardShapeStageFailure', guard)
      return
    }
    vars.set('guardShapeFailure', undefined)
    vars.set('guardShapeStageFailure', undefined)

    vars.set('guardShape', guard.guardShape)
  }
}

export function createSettleGuard<TEnv extends HonoEnvBase>(): (
  c: Context<GeneratedHonoEnv<TEnv>>,
) => void {
  return (c: Context<GeneratedHonoEnv<TEnv>>): void => {
    const vars = c as unknown as HandlerContext
    const failure = vars.get('guardVariantStageFailure')
    if (failure) settleStage(failure)

    const shapeFailure = vars.get('guardShapeStageFailure')
    if (shapeFailure) settleStage(shapeFailure)
  }
}

async function runBeforeHooks<TEnv extends HonoEnvBase>(
  hooks: readonly HonoBeforeHook<TEnv>[],
  c: Context<GeneratedHonoEnv<TEnv>>,
): Promise<Response | undefined> {
  for (const hook of hooks) {
    const result = await hook(c)
    if (result instanceof Response) return result
  }
  return undefined
}

async function runAfterHooks<TEnv extends HonoEnvBase>(
  hooks: readonly HonoAfterHook<TEnv>[],
  c: Context<GeneratedHonoEnv<TEnv>>,
): Promise<Response | undefined> {
  for (const hook of hooks) {
    const result = await hook(c)
    if (result instanceof Response) return result
  }
  return undefined
}

export function sendResult(c: HandlerContext): Response {
  const data = c.get('resultData')
  const status = (c.get('resultStatus') as number | undefined) ?? 200
  if (data === undefined) {
    throw new HTTPException(500, { message: 'No data set by handler' })
  }
  return c.json(
    transformResult(data) as JsonLike,
    status as ContentfulStatusCode,
  )
}

export function sendError(c: HandlerContext, error: unknown): Response {
  if (error instanceof HTTPException) {
    return c.json(
      { message: error.message },
      error.status as ContentfulStatusCode,
    )
  }
  const httpError = mapError(error)
  return c.json(
    { message: httpError.message },
    httpError.status as ContentfulStatusCode,
  )
}

export function createReadRoute<
  TCtx,
  TPrisma,
  TEnv extends HonoEnvBase,
>(input: {
  config: HonoRouteConfigLike<TCtx, TEnv>
  opConfig: HonoOpConfig<TEnv>
  opKind: OpKind
  handler: (c: HandlerContext) => Promise<void>
  parse: 'query' | 'body'
  dropGuard: boolean
  settleBeforeHooks: boolean
}): (c: Context<GeneratedHonoEnv<TEnv>>) => Promise<Response> {
  const shape = createShapeMiddleware<TCtx, TPrisma, TEnv>(input)
  const settleGuard = createSettleGuard<TEnv>()
  const parseFn =
    input.parse === 'query' ? parseQueryMiddleware : parseBodyAsQueryMiddleware
  return async (c: Context<GeneratedHonoEnv<TEnv>>): Promise<Response> => {
    try {
      const authorized = await runBeforeHooks<TEnv>(
        input.opConfig.authorize ? [input.opConfig.authorize] : [],
        c,
      )
      if (authorized) return authorized
      await parseFn(c as unknown as HandlerContext)
      await shape(c)

      if (input.settleBeforeHooks) settleGuard(c)

      const operationBefore = await runBeforeHooks<TEnv>(
        input.opConfig.operationBefore,
        c,
      )
      if (operationBefore) return operationBefore

      if (!input.settleBeforeHooks) settleGuard(c)

      const key = (c as unknown as HandlerContext).get('guardVariantKey')
      const variantHooks =
        key !== undefined ? input.opConfig.variantHooks[key] : undefined

      const variantBefore = await runBeforeHooks<TEnv>(
        variantHooks?.before ?? [],
        c,
      )
      if (variantBefore) return variantBefore
      await input.handler(c as unknown as HandlerContext)
      const variantAfter = await runAfterHooks<TEnv>(
        variantHooks?.after ?? [],
        c,
      )
      if (variantAfter) return variantAfter
      const operationAfter = await runAfterHooks<TEnv>(
        input.opConfig.operationAfter,
        c,
      )
      if (operationAfter) return operationAfter
      return sendResult(c as unknown as HandlerContext)
    } catch (error: unknown) {
      return sendError(c as unknown as HandlerContext, error)
    }
  }
}

export function createWriteRoute<
  TCtx,
  TPrisma,
  TEnv extends HonoEnvBase,
>(input: {
  config: HonoRouteConfigLike<TCtx, TEnv>
  opConfig: HonoOpConfig<TEnv>
  opKind: OpKind
  handler: (c: HandlerContext) => Promise<void>
  dropGuard: boolean
  settleBeforeHooks: boolean
}): (c: Context<GeneratedHonoEnv<TEnv>>) => Promise<Response> {
  const shape = createShapeMiddleware<TCtx, TPrisma, TEnv>(input)
  const settleGuard = createSettleGuard<TEnv>()
  return async (c: Context<GeneratedHonoEnv<TEnv>>): Promise<Response> => {
    try {
      const authorized = await runBeforeHooks<TEnv>(
        input.opConfig.authorize ? [input.opConfig.authorize] : [],
        c,
      )
      if (authorized) return authorized
      await parseWriteBodyMiddleware(c as unknown as HandlerContext)
      await shape(c)

      if (input.settleBeforeHooks) settleGuard(c)

      const operationBefore = await runBeforeHooks<TEnv>(
        input.opConfig.operationBefore,
        c,
      )
      if (operationBefore) return operationBefore

      if (!input.settleBeforeHooks) settleGuard(c)

      const key = (c as unknown as HandlerContext).get('guardVariantKey')
      const variantHooks =
        key !== undefined ? input.opConfig.variantHooks[key] : undefined

      const variantBefore = await runBeforeHooks<TEnv>(
        variantHooks?.before ?? [],
        c,
      )
      if (variantBefore) return variantBefore
      await input.handler(c as unknown as HandlerContext)
      const variantAfter = await runAfterHooks<TEnv>(
        variantHooks?.after ?? [],
        c,
      )
      if (variantAfter) return variantAfter
      const operationAfter = await runAfterHooks<TEnv>(
        input.opConfig.operationAfter,
        c,
      )
      if (operationAfter) return operationAfter
      return sendResult(c as unknown as HandlerContext)
    } catch (error: unknown) {
      return sendError(c as unknown as HandlerContext, error)
    }
  }
}

export function createUpdateEachRoute<
  TCtx,
  TPrisma,
  TEnv extends HonoEnvBase,
>(input: {
  config: HonoRouteConfigLike<TCtx, TEnv>
  opConfig: HonoOpConfig<TEnv>
  handler: (c: HandlerContext) => Promise<void>
  dropGuard: boolean
}): (c: Context<GeneratedHonoEnv<TEnv>>) => Promise<Response> {
  const shape = createShapeMiddleware<TCtx, TPrisma, TEnv>({
    ...input,
    opKind: 'noop',
  })
  return async (c: Context<GeneratedHonoEnv<TEnv>>): Promise<Response> => {
    try {
      await parseUpdateEachBodyMiddleware(c as unknown as HandlerContext)
      await shape(c)
      const beforeResponse = await runBeforeHooks<TEnv>(
        input.opConfig.operationBefore,
        c,
      )
      if (beforeResponse) return beforeResponse
      await input.handler(c as unknown as HandlerContext)
      const afterResponse = await runAfterHooks<TEnv>(
        input.opConfig.operationAfter,
        c,
      )
      if (afterResponse) return afterResponse
      return sendResult(c as unknown as HandlerContext)
    } catch (error: unknown) {
      return sendError(c as unknown as HandlerContext, error)
    }
  }
}

/**
 * OpenAPI endpoints for one model. Takes prebuilt document getters so this
 * module never imports the renderer: a bundle that registers no OpenAPI part
 * keeps `yaml` and `buildModelOpenApi` out of its graph entirely.
 */
export function registerOpenApiRoutes(
  app: {
    get: (path: string, handler: (c: HandlerContext) => Response) => void
  },
  basePath: string,
  getJson: () => unknown,
  getYaml: () => string,
): void {
  const jsonPath = basePath ? `${basePath}/openapi.json` : '/openapi.json'
  const yamlPath = basePath ? `${basePath}/openapi.yaml` : '/openapi.yaml'
  app.get(jsonPath, (c) => c.json(getJson() as JsonLike))
  app.get(yamlPath, (c) => {
    c.header('Content-Type', 'application/yaml')
    return c.body(getYaml())
  })
}
