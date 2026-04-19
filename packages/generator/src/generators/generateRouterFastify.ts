import { DMMF } from '@prisma/generator-helper'

export function generateFastifyRouterFunction({
  model,
  enums,
}: {
  model: DMMF.Model
  enums: DMMF.DatamodelEnum[]
}): string {
  const modelName = model.name
  const modelNameLower = modelName.toLowerCase()
  const routerFunctionName = `${modelName}Routes`

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

  return `import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
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
} from './${modelName}Handlers.js'
import type { RouteConfig, FastifyHookHandler } from '../routeConfig.js'
import { parseQueryParams } from '../parseQueryParams.js'
import { buildModelOpenApi } from '../buildModelOpenApi.js'
import { mapError, transformResult } from '../operationRuntime.js'

const _env = typeof process !== 'undefined' && process.env ? process.env : {} as Record<string, string | undefined>

const MODEL_FIELDS = ${JSON.stringify(fieldsMeta, null, 2)} as const

const MODEL_ENUMS = ${JSON.stringify(enumsMeta, null, 2)} as const

const defaultOpConfig = {
  before: [] as FastifyHookHandler[],
  after: [] as FastifyHookHandler[],
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

function parseQueryHook(request: FastifyRequest): void {
  const raw = request.query as Record<string, unknown>
  if (raw && Object.keys(raw).length > 0) {
    ;(request as any).parsedQuery = parseQueryParams(raw)
  }
}

function makeShapeHook(config: RouteConfig, opConfig: any): (request: FastifyRequest) => void {
  return (request: FastifyRequest) => {
    ;(request as any).routeConfig = config
    if (opConfig.shape) {
      ;(request as any).guardShape = opConfig.shape
      const headerName = config.guard?.variantHeader || 'x-api-variant'
      const headerValue = request.headers[headerName]
      const caller = config.guard?.resolveVariant?.(request)
        ?? (Array.isArray(headerValue) ? headerValue[0] : headerValue)
        ?? undefined
      if (caller) {
        ;(request as any).guardCaller = caller
      }
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
  const req = request as any
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

export async function ${routerFunctionName}(
  fastify: FastifyInstance,
  config: RouteConfig = {},
) {
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

  fastify.setErrorHandler((error, _request, reply) => {
    const status = (error as any).status ?? error.statusCode ?? 500
    const message = error.message || 'Internal server error'
    if (!reply.sent) {
      reply.code(status).send({ message })
    }
  })

  if (!openApiDisabled) {
    const openapiJsonPath = basePath ? \`\${basePath}/openapi.json\` : '/openapi.json'
    const openapiYamlPath = basePath ? \`\${basePath}/openapi.yaml\` : '/openapi.yaml'

    fastify.get(openapiJsonPath, async (_request, reply) => {
      const spec = buildModelOpenApi(
        '${modelName}',
        MODEL_FIELDS as any,
        MODEL_ENUMS as any,
        config,
        { format: 'json' },
      )
      return reply.send(spec)
    })

    fastify.get(openapiYamlPath, async (_request, reply) => {
      const spec = buildModelOpenApi(
        '${modelName}',
        MODEL_FIELDS as any,
        MODEL_ENUMS as any,
        config,
        { format: 'yaml' },
      )
      return reply.type('application/yaml').send(spec as string)
    })
  }

  if (config.enableAll || config.findFirst) {
    const opConfig = config.findFirst || defaultOpConfig
    const { before = [], after = [] } = opConfig
    const path = basePath ? \`\${basePath}/first\` : '/first'
    fastify.get(path, async (request, reply) => {
      try {
        parseQueryHook(request)
        makeShapeHook(config, opConfig)(request)
        if (await runHooks(before, request, reply)) return
        await ${modelName}FindFirst(request, reply)
        if (await runHooks(after, request, reply)) return
        sendResult(request, reply)
      } catch (error: unknown) {
        sendError(reply, error)
      }
    })
  }

  if (config.enableAll || config.findFirstOrThrow) {
    const opConfig = config.findFirstOrThrow || defaultOpConfig
    const { before = [], after = [] } = opConfig
    const path = basePath ? \`\${basePath}/first/strict\` : '/first/strict'
    fastify.get(path, async (request, reply) => {
      try {
        parseQueryHook(request)
        makeShapeHook(config, opConfig)(request)
        if (await runHooks(before, request, reply)) return
        await ${modelName}FindFirstOrThrow(request, reply)
        if (await runHooks(after, request, reply)) return
        sendResult(request, reply)
      } catch (error: unknown) {
        sendError(reply, error)
      }
    })
  }

  if (config.enableAll || config.findManyPaginated) {
    const opConfig = config.findManyPaginated || defaultOpConfig
    const { before = [], after = [] } = opConfig
    const path = basePath ? \`\${basePath}/paginated\` : '/paginated'
    fastify.get(path, async (request, reply) => {
      try {
        parseQueryHook(request)
        makeShapeHook(config, opConfig)(request)
        if (await runHooks(before, request, reply)) return
        await ${modelName}FindManyPaginated(request, reply)
        if (await runHooks(after, request, reply)) return
        sendResult(request, reply)
      } catch (error: unknown) {
        sendError(reply, error)
      }
    })
  }

  if (config.enableAll || config.aggregate) {
    const opConfig = config.aggregate || defaultOpConfig
    const { before = [], after = [] } = opConfig
    const path = basePath ? \`\${basePath}/aggregate\` : '/aggregate'
    fastify.get(path, async (request, reply) => {
      try {
        parseQueryHook(request)
        makeShapeHook(config, opConfig)(request)
        if (await runHooks(before, request, reply)) return
        await ${modelName}Aggregate(request, reply)
        if (await runHooks(after, request, reply)) return
        sendResult(request, reply)
      } catch (error: unknown) {
        sendError(reply, error)
      }
    })
  }

  if (config.enableAll || config.count) {
    const opConfig = config.count || defaultOpConfig
    const { before = [], after = [] } = opConfig
    const path = basePath ? \`\${basePath}/count\` : '/count'
    fastify.get(path, async (request, reply) => {
      try {
        parseQueryHook(request)
        makeShapeHook(config, opConfig)(request)
        if (await runHooks(before, request, reply)) return
        await ${modelName}Count(request, reply)
        if (await runHooks(after, request, reply)) return
        sendResult(request, reply)
      } catch (error: unknown) {
        sendError(reply, error)
      }
    })
  }

  if (config.enableAll || config.groupBy) {
    const opConfig = config.groupBy || defaultOpConfig
    const { before = [], after = [] } = opConfig
    const path = basePath ? \`\${basePath}/groupby\` : '/groupby'
    fastify.get(path, async (request, reply) => {
      try {
        parseQueryHook(request)
        makeShapeHook(config, opConfig)(request)
        if (await runHooks(before, request, reply)) return
        await ${modelName}GroupBy(request, reply)
        if (await runHooks(after, request, reply)) return
        sendResult(request, reply)
      } catch (error: unknown) {
        sendError(reply, error)
      }
    })
  }

  if (config.enableAll || config.findUniqueOrThrow) {
    const opConfig = config.findUniqueOrThrow || defaultOpConfig
    const { before = [], after = [] } = opConfig
    const path = basePath ? \`\${basePath}/unique/strict\` : '/unique/strict'
    fastify.get(path, async (request, reply) => {
      try {
        parseQueryHook(request)
        makeShapeHook(config, opConfig)(request)
        if (await runHooks(before, request, reply)) return
        await ${modelName}FindUniqueOrThrow(request, reply)
        if (await runHooks(after, request, reply)) return
        sendResult(request, reply)
      } catch (error: unknown) {
        sendError(reply, error)
      }
    })
  }

  if (config.enableAll || config.findUnique) {
    const opConfig = config.findUnique || defaultOpConfig
    const { before = [], after = [] } = opConfig
    const path = basePath ? \`\${basePath}/unique\` : '/unique'
    fastify.get(path, async (request, reply) => {
      try {
        parseQueryHook(request)
        makeShapeHook(config, opConfig)(request)
        if (await runHooks(before, request, reply)) return
        await ${modelName}FindUnique(request, reply)
        if (await runHooks(after, request, reply)) return
        sendResult(request, reply)
      } catch (error: unknown) {
        sendError(reply, error)
      }
    })
  }

  if (config.enableAll || config.findMany) {
    const opConfig = config.findMany || defaultOpConfig
    const { before = [], after = [] } = opConfig
    const path = basePath || '/'
    fastify.get(path, async (request, reply) => {
      try {
        parseQueryHook(request)
        makeShapeHook(config, opConfig)(request)
        if (await runHooks(before, request, reply)) return
        await ${modelName}FindMany(request, reply)
        if (await runHooks(after, request, reply)) return
        sendResult(request, reply)
      } catch (error: unknown) {
        sendError(reply, error)
      }
    })
  }

  if (config.enableAll || config.createManyAndReturn) {
    const opConfig = config.createManyAndReturn || defaultOpConfig
    const { before = [], after = [] } = opConfig
    const path = basePath ? \`\${basePath}/many/return\` : '/many/return'
    fastify.post(path, async (request, reply) => {
      try {
        makeShapeHook(config, opConfig)(request)
        if (await runHooks(before, request, reply)) return
        await ${modelName}CreateManyAndReturn(request, reply)
        if (await runHooks(after, request, reply)) return
        sendResult(request, reply)
      } catch (error: unknown) {
        sendError(reply, error)
      }
    })
  }

  if (config.enableAll || config.createMany) {
    const opConfig = config.createMany || defaultOpConfig
    const { before = [], after = [] } = opConfig
    const path = basePath ? \`\${basePath}/many\` : '/many'
    fastify.post(path, async (request, reply) => {
      try {
        makeShapeHook(config, opConfig)(request)
        if (await runHooks(before, request, reply)) return
        await ${modelName}CreateMany(request, reply)
        if (await runHooks(after, request, reply)) return
        sendResult(request, reply)
      } catch (error: unknown) {
        sendError(reply, error)
      }
    })
  }

  if (config.enableAll || config.create) {
    const opConfig = config.create || defaultOpConfig
    const { before = [], after = [] } = opConfig
    const path = basePath || '/'
    fastify.post(path, async (request, reply) => {
      try {
        makeShapeHook(config, opConfig)(request)
        if (await runHooks(before, request, reply)) return
        await ${modelName}Create(request, reply)
        if (await runHooks(after, request, reply)) return
        sendResult(request, reply)
      } catch (error: unknown) {
        sendError(reply, error)
      }
    })
  }

  if (config.enableAll || config.updateManyAndReturn) {
    const opConfig = config.updateManyAndReturn || defaultOpConfig
    const { before = [], after = [] } = opConfig
    const path = basePath ? \`\${basePath}/many/return\` : '/many/return'
    fastify.put(path, async (request, reply) => {
      try {
        makeShapeHook(config, opConfig)(request)
        if (await runHooks(before, request, reply)) return
        await ${modelName}UpdateManyAndReturn(request, reply)
        if (await runHooks(after, request, reply)) return
        sendResult(request, reply)
      } catch (error: unknown) {
        sendError(reply, error)
      }
    })
  }

  if (config.enableAll || config.updateMany) {
    const opConfig = config.updateMany || defaultOpConfig
    const { before = [], after = [] } = opConfig
    const path = basePath ? \`\${basePath}/many\` : '/many'
    fastify.put(path, async (request, reply) => {
      try {
        makeShapeHook(config, opConfig)(request)
        if (await runHooks(before, request, reply)) return
        await ${modelName}UpdateMany(request, reply)
        if (await runHooks(after, request, reply)) return
        sendResult(request, reply)
      } catch (error: unknown) {
        sendError(reply, error)
      }
    })
  }

  if (config.enableAll || config.update) {
    const opConfig = config.update || defaultOpConfig
    const { before = [], after = [] } = opConfig
    const path = basePath || '/'
    fastify.put(path, async (request, reply) => {
      try {
        makeShapeHook(config, opConfig)(request)
        if (await runHooks(before, request, reply)) return
        await ${modelName}Update(request, reply)
        if (await runHooks(after, request, reply)) return
        sendResult(request, reply)
      } catch (error: unknown) {
        sendError(reply, error)
      }
    })
  }

  if (config.enableAll || config.upsert) {
    const opConfig = config.upsert || defaultOpConfig
    const { before = [], after = [] } = opConfig
    const path = basePath || '/'
    fastify.patch(path, async (request, reply) => {
      try {
        makeShapeHook(config, opConfig)(request)
        if (await runHooks(before, request, reply)) return
        await ${modelName}Upsert(request, reply)
        if (await runHooks(after, request, reply)) return
        sendResult(request, reply)
      } catch (error: unknown) {
        sendError(reply, error)
      }
    })
  }

  if (config.enableAll || config.deleteMany) {
    const opConfig = config.deleteMany || defaultOpConfig
    const { before = [], after = [] } = opConfig
    const path = basePath ? \`\${basePath}/many\` : '/many'
    fastify.delete(path, async (request, reply) => {
      try {
        makeShapeHook(config, opConfig)(request)
        if (await runHooks(before, request, reply)) return
        await ${modelName}DeleteMany(request, reply)
        if (await runHooks(after, request, reply)) return
        sendResult(request, reply)
      } catch (error: unknown) {
        sendError(reply, error)
      }
    })
  }

  if (config.enableAll || config.delete) {
    const opConfig = config.delete || defaultOpConfig
    const { before = [], after = [] } = opConfig
    const path = basePath || '/'
    fastify.delete(path, async (request, reply) => {
      try {
        makeShapeHook(config, opConfig)(request)
        if (await runHooks(before, request, reply)) return
        await ${modelName}Delete(request, reply)
        if (await runHooks(after, request, reply)) return
        sendResult(request, reply)
      } catch (error: unknown) {
        sendError(reply, error)
      }
    })
  }
}
`
}