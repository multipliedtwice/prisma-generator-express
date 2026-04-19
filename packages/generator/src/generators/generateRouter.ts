import { DMMF } from '@prisma/generator-helper'
import { toCamelCase } from '../utils/strings.js'

export function generateRouterFunction({
  model,
  enums,
  relativeClientPath,
}: {
  model: DMMF.Model
  enums: DMMF.DatamodelEnum[]
  relativeClientPath: string
}): string {
  const modelName = model.name
  const prefix = toCamelCase(modelName)
  const modelNameLower = modelName.toLowerCase()
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

  return `import express, { Request, Response, NextFunction, RequestHandler } from 'express'
import type { PrismaClient } from '${relativeClientPath}'
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
  ${prefix}GroupBy
} from './${modelName}Handlers.js'
import type { RouteConfig } from '../routeConfig.target.js'
import { parseQueryParams } from '../parseQueryParams.js'
import { buildModelOpenApi } from '../buildModelOpenApi.js'
import { transformResult } from '../operationRuntime.js'

const _env = typeof process !== 'undefined' && process.env ? process.env : {} as Record<string, string | undefined>

const MODEL_FIELDS = ${JSON.stringify(fieldsMeta, null, 2)} as const

const MODEL_ENUMS = ${JSON.stringify(enumsMeta, null, 2)} as const

const defaultOpConfig = {
  before: [] as RequestHandler[],
  after: [] as RequestHandler[],
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

export function ${routerFunctionName}(config: RouteConfig = {}) {
  const router = express.Router()

  router.use(express.json())

  const customPrefix = normalizePrefix(config.customUrlPrefix || '')
  const modelPrefix = config.addModelPrefix !== false ? '/${modelNameLower}' : ''
  const basePath = customPrefix + modelPrefix

  const openApiDisabled = config.disableOpenApi === true
    || (config.disableOpenApi !== false && (
      _env.DISABLE_OPENAPI === 'true'
      || _env.NODE_ENV === 'production'
    ))

  const qbEnabled = isQueryBuilderEnabled(config)

  if (qbEnabled) {
    const qbConfig = getQueryBuilderConfig(config)
    if (qbConfig) {
      try { require('../queryBuilder').startQueryBuilder(qbConfig) } catch (err) { if (_env.NODE_ENV !== 'production') console.warn('[query-builder]', err) }
    }
  }

  const parseQuery: RequestHandler = (req, res, next) => {
    const rawQuery = req.query
    if (rawQuery && Object.keys(rawQuery).length > 0) {
      res.locals.parsedQuery = parseQueryParams(rawQuery as Record<string, unknown>)
    }
    next()
  }

  const setShape = (opConfig: any): RequestHandler => {
    return (req, res, next) => {
      res.locals.routeConfig = config
      if (opConfig.shape) {
        res.locals.guardShape = opConfig.shape
        const caller = config.guard?.resolveVariant?.(req)
          ?? req.get(config.guard?.variantHeader || 'x-api-variant')
          ?? undefined
        if (caller) {
          res.locals.guardCaller = caller
        }
      }
      next()
    }
  }

  const respond: RequestHandler = (_req, res) => {
    const data = res.locals.data
    if (data === undefined) {
      return res.status(500).json({ message: 'No data set by handler' })
    }
    return res.json(transformResult(data))
  }

  const respondCreated: RequestHandler = (_req, res) => {
    const data = res.locals.data
    if (data === undefined) {
      return res.status(500).json({ message: 'No data set by handler' })
    }
    return res.status(201).json(transformResult(data))
  }

  if (!openApiDisabled) {
    const openapiJsonPath = basePath ? \`\${basePath}/openapi.json\` : '/openapi.json'
    const openapiYamlPath = basePath ? \`\${basePath}/openapi.yaml\` : '/openapi.yaml'

    router.get(openapiJsonPath, (_req, res) => {
      const spec = buildModelOpenApi(
        '${modelName}',
        MODEL_FIELDS as any,
        MODEL_ENUMS as any,
        config,
        { format: 'json' }
      )
      res.json(spec)
    })

    router.get(openapiYamlPath, (_req, res) => {
      const spec = buildModelOpenApi(
        '${modelName}',
        MODEL_FIELDS as any,
        MODEL_ENUMS as any,
        config,
        { format: 'yaml' }
      )
      res.type('application/yaml').send(spec as string)
    })
  }

  if (config.enableAll || config.findFirst) {
    const opConfig = config.findFirst || defaultOpConfig
    const { before = [], after = [] } = opConfig
    const path = basePath ? \`\${basePath}/first\` : '/first'
    router.get(path, parseQuery, setShape(opConfig), ...before, ${prefix}FindFirst as RequestHandler, ...after, respond)
  }

  if (config.enableAll || config.findFirstOrThrow) {
    const opConfig = config.findFirstOrThrow || defaultOpConfig
    const { before = [], after = [] } = opConfig
    const path = basePath ? \`\${basePath}/first/strict\` : '/first/strict'
    router.get(path, parseQuery, setShape(opConfig), ...before, ${prefix}FindFirstOrThrow as RequestHandler, ...after, respond)
  }

  if (config.enableAll || config.findManyPaginated) {
    const opConfig = config.findManyPaginated || defaultOpConfig
    const { before = [], after = [] } = opConfig
    const path = basePath ? \`\${basePath}/paginated\` : '/paginated'
    router.get(path, parseQuery, setShape(opConfig), ...before, ${prefix}FindManyPaginated as RequestHandler, ...after, respond)
  }

  if (config.enableAll || config.aggregate) {
    const opConfig = config.aggregate || defaultOpConfig
    const { before = [], after = [] } = opConfig
    const path = basePath ? \`\${basePath}/aggregate\` : '/aggregate'
    router.get(path, parseQuery, setShape(opConfig), ...before, ${prefix}Aggregate as RequestHandler, ...after, respond)
  }

  if (config.enableAll || config.count) {
    const opConfig = config.count || defaultOpConfig
    const { before = [], after = [] } = opConfig
    const path = basePath ? \`\${basePath}/count\` : '/count'
    router.get(path, parseQuery, setShape(opConfig), ...before, ${prefix}Count as RequestHandler, ...after, respond)
  }

  if (config.enableAll || config.groupBy) {
    const opConfig = config.groupBy || defaultOpConfig
    const { before = [], after = [] } = opConfig
    const path = basePath ? \`\${basePath}/groupby\` : '/groupby'
    router.get(path, parseQuery, setShape(opConfig), ...before, ${prefix}GroupBy as RequestHandler, ...after, respond)
  }

  if (config.enableAll || config.findUniqueOrThrow) {
    const opConfig = config.findUniqueOrThrow || defaultOpConfig
    const { before = [], after = [] } = opConfig
    const path = basePath ? \`\${basePath}/unique/strict\` : '/unique/strict'
    router.get(path, parseQuery, setShape(opConfig), ...before, ${prefix}FindUniqueOrThrow as RequestHandler, ...after, respond)
  }

  if (config.enableAll || config.findUnique) {
    const opConfig = config.findUnique || defaultOpConfig
    const { before = [], after = [] } = opConfig
    const path = basePath ? \`\${basePath}/unique\` : '/unique'
    router.get(path, parseQuery, setShape(opConfig), ...before, ${prefix}FindUnique as RequestHandler, ...after, respond)
  }

  if (config.enableAll || config.findMany) {
    const opConfig = config.findMany || defaultOpConfig
    const { before = [], after = [] } = opConfig
    const path = basePath || '/'
    router.get(path, parseQuery, setShape(opConfig), ...before, ${prefix}FindMany as RequestHandler, ...after, respond)
  }

  if (config.enableAll || config.createManyAndReturn) {
    const opConfig = config.createManyAndReturn || defaultOpConfig
    const { before = [], after = [] } = opConfig
    const path = basePath ? \`\${basePath}/many/return\` : '/many/return'
    router.post(path, setShape(opConfig), ...before, ${prefix}CreateManyAndReturn as RequestHandler, ...after, respondCreated)
  }

  if (config.enableAll || config.createMany) {
    const opConfig = config.createMany || defaultOpConfig
    const { before = [], after = [] } = opConfig
    const path = basePath ? \`\${basePath}/many\` : '/many'
    router.post(path, setShape(opConfig), ...before, ${prefix}CreateMany as RequestHandler, ...after, respondCreated)
  }

  if (config.enableAll || config.create) {
    const opConfig = config.create || defaultOpConfig
    const { before = [], after = [] } = opConfig
    const path = basePath || '/'
    router.post(path, setShape(opConfig), ...before, ${prefix}Create as RequestHandler, ...after, respondCreated)
  }

  if (config.enableAll || config.updateManyAndReturn) {
    const opConfig = config.updateManyAndReturn || defaultOpConfig
    const { before = [], after = [] } = opConfig
    const path = basePath ? \`\${basePath}/many/return\` : '/many/return'
    router.put(path, setShape(opConfig), ...before, ${prefix}UpdateManyAndReturn as RequestHandler, ...after, respond)
  }

  if (config.enableAll || config.updateMany) {
    const opConfig = config.updateMany || defaultOpConfig
    const { before = [], after = [] } = opConfig
    const path = basePath ? \`\${basePath}/many\` : '/many'
    router.put(path, setShape(opConfig), ...before, ${prefix}UpdateMany as RequestHandler, ...after, respond)
  }

  if (config.enableAll || config.update) {
    const opConfig = config.update || defaultOpConfig
    const { before = [], after = [] } = opConfig
    const path = basePath || '/'
    router.put(path, setShape(opConfig), ...before, ${prefix}Update as RequestHandler, ...after, respond)
  }

  if (config.enableAll || config.upsert) {
    const opConfig = config.upsert || defaultOpConfig
    const { before = [], after = [] } = opConfig
    const path = basePath || '/'
    router.patch(path, setShape(opConfig), ...before, ${prefix}Upsert as RequestHandler, ...after, respond)
  }

  if (config.enableAll || config.deleteMany) {
    const opConfig = config.deleteMany || defaultOpConfig
    const { before = [], after = [] } = opConfig
    const path = basePath ? \`\${basePath}/many\` : '/many'
    router.delete(path, setShape(opConfig), ...before, ${prefix}DeleteMany as RequestHandler, ...after, respond)
  }

  if (config.enableAll || config.delete) {
    const opConfig = config.delete || defaultOpConfig
    const { before = [], after = [] } = opConfig
    const path = basePath || '/'
    router.delete(path, setShape(opConfig), ...before, ${prefix}Delete as RequestHandler, ...after, respond)
  }

  router.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = typeof err.status === 'number' ? err.status : 500
    const message = err.message || 'Internal server error'
    if (!res.headersSent) {
      return res.status(status).json({ message })
    }
    next(err)
  })

  return router
}
`
}