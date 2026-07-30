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
 * Guard dropping is a GENERATION-TIME decision, never a runtime one.
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

// Fixed at generation time. Never read from the environment — see
// generateRouterHono.ts.
const DROP_GUARD = ${dropGuard}

type JsonLike =
  | string
  | number
  | boolean
  | null
  | JsonLike[]
  | { [k: string]: JsonLike }

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

function makeShapeMiddleware<TCtx, TPrisma, TEnv extends HonoEnvBase>(
  config: ${modelName}RouteConfig<TCtx, TPrisma, TEnv>,
  opConfig: NormalizedOp<TEnv>,
  opKind: OpKind,
) {
  return async (c: Context<GeneratedHonoEnv<TEnv>>): Promise<void> => {
    const merged = mergePaginationConfig(config.pagination, opConfig.pagination)
    if (merged) c.set('routeConfig', { pagination: merged })

    const headerName = config.guard?.variantHeader || 'x-api-variant'
    const headerValue = c.req.header(headerName)
    const caller = config.guard?.resolveVariant?.(c) ?? headerValue ?? undefined
    if (typeof caller === 'string') c.set('guardCaller', caller)

    const resolution = resolveOperationVariantKey(opConfig.guardRouting, caller)
    if (!resolution.ok) {
      c.set('guardVariantFailure', resolution)
      return
    }

    const resolvedKey =
      opConfig.guardRouting.kind === 'named'
        ? resolution.key
        : undefined
    if (resolvedKey !== undefined) c.set('guardVariantKey', resolvedKey)

    if (opConfig.guardShape) {
      if (!DROP_GUARD) {
        c.set('guardShape', opConfig.guardShape)
      } else {
        const resolveCtx = typeof config.resolveContext === 'function'
          ? () => (config.resolveContext as (ctx: Context<GeneratedHonoEnv<TEnv>>) => unknown | Promise<unknown>)(c)
          : undefined

        await applyDroppedGuard(
          opConfig.guardShape,
          resolvedKey,
          resolveCtx,
          opKind,
          {
            readQuery: c.get('parsedQuery'),
            writeBody: isPlainObject(c.get('body'))
              ? (c.get('body') as Record<string, unknown>)
              : undefined,
          },
          () => {
            let target = c.get('parsedQuery')
            if (!target) {
              target = {}
              c.set('parsedQuery', target)
            }
            return target
          },
          () => {
            let target = c.get('body')
            if (!isPlainObject(target)) {
              target = {}
              c.set('body', target)
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
        config as RouteConfig,
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
        config as RouteConfig,
        { format: 'yaml', writeStrategy: '${writeStrategy}' },
      ) as string
    }
    return _openApiYamlCache
  }

  if (config.queryBuilder && config.queryBuilder !== false && _env.NODE_ENV !== 'production') {
    console.warn(
      '[${modelName}Router] queryBuilder config is present but Hono target does not auto-start it. ' +
      'Run \`npx prisma-query-builder-ui\` in a separate process.',
    )
  }

  app.onError((err, c) => {
    return sendError(c as HandlerContext, err)
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

  const handleRead = (
    opConfig: NormalizedOp<TEnv>,
    handlerFn: (c: HandlerContext) => Promise<void>,
    parseFn: (c: HandlerContext) => Promise<void>,
    opKind: OpKind,
  ) => async (c: Context<GeneratedHonoEnv<TEnv>>): Promise<Response> => {
    try {
      await parseFn(c as unknown as HandlerContext)
      await makeShapeMiddleware<TCtx, TPrisma, TEnv>(config, opConfig, opKind)(c)

      /**
       * Variant resolution is settled BEFORE any operation hook runs.
       *
       * The check used to sit after \`operationBefore\`, so a hook that returned a
       * Response — an auth gate, a cache, a short-circuit for a known caller —
       * answered the request before anyone established which guard applied to
       * it. A cached response served for a request whose variant could not be
       * resolved is a response served under a guard nobody chose.
       *
       * Hooks that must run first belong outside the generated router, where
       * they are visibly not part of guard resolution.
       */
      const failure = c.get('guardVariantFailure')
      if (failure) {
        throw new HTTPException(400, {
          message: formatGuardVariantResolutionError(failure),
        })
      }

      const operationBefore = await runBeforeHooks<TEnv>(opConfig.operationBefore, c)
      if (operationBefore) return operationBefore

      const key = c.get('guardVariantKey')
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

      // Settled before any operation hook — see the read handler above.
      const failure = c.get('guardVariantFailure')
      if (failure) {
        throw new HTTPException(400, {
          message: formatGuardVariantResolutionError(failure),
        })
      }

      const operationBefore = await runBeforeHooks<TEnv>(opConfig.operationBefore, c)
      if (operationBefore) return operationBefore

      const key = c.get('guardVariantKey')
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
    validateOperationConfig(raw, '${modelName}.' + String(key))
    return normalizeHonoOperation(raw)
  }

${readOpBlocks}

${writeOpBlocks}

  if (config.updateEach) {
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