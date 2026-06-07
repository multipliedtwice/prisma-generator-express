import { DMMF } from '@prisma/generator-helper'
import { toCamelCase } from '../utils/strings'
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
  relativeClientPath?: string
  guardShapesImport: string | null
  importStyle: ImportStyle
}): string {
  const ext = importExt(importStyle)
  const modelName = model.name
  const prefix = toCamelCase(modelName)
  const modelNameLower = modelName.toLowerCase()
  const delegateKey = modelName.charAt(0).toLowerCase() + modelName.slice(1)
  const routerFunctionName = `${prefix}Router`

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
  ${prefix}FindUnique,
  ${prefix}FindUniqueOrThrow,
  ${prefix}FindFirst,
  ${prefix}FindFirstOrThrow,
  ${prefix}FindMany,
  ${prefix}FindManyPaginated,
  ${prefix}Create,
  ${prefix}CreateMany,
  ${prefix}CreateManyAndReturn,
  ${prefix}Update,
  ${prefix}UpdateMany,
  ${prefix}UpdateManyAndReturn,
  ${prefix}Upsert,
  ${prefix}Delete,
  ${prefix}DeleteMany,
  ${prefix}Aggregate,
  ${prefix}Count,
  ${prefix}GroupBy,
} from './${modelName}Handlers${ext}'
import * as core from './${modelName}Core${ext}'
import type { RouteConfig } from '../routeConfig.target${ext}'
import { parseQueryParams } from '../parseQueryParams${ext}'
import { sanitizeKeys } from '../misc${ext}'
import { buildModelOpenApi } from '../buildModelOpenApi${ext}'
import type { OperationContext } from '../operationRuntime${ext}'
import {
  transformResult,
  acceptsEventStream,
  runProgressiveEndpoint,
  runSingleResultSSE,
} from '../operationRuntime${ext}'
import { relationModels } from '../relationModels${ext}'
import { runAutoIncludeProgressive } from '../autoIncludeRuntime${ext}'

${generateRouteConfigType(modelName, 'RequestHandler', guardShapesImport, importStyle, 'express')}
const _env = typeof process !== 'undefined' && process.env ? process.env : {} as Record<string, string | undefined>

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

const defaultOpConfig: OperationConfigLike = {
  before: [],
  after: [],
}

function normalizePrefix(p: string): string {
  if (!p) return ''
  let result = p
  if (!result.startsWith('/')) result = '/' + result
  while (result.length > 1 && result.endsWith('/')) result = result.slice(0, -1)
  if (result === '/') return ''
  return result
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

function readLocals(res: Response): LocalsBag {
  return res.locals as LocalsBag
}

export function ${routerFunctionName}<TCtx = unknown>(config: ${modelName}RouteConfig<TCtx> = {}) {
  const router = express.Router()
  router.use(express.json())

  const customPrefix = normalizePrefix(config.customUrlPrefix || '')
  const modelPrefix = config.addModelPrefix !== false ? '/${modelNameLower}' : ''
  const basePath = customPrefix + modelPrefix

  const openApiDisabled = config.disableOpenApi === true
    || (config.disableOpenApi !== false && (_env.DISABLE_OPENAPI === 'true' || _env.NODE_ENV === 'production'))

  const postReadsEnabled = !config.disablePostReads

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
          const isSingleRecordRead =
            baseOp === 'findUnique' || baseOp === 'findUniqueOrThrow' ||
            baseOp === 'findFirst' || baseOp === 'findFirstOrThrow'

          if (!isSingleRecordRead) {
            if (progressiveConfig.fallback === 'error') {
              return next({ status: 400, message: 'autoInclude mode supports only single-record reads' })
            }
            await runSingleResultSSE({
              req,
              res,
              coreQueryFn: () => coreFn(buildContext(req, res)),
            })
            return
          }

          await runAutoIncludeProgressive({
            req,
            res,
            ctx: buildContext(req, res),
            args: locals.parsedQuery ?? {},
            baseOp: baseOp as 'findUnique' | 'findUniqueOrThrow' | 'findFirst' | 'findFirstOrThrow',
            modelName: '${modelName}',
            delegateKey: '${delegateKey}',
            models: relationModels,
            variantConfig: progressiveConfig,
            coreQueryFn: () => coreFn(buildContext(req, res)),
          })
          return
        }

        if (!Array.isArray(progressiveConfig.stages)) {
          return next({ status: 500, message: 'Progressive endpoint requires stages array' })
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
      const spec = buildModelOpenApi('${modelName}', MODEL_FIELDS as unknown as Parameters<typeof buildModelOpenApi>[1], MODEL_ENUMS as unknown as Parameters<typeof buildModelOpenApi>[2], config, { format: 'json' })
      res.json(spec)
    })
    router.get(openapiYamlPath, (_req, res) => {
      const spec = buildModelOpenApi('${modelName}', MODEL_FIELDS as unknown as Parameters<typeof buildModelOpenApi>[1], MODEL_ENUMS as unknown as Parameters<typeof buildModelOpenApi>[2], config, { format: 'yaml' })
      res.type('application/yaml').send(spec as string)
    })
  }

  if (config.enableAll || config.findFirst) {
    const opConfig: OperationConfigLike = (config.findFirst as OperationConfigLike | undefined) ?? defaultOpConfig
    const { before = [], after = [] } = opConfig
    const path = basePath ? \`\${basePath}/first\` : '/first'
    router.get(path, parseQuery, setShape(opConfig), ...before, maybeProgressiveSSE(opConfig, core.findFirst, 'findFirst'), ${prefix}FindFirst as RequestHandler, ...after, respond)
    if (postReadsEnabled) router.post(path, parseBodyAsQuery, setShape(opConfig), ...before, ${prefix}FindFirst as RequestHandler, ...after, respond)
  }
  if (config.enableAll || config.findFirstOrThrow) {
    const opConfig: OperationConfigLike = (config.findFirstOrThrow as OperationConfigLike | undefined) ?? defaultOpConfig
    const { before = [], after = [] } = opConfig
    const path = basePath ? \`\${basePath}/first/strict\` : '/first/strict'
    router.get(path, parseQuery, setShape(opConfig), ...before, maybeProgressiveSSE(opConfig, core.findFirstOrThrow, 'findFirstOrThrow'), ${prefix}FindFirstOrThrow as RequestHandler, ...after, respond)
    if (postReadsEnabled) router.post(path, parseBodyAsQuery, setShape(opConfig), ...before, ${prefix}FindFirstOrThrow as RequestHandler, ...after, respond)
  }
  if (config.enableAll || config.findManyPaginated) {
    const opConfig: OperationConfigLike = (config.findManyPaginated as OperationConfigLike | undefined) ?? defaultOpConfig
    const { before = [], after = [] } = opConfig
    const path = basePath ? \`\${basePath}/paginated\` : '/paginated'
    router.get(path, parseQuery, setShape(opConfig), ...before, maybeProgressiveSSE(opConfig, core.findManyPaginated, 'findManyPaginated'), ${prefix}FindManyPaginated as RequestHandler, ...after, respond)
    if (postReadsEnabled) router.post(path, parseBodyAsQuery, setShape(opConfig), ...before, ${prefix}FindManyPaginated as RequestHandler, ...after, respond)
  }
  if (config.enableAll || config.aggregate) {
    const opConfig: OperationConfigLike = (config.aggregate as OperationConfigLike | undefined) ?? defaultOpConfig
    const { before = [], after = [] } = opConfig
    const path = basePath ? \`\${basePath}/aggregate\` : '/aggregate'
    router.get(path, parseQuery, setShape(opConfig), ...before, maybeProgressiveSSE(opConfig, core.aggregate, 'aggregate'), ${prefix}Aggregate as RequestHandler, ...after, respond)
    if (postReadsEnabled) router.post(path, parseBodyAsQuery, setShape(opConfig), ...before, ${prefix}Aggregate as RequestHandler, ...after, respond)
  }
  if (config.enableAll || config.count) {
    const opConfig: OperationConfigLike = (config.count as OperationConfigLike | undefined) ?? defaultOpConfig
    const { before = [], after = [] } = opConfig
    const path = basePath ? \`\${basePath}/count\` : '/count'
    router.get(path, parseQuery, setShape(opConfig), ...before, maybeProgressiveSSE(opConfig, core.count, 'count'), ${prefix}Count as RequestHandler, ...after, respond)
    if (postReadsEnabled) router.post(path, parseBodyAsQuery, setShape(opConfig), ...before, ${prefix}Count as RequestHandler, ...after, respond)
  }
  if (config.enableAll || config.groupBy) {
    const opConfig: OperationConfigLike = (config.groupBy as OperationConfigLike | undefined) ?? defaultOpConfig
    const { before = [], after = [] } = opConfig
    const path = basePath ? \`\${basePath}/groupby\` : '/groupby'
    router.get(path, parseQuery, setShape(opConfig), ...before, maybeProgressiveSSE(opConfig, core.groupBy, 'groupBy'), ${prefix}GroupBy as RequestHandler, ...after, respond)
    if (postReadsEnabled) router.post(path, parseBodyAsQuery, setShape(opConfig), ...before, ${prefix}GroupBy as RequestHandler, ...after, respond)
  }
  if (config.enableAll || config.findUniqueOrThrow) {
    const opConfig: OperationConfigLike = (config.findUniqueOrThrow as OperationConfigLike | undefined) ?? defaultOpConfig
    const { before = [], after = [] } = opConfig
    const path = basePath ? \`\${basePath}/unique/strict\` : '/unique/strict'
    router.get(path, parseQuery, setShape(opConfig), ...before, maybeProgressiveSSE(opConfig, core.findUniqueOrThrow, 'findUniqueOrThrow'), ${prefix}FindUniqueOrThrow as RequestHandler, ...after, respond)
    if (postReadsEnabled) router.post(path, parseBodyAsQuery, setShape(opConfig), ...before, ${prefix}FindUniqueOrThrow as RequestHandler, ...after, respond)
  }
  if (config.enableAll || config.findUnique) {
    const opConfig: OperationConfigLike = (config.findUnique as OperationConfigLike | undefined) ?? defaultOpConfig
    const { before = [], after = [] } = opConfig
    const path = basePath ? \`\${basePath}/unique\` : '/unique'
    router.get(path, parseQuery, setShape(opConfig), ...before, maybeProgressiveSSE(opConfig, core.findUnique, 'findUnique'), ${prefix}FindUnique as RequestHandler, ...after, respond)
    if (postReadsEnabled) router.post(path, parseBodyAsQuery, setShape(opConfig), ...before, ${prefix}FindUnique as RequestHandler, ...after, respond)
  }
  if (config.enableAll || config.findMany) {
    const opConfig: OperationConfigLike = (config.findMany as OperationConfigLike | undefined) ?? defaultOpConfig
    const { before = [], after = [] } = opConfig
    const path = basePath || '/'
    router.get(path, parseQuery, setShape(opConfig), ...before, maybeProgressiveSSE(opConfig, core.findMany, 'findMany'), ${prefix}FindMany as RequestHandler, ...after, respond)
    if (postReadsEnabled) {
      const postPath = basePath ? \`\${basePath}/read\` : '/read'
      router.post(postPath, parseBodyAsQuery, setShape(opConfig), ...before, ${prefix}FindMany as RequestHandler, ...after, respond)
    }
  }

  if (config.enableAll || config.createManyAndReturn) {
    const opConfig: OperationConfigLike = (config.createManyAndReturn as OperationConfigLike | undefined) ?? defaultOpConfig
    const { before = [], after = [] } = opConfig
    const path = basePath ? \`\${basePath}/many/return\` : '/many/return'
    router.post(path, setShape(opConfig), ...before, ${prefix}CreateManyAndReturn as RequestHandler, ...after, respondCreated)
  }
  if (config.enableAll || config.createMany) {
    const opConfig: OperationConfigLike = (config.createMany as OperationConfigLike | undefined) ?? defaultOpConfig
    const { before = [], after = [] } = opConfig
    const path = basePath ? \`\${basePath}/many\` : '/many'
    router.post(path, setShape(opConfig), ...before, ${prefix}CreateMany as RequestHandler, ...after, respondCreated)
  }
  if (config.enableAll || config.create) {
    const opConfig: OperationConfigLike = (config.create as OperationConfigLike | undefined) ?? defaultOpConfig
    const { before = [], after = [] } = opConfig
    const path = basePath || '/'
    router.post(path, setShape(opConfig), ...before, ${prefix}Create as RequestHandler, ...after, respondCreated)
  }
  if (config.enableAll || config.updateManyAndReturn) {
    const opConfig: OperationConfigLike = (config.updateManyAndReturn as OperationConfigLike | undefined) ?? defaultOpConfig
    const { before = [], after = [] } = opConfig
    const path = basePath ? \`\${basePath}/many/return\` : '/many/return'
    router.put(path, setShape(opConfig), ...before, ${prefix}UpdateManyAndReturn as RequestHandler, ...after, respond)
  }
  if (config.enableAll || config.updateMany) {
    const opConfig: OperationConfigLike = (config.updateMany as OperationConfigLike | undefined) ?? defaultOpConfig
    const { before = [], after = [] } = opConfig
    const path = basePath ? \`\${basePath}/many\` : '/many'
    router.put(path, setShape(opConfig), ...before, ${prefix}UpdateMany as RequestHandler, ...after, respond)
  }
  if (config.enableAll || config.update) {
    const opConfig: OperationConfigLike = (config.update as OperationConfigLike | undefined) ?? defaultOpConfig
    const { before = [], after = [] } = opConfig
    const path = basePath || '/'
    router.put(path, setShape(opConfig), ...before, ${prefix}Update as RequestHandler, ...after, respond)
  }
  if (config.enableAll || config.upsert) {
    const opConfig: OperationConfigLike = (config.upsert as OperationConfigLike | undefined) ?? defaultOpConfig
    const { before = [], after = [] } = opConfig
    const path = basePath || '/'
    router.patch(path, setShape(opConfig), ...before, ${prefix}Upsert as RequestHandler, ...after, respond)
  }
  if (config.enableAll || config.deleteMany) {
    const opConfig: OperationConfigLike = (config.deleteMany as OperationConfigLike | undefined) ?? defaultOpConfig
    const { before = [], after = [] } = opConfig
    const path = basePath ? \`\${basePath}/many\` : '/many'
    router.delete(path, setShape(opConfig), ...before, ${prefix}DeleteMany as RequestHandler, ...after, respond)
  }
  if (config.enableAll || config.delete) {
    const opConfig: OperationConfigLike = (config.delete as OperationConfigLike | undefined) ?? defaultOpConfig
    const { before = [], after = [] } = opConfig
    const path = basePath || '/'
    router.delete(path, setShape(opConfig), ...before, ${prefix}Delete as RequestHandler, ...after, respond)
  }

  router.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    const e = err as { status?: number; message?: string }
    const status = typeof e.status === 'number' ? e.status : 500
    const message = e.message || 'Internal server error'
    if (!res.headersSent) return res.status(status).json({ message })
    next(err)
  })

  return router
}
`
}