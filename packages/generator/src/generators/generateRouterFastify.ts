import { DMMF } from '@prisma/generator-helper'
import { generateRouteConfigType } from './generateRouteConfigType'
import { ImportStyle } from '../utils/resolveImportStyle'
import { importExt } from '../utils/importExt'
import { WriteStrategy } from '../constants'

export function generateFastifyRouterFunction({
  model,
  enums,
  guardShapesImport,
  importStyle,
  writeStrategy,
}: {
  model: DMMF.Model
  enums: DMMF.DatamodelEnum[]
  guardShapesImport: string | null
  importStyle: ImportStyle
  writeStrategy: WriteStrategy
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
} from './${modelName}Handlers${ext}'
import type { RouteConfig, FastifyHookHandler, WriteStrategy } from '../routeConfig.target${ext}'
import { parseQueryParams } from '../parseQueryParams${ext}'
import { sanitizeKeys, normalizePrefix, getEnv } from '../misc${ext}'
import { buildModelOpenApi } from '../buildModelOpenApi${ext}'
import { mapError, transformResult, HttpError, type OperationContext } from '../operationRuntime${ext}'

${generateRouteConfigType(modelName, 'FastifyHookHandler', guardShapesImport, importStyle, 'fastify')}
const _env = getEnv()

const WRITE_STRATEGY: WriteStrategy = '${writeStrategy}'

const MODEL_FIELDS = ${JSON.stringify(fieldsMeta, null, 2)} as const

const MODEL_ENUMS = ${JSON.stringify(enumsMeta, null, 2)} as const

type OperationConfigLike = {
  before?: FastifyHookHandler[]
  after?: FastifyHookHandler[]
  shape?: Record<string, unknown>
}

type FastifyExtended = FastifyRequest & {
  prisma?: unknown
  postgres?: unknown
  sqlite?: unknown
  parsedQuery?: Record<string, unknown>
  routeConfig?: { pagination?: OperationContext['paginationConfig'] }
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
    const paginationConfig = (config as { pagination?: OperationContext['paginationConfig'] }).pagination
    if (paginationConfig) {
      fx.routeConfig = { pagination: paginationConfig }
    }
    const headerName = (config.guard?.variantHeader || 'x-api-variant').toLowerCase()
    const headerValue = request.headers[headerName]
    const caller = config.guard?.resolveVariant?.(request)
      ?? (Array.isArray(headerValue) ? headerValue[0] : headerValue)
      ?? undefined
    if (caller) {
      fx.guardCaller = caller
    }
    if (opConfig.shape) {
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
  const httpError = mapError(error)
  reply.code(httpError.status).send({ message: httpError.message })
}

export async function ${routerFunctionName}<TCtx = unknown, TPrisma = any>(
  fastify: FastifyInstance,
  config: ${modelName}RouteConfig<TCtx, TPrisma> = {},
) {
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
        config,
        { format: 'json', writeStrategy: WRITE_STRATEGY },
      )
  const openApiYamlSpec = openApiDisabled
    ? null
    : buildModelOpenApi(
        '${modelName}',
        MODEL_FIELDS as unknown as Parameters<typeof buildModelOpenApi>[1],
        MODEL_ENUMS as unknown as Parameters<typeof buildModelOpenApi>[2],
        config,
        { format: 'yaml', writeStrategy: WRITE_STRATEGY },
      )

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

  fastify.setErrorHandler((error: FastifyError, _request: FastifyRequest, reply: FastifyReply) => {
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

    fastify.get(openapiJsonPath, async (_request, reply) => {
      return reply.send(openApiJsonSpec)
    })

    fastify.get(openapiYamlPath, async (_request, reply) => {
      return reply.type('application/yaml').send(openApiYamlSpec as string)
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

  if (config.enableAll || config.findFirst) {
    const opConfig: OperationConfigLike = (config.findFirst as OperationConfigLike | undefined) ?? defaultOpConfig
    const path = basePath ? \`\${basePath}/first\` : '/first'
    fastify.get(path, handleGet(opConfig, ${modelName}FindFirst, parseQueryHook))
    if (postReadsEnabled) fastify.post(path, handleGet(opConfig, ${modelName}FindFirst, parseBodyAsQueryHook))
  }

  if (config.enableAll || config.findFirstOrThrow) {
    const opConfig: OperationConfigLike = (config.findFirstOrThrow as OperationConfigLike | undefined) ?? defaultOpConfig
    const path = basePath ? \`\${basePath}/first/strict\` : '/first/strict'
    fastify.get(path, handleGet(opConfig, ${modelName}FindFirstOrThrow, parseQueryHook))
    if (postReadsEnabled) fastify.post(path, handleGet(opConfig, ${modelName}FindFirstOrThrow, parseBodyAsQueryHook))
  }

  if (config.enableAll || config.findManyPaginated) {
    const opConfig: OperationConfigLike = (config.findManyPaginated as OperationConfigLike | undefined) ?? defaultOpConfig
    const path = basePath ? \`\${basePath}/paginated\` : '/paginated'
    fastify.get(path, handleGet(opConfig, ${modelName}FindManyPaginated, parseQueryHook))
    if (postReadsEnabled) fastify.post(path, handleGet(opConfig, ${modelName}FindManyPaginated, parseBodyAsQueryHook))
  }

  if (config.enableAll || config.aggregate) {
    const opConfig: OperationConfigLike = (config.aggregate as OperationConfigLike | undefined) ?? defaultOpConfig
    const path = basePath ? \`\${basePath}/aggregate\` : '/aggregate'
    fastify.get(path, handleGet(opConfig, ${modelName}Aggregate, parseQueryHook))
    if (postReadsEnabled) fastify.post(path, handleGet(opConfig, ${modelName}Aggregate, parseBodyAsQueryHook))
  }

  if (config.enableAll || config.count) {
    const opConfig: OperationConfigLike = (config.count as OperationConfigLike | undefined) ?? defaultOpConfig
    const path = basePath ? \`\${basePath}/count\` : '/count'
    fastify.get(path, handleGet(opConfig, ${modelName}Count, parseQueryHook))
    if (postReadsEnabled) fastify.post(path, handleGet(opConfig, ${modelName}Count, parseBodyAsQueryHook))
  }

  if (config.enableAll || config.groupBy) {
    const opConfig: OperationConfigLike = (config.groupBy as OperationConfigLike | undefined) ?? defaultOpConfig
    const path = basePath ? \`\${basePath}/groupby\` : '/groupby'
    fastify.get(path, handleGet(opConfig, ${modelName}GroupBy, parseQueryHook))
    if (postReadsEnabled) fastify.post(path, handleGet(opConfig, ${modelName}GroupBy, parseBodyAsQueryHook))
  }

  if (config.enableAll || config.findUniqueOrThrow) {
    const opConfig: OperationConfigLike = (config.findUniqueOrThrow as OperationConfigLike | undefined) ?? defaultOpConfig
    const path = basePath ? \`\${basePath}/unique/strict\` : '/unique/strict'
    fastify.get(path, handleGet(opConfig, ${modelName}FindUniqueOrThrow, parseQueryHook))
    if (postReadsEnabled) fastify.post(path, handleGet(opConfig, ${modelName}FindUniqueOrThrow, parseBodyAsQueryHook))
  }

  if (config.enableAll || config.findUnique) {
    const opConfig: OperationConfigLike = (config.findUnique as OperationConfigLike | undefined) ?? defaultOpConfig
    const path = basePath ? \`\${basePath}/unique\` : '/unique'
    fastify.get(path, handleGet(opConfig, ${modelName}FindUnique, parseQueryHook))
    if (postReadsEnabled) fastify.post(path, handleGet(opConfig, ${modelName}FindUnique, parseBodyAsQueryHook))
  }

  if (config.enableAll || config.findMany) {
    const opConfig: OperationConfigLike = (config.findMany as OperationConfigLike | undefined) ?? defaultOpConfig
    const path = basePath || '/'
    fastify.get(path, handleGet(opConfig, ${modelName}FindMany, parseQueryHook))
    if (postReadsEnabled) {
      const postPath = basePath ? \`\${basePath}/read\` : '/read'
      fastify.post(postPath, handleGet(opConfig, ${modelName}FindMany, parseBodyAsQueryHook))
    }
  }

  if (config.enableAll || config.createManyAndReturn) {
    const opConfig: OperationConfigLike = (config.createManyAndReturn as OperationConfigLike | undefined) ?? defaultOpConfig
    const path = basePath ? \`\${basePath}/many/return\` : '/many/return'
    fastify.post(path, handleWrite(opConfig, ${modelName}CreateManyAndReturn))
  }

  if (config.enableAll || config.createMany) {
    const opConfig: OperationConfigLike = (config.createMany as OperationConfigLike | undefined) ?? defaultOpConfig
    const path = basePath ? \`\${basePath}/many\` : '/many'
    fastify.post(path, handleWrite(opConfig, ${modelName}CreateMany))
  }

  if (config.enableAll || config.create) {
    const opConfig: OperationConfigLike = (config.create as OperationConfigLike | undefined) ?? defaultOpConfig
    const path = basePath || '/'
    fastify.post(path, handleWrite(opConfig, ${modelName}Create))
  }

  if (config.enableAll || config.updateManyAndReturn) {
    const opConfig: OperationConfigLike = (config.updateManyAndReturn as OperationConfigLike | undefined) ?? defaultOpConfig
    const path = basePath ? \`\${basePath}/many/return\` : '/many/return'
    fastify.put(path, handleWrite(opConfig, ${modelName}UpdateManyAndReturn))
  }

  if (config.enableAll || config.updateMany) {
    const opConfig: OperationConfigLike = (config.updateMany as OperationConfigLike | undefined) ?? defaultOpConfig
    const path = basePath ? \`\${basePath}/many\` : '/many'
    fastify.put(path, handleWrite(opConfig, ${modelName}UpdateMany))
  }

  if (config.enableAll || config.update) {
    const opConfig: OperationConfigLike = (config.update as OperationConfigLike | undefined) ?? defaultOpConfig
    const path = basePath || '/'
    fastify.put(path, handleWrite(opConfig, ${modelName}Update))
  }

  if (config.enableAll || config.upsert) {
    const opConfig: OperationConfigLike = (config.upsert as OperationConfigLike | undefined) ?? defaultOpConfig
    const path = basePath || '/'
    fastify.patch(path, handleWrite(opConfig, ${modelName}Upsert))
  }

  if (config.enableAll || config.deleteMany) {
    const opConfig: OperationConfigLike = (config.deleteMany as OperationConfigLike | undefined) ?? defaultOpConfig
    const path = basePath ? \`\${basePath}/many\` : '/many'
    fastify.delete(path, handleWrite(opConfig, ${modelName}DeleteMany))
  }

  if (config.enableAll || config.delete) {
    const opConfig: OperationConfigLike = (config.delete as OperationConfigLike | undefined) ?? defaultOpConfig
    const path = basePath || '/'
    fastify.delete(path, handleWrite(opConfig, ${modelName}Delete))
  }
}
`
}