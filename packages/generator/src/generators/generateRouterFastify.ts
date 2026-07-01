import { DMMF } from '@prisma/generator-helper'
import { generateRouteConfigType } from './generateRouteConfigType'
import { ImportStyle } from '../utils/resolveImportStyle'
import { importExt } from '../utils/importExt'
import { WriteStrategy, FindManyPaginatedMode } from '../constants'

export function generateFastifyRouterFunction({
  model,
  enums,
  guardShapesImport,
  importStyle,
  writeStrategy,
  findManyPaginatedMode,
  dropGuard,
}: {
  model: DMMF.Model
  enums: DMMF.DatamodelEnum[]
  guardShapesImport: string | null
  importStyle: ImportStyle
  writeStrategy: WriteStrategy
  findManyPaginatedMode: FindManyPaginatedMode
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

  return `import type { FastifyInstance, FastifyRequest, FastifyReply, FastifyError } from 'fastify'
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
  ${modelName}UpdateEach,
} from './${modelName}Handlers${ext}'
import type {
  RouteConfig,
  FastifyHookHandler,
  WriteStrategy,
  FindManyPaginatedMode,
  PaginationConfig,
} from '../routeConfig.target${ext}'
import { parseQueryParams } from '../parseQueryParams${ext}'
import { sanitizeKeys, normalizePrefix, getEnv } from '../misc${ext}'
import { buildModelOpenApi } from '../buildModelOpenApi${ext}'
import { validateCountSourceWhere } from '../routeConfig${ext}'
import { mapError, transformResult, mergePaginationConfig, HttpError, type OperationContext } from '../operationRuntime${ext}'

${generateRouteConfigType(modelName, 'FastifyHookHandler', guardShapesImport, importStyle, 'fastify')}
const _env = getEnv()

const WRITE_STRATEGY: WriteStrategy = '${writeStrategy}'
const FIND_MANY_PAGINATED_MODE: FindManyPaginatedMode = '${findManyPaginatedMode}'
const DROP_GUARD = ${dropGuard} || _env.E2E === 'true'

const MODEL_FIELDS = ${JSON.stringify(fieldsMeta, null, 2)} as const

const MODEL_ENUMS = ${JSON.stringify(enumsMeta, null, 2)} as const

type OperationConfigLike = {
  before?: FastifyHookHandler[]
  after?: FastifyHookHandler[]
  shape?: Record<string, unknown>
  pagination?: Partial<PaginationConfig>
}

type FastifyExtended = FastifyRequest & {
  prisma?: unknown
  postgres?: unknown
  sqlite?: unknown
  parsedQuery?: Record<string, unknown>
  routeConfig?: { pagination?: PaginationConfig }
  guardShape?: Record<string, unknown>
  guardCaller?: string
  resultData?: unknown
  resultStatus?: number
}

const defaultOpConfig: OperationConfigLike = Object.freeze({
  before: Object.freeze([]) as unknown as FastifyHookHandler[],
  after: Object.freeze([]) as unknown as FastifyHookHandler[],
})

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

function parseQueryHook(request: FastifyRequest): void {
  const raw = request.query as Record<string, unknown>
  if (raw && Object.keys(raw).length > 0) {
    (request as FastifyExtended).parsedQuery = parseQueryParams(raw) as Record<string, unknown>
  }
}

function parseBodyAsQueryHook(request: FastifyRequest): void {
  const body = request.body
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'Request body must be a JSON object')
  }
  (request as FastifyExtended).parsedQuery = sanitizeKeys(body as Record<string, unknown>)
}

function makeShapeHook(
  config: ${modelName}RouteConfig,
  opConfig: OperationConfigLike,
): (request: FastifyRequest) => void {
  return (request: FastifyRequest) => {
    const fx = request as FastifyExtended
    const merged = mergePaginationConfig(config.pagination, opConfig.pagination)
    if (merged) {
      fx.routeConfig = { pagination: merged }
    }
    const headerName = (config.guard?.variantHeader || 'x-api-variant').toLowerCase()
    const headerValue = request.headers[headerName]
    const caller = config.guard?.resolveVariant?.(request)
      ?? (Array.isArray(headerValue) ? headerValue[0] : headerValue)
      ?? undefined
    if (caller) {
      fx.guardCaller = caller
    }
    if (opConfig.shape && !DROP_GUARD) {
      fx.guardShape = opConfig.shape
    }
  }
}

async function runHooks(
  hooks: FastifyHookHandler[],
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<boolean> {
  for (const hook of hooks) {
    if (reply.sent) return true
    await hook(request, reply)
  }
  return reply.sent
}

function sendResult(request: FastifyRequest, reply: FastifyReply): void {
  const req = request as FastifyExtended
  const data = req.resultData
  const status = req.resultStatus ?? 200
  if (data === undefined) {
    reply.code(500).send({ message: 'No data set by handler' })
    return
  }
  reply.code(status).send(transformResult(data))
}

function sendError(reply: FastifyReply, error: unknown): void {
  if (reply.sent) return
  const httpError = mapError(error)
  reply.code(httpError.status).send({ message: httpError.message })
}

export async function ${routerFunctionName}<TCtx = unknown, TPrisma = any>(
  fastify: FastifyInstance,
  config: ${modelName}RouteConfig<TCtx, TPrisma> = {},
) {
  validateCountSourceWhere(config.pagination?.countSource, '${modelName} pagination')
  validateCountSourceWhere(
    (config.findManyPaginated && typeof config.findManyPaginated === 'object' ? config.findManyPaginated : undefined)?.pagination?.countSource,
    '${modelName} findManyPaginated pagination',
  )

  await fastify.register(async (instance) => {
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
          config,
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
          config,
          { format: 'yaml', writeStrategy: WRITE_STRATEGY },
        ) as string
      }
      return _openApiYamlCache
    }

    const qbEnabled = isQueryBuilderEnabled(config)

    if (qbEnabled) {
      const qbConfig = getQueryBuilderConfig(config)
      if (qbConfig) {
        try {
          startQueryBuilder(qbConfig)
        } catch (err) {
          if (_env.NODE_ENV !== 'production') console.warn('[query-builder]', err)
        }
      }
    }

    instance.addHook('onRequest', async (request: FastifyRequest) => {
      (request as FastifyExtended & { findManyPaginatedMode?: FindManyPaginatedMode }).findManyPaginatedMode = FIND_MANY_PAGINATED_MODE
    })

    instance.setErrorHandler((error: FastifyError, _request: FastifyRequest, reply: FastifyReply) => {
      const e = error as { status?: number; statusCode?: number; message?: string }
      const status = e.status ?? e.statusCode ?? 500
      const message = error.message || 'Internal server error'
      if (!reply.sent) {
        reply.code(status).send({ message })
      }
    })

    if (!openApiDisabled) {
      const openapiJsonPath = basePath ? \`\${basePath}/openapi.json\` : '/openapi.json'
      const openapiYamlPath = basePath ? \`\${basePath}/openapi.yaml\` : '/openapi.yaml'

      instance.get(openapiJsonPath, async (_request, reply) => {
        return reply.send(getOpenApiJson())
      })

      instance.get(openapiYamlPath, async (_request, reply) => {
        return reply.type('application/yaml').send(getOpenApiYaml())
      })
    }

    const handleGet = (
      opConfig: OperationConfigLike,
      handlerFn: (req: FastifyRequest, reply: FastifyReply) => Promise<void>,
      parseFn: (req: FastifyRequest) => void,
    ) => async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        parseFn(request)
        makeShapeHook(config, opConfig)(request)
        const { before = [], after = [] } = opConfig
        if (await runHooks(before, request, reply)) return
        await handlerFn(request, reply)
        if (await runHooks(after, request, reply)) return
        sendResult(request, reply)
      } catch (error: unknown) {
        sendError(reply, error)
      }
    }

    const handleWrite = (
      opConfig: OperationConfigLike,
      handlerFn: (req: FastifyRequest, reply: FastifyReply) => Promise<void>,
    ) => async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        makeShapeHook(config, opConfig)(request)
        const { before = [], after = [] } = opConfig
        if (await runHooks(before, request, reply)) return
        await handlerFn(request, reply)
        if (await runHooks(after, request, reply)) return
        sendResult(request, reply)
      } catch (error: unknown) {
        sendError(reply, error)
      }
    }

    if (isEnabled(config.findFirst)) {
      const opConfig: OperationConfigLike = (config.findFirst as OperationConfigLike | undefined) ?? defaultOpConfig
      const path = basePath ? \`\${basePath}/first\` : '/first'
      instance.get(path, handleGet(opConfig, ${modelName}FindFirst, parseQueryHook))
      if (postReadsEnabled) instance.post(path, handleGet(opConfig, ${modelName}FindFirst, parseBodyAsQueryHook))
    }

    if (isEnabled(config.findFirstOrThrow)) {
      const opConfig: OperationConfigLike = (config.findFirstOrThrow as OperationConfigLike | undefined) ?? defaultOpConfig
      const path = basePath ? \`\${basePath}/first/strict\` : '/first/strict'
      instance.get(path, handleGet(opConfig, ${modelName}FindFirstOrThrow, parseQueryHook))
      if (postReadsEnabled) instance.post(path, handleGet(opConfig, ${modelName}FindFirstOrThrow, parseBodyAsQueryHook))
    }

    if (isEnabled(config.findManyPaginated)) {
      const opConfig: OperationConfigLike = (config.findManyPaginated as OperationConfigLike | undefined) ?? defaultOpConfig
      const path = basePath ? \`\${basePath}/paginated\` : '/paginated'
      instance.get(path, handleGet(opConfig, ${modelName}FindManyPaginated, parseQueryHook))
      if (postReadsEnabled) instance.post(path, handleGet(opConfig, ${modelName}FindManyPaginated, parseBodyAsQueryHook))
    }

    if (isEnabled(config.aggregate)) {
      const opConfig: OperationConfigLike = (config.aggregate as OperationConfigLike | undefined) ?? defaultOpConfig
      const path = basePath ? \`\${basePath}/aggregate\` : '/aggregate'
      instance.get(path, handleGet(opConfig, ${modelName}Aggregate, parseQueryHook))
      if (postReadsEnabled) instance.post(path, handleGet(opConfig, ${modelName}Aggregate, parseBodyAsQueryHook))
    }

    if (isEnabled(config.count)) {
      const opConfig: OperationConfigLike = (config.count as OperationConfigLike | undefined) ?? defaultOpConfig
      const path = basePath ? \`\${basePath}/count\` : '/count'
      instance.get(path, handleGet(opConfig, ${modelName}Count, parseQueryHook))
      if (postReadsEnabled) instance.post(path, handleGet(opConfig, ${modelName}Count, parseBodyAsQueryHook))
    }

    if (isEnabled(config.groupBy)) {
      const opConfig: OperationConfigLike = (config.groupBy as OperationConfigLike | undefined) ?? defaultOpConfig
      const path = basePath ? \`\${basePath}/groupby\` : '/groupby'
      instance.get(path, handleGet(opConfig, ${modelName}GroupBy, parseQueryHook))
      if (postReadsEnabled) instance.post(path, handleGet(opConfig, ${modelName}GroupBy, parseBodyAsQueryHook))
    }

    if (isEnabled(config.findUniqueOrThrow)) {
      const opConfig: OperationConfigLike = (config.findUniqueOrThrow as OperationConfigLike | undefined) ?? defaultOpConfig
      const path = basePath ? \`\${basePath}/unique/strict\` : '/unique/strict'
      instance.get(path, handleGet(opConfig, ${modelName}FindUniqueOrThrow, parseQueryHook))
      if (postReadsEnabled) instance.post(path, handleGet(opConfig, ${modelName}FindUniqueOrThrow, parseBodyAsQueryHook))
    }

    if (isEnabled(config.findUnique)) {
      const opConfig: OperationConfigLike = (config.findUnique as OperationConfigLike | undefined) ?? defaultOpConfig
      const path = basePath ? \`\${basePath}/unique\` : '/unique'
      instance.get(path, handleGet(opConfig, ${modelName}FindUnique, parseQueryHook))
      if (postReadsEnabled) instance.post(path, handleGet(opConfig, ${modelName}FindUnique, parseBodyAsQueryHook))
    }

    if (isEnabled(config.findMany)) {
      const opConfig: OperationConfigLike = (config.findMany as OperationConfigLike | undefined) ?? defaultOpConfig
      const path = basePath || '/'
      instance.get(path, handleGet(opConfig, ${modelName}FindMany, parseQueryHook))
      if (postReadsEnabled) {
        const postPath = basePath ? \`\${basePath}/read\` : '/read'
        instance.post(postPath, handleGet(opConfig, ${modelName}FindMany, parseBodyAsQueryHook))
      }
    }

    if (isEnabled(config.createManyAndReturn)) {
      const opConfig: OperationConfigLike = (config.createManyAndReturn as OperationConfigLike | undefined) ?? defaultOpConfig
      const path = basePath ? \`\${basePath}/many/return\` : '/many/return'
      instance.post(path, handleWrite(opConfig, ${modelName}CreateManyAndReturn))
    }

    if (isEnabled(config.createMany)) {
      const opConfig: OperationConfigLike = (config.createMany as OperationConfigLike | undefined) ?? defaultOpConfig
      const path = basePath ? \`\${basePath}/many\` : '/many'
      instance.post(path, handleWrite(opConfig, ${modelName}CreateMany))
    }

    if (isEnabled(config.create)) {
      const opConfig: OperationConfigLike = (config.create as OperationConfigLike | undefined) ?? defaultOpConfig
      const path = basePath || '/'
      instance.post(path, handleWrite(opConfig, ${modelName}Create))
    }

    if (isEnabled(config.updateManyAndReturn)) {
      const opConfig: OperationConfigLike = (config.updateManyAndReturn as OperationConfigLike | undefined) ?? defaultOpConfig
      const path = basePath ? \`\${basePath}/many/return\` : '/many/return'
      instance.put(path, handleWrite(opConfig, ${modelName}UpdateManyAndReturn))
    }

    if (isEnabled(config.updateMany)) {
      const opConfig: OperationConfigLike = (config.updateMany as OperationConfigLike | undefined) ?? defaultOpConfig
      const path = basePath ? \`\${basePath}/many\` : '/many'
      instance.put(path, handleWrite(opConfig, ${modelName}UpdateMany))
    }

    if (isEnabled(config.update)) {
      const opConfig: OperationConfigLike = (config.update as OperationConfigLike | undefined) ?? defaultOpConfig
      const path = basePath || '/'
      instance.put(path, handleWrite(opConfig, ${modelName}Update))
    }

    if (isEnabled(config.upsert)) {
      const opConfig: OperationConfigLike = (config.upsert as OperationConfigLike | undefined) ?? defaultOpConfig
      const path = basePath || '/'
      instance.patch(path, handleWrite(opConfig, ${modelName}Upsert))
    }

    if (isEnabled(config.deleteMany)) {
      const opConfig: OperationConfigLike = (config.deleteMany as OperationConfigLike | undefined) ?? defaultOpConfig
      const path = basePath ? \`\${basePath}/many\` : '/many'
      instance.delete(path, handleWrite(opConfig, ${modelName}DeleteMany))
    }

    if (isEnabled(config.delete)) {
      const opConfig: OperationConfigLike = (config.delete as OperationConfigLike | undefined) ?? defaultOpConfig
      const path = basePath || '/'
      instance.delete(path, handleWrite(opConfig, ${modelName}Delete))
    }

    if (config.updateEach) {
      const opConfig: OperationConfigLike = (config.updateEach as OperationConfigLike | undefined) ?? defaultOpConfig
      if ((!opConfig.before || opConfig.before.length === 0) && _env.NODE_ENV !== 'production') {
        console.warn(
          '[${modelName}Router] updateEach is enabled without a before hook. ' +
          'This endpoint bypasses guard shapes and should be protected by authentication middleware.',
        )
      }
      const path = basePath ? \`\${basePath}/each\` : '/each'
      instance.post(path, async (request: FastifyRequest, reply: FastifyReply) => {
        try {
          makeShapeHook(config, opConfig)(request)
          const { before = [], after = [] } = opConfig
          if (await runHooks(before, request, reply)) return
          await ${modelName}UpdateEach(request, reply)
          if (await runHooks(after, request, reply)) return
          sendResult(request, reply)
        } catch (error: unknown) {
          sendError(reply, error)
        }
      })
    }
  })
}
`
}