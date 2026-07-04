import { DMMF } from '@prisma/generator-helper'
import { generateRouteConfigType } from './generateRouteConfigType'
import { ImportStyle } from '../utils/resolveImportStyle'
import { importExt } from '../utils/importExt'
import { WriteStrategy, FindManyPaginatedMode } from '../constants'
import { OPERATION_METADATA } from '../copy/operationDefinitions'

function pathExpr(suffix: string): string {
  if (!suffix) return `basePath || '/'`
  return `\`\${basePath}${suffix}\``
}

function emitReadOp(meta: (typeof OPERATION_METADATA)[number], modelName: string): string {
  const c = meta.name.charAt(0).toUpperCase() + meta.name.slice(1)
  const handlerName = `${modelName}${c}`
  const pathValue = pathExpr(meta.pathSuffix)

  const postReadLine = meta.supportsPostRead
    ? meta.name === 'findMany'
      ? `      if (postReadsEnabled) {
        const postPath = basePath ? \`\${basePath}/read\` : '/read'
        instance.post(postPath, handleRead(opConfig, ${handlerName}, parseBodyAsQueryHook))
      }`
      : `      if (postReadsEnabled) instance.post(path, handleRead(opConfig, ${handlerName}, parseBodyAsQueryHook))`
    : ''

  return `    if (isEnabled(config.${meta.configKey})) {
      const opConfig: OperationConfigLike = (config.${meta.configKey} as OperationConfigLike | undefined) ?? defaultOpConfig
      const path = ${pathValue}
      instance.get(path, handleRead(opConfig, ${handlerName}, parseQueryHook))
${postReadLine}
    }`
}

function emitWriteOp(meta: (typeof OPERATION_METADATA)[number], modelName: string): string {
  const c = meta.name.charAt(0).toUpperCase() + meta.name.slice(1)
  const handlerName = `${modelName}${c}`
  const pathValue = pathExpr(meta.pathSuffix)

  return `    if (isEnabled(config.${meta.configKey})) {
      const opConfig: OperationConfigLike = (config.${meta.configKey} as OperationConfigLike | undefined) ?? defaultOpConfig
      const path = ${pathValue}
      instance.${meta.method}(path, handleWrite(opConfig, ${handlerName}))
    }`
}

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

  const handlerImports = OPERATION_METADATA
    .map((m) => `  ${modelName}${m.name.charAt(0).toUpperCase() + m.name.slice(1)},`)
    .join('\n')

  const readOps = OPERATION_METADATA.filter((m) => m.kind === 'read')
  const writeOps = OPERATION_METADATA.filter((m) => m.kind === 'write' || m.kind === 'batch')
    .filter((m) => m.name !== 'updateEach')

  const readOpBlocks = readOps.map((m) => emitReadOp(m, modelName)).join('\n\n')
  const writeOpBlocks = writeOps.map((m) => emitWriteOp(m, modelName)).join('\n\n')

  return `import type { FastifyInstance, FastifyRequest, FastifyReply, FastifyError } from 'fastify'
import { startQueryBuilder } from '../queryBuilder${ext}'
import {
${handlerImports}
} from './${modelName}Handlers${ext}'
import type {
  RouteConfig,
  FastifyHookHandler,
  FindManyPaginatedMode,
  PaginationConfig,
} from '../routeConfig.target${ext}'
import { parseQueryParams } from '../parseQueryParams${ext}'
import { sanitizeKeys, normalizePrefix, getEnv } from '../misc${ext}'
import { buildModelOpenApi } from '../buildModelOpenApi${ext}'
import { validateCountSourceWhere } from '../routeConfig${ext}'
import type { OperationContext } from '../operationRuntime${ext}'
import { transformResult } from '../operationRuntime${ext}'
import { HttpError, mapError } from '../errorMapper${ext}'
import { mergePaginationConfig } from '../pagination${ext}'
import { MODEL_FIELDS, MODEL_ENUMS } from './${modelName}Metadata${ext}'

${generateRouteConfigType(modelName, 'FastifyHookHandler', guardShapesImport, importStyle, 'fastify')}
const _env = getEnv()

const FIND_MANY_PAGINATED_MODE: FindManyPaginatedMode = '${findManyPaginatedMode}'
const DROP_GUARD = ${dropGuard} || _env.E2E === 'true'

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
          config,
          { format: 'yaml', writeStrategy: '${writeStrategy}' },
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
      const httpError = mapError(error)
      if (!reply.sent) {
        reply.code(httpError.status).send({ message: httpError.message })
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

    const handleRead = (
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

${readOpBlocks}

${writeOpBlocks}

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
          if (!Array.isArray(request.body)) {
            throw new HttpError(400, 'updateEach body must be an array of { where, data } items')
          }
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