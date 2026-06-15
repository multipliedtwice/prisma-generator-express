import { DMMF } from '@prisma/generator-helper'
import { generateRouteConfigType } from './generateRouteConfigType'
import { ImportStyle } from '../utils/resolveImportStyle'
import { importExt } from '../utils/importExt'

export function generateRouterFunction({
  model,
  enums,
  guardShapesImport,
  importStyle,
}: {
  model: DMMF.Model
  enums: DMMF.DatamodelEnum[]
  guardShapesImport: string | null
  importStyle: ImportStyle
}): string {
  const ext = importExt(importStyle)
  const modelName = model.name
  const modelNameLower = modelName.toLowerCase()
  const delegateKey = modelName.charAt(0).toLowerCase() + modelName.slice(1)
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

  return `import express from 'express'
import type { Request, Response, NextFunction, RequestHandler } from 'express'
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
import * as core from './${modelName}Core${ext}'
import type { RouteConfig, QueryBuilderConfig } from '../routeConfig.target${ext}'
import { parseQueryParams } from '../parseQueryParams${ext}'
import { sanitizeKeys, normalizePrefix, getEnv } from '../misc${ext}'
import { buildModelOpenApi } from '../buildModelOpenApi${ext}'
import type { OperationContext } from '../operationRuntime${ext}'
import {
  transformResult,
  acceptsEventStream,
  runProgressiveEndpoint,
  runSingleResultSSE,
  emitTerminalSSEError,
  removeReqCloseListener,
  mapError,
  HttpError,
} from '../operationRuntime${ext}'
import { relationModels } from '../relationModels${ext}'
import { runAutoIncludeProgressive } from '../autoIncludeRuntime${ext}'

${generateRouteConfigType(modelName, 'RequestHandler', guardShapesImport, importStyle, 'express')}
const _env = getEnv()

const MODEL_FIELDS = ${JSON.stringify(fieldsMeta, null, 2)} as const
const MODEL_ENUMS = ${JSON.stringify(enumsMeta, null, 2)} as const

type OperationConfigLike = {
  before?: RequestHandler[]
  after?: RequestHandler[]
  shape?: Record<string, unknown>
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
  routeConfig?: { pagination?: OperationContext['paginationConfig'] }
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
  const router = express.Router()

  const customPrefix = normalizePrefix(config.customUrlPrefix || '')
  const modelPrefix = config.addModelPrefix !== false ? '/${modelNameLower}' : ''
  const basePath = customPrefix + modelPrefix

  const openApiDisabled = config.disableOpenApi === true
    || (config.disableOpenApi !== false && (_env.DISABLE_OPENAPI === 'true' || _env.NODE_ENV === 'production'))

  const postReadsEnabled = !config.disablePostReads

  const openApiJsonSpec = openApiDisabled
    ? null
    : buildModelOpenApi(
        '${modelName}',
        MODEL_FIELDS as unknown as Parameters<typeof buildModelOpenApi>[1],
        MODEL_ENUMS as unknown as Parameters<typeof buildModelOpenApi>[2],
        config as unknown as Parameters<typeof buildModelOpenApi>[3],
        { format: 'json' },
      )
  const openApiYamlSpec = openApiDisabled
    ? null
    : buildModelOpenApi(
        '${modelName}',
        MODEL_FIELDS as unknown as Parameters<typeof buildModelOpenApi>[1],
        MODEL_ENUMS as unknown as Parameters<typeof buildModelOpenApi>[2],
        config as unknown as Parameters<typeof buildModelOpenApi>[3],
        { format: 'yaml' },
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
    }
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
      return next({ status: 400, message: 'Request body must be a JSON object' })
    }
    readLocals(res).parsedQuery = sanitizeKeys(req.body as Record<string, unknown>)
    next()
  }

  const setShape = (opConfig: OperationConfigLike): RequestHandler => {
    return (req, res, next) => {
      const locals = readLocals(res)
      if (config.pagination) {
        locals.routeConfig = { pagination: config.pagination }
      }
      const headerName = config.guard?.variantHeader || 'x-api-variant'
      const headerValue = req.get(headerName)
      const caller = config.guard?.resolveVariant?.(req) ?? headerValue ?? undefined
      if (caller) locals.guardCaller = caller
      if (opConfig.shape) locals.guardShape = opConfig.shape
      next()
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
            baseOp === 'findMany'

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
              baseOp: baseOp as 'findUnique' | 'findUniqueOrThrow' | 'findFirst' | 'findFirstOrThrow' | 'findMany',
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
          return next({ status: 500, message: 'Missing progressive stage: ' + missingStage })
        }

        if (typeof config.resolveContext !== 'function') {
          return next({ status: 500, message: 'Progressive endpoint requires config.resolveContext' })
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
        if (!res.headersSent) {
          return next({ status: 500, message: 'Internal server error' })
        }
      }
    }
  }

  const respond: RequestHandler = (_req, res) => {
    const data = readLocals(res).data
    if (data === undefined) return res.status(500).json({ message: 'No data set by handler' })
    return res.json(transformResult(data))
  }

  const respondCreated: RequestHandler = (_req, res) => {
    const data = readLocals(res).data
    if (data === undefined) return res.status(500).json({ message: 'No data set by handler' })
    return res.status(201).json(transformResult(data))
  }

  if (!openApiDisabled) {
    const openapiJsonPath = basePath ? \`\${basePath}/openapi.json\` : '/openapi.json'
    const openapiYamlPath = basePath ? \`\${basePath}/openapi.yaml\` : '/openapi.yaml'
    router.get(openapiJsonPath, (_req, res) => {
      res.json(openApiJsonSpec)
    })
    router.get(openapiYamlPath, (_req, res) => {
      res.type('application/yaml').send(openApiYamlSpec as string)
    })
  }

  if (config.enableAll || config.findFirst) {
    const opConfig: OperationConfigLike = (config.findFirst as OperationConfigLike | undefined) ?? defaultOpConfig
    const { before = [], after = [] } = opConfig
    const path = basePath ? \`\${basePath}/first\` : '/first'
    router.get(path, parseQuery, setShape(opConfig), ...before, maybeProgressiveSSE(opConfig, core.findFirst, 'findFirst'), ${modelName}FindFirst as RequestHandler, ...after, respond)
    if (postReadsEnabled) router.post(path, parseBodyAsQuery, setShape(opConfig), ...before, ${modelName}FindFirst as RequestHandler, ...after, respond)
  }
  if (config.enableAll || config.findFirstOrThrow) {
    const opConfig: OperationConfigLike = (config.findFirstOrThrow as OperationConfigLike | undefined) ?? defaultOpConfig
    const { before = [], after = [] } = opConfig
    const path = basePath ? \`\${basePath}/first/strict\` : '/first/strict'
    router.get(path, parseQuery, setShape(opConfig), ...before, maybeProgressiveSSE(opConfig, core.findFirstOrThrow, 'findFirstOrThrow'), ${modelName}FindFirstOrThrow as RequestHandler, ...after, respond)
    if (postReadsEnabled) router.post(path, parseBodyAsQuery, setShape(opConfig), ...before, ${modelName}FindFirstOrThrow as RequestHandler, ...after, respond)
  }
  if (config.enableAll || config.findManyPaginated) {
    const opConfig: OperationConfigLike = (config.findManyPaginated as OperationConfigLike | undefined) ?? defaultOpConfig
    const { before = [], after = [] } = opConfig
    const path = basePath ? \`\${basePath}/paginated\` : '/paginated'
    router.get(path, parseQuery, setShape(opConfig), ...before, maybeProgressiveSSE(opConfig, core.findManyPaginated, 'findManyPaginated'), ${modelName}FindManyPaginated as RequestHandler, ...after, respond)
    if (postReadsEnabled) router.post(path, parseBodyAsQuery, setShape(opConfig), ...before, ${modelName}FindManyPaginated as RequestHandler, ...after, respond)
  }
  if (config.enableAll || config.aggregate) {
    const opConfig: OperationConfigLike = (config.aggregate as OperationConfigLike | undefined) ?? defaultOpConfig
    const { before = [], after = [] } = opConfig
    const path = basePath ? \`\${basePath}/aggregate\` : '/aggregate'
    router.get(path, parseQuery, setShape(opConfig), ...before, maybeProgressiveSSE(opConfig, core.aggregate, 'aggregate'), ${modelName}Aggregate as RequestHandler, ...after, respond)
    if (postReadsEnabled) router.post(path, parseBodyAsQuery, setShape(opConfig), ...before, ${modelName}Aggregate as RequestHandler, ...after, respond)
  }
  if (config.enableAll || config.count) {
    const opConfig: OperationConfigLike = (config.count as OperationConfigLike | undefined) ?? defaultOpConfig
    const { before = [], after = [] } = opConfig
    const path = basePath ? \`\${basePath}/count\` : '/count'
    router.get(path, parseQuery, setShape(opConfig), ...before, maybeProgressiveSSE(opConfig, core.count, 'count'), ${modelName}Count as RequestHandler, ...after, respond)
    if (postReadsEnabled) router.post(path, parseBodyAsQuery, setShape(opConfig), ...before, ${modelName}Count as RequestHandler, ...after, respond)
  }
  if (config.enableAll || config.groupBy) {
    const opConfig: OperationConfigLike = (config.groupBy as OperationConfigLike | undefined) ?? defaultOpConfig
    const { before = [], after = [] } = opConfig
    const path = basePath ? \`\${basePath}/groupby\` : '/groupby'
    router.get(path, parseQuery, setShape(opConfig), ...before, maybeProgressiveSSE(opConfig, core.groupBy, 'groupBy'), ${modelName}GroupBy as RequestHandler, ...after, respond)
    if (postReadsEnabled) router.post(path, parseBodyAsQuery, setShape(opConfig), ...before, ${modelName}GroupBy as RequestHandler, ...after, respond)
  }
  if (config.enableAll || config.findUniqueOrThrow) {
    const opConfig: OperationConfigLike = (config.findUniqueOrThrow as OperationConfigLike | undefined) ?? defaultOpConfig
    const { before = [], after = [] } = opConfig
    const path = basePath ? \`\${basePath}/unique/strict\` : '/unique/strict'
    router.get(path, parseQuery, setShape(opConfig), ...before, maybeProgressiveSSE(opConfig, core.findUniqueOrThrow, 'findUniqueOrThrow'), ${modelName}FindUniqueOrThrow as RequestHandler, ...after, respond)
    if (postReadsEnabled) router.post(path, parseBodyAsQuery, setShape(opConfig), ...before, ${modelName}FindUniqueOrThrow as RequestHandler, ...after, respond)
  }
  if (config.enableAll || config.findUnique) {
    const opConfig: OperationConfigLike = (config.findUnique as OperationConfigLike | undefined) ?? defaultOpConfig
    const { before = [], after = [] } = opConfig
    const path = basePath ? \`\${basePath}/unique\` : '/unique'
    router.get(path, parseQuery, setShape(opConfig), ...before, maybeProgressiveSSE(opConfig, core.findUnique, 'findUnique'), ${modelName}FindUnique as RequestHandler, ...after, respond)
    if (postReadsEnabled) router.post(path, parseBodyAsQuery, setShape(opConfig), ...before, ${modelName}FindUnique as RequestHandler, ...after, respond)
  }
  if (config.enableAll || config.findMany) {
    const opConfig: OperationConfigLike = (config.findMany as OperationConfigLike | undefined) ?? defaultOpConfig
    const { before = [], after = [] } = opConfig
    const path = basePath || '/'
    router.get(path, parseQuery, setShape(opConfig), ...before, maybeProgressiveSSE(opConfig, core.findMany, 'findMany'), ${modelName}FindMany as RequestHandler, ...after, respond)
    if (postReadsEnabled) {
      const postPath = basePath ? \`\${basePath}/read\` : '/read'
      router.post(postPath, parseBodyAsQuery, setShape(opConfig), ...before, ${modelName}FindMany as RequestHandler, ...after, respond)
    }
  }

  if (config.enableAll || config.createManyAndReturn) {
    const opConfig: OperationConfigLike = (config.createManyAndReturn as OperationConfigLike | undefined) ?? defaultOpConfig
    const { before = [], after = [] } = opConfig
    const path = basePath ? \`\${basePath}/many/return\` : '/many/return'
    router.post(path, setShape(opConfig), ...before, ${modelName}CreateManyAndReturn as RequestHandler, ...after, respondCreated)
  }
  if (config.enableAll || config.createMany) {
    const opConfig: OperationConfigLike = (config.createMany as OperationConfigLike | undefined) ?? defaultOpConfig
    const { before = [], after = [] } = opConfig
    const path = basePath ? \`\${basePath}/many\` : '/many'
    router.post(path, setShape(opConfig), ...before, ${modelName}CreateMany as RequestHandler, ...after, respondCreated)
  }
  if (config.enableAll || config.create) {
    const opConfig: OperationConfigLike = (config.create as OperationConfigLike | undefined) ?? defaultOpConfig
    const { before = [], after = [] } = opConfig
    const path = basePath || '/'
    router.post(path, setShape(opConfig), ...before, ${modelName}Create as RequestHandler, ...after, respondCreated)
  }
  if (config.enableAll || config.updateManyAndReturn) {
    const opConfig: OperationConfigLike = (config.updateManyAndReturn as OperationConfigLike | undefined) ?? defaultOpConfig
    const { before = [], after = [] } = opConfig
    const path = basePath ? \`\${basePath}/many/return\` : '/many/return'
    router.put(path, setShape(opConfig), ...before, ${modelName}UpdateManyAndReturn as RequestHandler, ...after, respond)
  }
  if (config.enableAll || config.updateMany) {
    const opConfig: OperationConfigLike = (config.updateMany as OperationConfigLike | undefined) ?? defaultOpConfig
    const { before = [], after = [] } = opConfig
    const path = basePath ? \`\${basePath}/many\` : '/many'
    router.put(path, setShape(opConfig), ...before, ${modelName}UpdateMany as RequestHandler, ...after, respond)
  }
  if (config.enableAll || config.update) {
    const opConfig: OperationConfigLike = (config.update as OperationConfigLike | undefined) ?? defaultOpConfig
    const { before = [], after = [] } = opConfig
    const path = basePath || '/'
    router.put(path, setShape(opConfig), ...before, ${modelName}Update as RequestHandler, ...after, respond)
  }
  if (config.enableAll || config.upsert) {
    const opConfig: OperationConfigLike = (config.upsert as OperationConfigLike | undefined) ?? defaultOpConfig
    const { before = [], after = [] } = opConfig
    const path = basePath || '/'
    router.patch(path, setShape(opConfig), ...before, ${modelName}Upsert as RequestHandler, ...after, respond)
  }
  if (config.enableAll || config.deleteMany) {
    const opConfig: OperationConfigLike = (config.deleteMany as OperationConfigLike | undefined) ?? defaultOpConfig
    const { before = [], after = [] } = opConfig
    const path = basePath ? \`\${basePath}/many\` : '/many'
    router.delete(path, setShape(opConfig), ...before, ${modelName}DeleteMany as RequestHandler, ...after, respond)
  }
  if (config.enableAll || config.delete) {
    const opConfig: OperationConfigLike = (config.delete as OperationConfigLike | undefined) ?? defaultOpConfig
    const { before = [], after = [] } = opConfig
    const path = basePath || '/'
    router.delete(path, setShape(opConfig), ...before, ${modelName}Delete as RequestHandler, ...after, respond)
  }
  if (config.updateEach) {
    const opConfig: OperationConfigLike = (config.updateEach as OperationConfigLike | undefined) ?? defaultOpConfig
    const { before = [], after = [] } = opConfig
    const path = basePath ? \`\${basePath}/each\` : '/each'
    router.post(
      path,
      setShape(opConfig),
      ...before,
      async (req: Request, res: Response, next: NextFunction) => {
        try {
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
    let httpError: HttpError
    if (err instanceof HttpError) {
      httpError = err
    } else if (err && typeof err === 'object' && typeof (err as { status?: number }).status === 'number') {
      const e = err as { status: number; message?: string }
      httpError = new HttpError(e.status, e.message || 'Internal server error')
    } else {
      httpError = mapError(err)
    }
    if (!res.headersSent) return res.status(httpError.status).json({ message: httpError.message })
    next(err)
  })

  return router
}
`
}