import { DMMF } from '@prisma/generator-helper'
import { generateRouteConfigType } from './generateRouteConfigType'
import { ImportStyle } from '../utils/resolveImportStyle'
import { importExt } from '../utils/importExt'
import { WriteStrategy } from '../constants'

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
import type { Context } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { HTTPException } from 'hono/http-exception'
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
  ${modelName}UpdateEach,
} from './${modelName}Handlers${ext}'
import type {
  RouteConfig,
  HonoBeforeHook,
  HonoAfterHook,
  HonoEnvBase,
  HonoInternalVariables,
  GeneratedHonoEnv,
  WriteStrategy,
  PaginationConfig,
} from '../routeConfig.target${ext}'
import { parseQueryParams } from '../parseQueryParams${ext}'
import { normalizePrefix, getEnv, sanitizeKeys } from '../misc${ext}'
import { buildModelOpenApi } from '../buildModelOpenApi${ext}'
import { validateCountSourceWhere } from '../routeConfig${ext}'
import {
  mapError,
  transformResult,
  mergePaginationConfig,
} from '../operationRuntime${ext}'

${generateRouteConfigType(modelName, 'HonoBeforeHook', guardShapesImport, importStyle, 'hono')}
const _env = getEnv()

const WRITE_STRATEGY: WriteStrategy = '${writeStrategy}'
const DROP_GUARD = ${dropGuard} || _env.E2E === 'true'

type JsonLike =
  | string
  | number
  | boolean
  | null
  | JsonLike[]
  | { [k: string]: JsonLike }

const MODEL_FIELDS = ${JSON.stringify(fieldsMeta, null, 2)} as const

const MODEL_ENUMS = ${JSON.stringify(enumsMeta, null, 2)} as const

type OperationConfigLike<TEnv extends HonoEnvBase> = {
  before?: HonoBeforeHook<TEnv>[]
  after?: HonoAfterHook<TEnv>[]
  shape?: Record<string, unknown>
  pagination?: Partial<PaginationConfig>
}

const defaultOpConfig = Object.freeze({
  before: Object.freeze([]),
  after: Object.freeze([]),
}) as unknown as OperationConfigLike<HonoEnvBase>

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
  opConfig: OperationConfigLike<TEnv>,
) {
  return (c: Context<GeneratedHonoEnv<TEnv>>): void => {
    const merged = mergePaginationConfig(config.pagination, opConfig.pagination)
    if (merged) {
      c.set('routeConfig', { pagination: merged })
    }
    const headerName = config.guard?.variantHeader || 'x-api-variant'
    const headerValue = c.req.header(headerName)
    const caller = config.guard?.resolveVariant?.(c) ?? headerValue ?? undefined
    if (caller) c.set('guardCaller', caller)
    if (opConfig.shape && !DROP_GUARD) {
      c.set('guardShape', opConfig.shape)
    }
  }
}

async function runBeforeHooks<TEnv extends HonoEnvBase>(
  hooks: HonoBeforeHook<TEnv>[],
  c: Context<GeneratedHonoEnv<TEnv>>,
): Promise<Response | undefined> {
  for (const hook of hooks) {
    const result = await hook(c)
    if (result instanceof Response) return result
  }
  return undefined
}

async function runAfterHooks<TEnv extends HonoEnvBase>(
  hooks: HonoAfterHook<TEnv>[],
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
        { format: 'json', writeStrategy: WRITE_STRATEGY },
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
        { format: 'yaml', writeStrategy: WRITE_STRATEGY },
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
    opConfig: OperationConfigLike<TEnv>,
    handlerFn: (c: HandlerContext) => Promise<void>,
    parseFn: (c: HandlerContext) => Promise<void>,
  ) => async (c: Context<GeneratedHonoEnv<TEnv>>): Promise<Response> => {
    try {
      await parseFn(c as unknown as HandlerContext)
      makeShapeMiddleware<TCtx, TPrisma, TEnv>(config, opConfig)(c)
      const { before = [], after = [] } = opConfig
      const beforeResp = await runBeforeHooks<TEnv>(before, c)
      if (beforeResp) return beforeResp
      await handlerFn(c as unknown as HandlerContext)
      const afterResp = await runAfterHooks<TEnv>(after, c)
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
      const beforeResp = await runBeforeHooks<TEnv>(before, c)
      if (beforeResp) return beforeResp
      await handlerFn(c as unknown as HandlerContext)
      const afterResp = await runAfterHooks<TEnv>(after, c)
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

  if (isEnabled(config.findFirst)) {
    const opConfig = opFor('findFirst')
    const path = basePath ? \`\${basePath}/first\` : '/first'
    app.get(path, handleRead(opConfig, ${modelName}FindFirst, parseQueryMiddleware))
    if (postReadsEnabled) app.post(path, handleRead(opConfig, ${modelName}FindFirst, parseBodyAsQueryMiddleware))
  }
  if (isEnabled(config.findFirstOrThrow)) {
    const opConfig = opFor('findFirstOrThrow')
    const path = basePath ? \`\${basePath}/first/strict\` : '/first/strict'
    app.get(path, handleRead(opConfig, ${modelName}FindFirstOrThrow, parseQueryMiddleware))
    if (postReadsEnabled) app.post(path, handleRead(opConfig, ${modelName}FindFirstOrThrow, parseBodyAsQueryMiddleware))
  }
  if (isEnabled(config.findManyPaginated)) {
    const opConfig = opFor('findManyPaginated')
    const path = basePath ? \`\${basePath}/paginated\` : '/paginated'
    app.get(path, handleRead(opConfig, ${modelName}FindManyPaginated, parseQueryMiddleware))
    if (postReadsEnabled) app.post(path, handleRead(opConfig, ${modelName}FindManyPaginated, parseBodyAsQueryMiddleware))
  }
  if (isEnabled(config.aggregate)) {
    const opConfig = opFor('aggregate')
    const path = basePath ? \`\${basePath}/aggregate\` : '/aggregate'
    app.get(path, handleRead(opConfig, ${modelName}Aggregate, parseQueryMiddleware))
    if (postReadsEnabled) app.post(path, handleRead(opConfig, ${modelName}Aggregate, parseBodyAsQueryMiddleware))
  }
  if (isEnabled(config.count)) {
    const opConfig = opFor('count')
    const path = basePath ? \`\${basePath}/count\` : '/count'
    app.get(path, handleRead(opConfig, ${modelName}Count, parseQueryMiddleware))
    if (postReadsEnabled) app.post(path, handleRead(opConfig, ${modelName}Count, parseBodyAsQueryMiddleware))
  }
  if (isEnabled(config.groupBy)) {
    const opConfig = opFor('groupBy')
    const path = basePath ? \`\${basePath}/groupby\` : '/groupby'
    app.get(path, handleRead(opConfig, ${modelName}GroupBy, parseQueryMiddleware))
    if (postReadsEnabled) app.post(path, handleRead(opConfig, ${modelName}GroupBy, parseBodyAsQueryMiddleware))
  }
  if (isEnabled(config.findUniqueOrThrow)) {
    const opConfig = opFor('findUniqueOrThrow')
    const path = basePath ? \`\${basePath}/unique/strict\` : '/unique/strict'
    app.get(path, handleRead(opConfig, ${modelName}FindUniqueOrThrow, parseQueryMiddleware))
    if (postReadsEnabled) app.post(path, handleRead(opConfig, ${modelName}FindUniqueOrThrow, parseBodyAsQueryMiddleware))
  }
  if (isEnabled(config.findUnique)) {
    const opConfig = opFor('findUnique')
    const path = basePath ? \`\${basePath}/unique\` : '/unique'
    app.get(path, handleRead(opConfig, ${modelName}FindUnique, parseQueryMiddleware))
    if (postReadsEnabled) app.post(path, handleRead(opConfig, ${modelName}FindUnique, parseBodyAsQueryMiddleware))
  }
  if (isEnabled(config.findMany)) {
    const opConfig = opFor('findMany')
    const path = basePath || '/'
    app.get(path, handleRead(opConfig, ${modelName}FindMany, parseQueryMiddleware))
    if (postReadsEnabled) {
      const postPath = basePath ? \`\${basePath}/read\` : '/read'
      app.post(postPath, handleRead(opConfig, ${modelName}FindMany, parseBodyAsQueryMiddleware))
    }
  }

  if (isEnabled(config.createManyAndReturn)) {
    const opConfig = opFor('createManyAndReturn')
    const path = basePath ? \`\${basePath}/many/return\` : '/many/return'
    app.post(path, handleWrite(opConfig, ${modelName}CreateManyAndReturn))
  }
  if (isEnabled(config.createMany)) {
    const opConfig = opFor('createMany')
    const path = basePath ? \`\${basePath}/many\` : '/many'
    app.post(path, handleWrite(opConfig, ${modelName}CreateMany))
  }
  if (isEnabled(config.create)) {
    const opConfig = opFor('create')
    const path = basePath || '/'
    app.post(path, handleWrite(opConfig, ${modelName}Create))
  }
  if (isEnabled(config.updateManyAndReturn)) {
    const opConfig = opFor('updateManyAndReturn')
    const path = basePath ? \`\${basePath}/many/return\` : '/many/return'
    app.put(path, handleWrite(opConfig, ${modelName}UpdateManyAndReturn))
  }
  if (isEnabled(config.updateMany)) {
    const opConfig = opFor('updateMany')
    const path = basePath ? \`\${basePath}/many\` : '/many'
    app.put(path, handleWrite(opConfig, ${modelName}UpdateMany))
  }
  if (isEnabled(config.update)) {
    const opConfig = opFor('update')
    const path = basePath || '/'
    app.put(path, handleWrite(opConfig, ${modelName}Update))
  }
  if (isEnabled(config.upsert)) {
    const opConfig = opFor('upsert')
    const path = basePath || '/'
    app.patch(path, handleWrite(opConfig, ${modelName}Upsert))
  }
  if (isEnabled(config.deleteMany)) {
    const opConfig = opFor('deleteMany')
    const path = basePath ? \`\${basePath}/many\` : '/many'
    app.delete(path, handleWrite(opConfig, ${modelName}DeleteMany))
  }
  if (isEnabled(config.delete)) {
    const opConfig = opFor('delete')
    const path = basePath || '/'
    app.delete(path, handleWrite(opConfig, ${modelName}Delete))
  }

  if (config.updateEach) {
    const opConfig = (config.updateEach as unknown as OperationConfigLike<TEnv> | undefined) ?? (defaultOpConfig as OperationConfigLike<TEnv>)
    if ((!opConfig.before || opConfig.before.length === 0) && _env.NODE_ENV !== 'production') {
      console.warn(
        '[${modelName}Router] updateEach is enabled without a before hook. ' +
        'This endpoint bypasses guard shapes and should be protected by authentication middleware.',
      )
    }
    const path = basePath ? \`\${basePath}/each\` : '/each'
    app.post(path, async (c: Context<GeneratedHonoEnv<TEnv>>): Promise<Response> => {
      try {
        await parseUpdateEachBodyMiddleware(c as unknown as HandlerContext)
        makeShapeMiddleware<TCtx, TPrisma, TEnv>(config, opConfig)(c)
        const { before = [], after = [] } = opConfig
        const beforeResp = await runBeforeHooks<TEnv>(before, c)
        if (beforeResp) return beforeResp
        await ${modelName}UpdateEach(c as unknown as HandlerContext)
        const afterResp = await runAfterHooks<TEnv>(after, c)
        if (afterResp) return afterResp
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