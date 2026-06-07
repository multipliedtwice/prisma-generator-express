import { DMMF } from '@prisma/generator-helper'
import { toCamelCase } from '../utils/strings'
import { generateRouteConfigType } from './generateRouteConfigType'
import { ImportStyle } from '../utils/resolveImportStyle'
import { importExt } from '../utils/importExt'

export function generateHonoRouterFunction({
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

  return `import { Hono } from 'hono'
import type { Context, Next } from 'hono'
import { HTTPException } from 'hono/http-exception'
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
import type { RouteConfig, HonoHookHandler } from '../routeConfig.target${ext}'
import { parseQueryParams } from '../parseQueryParams${ext}'
import { sanitizeKeys } from '../misc${ext}'
import { buildModelOpenApi } from '../buildModelOpenApi${ext}'
import { mapError, transformResult, HttpError, type OperationContext } from '../operationRuntime${ext}'

${generateRouteConfigType(modelName, 'HonoHookHandler', guardShapesImport, importStyle, 'hono')}

type HonoVariables = {
  prisma: unknown
  postgres?: unknown
  sqlite?: unknown
  parsedQuery?: Record<string, unknown>
  body?: unknown
  routeConfig?: { pagination?: OperationContext['paginationConfig'] }
  guardShape?: Record<string, unknown>
  guardCaller?: string
  resultData?: unknown
  resultStatus?: number
}

type HonoEnv = { Variables: HonoVariables }

const _env = typeof process !== 'undefined' && process.env ? process.env : {} as Record<string, string | undefined>

const MODEL_FIELDS = ${JSON.stringify(fieldsMeta, null, 2)} as const

const MODEL_ENUMS = ${JSON.stringify(enumsMeta, null, 2)} as const

type OperationConfigLike = {
  before?: HonoHookHandler[]
  after?: HonoHookHandler[]
  shape?: Record<string, unknown>
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

async function safeParseBody(c: Context<HonoEnv>): Promise<unknown> {
  try {
    return await c.req.json()
  } catch {
    throw new HttpError(400, 'Invalid JSON in request body')
  }
}

export function ${routerFunctionName}<TCtx = unknown>(
  config: ${modelName}RouteConfig<TCtx> = {},
): Hono<HonoEnv> {
  const app = new Hono<HonoEnv>()

  const customPrefix = normalizePrefix(config.customUrlPrefix || '')
  const modelPrefix = config.addModelPrefix !== false ? '/${modelNameLower}' : ''
  const basePath = customPrefix + modelPrefix

  const openApiDisabled = config.disableOpenApi === true
    || (config.disableOpenApi !== false && (
      _env.DISABLE_OPENAPI === 'true'
      || _env.NODE_ENV === 'production'
    ))

  const postReadsEnabled = !config.disablePostReads

  app.onError((err, c) => {
    if (err instanceof HTTPException) {
      return c.json({ message: err.message }, err.status)
    }
    const httpError = mapError(err)
    return c.json({ message: httpError.message }, httpError.status as Parameters<typeof c.json>[1])
  })

  const parseQueryMw = async (c: Context<HonoEnv>, next: Next): Promise<void> => {
    const raw = c.req.query()
    if (raw && Object.keys(raw).length > 0) {
      c.set(
        'parsedQuery',
        parseQueryParams(raw as Record<string, unknown>) as Record<string, unknown>,
      )
    }
    await next()
  }

  const parseBodyAsQueryMw = async (c: Context<HonoEnv>, next: Next): Promise<void> => {
    const body = await safeParseBody(c)
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new HttpError(400, 'Request body must be a JSON object')
    }
    c.set('parsedQuery', sanitizeKeys(body as Record<string, unknown>))
    await next()
  }

  const parseBodyMw = async (c: Context<HonoEnv>, next: Next): Promise<void> => {
    const body = await safeParseBody(c)
    c.set('body', body)
    await next()
  }

  const setContextMw = (opConfig: OperationConfigLike) => async (c: Context<HonoEnv>, next: Next): Promise<void> => {
    const paginationConfig = (config as { pagination?: OperationContext['paginationConfig'] }).pagination
    if (paginationConfig) {
      c.set('routeConfig', { pagination: paginationConfig })
    }
    if (opConfig.shape) {
      c.set('guardShape', opConfig.shape)
      const headerName = config.guard?.variantHeader || 'x-api-variant'
      const caller = config.guard?.resolveVariant?.(c as Context)
        ?? c.req.header(headerName)
        ?? undefined
      if (caller) {
        c.set('guardCaller', caller)
      }
    }
    await next()
  }

  const sendResultMw = async (c: Context<HonoEnv>, _next: Next): Promise<Response> => {
    const data = c.get('resultData')
    const status = c.get('resultStatus') ?? 200
    if (data === undefined) {
      return c.json({ message: 'No data set by handler' }, 500)
    }
    return c.json(
      transformResult(data) as Parameters<typeof c.json>[0],
      status as Parameters<typeof c.json>[1],
    )
  }

  const wrap = (fn: (c: Context<HonoEnv>) => Promise<void>) =>
    async (c: Context<HonoEnv>, next: Next): Promise<void> => {
      await fn(c)
      await next()
    }

  if (!openApiDisabled) {
    const openapiJsonPath = basePath ? \`\${basePath}/openapi.json\` : '/openapi.json'
    const openapiYamlPath = basePath ? \`\${basePath}/openapi.yaml\` : '/openapi.yaml'

    app.get(openapiJsonPath, (c) => {
      const spec = buildModelOpenApi(
        '${modelName}',
        MODEL_FIELDS as unknown as Parameters<typeof buildModelOpenApi>[1],
        MODEL_ENUMS as unknown as Parameters<typeof buildModelOpenApi>[2],
        config,
        { format: 'json' },
      )
      return c.json(spec as Parameters<typeof c.json>[0])
    })

    app.get(openapiYamlPath, (c) => {
      const yaml = buildModelOpenApi(
        '${modelName}',
        MODEL_FIELDS as unknown as Parameters<typeof buildModelOpenApi>[1],
        MODEL_ENUMS as unknown as Parameters<typeof buildModelOpenApi>[2],
        config,
        { format: 'yaml' },
      ) as string
      return c.body(yaml, 200, { 'Content-Type': 'application/yaml' })
    })
  }

  if (config.enableAll || config.findFirst) {
    const opConfig: OperationConfigLike = (config.findFirst as OperationConfigLike | undefined) ?? defaultOpConfig
    const { before = [], after = [] } = opConfig
    const path = basePath ? \`\${basePath}/first\` : '/first'
    app.get(path, parseQueryMw, setContextMw(opConfig), ...before, wrap(${prefix}FindFirst), ...after, sendResultMw)
    if (postReadsEnabled) {
      app.post(path, parseBodyAsQueryMw, setContextMw(opConfig), ...before, wrap(${prefix}FindFirst), ...after, sendResultMw)
    }
  }

  if (config.enableAll || config.findFirstOrThrow) {
    const opConfig: OperationConfigLike = (config.findFirstOrThrow as OperationConfigLike | undefined) ?? defaultOpConfig
    const { before = [], after = [] } = opConfig
    const path = basePath ? \`\${basePath}/first/strict\` : '/first/strict'
    app.get(path, parseQueryMw, setContextMw(opConfig), ...before, wrap(${prefix}FindFirstOrThrow), ...after, sendResultMw)
    if (postReadsEnabled) {
      app.post(path, parseBodyAsQueryMw, setContextMw(opConfig), ...before, wrap(${prefix}FindFirstOrThrow), ...after, sendResultMw)
    }
  }

  if (config.enableAll || config.findManyPaginated) {
    const opConfig: OperationConfigLike = (config.findManyPaginated as OperationConfigLike | undefined) ?? defaultOpConfig
    const { before = [], after = [] } = opConfig
    const path = basePath ? \`\${basePath}/paginated\` : '/paginated'
    app.get(path, parseQueryMw, setContextMw(opConfig), ...before, wrap(${prefix}FindManyPaginated), ...after, sendResultMw)
    if (postReadsEnabled) {
      app.post(path, parseBodyAsQueryMw, setContextMw(opConfig), ...before, wrap(${prefix}FindManyPaginated), ...after, sendResultMw)
    }
  }

  if (config.enableAll || config.aggregate) {
    const opConfig: OperationConfigLike = (config.aggregate as OperationConfigLike | undefined) ?? defaultOpConfig
    const { before = [], after = [] } = opConfig
    const path = basePath ? \`\${basePath}/aggregate\` : '/aggregate'
    app.get(path, parseQueryMw, setContextMw(opConfig), ...before, wrap(${prefix}Aggregate), ...after, sendResultMw)
    if (postReadsEnabled) {
      app.post(path, parseBodyAsQueryMw, setContextMw(opConfig), ...before, wrap(${prefix}Aggregate), ...after, sendResultMw)
    }
  }

  if (config.enableAll || config.count) {
    const opConfig: OperationConfigLike = (config.count as OperationConfigLike | undefined) ?? defaultOpConfig
    const { before = [], after = [] } = opConfig
    const path = basePath ? \`\${basePath}/count\` : '/count'
    app.get(path, parseQueryMw, setContextMw(opConfig), ...before, wrap(${prefix}Count), ...after, sendResultMw)
    if (postReadsEnabled) {
      app.post(path, parseBodyAsQueryMw, setContextMw(opConfig), ...before, wrap(${prefix}Count), ...after, sendResultMw)
    }
  }

  if (config.enableAll || config.groupBy) {
    const opConfig: OperationConfigLike = (config.groupBy as OperationConfigLike | undefined) ?? defaultOpConfig
    const { before = [], after = [] } = opConfig
    const path = basePath ? \`\${basePath}/groupby\` : '/groupby'
    app.get(path, parseQueryMw, setContextMw(opConfig), ...before, wrap(${prefix}GroupBy), ...after, sendResultMw)
    if (postReadsEnabled) {
      app.post(path, parseBodyAsQueryMw, setContextMw(opConfig), ...before, wrap(${prefix}GroupBy), ...after, sendResultMw)
    }
  }

  if (config.enableAll || config.findUniqueOrThrow) {
    const opConfig: OperationConfigLike = (config.findUniqueOrThrow as OperationConfigLike | undefined) ?? defaultOpConfig
    const { before = [], after = [] } = opConfig
    const path = basePath ? \`\${basePath}/unique/strict\` : '/unique/strict'
    app.get(path, parseQueryMw, setContextMw(opConfig), ...before, wrap(${prefix}FindUniqueOrThrow), ...after, sendResultMw)
    if (postReadsEnabled) {
      app.post(path, parseBodyAsQueryMw, setContextMw(opConfig), ...before, wrap(${prefix}FindUniqueOrThrow), ...after, sendResultMw)
    }
  }

  if (config.enableAll || config.findUnique) {
    const opConfig: OperationConfigLike = (config.findUnique as OperationConfigLike | undefined) ?? defaultOpConfig
    const { before = [], after = [] } = opConfig
    const path = basePath ? \`\${basePath}/unique\` : '/unique'
    app.get(path, parseQueryMw, setContextMw(opConfig), ...before, wrap(${prefix}FindUnique), ...after, sendResultMw)
    if (postReadsEnabled) {
      app.post(path, parseBodyAsQueryMw, setContextMw(opConfig), ...before, wrap(${prefix}FindUnique), ...after, sendResultMw)
    }
  }

  if (config.enableAll || config.findMany) {
    const opConfig: OperationConfigLike = (config.findMany as OperationConfigLike | undefined) ?? defaultOpConfig
    const { before = [], after = [] } = opConfig
    const path = basePath || '/'
    app.get(path, parseQueryMw, setContextMw(opConfig), ...before, wrap(${prefix}FindMany), ...after, sendResultMw)
    if (postReadsEnabled) {
      const postPath = basePath ? \`\${basePath}/read\` : '/read'
      app.post(postPath, parseBodyAsQueryMw, setContextMw(opConfig), ...before, wrap(${prefix}FindMany), ...after, sendResultMw)
    }
  }

  if (config.enableAll || config.createManyAndReturn) {
    const opConfig: OperationConfigLike = (config.createManyAndReturn as OperationConfigLike | undefined) ?? defaultOpConfig
    const { before = [], after = [] } = opConfig
    const path = basePath ? \`\${basePath}/many/return\` : '/many/return'
    app.post(path, parseBodyMw, setContextMw(opConfig), ...before, wrap(${prefix}CreateManyAndReturn), ...after, sendResultMw)
  }

  if (config.enableAll || config.createMany) {
    const opConfig: OperationConfigLike = (config.createMany as OperationConfigLike | undefined) ?? defaultOpConfig
    const { before = [], after = [] } = opConfig
    const path = basePath ? \`\${basePath}/many\` : '/many'
    app.post(path, parseBodyMw, setContextMw(opConfig), ...before, wrap(${prefix}CreateMany), ...after, sendResultMw)
  }

  if (config.enableAll || config.create) {
    const opConfig: OperationConfigLike = (config.create as OperationConfigLike | undefined) ?? defaultOpConfig
    const { before = [], after = [] } = opConfig
    const path = basePath || '/'
    app.post(path, parseBodyMw, setContextMw(opConfig), ...before, wrap(${prefix}Create), ...after, sendResultMw)
  }

  if (config.enableAll || config.updateManyAndReturn) {
    const opConfig: OperationConfigLike = (config.updateManyAndReturn as OperationConfigLike | undefined) ?? defaultOpConfig
    const { before = [], after = [] } = opConfig
    const path = basePath ? \`\${basePath}/many/return\` : '/many/return'
    app.put(path, parseBodyMw, setContextMw(opConfig), ...before, wrap(${prefix}UpdateManyAndReturn), ...after, sendResultMw)
  }

  if (config.enableAll || config.updateMany) {
    const opConfig: OperationConfigLike = (config.updateMany as OperationConfigLike | undefined) ?? defaultOpConfig
    const { before = [], after = [] } = opConfig
    const path = basePath ? \`\${basePath}/many\` : '/many'
    app.put(path, parseBodyMw, setContextMw(opConfig), ...before, wrap(${prefix}UpdateMany), ...after, sendResultMw)
  }

  if (config.enableAll || config.update) {
    const opConfig: OperationConfigLike = (config.update as OperationConfigLike | undefined) ?? defaultOpConfig
    const { before = [], after = [] } = opConfig
    const path = basePath || '/'
    app.put(path, parseBodyMw, setContextMw(opConfig), ...before, wrap(${prefix}Update), ...after, sendResultMw)
  }

  if (config.enableAll || config.upsert) {
    const opConfig: OperationConfigLike = (config.upsert as OperationConfigLike | undefined) ?? defaultOpConfig
    const { before = [], after = [] } = opConfig
    const path = basePath || '/'
    app.patch(path, parseBodyMw, setContextMw(opConfig), ...before, wrap(${prefix}Upsert), ...after, sendResultMw)
  }

  if (config.enableAll || config.deleteMany) {
    const opConfig: OperationConfigLike = (config.deleteMany as OperationConfigLike | undefined) ?? defaultOpConfig
    const { before = [], after = [] } = opConfig
    const path = basePath ? \`\${basePath}/many\` : '/many'
    app.delete(path, parseBodyMw, setContextMw(opConfig), ...before, wrap(${prefix}DeleteMany), ...after, sendResultMw)
  }

  if (config.enableAll || config.delete) {
    const opConfig: OperationConfigLike = (config.delete as OperationConfigLike | undefined) ?? defaultOpConfig
    const { before = [], after = [] } = opConfig
    const path = basePath || '/'
    app.delete(path, parseBodyMw, setContextMw(opConfig), ...before, wrap(${prefix}Delete), ...after, sendResultMw)
  }

  return app
}
`
}