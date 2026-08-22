import { DMMF } from '@prisma/generator-helper'
import { generateRouteConfigType } from './generateRouteConfigType'
import { ImportStyle } from '../utils/resolveImportStyle'
import { importExt } from '../utils/importExt'
import { WriteStrategy, FindManyPaginatedMode } from '../constants'
import { modelPathSegment, PathCase } from '../utils/pathCasing'
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

function emitReadOp(
  meta: (typeof OPERATION_METADATA)[number],
  modelName: string,
): string {
  const c = meta.name.charAt(0).toUpperCase() + meta.name.slice(1)
  const handlerName = `${modelName}${c}`
  const pathValue = pathExpr(meta.pathSuffix)
  const opKind = opKindFor(meta.name)

  const postReadLine = meta.supportsPostRead
    ? meta.name === 'findMany'
      ? `      if (resolvePostReadsEnabled(config.disablePostReads, opConfig.disablePostReads)) {
        const postPath = basePath ? \`\${basePath}/read\` : '/read'
        instance.post(postPath, handleRead(opConfig, ${handlerName}, parseBodyAsQueryHook, '${opKind}'))
      }`
      : `      if (resolvePostReadsEnabled(config.disablePostReads, opConfig.disablePostReads)) instance.post(path, handleRead(opConfig, ${handlerName}, parseBodyAsQueryHook, '${opKind}'))`
    : ''

  return `    if (isEnabled(config.${meta.configKey})) {
      const opConfig = opFor('${meta.configKey}')
      const path = ${pathValue}
      instance.get(path, handleRead(opConfig, ${handlerName}, parseQueryHook, '${opKind}'))
${postReadLine}
    }`
}

function emitWriteOp(
  meta: (typeof OPERATION_METADATA)[number],
  modelName: string,
): string {
  const c = meta.name.charAt(0).toUpperCase() + meta.name.slice(1)
  const handlerName = `${modelName}${c}`
  const pathValue = pathExpr(meta.pathSuffix)
  const opKind = opKindFor(meta.name)

  return `    if (isEnabled(config.${meta.configKey})) {
      const opConfig = opFor('${meta.configKey}')
      const path = ${pathValue}
      instance.${meta.method}(path, handleWrite(opConfig, ${handlerName}, '${opKind}'))
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
  pathCase,
}: {
  model: DMMF.Model
  enums: DMMF.DatamodelEnum[]
  guardShapesImport: string | null
  importStyle: ImportStyle
  writeStrategy: WriteStrategy
  findManyPaginatedMode: FindManyPaginatedMode
  dropGuard: boolean
  pathCase: PathCase
}): string {
  const ext = importExt(importStyle)
  const modelName = model.name
  const modelSegment = modelPathSegment(model.name, pathCase)
  const routerFunctionName = `${model.name}Router`

  const handlerImports = OPERATION_METADATA.map(
    (m) => `  ${modelName}${m.name.charAt(0).toUpperCase() + m.name.slice(1)},`,
  ).join('\n')

  const readOps = OPERATION_METADATA.filter((m) => m.kind === 'read')
  const writeOps = OPERATION_METADATA.filter(
    (m) => m.kind === 'write' || m.kind === 'batch',
  ).filter((m) => m.name !== 'updateEach')

  const readOpBlocks = readOps.map((m) => emitReadOp(m, modelName)).join('\n\n')
  const writeOpBlocks = writeOps
    .map((m) => emitWriteOp(m, modelName))
    .join('\n\n')

  return `import type { FastifyInstance, FastifyRequest, FastifyReply, FastifyError } from 'fastify'
import { startQueryBuilder } from '../queryBuilder${ext}'
import {
${handlerImports}
} from './${modelName}Handlers${ext}'
import type {
  RouteConfig,
  FastifyHookHandler,
  FindManyPaginatedMode,
  PaginationConfig,,
  PrismaClientLike,
} from '../routeConfig.target${ext}'
import { parseQueryParams } from '../parseQueryParams${ext}'
import { sanitizeKeys, normalizePrefix, getEnv, isPlainObject, resolveDropGuardEnv } from '../misc${ext}'
import { buildModelOpenApi } from '../buildModelOpenApi${ext}'
import {
  normalizeOperation,
  resolveOperationVariantKey,
  validateCountSourceWhere,
  validateOperationConfig,
  validateUpdateEachConfig,
  resolvePostReadsEnabled,
  warnIfUnguardedRoutes,
} from '../routeConfig${ext}'
import type { NormalizedOperationConfig } from '../routeConfig${ext}'
import type { OperationContext } from '../operationRuntime${ext}'
import { transformResult } from '../operationRuntime${ext}'
import { HttpError, mapError } from '../errorMapper${ext}'
import { formatGuardVariantResolutionError } from '../guardVariantError${ext}'
import type { GuardVariantResolution } from '../guardVariantRouting${ext}'
import { mergePaginationConfig } from '../pagination${ext}'
import { applyDroppedGuard } from '../projectionDefaults${ext}'
import type { OpKind } from '../projectionDefaults${ext}'
import { MODEL_FIELDS, MODEL_ENUMS } from './${modelName}Metadata${ext}'

${generateRouteConfigType(modelName, 'FastifyHookHandler', guardShapesImport, importStyle, 'fastify')}
const _env = getEnv()

const FIND_MANY_PAGINATED_MODE: FindManyPaginatedMode = '${findManyPaginatedMode}'
const DROP_GUARD = ${dropGuard} || resolveDropGuardEnv(_env)

type OperationConfigLike = {
  before?: FastifyHookHandler[]
  after?: FastifyHookHandler[]
  shape?: unknown
  variants?: Record<
    string,
    {
      shape?: unknown
      before?: FastifyHookHandler[]
      after?: FastifyHookHandler[]
    }
  >
  pagination?: Partial<PaginationConfig>
}

type NormalizedOp = NormalizedOperationConfig<
  FastifyHookHandler,
  FastifyHookHandler
>

type FastifyExtended = FastifyRequest & {
  prisma?: unknown
  postgres?: unknown
  sqlite?: unknown
  parsedQuery?: Record<string, unknown>
  routeConfig?: { pagination?: PaginationConfig }
  guardShape?: Record<string, unknown>
  guardCaller?: string
  guardVariantKey?: string
  guardVariantFailure?: Extract<GuardVariantResolution, { ok: false }>
  resultData?: unknown
  resultStatus?: number
}

function normalizeFastifyOperation(
  config: OperationConfigLike | undefined,
): NormalizedOp {
  return normalizeOperation<FastifyHookHandler, FastifyHookHandler>(config)
}

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

function buildResolveContext(
  config: ${modelName}RouteConfig,
  request: FastifyRequest,
): (() => unknown | Promise<unknown>) | undefined {
  if (typeof config.resolveContext !== 'function') return undefined
  return () => (config.resolveContext as (r: FastifyRequest) => unknown | Promise<unknown>)(request)
}

function makeShapeHook(
  config: ${modelName}RouteConfig,
  opConfig: NormalizedOp,
  opKind: OpKind,
): (request: FastifyRequest) => Promise<void> {
  return async (request: FastifyRequest) => {
    const fx = request as FastifyExtended
    const merged = mergePaginationConfig(config.pagination, opConfig.pagination)
    if (merged) fx.routeConfig = { pagination: merged }

    const headerName = (config.guard?.variantHeader || 'x-api-variant').toLowerCase()
    const headerValue = request.headers[headerName]
    const caller = config.guard?.resolveVariant?.(request)
      ?? (Array.isArray(headerValue) ? headerValue[0] : headerValue)
      ?? undefined
    if (typeof caller === 'string') fx.guardCaller = caller

    const resolution = resolveOperationVariantKey(opConfig.guardRouting, caller)
    if (!resolution.ok) {
      fx.guardVariantFailure = resolution
      return
    }

    const resolvedKey =
      opConfig.guardRouting.kind === 'named'
        ? resolution.key
        : undefined
    if (resolvedKey !== undefined) fx.guardVariantKey = resolvedKey

    if (opConfig.guardShape) {
      if (!DROP_GUARD) {
        fx.guardShape = opConfig.guardShape
      } else {
        await applyDroppedGuard(
          opConfig.guardShape,
          resolvedKey,
          buildResolveContext(config, request),
          opKind,
          {
            readQuery: fx.parsedQuery,
            writeBody: isPlainObject(request.body)
              ? (request.body as Record<string, unknown>)
              : undefined,
          },
          () => {
            if (!fx.parsedQuery) fx.parsedQuery = {}
            return fx.parsedQuery
          },
          () => {
            if (!isPlainObject(request.body)) {
              ;(request as unknown as { body: unknown }).body = {}
            }
            return request.body as Record<string, unknown>
          },
        )
      }
    }
  }
}

async function runHooks(
  hooks: readonly FastifyHookHandler[],
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

export async function ${routerFunctionName}<TCtx = unknown, TPrisma extends PrismaClientLike = PrismaClientLike>(
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
  warnIfUnguardedRoutes('${modelName}', ['findMany', 'findUnique', 'findUniqueOrThrow', 'findFirst', 'findFirstOrThrow', 'findManyPaginated', 'count', 'aggregate', 'groupBy', 'create', 'createMany', 'createManyAndReturn', 'update', 'updateMany', 'updateManyAndReturn', 'upsert', 'delete', 'deleteMany'], config, isEnabled)

    const opFor = (key: string): NormalizedOp => {
      const raw = (config as unknown as Record<string, unknown>)[key] as OperationConfigLike | undefined
      validateOperationConfig(raw, '${modelName}.' + key)
      return normalizeFastifyOperation(raw)
    }

    const customPrefix = normalizePrefix(config.customUrlPrefix || '')
    const modelPrefix = config.addModelPrefix !== false ? '/${modelSegment}' : ''
    const basePath = customPrefix + modelPrefix

    const openApiDisabled = config.disableOpenApi === true
      || (config.disableOpenApi !== false && (
        _env.NODE_ENV === 'production'
        || _env.DISABLE_OPENAPI === 'true'
      ))


    let _openApiJsonCache: unknown = undefined
    const getOpenApiJson = (): unknown => {
      if (_openApiJsonCache === undefined) {
        _openApiJsonCache = buildModelOpenApi(
          '${modelName}',
          MODEL_FIELDS as unknown as Parameters<typeof buildModelOpenApi>[1],
          MODEL_ENUMS as unknown as Parameters<typeof buildModelOpenApi>[2],
          config,
          { format: 'json', writeStrategy: '${writeStrategy}', pathSegment: '${modelSegment}' },
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
          { format: 'yaml', writeStrategy: '${writeStrategy}', pathSegment: '${modelSegment}' },
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
      opConfig: NormalizedOp,
      handlerFn: (req: FastifyRequest, reply: FastifyReply) => Promise<void>,
      parseFn: (req: FastifyRequest) => void,
      opKind: OpKind,
    ) => async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        parseFn(request)
        await makeShapeHook(config, opConfig, opKind)(request)
        if (await runHooks(opConfig.operationBefore, request, reply)) return

        const fx = request as FastifyExtended
        if (fx.guardVariantFailure) {
          throw new HttpError(
            400,
            formatGuardVariantResolutionError(fx.guardVariantFailure),
          )
        }

        const key = fx.guardVariantKey
        const variantHooks =
          key !== undefined ? opConfig.variantHooks[key] : undefined

        if (await runHooks(variantHooks?.before ?? [], request, reply)) return
        await handlerFn(request, reply)
        if (await runHooks(variantHooks?.after ?? [], request, reply)) return
        if (await runHooks(opConfig.operationAfter, request, reply)) return
        sendResult(request, reply)
      } catch (error: unknown) {
        sendError(reply, error)
      }
    }

    const handleWrite = (
      opConfig: NormalizedOp,
      handlerFn: (req: FastifyRequest, reply: FastifyReply) => Promise<void>,
      opKind: OpKind,
    ) => async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        await makeShapeHook(config, opConfig, opKind)(request)
        if (await runHooks(opConfig.operationBefore, request, reply)) return

        const fx = request as FastifyExtended
        if (fx.guardVariantFailure) {
          throw new HttpError(
            400,
            formatGuardVariantResolutionError(fx.guardVariantFailure),
          )
        }

        const key = fx.guardVariantKey
        const variantHooks =
          key !== undefined ? opConfig.variantHooks[key] : undefined

        if (await runHooks(variantHooks?.before ?? [], request, reply)) return
        await handlerFn(request, reply)
        if (await runHooks(variantHooks?.after ?? [], request, reply)) return
        if (await runHooks(opConfig.operationAfter, request, reply)) return
        sendResult(request, reply)
      } catch (error: unknown) {
        sendError(reply, error)
      }
    }

${readOpBlocks}

${writeOpBlocks}

    if (config.updateEach) {
      const rawUpdateEach = config.updateEach as unknown as OperationConfigLike
      validateUpdateEachConfig(rawUpdateEach, '${modelName}.updateEach')
      const opConfig = normalizeFastifyOperation(rawUpdateEach)
      if (opConfig.operationBefore.length === 0 && _env.NODE_ENV !== 'production') {
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
          await makeShapeHook(config, opConfig, 'noop')(request)
          if (await runHooks(opConfig.operationBefore, request, reply)) return
          await ${modelName}UpdateEach(request, reply)
          if (await runHooks(opConfig.operationAfter, request, reply)) return
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
