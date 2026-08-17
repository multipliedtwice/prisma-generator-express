import { DMMF } from '@prisma/generator-helper'
import { generateRouteConfigType } from './generateRouteConfigType'
import { ImportStyle } from '../utils/resolveImportStyle'
import { importExt } from '../utils/importExt'
import { WriteStrategy } from '../constants'
import { OPERATION_METADATA } from '../copy/operationDefinitions'

function pathExpr(suffix: string): string {
  if (!suffix) return `basePath || '/'`
  return `\`\${basePath}${suffix}\``
}

function opKindFor(opName: string): string {
  switch (opName) {
    case 'findUnique':
    case 'findUniqueOrThrow':
      return 'readUnique'
    case 'findMany':
    case 'findFirst':
    case 'findFirstOrThrow':
    case 'findManyPaginated':
    case 'count':
    case 'aggregate':
    case 'groupBy':
      return 'read'
    case 'create':
      return 'create'
    case 'createMany':
    case 'createManyAndReturn':
      return 'createMany'
    case 'update':
      return 'update'
    case 'updateMany':
    case 'updateManyAndReturn':
      return 'updateMany'
    case 'upsert':
      return 'upsert'
    case 'delete':
      return 'delete'
    case 'deleteMany':
      return 'deleteMany'
    default:
      return 'noop'
  }
}

function emitReadOp(meta: (typeof OPERATION_METADATA)[number], modelName: string): string {
  const c = meta.name.charAt(0).toUpperCase() + meta.name.slice(1)
  const handlerName = `${modelName}${c}`
  const pathValue = pathExpr(meta.pathSuffix)
  const opKind = opKindFor(meta.name)

  const postReadLine = meta.supportsPostRead
    ? meta.name === 'findMany'
      ? `    if (postReadsEnabled) {
      const postPath = basePath ? \`\${basePath}/read\` : '/read'
      app.post(postPath, handleRead(opConfig, ${handlerName}, parseBodyAsQueryMiddleware, '${opKind}'))
    }`
      : `    if (postReadsEnabled) app.post(path, handleRead(opConfig, ${handlerName}, parseBodyAsQueryMiddleware, '${opKind}'))`
    : ''

  return `  if (isEnabled(config.${meta.configKey})) {
    const opConfig = opFor('${meta.configKey}')
    const path = ${pathValue}
    app.get(path, handleRead(opConfig, ${handlerName}, parseQueryMiddleware, '${opKind}'))
${postReadLine}
  }`
}

function emitWriteOp(meta: (typeof OPERATION_METADATA)[number], modelName: string): string {
  const c = meta.name.charAt(0).toUpperCase() + meta.name.slice(1)
  const handlerName = `${modelName}${c}`
  const pathValue = pathExpr(meta.pathSuffix)
  const opKind = opKindFor(meta.name)

  return `  if (isEnabled(config.${meta.configKey})) {
    const opConfig = opFor('${meta.configKey}')
    const path = ${pathValue}
    app.${meta.method}(path, handleWrite(opConfig, ${handlerName}, '${opKind}'))
  }`
}

/**
 * Guard behaviour is SEVEN INDEPENDENT OPT-IN CONTROLS on the route config.
 *
 * 1.64.2 shipped all of it as the default, which was a breaking change to a
 * published package. The first correction put all of it behind one `requireGuard`
 * switch, which was also wrong: these are unrelated decisions, and one switch
 * forces a consumer who wants a missing-guard refusal to also accept a
 * hook-ordering change and lose a route they may be using.
 *
 * Each is now its own option, each defaulting to the pre-1.64.2 behaviour:
 *
 *   - `requireGuardShape`           refuse an operation with no guard
 *   - `validateGuardShapes`         refuse an empty or key-mixing shape
 *   - `requireDefaultVariantOptIn`  confirm a `default` variant
 *   - `enableUpdateEach`            register the batch route (default true)
 *   - `guardResolutionOrder`        settle the guard before or after hooks
 *   - `allowE2EGuardBypass`         honour E2E=true (default true)
 *   - `validateResolvedShapes`      check what a shape function returned
 *
 * `HARDENED_GUARD_PROFILE` selects all seven, as values to spread rather than a
 * mode to store. See routeConfig.ts.
 *
 * Guard dropping is then a GENERATION-TIME decision, never a runtime one.
 *
 * The emitted router used to compute `DROP_GUARD = <flag> || _env.E2E === 'true'`,
 * so setting `E2E=true` in a deployed environment downgraded enforcement even
 * when the generator had been told to keep the guard. The two modes are not
 * equivalent: with the guard, the shape goes to prisma-guard; with it dropped,
 * `applyDroppedGuard` applies projection defaults and forced `where` clauses and
 * nothing else is validated against the shape.
 *
 * On an edge runtime that variable is an ordinary config var — set on a staging
 * deployment, copied forward, flagged as security-relevant nowhere. A
 * deployment's guard behaviour has to be a property of the artifact, not of the
 * environment it happens to land in.
 *
 * The rationale lives here rather than in the emitted file on purpose: generated
 * output is an artifact, and a paragraph about a bypass that no longer exists
 * would be copied into every router this generator writes.
 *
 * `updateEach` is refused for the same reason, one step further on — and, again,
 * only under the flag. It bypasses guard shapes by design — the endpoint is a
 * batch of `{ where, data }` items applied directly — and the only thing between
 * it and an unguarded mass mutation is a `console.warn` suppressed in
 * production. A warning is not a security boundary; it is advice to whoever
 * happens to be reading a development log. Refused at construction rather than
 * silently dropped, so a deployment expecting the route learns at boot instead
 * of at the first 404.
 */
export function generateHonoRouterFunction({
  model,
  enums,
  guardShapesImport,
  importStyle,
  writeStrategy,
  dropGuard,
}: {
  model: DMMF.Model
  enums: DMMF.DatamodelEnum[]
  guardShapesImport: string | null
  importStyle: ImportStyle
  writeStrategy: WriteStrategy
  dropGuard: boolean
}): string {
  const ext = importExt(importStyle)
  const modelName = model.name
  const modelNameLower = modelName.toLowerCase()
  const routerFunctionName = `${modelName}Router`

  const handlerImports = OPERATION_METADATA
    .map((m) => `  ${modelName}${m.name.charAt(0).toUpperCase() + m.name.slice(1)},`)
    .join('\n')

  const readOps = OPERATION_METADATA.filter((m) => m.kind === 'read')
  const writeOps = OPERATION_METADATA.filter((m) => m.kind === 'write' || m.kind === 'batch')
    .filter((m) => m.name !== 'updateEach')

  const readOpBlocks = readOps.map((m) => emitReadOp(m, modelName)).join('\n\n')
  const writeOpBlocks = writeOps.map((m) => emitWriteOp(m, modelName)).join('\n\n')

  return `import { Hono } from 'hono'
import type { Context } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { HTTPException } from 'hono/http-exception'
import {
${handlerImports}
} from './${modelName}Handlers${ext}'
import type {
  RouteConfig,
  HonoBeforeHook,
  HonoAfterHook,
  HonoEnvBase,
  HonoInternalVariables,
  GeneratedHonoEnv,
  PaginationConfig,
} from '../routeConfig.target${ext}'
import { parseQueryParams } from '../parseQueryParams${ext}'
import { normalizePrefix, getEnv, sanitizeKeys, isPlainObject } from '../misc${ext}'
import { buildModelOpenApi } from '../buildModelOpenApi${ext}'
import {
  normalizeOperation,
  resolveOperationVariantKey,
  resolveGuardPolicy,
  resolveGuardShapeOnce,
  validateCountSourceWhere,
  validateOperationConfig,
  validateUpdateEachConfig,
} from '../routeConfig${ext}'
import type { NormalizedOperationConfig } from '../routeConfig${ext}'
import { transformResult } from '../operationRuntime${ext}'
import { mapError } from '../errorMapper${ext}'
import { formatGuardVariantResolutionError } from '../guardVariantError${ext}'
import { mergePaginationConfig } from '../pagination${ext}'
import { applyDroppedGuard } from '../projectionDefaults${ext}'
import type { OpKind } from '../projectionDefaults${ext}'
import { MODEL_FIELDS, MODEL_ENUMS } from './${modelName}Metadata${ext}'

${generateRouteConfigType(modelName, 'HonoBeforeHook', guardShapesImport, importStyle, 'hono')}
const _env = getEnv()

// Fixed at generation time. The \`allowE2EGuardBypass\` control decides whether the
// environment can additionally drop the guard at runtime; it defaults to true,
// which is upstream behaviour. See generateRouterHono.ts.
const DROP_GUARD = ${dropGuard}

/**
 * DELIBERATELY NOT RECURSIVE.
 *
 * A self-referential JSON type sent through \`c.json()\` makes Hono's response
 * inference instantiate without a fixed point, and TypeScript answers
 * "type instantiation is excessively deep" — in the emitted file, for every
 * consumer. One level is all this needs: the value is serialised, not walked.
 */
type JsonLike = string | number | boolean | null | unknown[] | Record<string, unknown>

type OperationConfigLike<TEnv extends HonoEnvBase> = {
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
}

type NormalizedOp<TEnv extends HonoEnvBase> = NormalizedOperationConfig<
  HonoBeforeHook<TEnv>,
  HonoAfterHook<TEnv>
>

function normalizeHonoOperation<TEnv extends HonoEnvBase>(
  config: OperationConfigLike<TEnv> | undefined,
): NormalizedOp<TEnv> {
  return normalizeOperation<HonoBeforeHook<TEnv>, HonoAfterHook<TEnv>>(config)
}

type HandlerContext = Context<{ Variables: HonoInternalVariables }>

async function parseQueryMiddleware(c: HandlerContext): Promise<void> {
  const raw = c.req.query() as Record<string, unknown>
  if (raw && Object.keys(raw).length > 0) {
    c.set('parsedQuery', parseQueryParams(raw) as Record<string, unknown>)
  }
}

async function parseBodyAsQueryMiddleware(c: HandlerContext): Promise<void> {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    throw new HTTPException(400, { message: 'Request body must be a JSON object' })
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HTTPException(400, { message: 'Request body must be a JSON object' })
  }
  c.set('parsedQuery', sanitizeKeys(body as Record<string, unknown>))
}

async function parseUpdateEachBodyMiddleware(c: HandlerContext): Promise<void> {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    throw new HTTPException(400, { message: 'updateEach body must be an array of { where, data } items' })
  }
  if (!Array.isArray(body)) {
    throw new HTTPException(400, { message: 'updateEach body must be an array of { where, data } items' })
  }
  c.set('body', body)
}

async function parseWriteBodyMiddleware(c: HandlerContext): Promise<void> {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    throw new HTTPException(400, { message: 'Request body must be a JSON object' })
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HTTPException(400, { message: 'Request body must be a JSON object' })
  }
  c.set('body', body)
}

function makeShapeMiddleware<TCtx, TPrisma, TEnv extends HonoEnvBase>(
  config: ${modelName}RouteConfig<TCtx, TPrisma, TEnv>,
  opConfig: NormalizedOp<TEnv>,
  opKind: OpKind,
) {
  const policy = resolveGuardPolicy(config)

  /**
   * The environment bypass, honoured unless the consumer turned it off.
   *
   * \`E2E=true\` downgrading enforcement in a deployed environment is a real
   * hazard, and it is also upstream behaviour — so it is a control, not a
   * decision made here.
   */
  const dropGuard = DROP_GUARD || (policy.allowE2EGuardBypass && _env.E2E === 'true')

  return async (c: Context<GeneratedHonoEnv<TEnv>>): Promise<void> => {
    /**
     * INTERNAL REQUEST STATE IS SET THROUGH A CONCRETE CONTEXT.
     *
     * \`GeneratedHonoEnv<TEnv>['Variables']\` is \`HonoInternalVariables & TEnv['Variables']\`,
     * and inside this generic function TypeScript cannot know that the consumer's
     * half does not also declare \`routeConfig\` — so setting that key straight
     * onto \`c\` is unassignable to the intersection and the emitted router does not
     * typecheck under \`strict\` for ANY consumer. These keys belong to this
     * router, so they are written through the internal shape they were declared
     * in.
     */
    const vars = c as unknown as HandlerContext

    const merged = mergePaginationConfig(config.pagination, opConfig.pagination)
    if (merged) vars.set('routeConfig', { pagination: merged })

    const headerName = config.guard?.variantHeader || 'x-api-variant'
    const headerValue = c.req.header(headerName)
    const caller = config.guard?.resolveVariant?.(c) ?? headerValue ?? undefined
    if (typeof caller === 'string') vars.set('guardCaller', caller)

    const resolution = resolveOperationVariantKey(opConfig.guardRouting, caller)
    if (!resolution.ok) {
      vars.set('guardVariantFailure', resolution)
      return
    }

    const resolvedKey =
      opConfig.guardRouting.kind === 'named'
        ? resolution.key
        : undefined
    if (resolvedKey !== undefined) vars.set('guardVariantKey', resolvedKey)

    if (opConfig.guardShape) {
      const resolveCtx = typeof config.resolveContext === 'function'
        ? () => (config.resolveContext as unknown as (ctx: Context<GeneratedHonoEnv<TEnv>>) => unknown | Promise<unknown>)(c)
        : undefined

      /**
       * With \`validateResolvedShapes\`, resolved ONCE here and the validated value
       * is what travels onward — see resolveGuardShapeOnce. Passing the function
       * on would let it return a different shape when it is enforced than when it
       * was checked.
       *
       * Without it the raw shape is passed through untouched, which is upstream
       * behaviour: it is resolved at the point of use, and a function returning
       * something unusable is not this router's business to refuse.
       */
      let effectiveShape: Record<string, unknown> | undefined = opConfig.guardShape
      if (policy.validateResolvedShapes) {
        const resolution = await resolveGuardShapeOnce(opConfig.guardShape, resolvedKey, resolveCtx)
        if (!resolution.ok) {
          vars.set('guardShapeFailure', resolution.problem)
          return
        }
        // \`ok\` means the resolved value is a shape object; the fallback keeps the
        // declared shape rather than storing something the context cannot hold.
        effectiveShape = isPlainObject(resolution.shape) ? resolution.shape : opConfig.guardShape
      }

      if (!dropGuard) {
        vars.set('guardShape', effectiveShape)
      } else {
        await applyDroppedGuard(
          effectiveShape,
          resolvedKey,
          resolveCtx,
          opKind,
          {
            readQuery: vars.get('parsedQuery'),
            writeBody: isPlainObject(vars.get('body'))
              ? (vars.get('body') as Record<string, unknown>)
              : undefined,
          },
          () => {
            let target = vars.get('parsedQuery')
            if (!target) {
              target = {}
              vars.set('parsedQuery', target)
            }
            return target
          },
          () => {
            let target = vars.get('body')
            if (!isPlainObject(target)) {
              target = {}
              vars.set('body', target)
            }
            return target as Record<string, unknown>
          },
        )
      }
    }
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

function sendResult(c: HandlerContext): Response {
  const data = c.get('resultData')
  const status = (c.get('resultStatus') as number | undefined) ?? 200
  if (data === undefined) {
    throw new HTTPException(500, { message: 'No data set by handler' })
  }
  return c.json(transformResult(data) as JsonLike, status as ContentfulStatusCode)
}

function sendError(c: HandlerContext, error: unknown): Response {
  if (error instanceof HTTPException) {
    return c.json({ message: error.message }, error.status as ContentfulStatusCode)
  }
  const httpError = mapError(error)
  return c.json({ message: httpError.message }, httpError.status as ContentfulStatusCode)
}

export function ${routerFunctionName}<TCtx = unknown, TPrisma = any, TEnv extends HonoEnvBase = HonoEnvBase>(config: ${modelName}RouteConfig<TCtx, TPrisma, TEnv> = {}): Hono<GeneratedHonoEnv<TEnv>> {
  validateCountSourceWhere(config.pagination?.countSource, '${modelName} pagination')
  validateCountSourceWhere(
    (config.findManyPaginated && typeof config.findManyPaginated === 'object' ? config.findManyPaginated : undefined)?.pagination?.countSource,
    '${modelName} findManyPaginated pagination',
  )

  const app = new Hono<GeneratedHonoEnv<TEnv>>()

  const isEnabled = (value: unknown): boolean => value !== false && !!(config.enableAll || value)

  const customPrefix = normalizePrefix(config.customUrlPrefix || '')
  const modelPrefix = config.addModelPrefix !== false ? '/${modelNameLower}' : ''
  const basePath = customPrefix + modelPrefix

  const openApiDisabled = config.disableOpenApi === true
    || (config.disableOpenApi !== false && (
      _env.NODE_ENV === 'production'
      || _env.DISABLE_OPENAPI === 'true'
    ))

  const postReadsEnabled = !config.disablePostReads

  let _openApiJsonCache: unknown = undefined
  const getOpenApiJson = (): unknown => {
    if (_openApiJsonCache === undefined) {
      _openApiJsonCache = buildModelOpenApi(
        '${modelName}',
        MODEL_FIELDS as unknown as Parameters<typeof buildModelOpenApi>[1],
        MODEL_ENUMS as unknown as Parameters<typeof buildModelOpenApi>[2],
        config as unknown as Parameters<typeof buildModelOpenApi>[3],
        { format: 'json', writeStrategy: '${writeStrategy}' },
      )
    }
    return _openApiJsonCache
  }
  let _openApiYamlCache: string | undefined = undefined
  const getOpenApiYaml = (): string => {
    if (_openApiYamlCache === undefined) {
      _openApiYamlCache = buildModelOpenApi(
        '${modelName}',
        MODEL_FIELDS as unknown as Parameters<typeof buildModelOpenApi>[1],
        MODEL_ENUMS as unknown as Parameters<typeof buildModelOpenApi>[2],
        config as unknown as Parameters<typeof buildModelOpenApi>[3],
        { format: 'yaml', writeStrategy: '${writeStrategy}' },
      ) as string
    }
    return _openApiYamlCache
  }

  if (config.queryBuilder && _env.NODE_ENV !== 'production') {
    console.warn(
      '[${modelName}Router] queryBuilder config is present but Hono target does not auto-start it. ' +
      'Run \`npx prisma-query-builder-ui\` in a separate process.',
    )
  }

  app.onError((err, c) => {
    return sendError(c as unknown as HandlerContext, err)
  })

  if (!openApiDisabled) {
    const openapiJsonPath = basePath ? \`\${basePath}/openapi.json\` : '/openapi.json'
    const openapiYamlPath = basePath ? \`\${basePath}/openapi.yaml\` : '/openapi.yaml'
    app.get(openapiJsonPath, (c) => c.json(getOpenApiJson() as JsonLike))
    app.get(openapiYamlPath, (c) => {
      c.header('Content-Type', 'application/yaml')
      return c.body(getOpenApiYaml())
    })
  }

  const POLICY = resolveGuardPolicy(config)
  const SETTLE_BEFORE_HOOKS = POLICY.guardResolutionOrder === 'before-hooks'

  /**
   * The guard-resolution failures, raised in one place so both handlers and both
   * orderings share exactly one definition of what a failure is.
   *
   * WHERE it is called is the behavioural difference, and it is the
   * \`guardResolutionOrder\` control. \`'before-hooks'\` runs it before any operation
   * hook, because a hook that returns a Response — an auth gate, a cache, a
   * short-circuit for a known caller — would otherwise answer a request whose
   * guard was never established. \`'after-hooks'\` is upstream behaviour.
   *
   * \`guardShapeFailure\` is only ever set when \`validateResolvedShapes\` is on, so
   * that branch is inert rather than merely unreached when it is off.
   */
  const settleGuard = (c: Context<GeneratedHonoEnv<TEnv>>): void => {
    const vars = c as unknown as HandlerContext
    const failure = vars.get('guardVariantFailure')
    if (failure) {
      throw new HTTPException(400, {
        message: formatGuardVariantResolutionError(failure),
      })
    }

    const shapeFailure = vars.get('guardShapeFailure')
    if (shapeFailure) {
      throw new HTTPException(500, {
        message: 'guard shape could not be resolved: ' + shapeFailure,
      })
    }
  }

  const handleRead = (
    opConfig: NormalizedOp<TEnv>,
    handlerFn: (c: HandlerContext) => Promise<void>,
    parseFn: (c: HandlerContext) => Promise<void>,
    opKind: OpKind,
  ) => async (c: Context<GeneratedHonoEnv<TEnv>>): Promise<Response> => {
    try {
      await parseFn(c as unknown as HandlerContext)
      await makeShapeMiddleware<TCtx, TPrisma, TEnv>(config, opConfig, opKind)(c)

      // Settled BEFORE any hook can answer the request, when asked for.
      if (SETTLE_BEFORE_HOOKS) settleGuard(c)

      const operationBefore = await runBeforeHooks<TEnv>(opConfig.operationBefore, c)
      if (operationBefore) return operationBefore

      // Upstream order: hooks first, guard failure after.
      if (!SETTLE_BEFORE_HOOKS) settleGuard(c)

      const key = (c as unknown as HandlerContext).get('guardVariantKey')
      const variantHooks =
        key !== undefined ? opConfig.variantHooks[key] : undefined

      const variantBefore = await runBeforeHooks<TEnv>(variantHooks?.before ?? [], c)
      if (variantBefore) return variantBefore
      await handlerFn(c as unknown as HandlerContext)
      const variantAfter = await runAfterHooks<TEnv>(variantHooks?.after ?? [], c)
      if (variantAfter) return variantAfter
      const operationAfter = await runAfterHooks<TEnv>(opConfig.operationAfter, c)
      if (operationAfter) return operationAfter
      return sendResult(c as unknown as HandlerContext)
    } catch (error: unknown) {
      return sendError(c as unknown as HandlerContext, error)
    }
  }

  const handleWrite = (
    opConfig: NormalizedOp<TEnv>,
    handlerFn: (c: HandlerContext) => Promise<void>,
    opKind: OpKind,
  ) => async (c: Context<GeneratedHonoEnv<TEnv>>): Promise<Response> => {
    try {
      await parseWriteBodyMiddleware(c as unknown as HandlerContext)
      await makeShapeMiddleware<TCtx, TPrisma, TEnv>(config, opConfig, opKind)(c)

      // Settled BEFORE any hook can answer the request, when asked for.
      if (SETTLE_BEFORE_HOOKS) settleGuard(c)

      const operationBefore = await runBeforeHooks<TEnv>(opConfig.operationBefore, c)
      if (operationBefore) return operationBefore

      // Upstream order: hooks first, guard failure after.
      if (!SETTLE_BEFORE_HOOKS) settleGuard(c)

      const key = (c as unknown as HandlerContext).get('guardVariantKey')
      const variantHooks =
        key !== undefined ? opConfig.variantHooks[key] : undefined

      const variantBefore = await runBeforeHooks<TEnv>(variantHooks?.before ?? [], c)
      if (variantBefore) return variantBefore
      await handlerFn(c as unknown as HandlerContext)
      const variantAfter = await runAfterHooks<TEnv>(variantHooks?.after ?? [], c)
      if (variantAfter) return variantAfter
      const operationAfter = await runAfterHooks<TEnv>(opConfig.operationAfter, c)
      if (operationAfter) return operationAfter
      return sendResult(c as unknown as HandlerContext)
    } catch (error: unknown) {
      return sendError(c as unknown as HandlerContext, error)
    }
  }

  const opFor = <K extends keyof ${modelName}RouteConfig<TCtx, TPrisma, TEnv>>(
    key: K,
  ): NormalizedOp<TEnv> => {
    const raw = config[key] as unknown as OperationConfigLike<TEnv> | undefined
    validateOperationConfig(raw, '${modelName}.' + String(key), POLICY)
    return normalizeHonoOperation(raw)
  }

${readOpBlocks}

${writeOpBlocks}

  if (config.updateEach) {
    /**
     * Refused only when \`enableUpdateEach\` is false. It bypasses guard shapes by design — the
     * endpoint is a batch of { where, data } applied directly — and the only thing
     * between it and an unguarded mass mutation is a console.warn suppressed in
     * production. A warning is not a security boundary.
     *
     * Removing the route outright was a breaking change to a published package,
     * so by default it registers exactly as it did, warning and all.
     */
    if (!POLICY.enableUpdateEach) {
      throw new Error(
        '${modelName}.updateEach: enableUpdateEach is false, so this router ' +
        'does not register updateEach. It bypasses guard shapes entirely, so ' +
        'there is no configuration that makes it safe to expose. Perform batch ' +
        'updates through a guarded operation, or behind your own authenticated ' +
        'route outside the generated router.',
      )
    }

    const rawUpdateEach = config.updateEach as unknown as OperationConfigLike<TEnv>
    validateUpdateEachConfig(rawUpdateEach, '${modelName}.updateEach')
    const opConfig = normalizeHonoOperation(rawUpdateEach)
    if (opConfig.operationBefore.length === 0 && _env.NODE_ENV !== 'production') {
      console.warn(
        '[${modelName}Router] updateEach is enabled without a before hook. ' +
        'This endpoint bypasses guard shapes and should be protected by authentication middleware.',
      )
    }
    const path = basePath ? \`\${basePath}/each\` : '/each'
    app.post(path, async (c: Context<GeneratedHonoEnv<TEnv>>): Promise<Response> => {
      try {
        await parseUpdateEachBodyMiddleware(c as unknown as HandlerContext)
        await makeShapeMiddleware<TCtx, TPrisma, TEnv>(config, opConfig, 'noop')(c)
        const beforeResponse = await runBeforeHooks<TEnv>(opConfig.operationBefore, c)
        if (beforeResponse) return beforeResponse
        await ${modelName}UpdateEach(c as unknown as HandlerContext)
        const afterResponse = await runAfterHooks<TEnv>(opConfig.operationAfter, c)
        if (afterResponse) return afterResponse
        return sendResult(c as unknown as HandlerContext)
      } catch (error: unknown) {
        return sendError(c as unknown as HandlerContext, error)
      }
    })
  }

  return app
}
`
}