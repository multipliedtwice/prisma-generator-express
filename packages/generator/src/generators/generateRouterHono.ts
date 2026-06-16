import { DMMF } from '@prisma/generator-helper'
import { generateRouteConfigType } from './generateRouteConfigType'
import { ImportStyle } from '../utils/resolveImportStyle'
import { importExt } from '../utils/importExt'
import { WriteStrategy, FindManyPaginatedMode } from '../constants'

export function generateHonoRouterFunction({
  model,
  enums,
  guardShapesImport,
  importStyle,
  writeStrategy,
  findManyPaginatedMode,
}: {
  model: DMMF.Model
  enums: DMMF.DatamodelEnum[]
  guardShapesImport: string | null
  importStyle: ImportStyle
  writeStrategy: WriteStrategy
  findManyPaginatedMode: FindManyPaginatedMode
}): string {
  const ext = importExt(importStyle)
  const modelName = model.name
  const modelNameLower = modelName.toLowerCase()
  const routerFunctionName = `${modelName}Router`

  const fieldsMeta = model.fields.map((f) => ({
    name: f.name,
    kind: f.kind,
    type: f.type,
    isList: f.isList,
    isRequired: f.isRequired,
    hasDefaultValue: f.hasDefaultValue,
    isUpdatedAt: f.isUpdatedAt ?? false,
    documentation: f.documentation,
    relationFromFields: f.relationFromFields,
  }))

  const referencedEnumTypes = new Set(
    model.fields.filter((f) => f.kind === 'enum').map((f) => f.type),
  )

  const enumsMeta = enums
    .filter((e) => referencedEnumTypes.has(e.name))
    .map((e) => ({
      name: e.name,
      values: e.values.map((v) => ({ name: v.name })),
    }))

  return `import { Hono } from 'hono'
import type { Context, Next } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { HTTPException } from 'hono/http-exception'
import { startQueryBuilder } from '../queryBuilder${ext}'
import {
  ${modelName}FindUnique,
  ${modelName}FindUniqueOrThrow,
  ${modelName}FindFirst,
  ${modelName}FindFirstOrThrow,
  ${modelName}FindMany,
  ${modelName}FindManyPaginated,
  ${modelName}Create,
  ${modelName}CreateMany,
  ${modelName}CreateManyAndReturn,
  ${modelName}Update,
  ${modelName}UpdateMany,
  ${modelName}UpdateManyAndReturn,
  ${modelName}Upsert,
  ${modelName}Delete,
  ${modelName}DeleteMany,
  ${modelName}Aggregate,
  ${modelName}Count,
  ${modelName}GroupBy,
} from './${modelName}Handlers${ext}'
import type {
  RouteConfig,
  HonoHookHandler,
  HonoEnvBase,
  HonoInternalVariables,
  GeneratedHonoEnv,
  WriteStrategy,
  FindManyPaginatedMode,
  PaginationConfig,
} from '../routeConfig.target${ext}'
import { parseQueryParams } from '../parseQueryParams${ext}'
import { sanitizeKeys, normalizePrefix, getEnv } from '../misc${ext}'
import { buildModelOpenApi } from '../buildModelOpenApi${ext}'
import {
  mapError,
  transformResult,
  mergePaginationConfig,
  type OperationContext,
} from '../operationRuntime${ext}'

${generateRouteConfigType(modelName, 'HonoHookHandler', guardShapesImport, importStyle, 'hono')}
const _env = getEnv()

const WRITE_STRATEGY: WriteStrategy = '${writeStrategy}'
const FIND_MANY_PAGINATED_MODE: FindManyPaginatedMode = '${findManyPaginatedMode}'

const MODEL_FIELDS = ${JSON.stringify(fieldsMeta, null, 2)} as const

const MODEL_ENUMS = ${JSON.stringify(enumsMeta, null, 2)} as const

type OperationConfigLike<TEnv extends HonoEnvBase> = {
  before?: HonoHookHandler<TEnv>[]
  after?: HonoHookHandler<TEnv>[]
  shape?: Record<string, unknown>
  pagination?: Partial<PaginationConfig>
}

const defaultOpConfig = Object.freeze({
  before: Object.freeze([]),
  after: Object.freeze([]),
}) as unknown as OperationConfigLike<HonoEnvBase>

type HandlerContext = Context<{ Variables: HonoInternalVariables & { findManyPaginatedMode?: FindManyPaginatedMode } }>

function isQueryBuilderEnabled(config: RouteConfig): boolean {
  if (config.queryBuilder === false) return false
  if (typeof config.queryBuilder === 'object' && config.queryBuilder.enabled === false) return false
  if (_env.NODE_ENV === 'production') return false
  return true
}

function getQueryBuilderConfig(config: RouteConfig) {
  if (config.queryBuilder === false) return null
  if (typeof config.queryBuilder === 'object') return config.queryBuilder
  return {}
}

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
  c.set('body', sanitizeKeys(body as Record<string, unknown>))
}

function makeShapeMiddleware<TCtx, TPrisma, TEnv extends HonoEnvBase>(
  config: ${modelName}RouteConfig<TCtx, TPrisma, TEnv>,
  opConfig: OperationConfigLike<TEnv>,
) {
  return (c: Context<GeneratedHonoEnv<TEnv>>): void => {
    const merged = mergePaginationConfig(config.pagination, opConfig.pagination)
    if (merged) {
      c.set('routeConfig', { pagination: merged })
    }
    ;(c as unknown as HandlerContext).set('findManyPaginatedMode', FIND_MANY_PAGINATED_MODE)
    const headerName = config.guard?.variantHeader || 'x-api-variant'
    const headerValue = c.req.header(headerName)
    const caller = config.guard?.resolveVariant?.(c) ?? headerValue ?? undefined
    if (caller) c.set('guardCaller', caller)
    if (opConfig.shape) {
      c.set('guardShape', opConfig.shape)
    }
  }
}

async function runHooks<TEnv extends HonoEnvBase>(
  hooks: HonoHookHandler<TEnv>[],
  c: Context<GeneratedHonoEnv<TEnv>>,
): Promise<Response | undefined> {
  for (const hook of hooks) {
    let advanced = false
    const next: Next = async () => {
      advanced = true
    }
    const result = await hook(c, next)
    if (result instanceof Response) return result
    if (!advanced) {
      if (_env.NODE_ENV !== 'production') {
        console.warn(
          '[hono-router] Hook returned without calling next() or returning a Response. ' +
          'Use \`return c.json(...)\` to short-circuit, or \`await next()\` to continue.',
        )
      }
      return c.body(null) ?? undefined
    }
  }
  return undefined
}

function sendResult(c: HandlerContext): Response {
  const data = c.get('resultData')
  const status = (c.get('resultStatus') as number | undefined) ?? 200
  if (data === undefined) {
    throw new HTTPException(500, { message: 'No data set by handler' })
  }
  return c.json(transformResult(data) as Record<string, unknown>, status as ContentfulStatusCode)
}

function sendError(c: HandlerContext, error: unknown): Response {
  const httpError = mapError(error)
  return c.json({ message: httpError.message }, httpError.status as ContentfulStatusCode)
}

export function ${routerFunctionName}<TCtx = unknown, TPrisma = any, TEnv extends HonoEnvBase = HonoEnvBase>(config: ${modelName}RouteConfig<TCtx, TPrisma, TEnv> = {}): Hono<GeneratedHonoEnv<TEnv>> {
  const app = new Hono<GeneratedHonoEnv<TEnv>>()

  const customPrefix = normalizePrefix(config.customUrlPrefix || '')
  const modelPrefix = config.addModelPrefix !== false ? '/${modelNameLower}' : ''
  const basePath = customPrefix + modelPrefix

  const openApiDisabled = config.disableOpenApi === true
    || (config.disableOpenApi !== false && (
      _env.DISABLE_OPENAPI === 'true'
      || _env.NODE_ENV === 'production'
    ))

  const postReadsEnabled = !config.disablePostReads

  const openApiJsonSpec = openApiDisabled
    ? null
    : buildModelOpenApi(
        '${modelName}',
        MODEL_FIELDS as unknown as Parameters<typeof buildModelOpenApi>[1],
        MODEL_ENUMS as unknown as Parameters<typeof buildModelOpenApi>[2],
        config as RouteConfig,
        { format: 'json', writeStrategy: WRITE_STRATEGY },
      )
  const openApiYamlSpec = openApiDisabled
    ? null
    : buildModelOpenApi(
        '${modelName}',
        MODEL_FIELDS as unknown as Parameters<typeof buildModelOpenApi>[1],
        MODEL_ENUMS as unknown as Parameters<typeof buildModelOpenApi>[2],
        config as RouteConfig,
        { format: 'yaml', writeStrategy: WRITE_STRATEGY },
      )

  if (isQueryBuilderEnabled(config as RouteConfig)) {
    const qbConfig = getQueryBuilderConfig(config as RouteConfig)
    if (qbConfig) {
      try {
        startQueryBuilder(qbConfig)
      } catch (err) {
        if (_env.NODE_ENV !== 'production') console.warn('[query-builder]', err)
      }
    }
  }

  app.onError((err, c) => {
    if (err instanceof HTTPException) {
      return c.json({ message: err.message }, err.status as ContentfulStatusCode)
    }
    return sendError(c as HandlerContext, err)
  })

  if (!openApiDisabled) {
    const openapiJsonPath = basePath ? \`\${basePath}/openapi.json\` : '/openapi.json'
    const openapiYamlPath = basePath ? \`\${basePath}/openapi.yaml\` : '/openapi.yaml'
    app.get(openapiJsonPath, (c) => c.json(openApiJsonSpec as Record<string, unknown>))
    app.get(openapiYamlPath, (c) => {
      c.header('Content-Type', 'application/yaml')
      return c.body(openApiYamlSpec as string)
    })
  }

  const handleRead = (
    opConfig: OperationConfigLike<TEnv>,
    handlerFn: (c: HandlerContext) => Promise<void>,
    parseFn: (c: HandlerContext) => Promise<void>,
  ) => async (c: Context<GeneratedHonoEnv<TEnv>>): Promise<Response> => {
    try {
      await parseFn(c as unknown as HandlerContext)
      makeShapeMiddleware<TCtx, TPrisma, TEnv>(config, opConfig)(c)
      const { before = [], after = [] } = opConfig
      const beforeResp = await runHooks<TEnv>(before, c)
      if (beforeResp) return beforeResp
      await handlerFn(c as unknown as HandlerContext)
      const afterResp = await runHooks<TEnv>(after, c)
      if (afterResp) return afterResp
      return sendResult(c as unknown as HandlerContext)
    } catch (error: unknown) {
      return sendError(c as unknown as HandlerContext, error)
    }
  }

  const handleWrite = (
    opConfig: OperationConfigLike<TEnv>,
    handlerFn: (c: HandlerContext) => Promise<void>,
  ) => async (c: Context<GeneratedHonoEnv<TEnv>>): Promise<Response> => {
    try {
      await parseWriteBodyMiddleware(c as unknown as HandlerContext)
      makeShapeMiddleware<TCtx, TPrisma, TEnv>(config, opConfig)(c)
      const { before = [], after = [] } = opConfig
      const beforeResp = await runHooks<TEnv>(before, c)
      if (beforeResp) return beforeResp
      await handlerFn(c as unknown as HandlerContext)
      const afterResp = await runHooks<TEnv>(after, c)
      if (afterResp) return afterResp
      return sendResult(c as unknown as HandlerContext)
    } catch (error: unknown) {
      return sendError(c as unknown as HandlerContext, error)
    }
  }

  const opFor = <K extends keyof ${modelName}RouteConfig<TCtx, TPrisma, TEnv>>(key: K): OperationConfigLike<TEnv> => {
    return (config[key] as unknown as OperationConfigLike<TEnv> | undefined)
      ?? (defaultOpConfig as OperationConfigLike<TEnv>)
  }

  if (config.enableAll || config.findFirst) {
    const opConfig = opFor('findFirst')
    const path = basePath ? \`\${basePath}/first\` : '/first'
    app.get(path, handleRead(opConfig, ${modelName}FindFirst, parseQueryMiddleware))
    if (postReadsEnabled) app.post(path, handleRead(opConfig, ${modelName}FindFirst, parseBodyAsQueryMiddleware))
  }
  if (config.enableAll || config.findFirstOrThrow) {
    const opConfig = opFor('findFirstOrThrow')
    const path = basePath ? \`\${basePath}/first/strict\` : '/first/strict'
    app.get(path, handleRead(opConfig, ${modelName}FindFirstOrThrow, parseQueryMiddleware))
    if (postReadsEnabled) app.post(path, handleRead(opConfig, ${modelName}FindFirstOrThrow, parseBodyAsQueryMiddleware))
  }
  if (config.enableAll || config.findManyPaginated) {
    const opConfig = opFor('findManyPaginated')
    const path = basePath ? \`\${basePath}/paginated\` : '/paginated'
    app.get(path, handleRead(opConfig, ${modelName}FindManyPaginated, parseQueryMiddleware))
    if (postReadsEnabled) app.post(path, handleRead(opConfig, ${modelName}FindManyPaginated, parseBodyAsQueryMiddleware))
  }
  if (config.enableAll || config.aggregate) {
    const opConfig = opFor('aggregate')
    const path = basePath ? \`\${basePath}/aggregate\` : '/aggregate'
    app.get(path, handleRead(opConfig, ${modelName}Aggregate, parseQueryMiddleware))
    if (postReadsEnabled) app.post(path, handleRead(opConfig, ${modelName}Aggregate, parseBodyAsQueryMiddleware))
  }
  if (config.enableAll || config.count) {
    const opConfig = opFor('count')
    const path = basePath ? \`\${basePath}/count\` : '/count'
    app.get(path, handleRead(opConfig, ${modelName}Count, parseQueryMiddleware))
    if (postReadsEnabled) app.post(path, handleRead(opConfig, ${modelName}Count, parseBodyAsQueryMiddleware))
  }
  if (config.enableAll || config.groupBy) {
    const opConfig = opFor('groupBy')
    const path = basePath ? \`\${basePath}/groupby\` : '/groupby'
    app.get(path, handleRead(opConfig, ${modelName}GroupBy, parseQueryMiddleware))
    if (postReadsEnabled) app.post(path, handleRead(opConfig, ${modelName}GroupBy, parseBodyAsQueryMiddleware))
  }
  if (config.enableAll || config.findUniqueOrThrow) {
    const opConfig = opFor('findUniqueOrThrow')
    const path = basePath ? \`\${basePath}/unique/strict\` : '/unique/strict'
    app.get(path, handleRead(opConfig, ${modelName}FindUniqueOrThrow, parseQueryMiddleware))
    if (postReadsEnabled) app.post(path, handleRead(opConfig, ${modelName}FindUniqueOrThrow, parseBodyAsQueryMiddleware))
  }
  if (config.enableAll || config.findUnique) {
    const opConfig = opFor('findUnique')
    const path = basePath ? \`\${basePath}/unique\` : '/unique'
    app.get(path, handleRead(opConfig, ${modelName}FindUnique, parseQueryMiddleware))
    if (postReadsEnabled) app.post(path, handleRead(opConfig, ${modelName}FindUnique, parseBodyAsQueryMiddleware))
  }
  if (config.enableAll || config.findMany) {
    const opConfig = opFor('findMany')
    const path = basePath || '/'
    app.get(path, handleRead(opConfig, ${modelName}FindMany, parseQueryMiddleware))
    if (postReadsEnabled) {
      const postPath = basePath ? \`\${basePath}/read\` : '/read'
      app.post(postPath, handleRead(opConfig, ${modelName}FindMany, parseBodyAsQueryMiddleware))
    }
  }

  if (config.enableAll || config.createManyAndReturn) {
    const opConfig = opFor('createManyAndReturn')
    const path = basePath ? \`\${basePath}/many/return\` : '/many/return'
    app.post(path, handleWrite(opConfig, ${modelName}CreateManyAndReturn))
  }
  if (config.enableAll || config.createMany) {
    const opConfig = opFor('createMany')
    const path = basePath ? \`\${basePath}/many\` : '/many'
    app.post(path, handleWrite(opConfig, ${modelName}CreateMany))
  }
  if (config.enableAll || config.create) {
    const opConfig = opFor('create')
    const path = basePath || '/'
    app.post(path, handleWrite(opConfig, ${modelName}Create))
  }
  if (config.enableAll || config.updateManyAndReturn) {
    const opConfig = opFor('updateManyAndReturn')
    const path = basePath ? \`\${basePath}/many/return\` : '/many/return'
    app.put(path, handleWrite(opConfig, ${modelName}UpdateManyAndReturn))
  }
  if (config.enableAll || config.updateMany) {
    const opConfig = opFor('updateMany')
    const path = basePath ? \`\${basePath}/many\` : '/many'
    app.put(path, handleWrite(opConfig, ${modelName}UpdateMany))
  }
  if (config.enableAll || config.update) {
    const opConfig = opFor('update')
    const path = basePath || '/'
    app.put(path, handleWrite(opConfig, ${modelName}Update))
  }
  if (config.enableAll || config.upsert) {
    const opConfig = opFor('upsert')
    const path = basePath || '/'
    app.patch(path, handleWrite(opConfig, ${modelName}Upsert))
  }
  if (config.enableAll || config.deleteMany) {
    const opConfig = opFor('deleteMany')
    const path = basePath ? \`\${basePath}/many\` : '/many'
    app.delete(path, handleWrite(opConfig, ${modelName}DeleteMany))
  }
  if (config.enableAll || config.delete) {
    const opConfig = opFor('delete')
    const path = basePath || '/'
    app.delete(path, handleWrite(opConfig, ${modelName}Delete))
  }

  return app
}
`
}