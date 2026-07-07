import { DMMF } from '@prisma/generator-helper'
import { generateRouteConfigType } from './generateRouteConfigType'
import { ImportStyle } from '../utils/resolveImportStyle'
import { importExt } from '../utils/importExt'
import { WriteStrategy, FindManyPaginatedMode } from '../constants'
import { OPERATION_METADATA } from '../copy/operationDefinitions'

function pathExpr(basePath: string, suffix: string): string {
  if (!suffix) return basePath || '/'
  if (!basePath) return `'${suffix}'`
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
  const pathValue = pathExpr('basePath', meta.pathSuffix)
  const opKind = opKindFor(meta.name)

  const postReadBlock = meta.supportsPostRead
    ? `    if (postReadsEnabled) {
      const postPath = ${meta.name === 'findMany' ? "basePath ? `${basePath}/read` : '/read'" : `path`}
      router.post(postPath, parseBodyAsQuery, setShape(opConfig, '${opKind}'), ...before, ${handlerName} as RequestHandler, ...after, respond)
    }`
    : ''

  return `  if (isEnabled(config.${meta.configKey})) {
    const opConfig: OperationConfigLike = (config.${meta.configKey} as OperationConfigLike | undefined) ?? defaultOpConfig
    const { before = [], after = [] } = opConfig
    const path = ${pathValue}
    router.get(path, parseQuery, setShape(opConfig, '${opKind}'), ...before, maybeProgressiveSSE(opConfig, core.${meta.coreName}, '${meta.name}'), ${handlerName} as RequestHandler, ...after, respond)
${postReadBlock}
  }`
}

function emitWriteOp(
  meta: (typeof OPERATION_METADATA)[number],
  modelName: string,
): string {
  const c = meta.name.charAt(0).toUpperCase() + meta.name.slice(1)
  const handlerName = `${modelName}${c}`
  const pathValue = pathExpr('basePath', meta.pathSuffix)
  const respondFn = meta.successStatus === 201 ? 'respondCreated' : 'respond'
  const opKind = opKindFor(meta.name)

  return `  if (isEnabled(config.${meta.configKey})) {
    const opConfig: OperationConfigLike = (config.${meta.configKey} as OperationConfigLike | undefined) ?? defaultOpConfig
    const { before = [], after = [] } = opConfig
    const path = ${pathValue}
    router.${meta.method}(path, setShape(opConfig, '${opKind}'), ...before, ${handlerName} as RequestHandler, ...after, ${respondFn})
  }`
}

export function generateRouterFunction({
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
  const delegateKey = modelName.charAt(0).toLowerCase() + modelName.slice(1)
  const routerFunctionName = `${modelName}Router`

  const handlerImports = OPERATION_METADATA.filter(
    (m) => m.name !== 'updateEach',
  )
    .map(
      (m) =>
        `  ${modelName}${m.name.charAt(0).toUpperCase() + m.name.slice(1)},`,
    )
    .join('\n')

  const readOps = OPERATION_METADATA.filter((m) => m.kind === 'read')
  const writeOps = OPERATION_METADATA.filter(
    (m) => m.kind === 'write' || m.kind === 'batch',
  ).filter((m) => m.name !== 'updateEach')

  const readOpBlocks = readOps.map((m) => emitReadOp(m, modelName)).join('\n\n')
  const writeOpBlocks = writeOps
    .map((m) => emitWriteOp(m, modelName))
    .join('\n\n')

  return `import express from 'express'
import type { Request, Response, NextFunction, RequestHandler } from 'express'
import { startQueryBuilder } from '../queryBuilder${ext}'
import {
${handlerImports}
} from './${modelName}Handlers${ext}'
import * as core from './${modelName}Core${ext}'
import type {
  RouteConfig,
  QueryBuilderConfig,
  FindManyPaginatedMode,
  PaginationConfig,
} from '../routeConfig.target${ext}'
import { parseQueryParams } from '../parseQueryParams${ext}'
import { sanitizeKeys, normalizePrefix, getEnv, isPlainObject } from '../misc${ext}'
import { buildModelOpenApi } from '../buildModelOpenApi${ext}'
import { validateCountSourceWhere } from '../routeConfig${ext}'
import type { OperationContext } from '../operationRuntime${ext}'
import { transformResult } from '../operationRuntime${ext}'
import { HttpError, mapError } from '../errorMapper${ext}'
import { mergePaginationConfig } from '../pagination${ext}'
import {
  acceptsEventStream,
  runProgressiveEndpoint,
  runSingleResultSSE,
  emitTerminalSSEError,
  removeReqCloseListener,
} from '../sse${ext}'
import { relationModels } from '../relationModels${ext}'
import { runAutoIncludeProgressive } from '../autoIncludeRuntime${ext}'
import { applyDroppedGuard } from '../projectionDefaults${ext}'
import type { OpKind } from '../projectionDefaults${ext}'
import { MODEL_FIELDS, MODEL_ENUMS } from './${modelName}Metadata${ext}'

${generateRouteConfigType(modelName, 'RequestHandler', guardShapesImport, importStyle, 'express')}
const _env = getEnv()

const FIND_MANY_PAGINATED_MODE: FindManyPaginatedMode = '${findManyPaginatedMode}'
const DROP_GUARD = ${dropGuard} || _env.E2E === 'true'

type OperationConfigLike = {
  before?: RequestHandler[]
  after?: RequestHandler[]
  shape?: Record<string, unknown>
  pagination?: Partial<PaginationConfig>
  progressive?: Record<string, ProgressiveVariantConfig>
  progressiveStages?: Record<string, ProgressiveStage<unknown>>
}

type ExtendedRequest = Request & {
  prisma?: unknown
  postgres?: unknown
  sqlite?: unknown
}

type LocalsBag = {
  parsedQuery?: Record<string, unknown>
  routeConfig?: { pagination?: PaginationConfig }
  guardShape?: Record<string, unknown>
  guardCaller?: string
  data?: unknown
}

const defaultOpConfig: OperationConfigLike = Object.freeze({
  before: Object.freeze([]) as unknown as RequestHandler[],
  after: Object.freeze([]) as unknown as RequestHandler[],
})

function isQueryBuilderEnabled(config: { queryBuilder?: QueryBuilderConfig | false }): boolean {
  if (config.queryBuilder === false) return false
  if (typeof config.queryBuilder === 'object' && config.queryBuilder.enabled === false) return false
  if (_env.NODE_ENV === 'production') return false
  return true
}

function getQueryBuilderConfig(config: { queryBuilder?: QueryBuilderConfig | false }) {
  if (config.queryBuilder === false) return null
  if (typeof config.queryBuilder === 'object') return config.queryBuilder
  return {}
}

function readLocals(res: Response): LocalsBag {
  return res.locals as LocalsBag
}

export function ${routerFunctionName}<TCtx = unknown, TPrisma = any>(config: ${modelName}RouteConfig<TCtx, TPrisma> = {}) {
  validateCountSourceWhere(config.pagination?.countSource, '${modelName} pagination')
  validateCountSourceWhere(
    (config.findManyPaginated && typeof config.findManyPaginated === 'object' ? config.findManyPaginated : undefined)?.pagination?.countSource,
    '${modelName} findManyPaginated pagination',
  )

  const router = express.Router()

  const isEnabled = (value: unknown): boolean => value !== false && !!(config.enableAll || value)

  const customPrefix = normalizePrefix(config.customUrlPrefix || '')
  const modelPrefix = config.addModelPrefix !== false ? '/${modelNameLower}' : ''
  const basePath = customPrefix + modelPrefix

  const openApiDisabled = config.disableOpenApi === true
    || (config.disableOpenApi !== false && (_env.DISABLE_OPENAPI === 'true' || _env.NODE_ENV === 'production'))

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

  const buildContext = (req: Request, res: Response): OperationContext => {
    const extReq = req as ExtendedRequest
    const locals = readLocals(res)
    return {
      prisma: extReq.prisma,
      postgres: extReq.postgres,
      sqlite: extReq.sqlite,
      parsedQuery: locals.parsedQuery,
      body: req.body,
      guardShape: locals.guardShape,
      guardCaller: locals.guardCaller,
      paginationConfig: locals.routeConfig?.pagination,
      findManyPaginatedMode: FIND_MANY_PAGINATED_MODE,
    }
  }

  const buildResolveContext = (req: Request): (() => unknown | Promise<unknown>) | undefined => {
    if (typeof config.resolveContext !== 'function') return undefined
    return () => (config.resolveContext as (r: Request) => unknown | Promise<unknown>)(req)
  }

  const parseQuery: RequestHandler = (req, res, next) => {
    const rawQuery = req.query
    if (rawQuery && Object.keys(rawQuery).length > 0) {
      const parsed = parseQueryParams(rawQuery as Record<string, unknown>) as Record<string, unknown>
      readLocals(res).parsedQuery = parsed
    }
    next()
  }

  const parseBodyAsQuery: RequestHandler = (req, res, next) => {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return next(new HttpError(400, 'Request body must be a JSON object'))
    }
    readLocals(res).parsedQuery = sanitizeKeys(req.body as Record<string, unknown>)
    next()
  }

  const setShape = (opConfig: OperationConfigLike, opKind: OpKind): RequestHandler => {
    return async (req, res, next) => {
      try {
        const locals = readLocals(res)
        const merged = mergePaginationConfig(config.pagination, opConfig.pagination)
        if (merged) {
          locals.routeConfig = { pagination: merged }
        }
        const headerName = config.guard?.variantHeader || 'x-api-variant'
        const headerValue = req.get(headerName)
        const caller = config.guard?.resolveVariant?.(req) ?? headerValue ?? undefined
        if (caller) locals.guardCaller = caller
        if (opConfig.shape) {
          if (!DROP_GUARD) {
            locals.guardShape = opConfig.shape
          } else {
            await applyDroppedGuard(
              opConfig.shape,
              caller,
              buildResolveContext(req),
              opKind,
              {
                readQuery: locals.parsedQuery,
                writeBody: isPlainObject(req.body)
                  ? (req.body as Record<string, unknown>)
                  : undefined,
              },
              () => {
                if (!locals.parsedQuery) locals.parsedQuery = {}
                return locals.parsedQuery
              },
              () => {
                if (!isPlainObject(req.body)) {
                  req.body = {}
                }
                return req.body as Record<string, unknown>
              },
            )
          }
        }
        next()
      } catch (err) {
        next(mapError(err))
      }
    }
  }

  const maybeProgressiveSSE = (
    opConfig: OperationConfigLike,
    coreFn: (ctx: OperationContext) => Promise<unknown>,
    baseOp: string,
  ): RequestHandler => {
    return async (req, res, next) => {
      if (res.headersSent || res.writableEnded) return next()
      if (req.method !== 'GET') return next()
      if (!acceptsEventStream(req.headers.accept)) return next()

      const locals = readLocals(res)
      const variant = locals.guardCaller
      const progressiveConfig = variant ? opConfig.progressive?.[variant] : undefined

      try {
        if (!progressiveConfig || progressiveConfig.enabled === false) {
          await runSingleResultSSE({
            req,
            res,
            coreQueryFn: () => coreFn(buildContext(req, res)),
          })
          return
        }

        if (progressiveConfig.mode === 'autoInclude') {
          const isAutoIncludeReadable =
            baseOp === 'findUnique' || baseOp === 'findUniqueOrThrow' ||
            baseOp === 'findFirst' || baseOp === 'findFirstOrThrow' ||
            baseOp === 'findMany' || baseOp === 'findManyPaginated'

          if (!isAutoIncludeReadable) {
            if (progressiveConfig.fallback === 'error') {
              emitTerminalSSEError(res, 'auto-progressive fallback: operation not supported by auto-include')
              return
            }
            await runSingleResultSSE({
              req,
              res,
              coreQueryFn: () => coreFn(buildContext(req, res)),
            })
            return
          }

          const ctx = buildContext(req, res)
          const args = (locals.parsedQuery ?? {}) as Record<string, unknown>
          const controller = new AbortController()
          const onClose = () => controller.abort()
          req.on('close', onClose)
          try {
            await runAutoIncludeProgressive({
              req,
              res,
              ctx,
              args,
              baseOp: baseOp as 'findUnique' | 'findUniqueOrThrow' | 'findFirst' | 'findFirstOrThrow' | 'findMany' | 'findManyPaginated',
              modelName: '${modelName}',
              delegateKey: '${delegateKey}',
              models: relationModels,
              variantConfig: progressiveConfig,
              coreQueryFn: () => coreFn(ctx),
              signal: controller.signal,
            })
          } finally {
            removeReqCloseListener(req, onClose)
          }
          return
        }

        if (!Array.isArray(progressiveConfig.stages)) {
          await runSingleResultSSE({
            req,
            res,
            coreQueryFn: () => coreFn(buildContext(req, res)),
          })
          return
        }

        const stageRegistry = opConfig.progressiveStages ?? {}
        const missingStage = progressiveConfig.stages.find(
          (name: string) => typeof stageRegistry[name] !== 'function',
        )
        if (missingStage) {
          emitTerminalSSEError(res, 'Missing progressive stage: ' + missingStage)
          return
        }

        if (typeof config.resolveContext !== 'function') {
          emitTerminalSSEError(res, 'Progressive endpoint requires config.resolveContext')
          return
        }

        const ctx = await config.resolveContext(req)
        await runProgressiveEndpoint({
          req,
          res,
          ctx,
          prisma: (req as ExtendedRequest).prisma,
          variant: variant as string,
          stages: progressiveConfig.stages,
          stageRegistry,
        })
      } catch (err) {
        console.error('[progressive] dispatch error:', err)
        if (!res.headersSent && !res.writableEnded) {
          emitTerminalSSEError(res, 'Internal server error')
        }
      }
    }
  }

  const respond: RequestHandler = (_req, res) => {
    if (res.headersSent || res.writableEnded) return
    const data = readLocals(res).data
    if (data === undefined) return res.status(500).json({ message: 'No data set by handler' })
    return res.json(transformResult(data))
  }

  const respondCreated: RequestHandler = (_req, res) => {
    if (res.headersSent || res.writableEnded) return
    const data = readLocals(res).data
    if (data === undefined) return res.status(500).json({ message: 'No data set by handler' })
    return res.status(201).json(transformResult(data))
  }

  if (!openApiDisabled) {
    const openapiJsonPath = basePath ? \`\${basePath}/openapi.json\` : '/openapi.json'
    const openapiYamlPath = basePath ? \`\${basePath}/openapi.yaml\` : '/openapi.yaml'
    router.get(openapiJsonPath, (_req, res) => {
      res.json(getOpenApiJson())
    })
    router.get(openapiYamlPath, (_req, res) => {
      res.type('application/yaml').send(getOpenApiYaml())
    })
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
    const { before = [], after = [] } = opConfig
    const path = basePath ? \`\${basePath}/each\` : '/each'
    router.post(
      path,
      setShape(opConfig, 'noop'),
      ...before,
      async (req: Request, res: Response, next: NextFunction) => {
        try {
          if (!Array.isArray(req.body)) {
            throw new HttpError(400, 'updateEach body must be an array of { where, data } items')
          }
          const atomic = req.get('x-batch-atomic') === 'true'
          readLocals(res).data = await core.updateEach(buildContext(req, res), atomic)
          next()
        } catch (err) {
          next(mapError(err))
        }
      },
      ...after,
      respond,
    )
  }

  router.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    const httpError = mapError(err)
    if (!res.headersSent) return res.status(httpError.status).json({ message: httpError.message })
    next(err)
  })

  return router
}
`
}