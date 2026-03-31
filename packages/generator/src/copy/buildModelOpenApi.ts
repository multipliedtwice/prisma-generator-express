import type { RouteConfig } from './routeConfig'
import { OPERATION_DEFS, isOperationEnabled } from './operationDefinitions'

type SchemaObject = {
  type?: string | string[]
  format?: string
  enum?: string[]
  items?: SchemaObject | RefObject
  properties?: Record<string, SchemaObject | RefObject>
  required?: string[]
  description?: string
  oneOf?: (SchemaObject | RefObject)[]
  allOf?: (SchemaObject | RefObject)[]
  nullable?: boolean
}

type RefObject = { $ref: string; description?: string }

type OpenApiSpec = {
  openapi: string
  info: { title: string; description: string; version: string }
  servers?: Array<{ url: string; description?: string }>
  paths: Record<string, any>
  components: {
    schemas: Record<string, SchemaObject>
    securitySchemes?: Record<string, any>
  }
  security?: Array<Record<string, string[]>>
}

type ModelField = {
  name: string
  kind: string
  type: string
  isList: boolean
  isRequired: boolean
  hasDefaultValue: boolean
  isUpdatedAt?: boolean
  documentation?: string
  relationFromFields?: string[]
}

type EnumDef = {
  name: string
  values: { name: string }[]
}

type BuildOptions = {
  format: 'json' | 'yaml'
  title?: string
  description?: string
  version?: string
}

const OP_MAP = new Map(OPERATION_DEFS.map((d) => [d.name, d]))

const NUMERIC_SCALAR_TYPES = new Set(['Int', 'BigInt', 'Float', 'Decimal'])

const STRING_NUMERIC_TYPES = new Set(['BigInt', 'Decimal'])

function opEnabled(config: RouteConfig, name: string): boolean {
  const def = OP_MAP.get(name)
  return def ? isOperationEnabled(config as Record<string, any>, def) : false
}

function opPath(basePath: string, name: string): string {
  const def = OP_MAP.get(name)!
  if (!def.pathSuffix) return basePath || '/'
  return `${basePath}${def.pathSuffix}`
}

function errorRef(): RefObject {
  return { $ref: '#/components/schemas/ErrorResponse' }
}

function errorResponse(description: string) {
  return {
    description,
    content: { 'application/json': { schema: errorRef() } },
  }
}

const COMMON_ERRORS: Record<number, string> = {
  400: 'Bad request — invalid parameters, malformed JSON, or query validation failure',
  403: 'Forbidden — guard policy rejected the request',
  404: 'Not found — record does not exist',
  409: 'Conflict — unique constraint or transaction conflict',
  500: 'Internal server error',
  501: 'Not implemented — feature not supported by the current database provider',
  503: 'Service unavailable — database connection pool timeout',
}

function addErrorResponses(operation: any, codes: number[]): void {
  for (const code of codes) {
    operation.responses[String(code)] = errorResponse(
      COMMON_ERRORS[code] || 'Error',
    )
  }
}

function normalizePrefix(p: string): string {
  if (!p) return ''
  let result = p
  if (!result.startsWith('/')) result = '/' + result
  while (result.length > 1 && result.endsWith('/')) result = result.slice(0, -1)
  if (result === '/') return ''
  return result
}

function removeTrailingSlash(path: string): string {
  if (path === '/') return ''
  return path.endsWith('/') ? path.slice(0, -1) : path
}

function queryParam(
  name: string,
  description: string,
  schema: Record<string, string> = { type: 'string' },
  required?: boolean,
) {
  const param: any = { name, in: 'query' as const, schema, description }
  if (required) param.required = true
  return param
}

export function buildModelOpenApi(
  modelName: string,
  modelFields: ModelField[],
  enums: EnumDef[],
  config: RouteConfig,
  options: BuildOptions,
): string | OpenApiSpec {
  const spec: OpenApiSpec = {
    openapi: '3.1.0',
    info: {
      title: options.title || config.openApiTitle || `${modelName} API`,
      description: options.description || config.openApiDescription || '',
      version: options.version || config.openApiVersion || '1.0.0',
    },
    paths: {},
    components: { schemas: {} },
  }

  if (config.openApiServers?.length) {
    spec.servers = config.openApiServers
  }

  if (config.openApiSecuritySchemes) {
    spec.components.securitySchemes = config.openApiSecuritySchemes
  }

  if (config.openApiSecurity?.length) {
    spec.security = config.openApiSecurity
  }

  const prefixSource = config.specBasePath ?? config.customUrlPrefix ?? ''
  const basePath =
    normalizePrefix(prefixSource) +
    removeTrailingSlash(
      config.addModelPrefix !== false ? `/${modelName.toLowerCase()}` : '',
    )

  const referencedEnumTypes = new Set(
    modelFields.filter((f) => f.kind === 'enum').map((f) => f.type),
  )

  for (const enumDef of enums) {
    if (!referencedEnumTypes.has(enumDef.name)) continue
    spec.components.schemas[enumDef.name] = {
      type: 'string',
      enum: enumDef.values.map((v) => v.name),
    }
  }

  spec.components.schemas['ErrorResponse'] = {
    type: 'object',
    properties: {
      message: {
        type: 'string',
        description: 'Human-readable error description',
      },
    },
    required: ['message'],
  }

  generateOperationSchemas(spec, modelName, modelFields)

  generatePaths(spec, modelName, basePath, config, modelFields)

  if (options.format === 'yaml') {
    return toYaml(spec)
  }
  return spec
}

function generateOperationSchemas(
  spec: OpenApiSpec,
  modelName: string,
  fields: ModelField[],
) {
  const relatedModels = new Set<string>()
  fields.forEach((field) => {
    if (field.kind === 'object') {
      relatedModels.add(field.type)
    }
  })

  relatedModels.forEach((relatedModel) => {
    if (!spec.components.schemas[`${relatedModel}Response`]) {
      spec.components.schemas[`${relatedModel}Response`] = {
        type: 'object',
        description: `Related ${relatedModel} object. See the ${relatedModel} docs endpoint for full schema. Shape depends on select/include parameters.`,
      }
    }
  })

  const requiredScalars = fields
    .filter(
      (f) =>
        (f.kind === 'scalar' || f.kind === 'enum') &&
        f.isRequired &&
        !f.hasDefaultValue &&
        !f.isUpdatedAt,
    )
    .map((f) => f.name)

  const createInputSchema: SchemaObject = {
    type: 'object',
    properties: fieldsToWriteProperties(fields),
  }
  if (requiredScalars.length > 0) {
    createInputSchema.required = [...requiredScalars]
  }

  spec.components.schemas[`${modelName}CreateInput`] = createInputSchema

  spec.components.schemas[`${modelName}UpdateInput`] = {
    type: 'object',
    properties: fieldsToWriteProperties(fields),
  }

  const createManyInputSchema: SchemaObject = {
    type: 'object',
    properties: fieldsToBulkWriteProperties(fields),
    description:
      'Scalar-only input for bulk create. Nested relation writes are not supported in createMany operations.',
  }
  if (requiredScalars.length > 0) {
    createManyInputSchema.required = [...requiredScalars]
  }

  spec.components.schemas[`${modelName}CreateManyInput`] = createManyInputSchema

  spec.components.schemas[`${modelName}UpdateManyMutationInput`] = {
    type: 'object',
    properties: fieldsToBulkWriteProperties(fields),
    description:
      'Scalar-only input for bulk update. Nested relation writes are not supported in updateMany operations.',
  }

  spec.components.schemas[`${modelName}Response`] = {
    type: 'object',
    properties: fieldsToProperties(fields),
    description:
      'Response shape depends on select/include/omit parameters. Relations are only present when explicitly included.',
  }

  spec.components.schemas[`${modelName}ListResponse`] = {
    type: 'object',
    properties: {
      data: {
        type: 'array',
        items: { $ref: `#/components/schemas/${modelName}Response` },
      },
      total: {
        type: 'integer',
        description:
          'Total number of matching records. May be approximate when using distinct with large result sets.',
      },
      hasMore: {
        type: 'boolean',
        description:
          'Whether more records exist beyond the current page. Reliable for forward offset pagination (skip + take) only.',
      },
    },
    required: ['data', 'total', 'hasMore'],
  }

  spec.components.schemas[`${modelName}BatchCountResponse`] = {
    type: 'object',
    properties: {
      count: {
        type: 'integer',
        description: 'Number of records affected by the batch operation',
      },
    },
    required: ['count'],
  }

  const numericFields = fields.filter(
    (f) => f.kind === 'scalar' && NUMERIC_SCALAR_TYPES.has(f.type),
  )

  const numericFieldSelection: Record<string, SchemaObject> = {}
  for (const f of numericFields) {
    numericFieldSelection[f.name] = { type: 'boolean' }
  }

  const avgResultProps: Record<string, SchemaObject> = {}
  const numericResultProps: Record<string, SchemaObject> = {}
  for (const f of numericFields) {
    avgResultProps[f.name] = STRING_NUMERIC_TYPES.has(f.type)
      ? {
          oneOf: [{ type: 'string' }, { type: 'null' }],
          description: 'Decimal serialized as string',
        }
      : { oneOf: [{ type: 'number' }, { type: 'null' }] }
    numericResultProps[f.name] = STRING_NUMERIC_TYPES.has(f.type)
      ? { oneOf: [{ type: 'string' }, { type: 'null' }] }
      : { oneOf: [{ type: 'number' }, { type: 'null' }] }
  }

  const allFieldSelection: Record<string, SchemaObject> = {
    _all: { type: 'boolean' },
  }
  for (const f of fields) {
    if (f.kind === 'scalar' || f.kind === 'enum') {
      allFieldSelection[f.name] = { type: 'boolean' }
    }
  }

  const countResultProps: Record<string, SchemaObject> = {
    _all: { type: 'integer' },
  }
  for (const f of fields) {
    if (f.kind === 'scalar' || f.kind === 'enum') {
      countResultProps[f.name] = { type: 'integer' }
    }
  }

  const aggregateProps: Record<string, SchemaObject | RefObject> = {
    _count: {
      oneOf: [
        { type: 'integer' },
        { type: 'object', properties: countResultProps },
      ],
    },
  }

  if (numericFields.length > 0) {
    aggregateProps._avg = { type: 'object', properties: avgResultProps }
    aggregateProps._sum = { type: 'object', properties: numericResultProps }
    aggregateProps._min = { type: 'object', properties: numericResultProps }
    aggregateProps._max = { type: 'object', properties: numericResultProps }
  }

  spec.components.schemas[`${modelName}AggregateResponse`] = {
    type: 'object',
    properties: aggregateProps,
  }

  const groupByItemProps: Record<string, SchemaObject | RefObject> = {}
  for (const f of fields) {
    if (f.kind === 'scalar' || f.kind === 'enum') {
      groupByItemProps[f.name] = mapFieldToSchema(f)
    }
  }
  groupByItemProps._count = {
    oneOf: [
      { type: 'integer' },
      { type: 'object', properties: countResultProps },
    ],
  }
  if (numericFields.length > 0) {
    groupByItemProps._avg = { type: 'object', properties: avgResultProps }
    groupByItemProps._sum = { type: 'object', properties: numericResultProps }
    groupByItemProps._min = { type: 'object', properties: numericResultProps }
    groupByItemProps._max = { type: 'object', properties: numericResultProps }
  }

  spec.components.schemas[`${modelName}GroupByItem`] = {
    type: 'object',
    properties: groupByItemProps,
    description:
      'Each item contains the field values for the fields specified in the by parameter plus any requested aggregates. Only by-fields appear as scalar properties in the response — this schema lists all possible fields for reference.',
  }
}

function getFindManyParams() {
  return [
    queryParam('where', 'Filter conditions (JSON-encoded string)'),
    queryParam('orderBy', 'Sort order (JSON-encoded string)'),
    queryParam('take', 'Limit results', { type: 'integer' }),
    queryParam('skip', 'Skip results', { type: 'integer' }),
    queryParam('select', 'Select fields (JSON-encoded string)'),
    queryParam('include', 'Include relations (JSON-encoded string)'),
    queryParam('omit', 'Omit fields from response (JSON-encoded string)'),
    queryParam('cursor', 'Cursor for pagination (JSON-encoded string)'),
    queryParam('distinct', 'Distinct fields (JSON-encoded string)'),
  ]
}

function getFindUniqueParams() {
  return [
    queryParam(
      'where',
      'Unique selector (JSON-encoded string)',
      { type: 'string' },
      true,
    ),
    queryParam('select', 'Select fields (JSON-encoded string)'),
    queryParam('include', 'Include relations (JSON-encoded string)'),
    queryParam('omit', 'Omit fields from response (JSON-encoded string)'),
  ]
}

function getCountParams() {
  return [
    queryParam('where', 'Filter conditions (JSON-encoded string)'),
    queryParam('orderBy', 'Sort order (JSON-encoded string)'),
    queryParam('take', 'Limit results', { type: 'integer' }),
    queryParam('skip', 'Skip results', { type: 'integer' }),
    queryParam('cursor', 'Cursor for pagination (JSON-encoded string)'),
    queryParam(
      'select',
      'Count specific fields (JSON-encoded). When provided, returns per-field counts as an object instead of a single integer.',
    ),
  ]
}

function getAggregateParams() {
  return [
    queryParam('where', 'Filter conditions (JSON-encoded string)'),
    queryParam('orderBy', 'Sort order (JSON-encoded string)'),
    queryParam('cursor', 'Cursor for pagination (JSON-encoded string)'),
    queryParam('take', 'Limit results', { type: 'integer' }),
    queryParam('skip', 'Skip results', { type: 'integer' }),
    queryParam(
      '_count',
      'Count aggregate (JSON-encoded: true or field selection object)',
    ),
    queryParam(
      '_avg',
      'Average aggregate (JSON-encoded field selection object)',
    ),
    queryParam('_sum', 'Sum aggregate (JSON-encoded field selection object)'),
    queryParam('_min', 'Min aggregate (JSON-encoded field selection object)'),
    queryParam('_max', 'Max aggregate (JSON-encoded field selection object)'),
  ]
}

function getGroupByParams() {
  return [
    queryParam(
      'by',
      'Fields to group by (JSON-encoded string array)',
      { type: 'string' },
      true,
    ),
    queryParam('where', 'Filter conditions (JSON-encoded string)'),
    queryParam(
      'orderBy',
      'Sort order (JSON-encoded string). Required when using skip or take.',
    ),
    queryParam('having', 'Having conditions (JSON-encoded filter object)'),
    queryParam('take', 'Limit results', { type: 'integer' }),
    queryParam('skip', 'Skip results', { type: 'integer' }),
    queryParam(
      '_count',
      'Count aggregate (JSON-encoded: true or field selection object)',
    ),
    queryParam(
      '_avg',
      'Average aggregate (JSON-encoded field selection object)',
    ),
    queryParam('_sum', 'Sum aggregate (JSON-encoded field selection object)'),
    queryParam('_min', 'Min aggregate (JSON-encoded field selection object)'),
    queryParam('_max', 'Max aggregate (JSON-encoded field selection object)'),
  ]
}

function generatePaths(
  spec: OpenApiSpec,
  modelName: string,
  basePath: string,
  config: RouteConfig,
  fields: ModelField[],
) {
  const createInputRef = {
    $ref: `#/components/schemas/${modelName}CreateInput`,
  }
  const updateInputRef = {
    $ref: `#/components/schemas/${modelName}UpdateInput`,
  }
  const createManyInputRef = {
    $ref: `#/components/schemas/${modelName}CreateManyInput`,
  }
  const updateManyMutationRef = {
    $ref: `#/components/schemas/${modelName}UpdateManyMutationInput`,
  }
  const responseRef = { $ref: `#/components/schemas/${modelName}Response` }
  const nullableResponseSchema = {
    oneOf: [responseRef, { type: 'null' as const }],
  }
  const batchCountRef = {
    $ref: `#/components/schemas/${modelName}BatchCountResponse`,
  }
  const listRef = { $ref: `#/components/schemas/${modelName}ListResponse` }
  const aggregateRef = {
    $ref: `#/components/schemas/${modelName}AggregateResponse`,
  }
  const groupByItemRef = {
    $ref: `#/components/schemas/${modelName}GroupByItem`,
  }

  if (opEnabled(config, 'findMany')) {
    const op: any = {
      tags: [modelName],
      summary: `List ${modelName}`,
      operationId: `${modelName}FindMany`,
      parameters: getFindManyParams(),
      responses: {
        '200': {
          description: 'Success',
          content: {
            'application/json': {
              schema: { type: 'array', items: responseRef },
            },
          },
        },
      },
    }
    addErrorResponses(op, [400, 403, 500, 501, 503])
    addPath(spec, opPath(basePath, 'findMany'), 'get', op)
  }

  if (opEnabled(config, 'findUnique')) {
    const op: any = {
      tags: [modelName],
      summary: `Get ${modelName} by unique constraint`,
      operationId: `${modelName}FindUnique`,
      description:
        'Returns null with status 200 when no record matches the unique constraint.',
      parameters: getFindUniqueParams(),
      responses: {
        '200': {
          description: 'Success (returns the record or null)',
          content: { 'application/json': { schema: nullableResponseSchema } },
        },
      },
    }
    addErrorResponses(op, [400, 403, 500, 501, 503])
    addPath(spec, opPath(basePath, 'findUnique'), 'get', op)
  }

  if (opEnabled(config, 'findUniqueOrThrow')) {
    const op: any = {
      tags: [modelName],
      summary: `Get ${modelName} by unique constraint (throws if not found)`,
      operationId: `${modelName}FindUniqueOrThrow`,
      parameters: getFindUniqueParams(),
      responses: {
        '200': {
          description: 'Success',
          content: { 'application/json': { schema: responseRef } },
        },
      },
    }
    addErrorResponses(op, [400, 403, 404, 500, 501, 503])
    addPath(spec, opPath(basePath, 'findUniqueOrThrow'), 'get', op)
  }

  if (opEnabled(config, 'findFirst')) {
    const op: any = {
      tags: [modelName],
      summary: `Get first ${modelName}`,
      operationId: `${modelName}FindFirst`,
      description: 'Returns null with status 200 when no record matches.',
      parameters: getFindManyParams(),
      responses: {
        '200': {
          description: 'Success (returns the record or null)',
          content: { 'application/json': { schema: nullableResponseSchema } },
        },
      },
    }
    addErrorResponses(op, [400, 403, 500, 501, 503])
    addPath(spec, opPath(basePath, 'findFirst'), 'get', op)
  }

  if (opEnabled(config, 'findFirstOrThrow')) {
    const op: any = {
      tags: [modelName],
      summary: `Get first ${modelName} (throws if not found)`,
      operationId: `${modelName}FindFirstOrThrow`,
      parameters: getFindManyParams(),
      responses: {
        '200': {
          description: 'Success',
          content: { 'application/json': { schema: responseRef } },
        },
      },
    }
    addErrorResponses(op, [400, 403, 404, 500, 501, 503])
    addPath(spec, opPath(basePath, 'findFirstOrThrow'), 'get', op)
  }

  if (opEnabled(config, 'findManyPaginated')) {
    const op: any = {
      tags: [modelName],
      summary: `List ${modelName} with pagination`,
      operationId: `${modelName}FindManyPaginated`,
      description:
        'Returns paginated results with total count. The hasMore field is reliable for forward offset pagination (skip + take) only. When using distinct with very large result sets (>100k unique values), total may fall back to an approximate non-distinct count.',
      parameters: getFindManyParams(),
      responses: {
        '200': {
          description: 'Success',
          content: { 'application/json': { schema: listRef } },
        },
      },
    }
    addErrorResponses(op, [400, 403, 409, 500, 501, 503])
    addPath(spec, opPath(basePath, 'findManyPaginated'), 'get', op)
  }

  if (opEnabled(config, 'create')) {
    const op: any = {
      tags: [modelName],
      summary: `Create ${modelName}`,
      operationId: `${modelName}Create`,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                data: createInputRef,
                select: {
                  type: 'object',
                  description: 'Select fields to return',
                },
                include: {
                  type: 'object',
                  description: 'Include relations to return',
                },
                omit: {
                  type: 'object',
                  description: 'Omit fields from response',
                },
              },
              required: ['data'],
            },
          },
        },
      },
      responses: {
        '201': {
          description: 'Created',
          content: { 'application/json': { schema: responseRef } },
        },
      },
    }
    addErrorResponses(op, [400, 403, 409, 500, 501, 503])
    addPath(spec, opPath(basePath, 'create'), 'post', op)
  }

  if (opEnabled(config, 'createMany')) {
    const op: any = {
      tags: [modelName],
      summary: `Create many ${modelName}`,
      operationId: `${modelName}CreateMany`,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                data: { type: 'array', items: createManyInputRef },
                skipDuplicates: {
                  type: 'boolean',
                  description:
                    'Skip records that would cause unique constraint violations. Not supported on all database providers.',
                },
              },
              required: ['data'],
            },
          },
        },
      },
      responses: {
        '201': {
          description: 'Created',
          content: { 'application/json': { schema: batchCountRef } },
        },
      },
    }
    addErrorResponses(op, [400, 403, 409, 500, 501, 503])
    addPath(spec, opPath(basePath, 'createMany'), 'post', op)
  }

  if (opEnabled(config, 'createManyAndReturn')) {
    const op: any = {
      tags: [modelName],
      summary: `Create many ${modelName} and return records`,
      operationId: `${modelName}CreateManyAndReturn`,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                data: { type: 'array', items: createManyInputRef },
                skipDuplicates: {
                  type: 'boolean',
                  description:
                    'Skip records that would cause unique constraint violations. Not supported on all database providers.',
                },
                select: {
                  type: 'object',
                  description: 'Select fields to return',
                },
                include: {
                  type: 'object',
                  description: 'Include relations to return',
                },
                omit: {
                  type: 'object',
                  description: 'Omit fields from response',
                },
              },
              required: ['data'],
            },
          },
        },
      },
      responses: {
        '201': {
          description: 'Created',
          content: {
            'application/json': {
              schema: { type: 'array', items: responseRef },
            },
          },
        },
      },
    }
    addErrorResponses(op, [400, 403, 409, 500, 501, 503])
    addPath(spec, opPath(basePath, 'createManyAndReturn'), 'post', op)
  }

  if (opEnabled(config, 'update')) {
    const op: any = {
      tags: [modelName],
      summary: `Update ${modelName}`,
      operationId: `${modelName}Update`,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                where: { type: 'object' },
                data: updateInputRef,
                select: {
                  type: 'object',
                  description: 'Select fields to return',
                },
                include: {
                  type: 'object',
                  description: 'Include relations to return',
                },
                omit: {
                  type: 'object',
                  description: 'Omit fields from response',
                },
              },
              required: ['where', 'data'],
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Success',
          content: { 'application/json': { schema: responseRef } },
        },
      },
    }
    addErrorResponses(op, [400, 403, 404, 409, 500, 501, 503])
    addPath(spec, opPath(basePath, 'update'), 'put', op)
  }

  if (opEnabled(config, 'updateMany')) {
    const op: any = {
      tags: [modelName],
      summary: `Update many ${modelName}`,
      operationId: `${modelName}UpdateMany`,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                where: { type: 'object' },
                data: updateManyMutationRef,
              },
              required: ['where', 'data'],
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Success',
          content: { 'application/json': { schema: batchCountRef } },
        },
      },
    }
    addErrorResponses(op, [400, 403, 409, 500, 501, 503])
    addPath(spec, opPath(basePath, 'updateMany'), 'put', op)
  }

  if (opEnabled(config, 'updateManyAndReturn')) {
    const op: any = {
      tags: [modelName],
      summary: `Update many ${modelName} and return records`,
      operationId: `${modelName}UpdateManyAndReturn`,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                where: { type: 'object' },
                data: updateManyMutationRef,
                select: {
                  type: 'object',
                  description: 'Select fields to return',
                },
                include: {
                  type: 'object',
                  description: 'Include relations to return',
                },
                omit: {
                  type: 'object',
                  description: 'Omit fields from response',
                },
              },
              required: ['where', 'data'],
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Success',
          content: {
            'application/json': {
              schema: { type: 'array', items: responseRef },
            },
          },
        },
      },
    }
    addErrorResponses(op, [400, 403, 409, 500, 501, 503])
    addPath(spec, opPath(basePath, 'updateManyAndReturn'), 'put', op)
  }

  if (opEnabled(config, 'upsert')) {
    const op: any = {
      tags: [modelName],
      summary: `Upsert ${modelName}`,
      operationId: `${modelName}Upsert`,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                where: { type: 'object' },
                create: createInputRef,
                update: updateInputRef,
                select: {
                  type: 'object',
                  description: 'Select fields to return',
                },
                include: {
                  type: 'object',
                  description: 'Include relations to return',
                },
                omit: {
                  type: 'object',
                  description: 'Omit fields from response',
                },
              },
              required: ['where', 'create', 'update'],
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Success',
          content: { 'application/json': { schema: responseRef } },
        },
      },
    }
    addErrorResponses(op, [400, 403, 409, 500, 501, 503])
    addPath(spec, opPath(basePath, 'upsert'), 'patch', op)
  }

  if (opEnabled(config, 'delete')) {
    const op: any = {
      tags: [modelName],
      summary: `Delete ${modelName}`,
      operationId: `${modelName}Delete`,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                where: { type: 'object' },
                select: {
                  type: 'object',
                  description: 'Select fields to return',
                },
                include: {
                  type: 'object',
                  description: 'Include relations to return',
                },
                omit: {
                  type: 'object',
                  description: 'Omit fields from response',
                },
              },
              required: ['where'],
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Deleted',
          content: { 'application/json': { schema: responseRef } },
        },
      },
    }
    addErrorResponses(op, [400, 403, 404, 500, 501, 503])
    addPath(spec, opPath(basePath, 'delete'), 'delete', op)
  }

  if (opEnabled(config, 'deleteMany')) {
    const op: any = {
      tags: [modelName],
      summary: `Delete many ${modelName}`,
      operationId: `${modelName}DeleteMany`,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: { where: { type: 'object' } },
              required: ['where'],
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Deleted',
          content: { 'application/json': { schema: batchCountRef } },
        },
      },
    }
    addErrorResponses(op, [400, 403, 500, 501, 503])
    addPath(spec, opPath(basePath, 'deleteMany'), 'delete', op)
  }

  if (opEnabled(config, 'count')) {
    const op: any = {
      tags: [modelName],
      summary: `Count ${modelName}`,
      operationId: `${modelName}Count`,
      parameters: getCountParams(),
      responses: {
        '200': {
          description: 'Success',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    type: 'integer',
                    description: 'Total count when select is not provided',
                  },
                  {
                    type: 'object',
                    description:
                      'Per-field count object when select is provided',
                  },
                ],
              },
            },
          },
        },
      },
    }
    addErrorResponses(op, [400, 403, 500, 501, 503])
    addPath(spec, opPath(basePath, 'count'), 'get', op)
  }

  if (opEnabled(config, 'aggregate')) {
    const op: any = {
      tags: [modelName],
      summary: `Aggregate ${modelName}`,
      operationId: `${modelName}Aggregate`,
      parameters: getAggregateParams(),
      responses: {
        '200': {
          description: 'Success',
          content: { 'application/json': { schema: aggregateRef } },
        },
      },
    }
    addErrorResponses(op, [400, 403, 500, 501, 503])
    addPath(spec, opPath(basePath, 'aggregate'), 'get', op)
  }

  if (opEnabled(config, 'groupBy')) {
    const op: any = {
      tags: [modelName],
      summary: `Group ${modelName}`,
      operationId: `${modelName}GroupBy`,
      description:
        'Groups records by the specified fields and returns aggregates. When using skip or take, orderBy is required. Response items contain only the fields listed in by plus any requested aggregates.',
      parameters: getGroupByParams(),
      responses: {
        '200': {
          description: 'Success',
          content: {
            'application/json': {
              schema: { type: 'array', items: groupByItemRef },
            },
          },
        },
      },
    }
    addErrorResponses(op, [400, 403, 500, 501, 503])
    addPath(spec, opPath(basePath, 'groupBy'), 'get', op)
  }
}

function addPath(
  spec: OpenApiSpec,
  path: string,
  method: string,
  operation: any,
) {
  if (!spec.paths[path]) {
    spec.paths[path] = {}
  }
  spec.paths[path][method] = operation
}

function fieldsToProperties(
  fields: ModelField[],
): Record<string, SchemaObject | RefObject> {
  const props: Record<string, SchemaObject | RefObject> = {}
  for (const field of fields) {
    props[field.name] = mapFieldToSchema(field)
  }
  return props
}

function fieldsToWriteProperties(
  fields: ModelField[],
): Record<string, SchemaObject | RefObject> {
  const props: Record<string, SchemaObject | RefObject> = {}
  for (const field of fields) {
    props[field.name] = mapFieldToWriteSchema(field)
  }
  return props
}

function fieldsToBulkWriteProperties(
  fields: ModelField[],
): Record<string, SchemaObject | RefObject> {
  const props: Record<string, SchemaObject | RefObject> = {}
  for (const field of fields) {
    if (field.kind === 'object') continue
    props[field.name] = mapFieldToWriteSchema(field)
  }
  return props
}

function wrapNullable(schema: SchemaObject | RefObject): SchemaObject {
  if ('$ref' in schema) {
    return { oneOf: [schema, { type: 'null' }] }
  }
  if (
    schema.type &&
    typeof schema.type === 'string' &&
    schema.type !== 'array'
  ) {
    return { ...schema, type: [schema.type, 'null'] }
  }
  return { oneOf: [schema, { type: 'null' }] }
}

function mapFieldToSchema(field: ModelField): SchemaObject | RefObject {
  let schema: SchemaObject | RefObject

  switch (field.kind) {
    case 'scalar':
      schema = mapScalarType(field.type)
      break
    case 'enum':
      schema = { $ref: `#/components/schemas/${field.type}` }
      break
    case 'object':
      if (field.isList) {
        schema = {
          type: 'array',
          items: { $ref: `#/components/schemas/${field.type}Response` },
        }
      } else {
        schema = { $ref: `#/components/schemas/${field.type}Response` }
      }
      break
    default:
      schema = { type: 'string' }
  }

  if (field.isList && field.kind !== 'object') {
    schema = { type: 'array', items: schema }
  }

  if (!field.isRequired && !field.isList) {
    schema = wrapNullable(schema)
  }

  if (field.documentation) {
    if ('$ref' in schema && !('oneOf' in schema) && !('allOf' in schema)) {
      schema = {
        allOf: [{ $ref: (schema as RefObject).$ref }],
        description: field.documentation,
      }
    } else if (!('$ref' in schema)) {
      schema.description = field.documentation
    }
  }

  return schema
}

function mapFieldToWriteSchema(field: ModelField): SchemaObject | RefObject {
  if (field.kind === 'object') {
    if (field.isList) {
      return {
        type: 'object',
        description: `Nested ${field.type} write operations for list relation`,
        properties: {
          create: {
            oneOf: [
              { type: 'object', description: `${field.type} create input` },
              {
                type: 'array',
                items: {
                  type: 'object',
                  description: `${field.type} create input`,
                },
              },
            ],
          },
          connect: {
            oneOf: [
              { type: 'object', description: 'Unique identifier to connect' },
              {
                type: 'array',
                items: {
                  type: 'object',
                  description: 'Unique identifier to connect',
                },
              },
            ],
          },
          connectOrCreate: {
            oneOf: [
              {
                type: 'object',
                description: '{ where, create } pair',
                properties: {
                  where: { type: 'object' },
                  create: { type: 'object' },
                },
              },
              {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    where: { type: 'object' },
                    create: { type: 'object' },
                  },
                },
              },
            ],
          },
          createMany: {
            type: 'object',
            properties: {
              data: {
                type: 'array',
                items: {
                  type: 'object',
                  description: `${field.type} create input`,
                },
              },
              skipDuplicates: { type: 'boolean' },
            },
          },
          set: {
            type: 'array',
            items: { type: 'object', description: 'Unique identifier' },
            description: 'Replace all connected records',
          },
          disconnect: {
            oneOf: [
              {
                type: 'object',
                description: 'Unique identifier to disconnect',
              },
              {
                type: 'array',
                items: {
                  type: 'object',
                  description: 'Unique identifier to disconnect',
                },
              },
            ],
          },
          delete: {
            oneOf: [
              { type: 'object', description: 'Unique identifier to delete' },
              {
                type: 'array',
                items: {
                  type: 'object',
                  description: 'Unique identifier to delete',
                },
              },
            ],
          },
          update: {
            oneOf: [
              {
                type: 'object',
                description: '{ where, data } pair',
                properties: {
                  where: { type: 'object' },
                  data: { type: 'object' },
                },
              },
              {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    where: { type: 'object' },
                    data: { type: 'object' },
                  },
                },
              },
            ],
          },
          updateMany: {
            oneOf: [
              {
                type: 'object',
                description: '{ where, data } pair',
                properties: {
                  where: { type: 'object' },
                  data: { type: 'object' },
                },
              },
              {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    where: { type: 'object' },
                    data: { type: 'object' },
                  },
                },
              },
            ],
          },
          deleteMany: {
            oneOf: [
              { type: 'object', description: 'Where filter' },
              {
                type: 'array',
                items: { type: 'object', description: 'Where filter' },
              },
            ],
          },
          upsert: {
            oneOf: [
              {
                type: 'object',
                description: '{ where, create, update } triple',
                properties: {
                  where: { type: 'object' },
                  create: { type: 'object' },
                  update: { type: 'object' },
                },
              },
              {
                type: 'array',
                items: {
                  type: 'object',
                  description: '{ where, create, update } triple',
                  properties: {
                    where: { type: 'object' },
                    create: { type: 'object' },
                    update: { type: 'object' },
                  },
                },
              },
            ],
          },
        },
      }
    }
    return {
      type: 'object',
      description: `Nested ${field.type} write operations for single relation`,
      properties: {
        create: { type: 'object', description: `${field.type} create input` },
        connect: {
          type: 'object',
          description: 'Unique identifier to connect',
        },
        connectOrCreate: {
          type: 'object',
          description: '{ where, create } pair',
          properties: { where: { type: 'object' }, create: { type: 'object' } },
        },
        disconnect: {
          type: 'boolean',
          description: 'Disconnect the related record',
        },
        delete: { type: 'boolean', description: 'Delete the related record' },
        update: { type: 'object', description: `${field.type} update input` },
        upsert: {
          type: 'object',
          description:
            '{ create, update } pair — create if not exists, update if exists',
          properties: {
            create: {
              type: 'object',
              description: `${field.type} create input`,
            },
            update: {
              type: 'object',
              description: `${field.type} update input`,
            },
          },
        },
      },
    }
  }

  let schema: SchemaObject | RefObject

  switch (field.kind) {
    case 'scalar':
      schema = mapScalarType(field.type)
      break
    case 'enum':
      schema = { $ref: `#/components/schemas/${field.type}` }
      break
    default:
      schema = { type: 'string' }
  }

  if (field.isList) {
    schema = { type: 'array', items: schema }
  }

  if (!field.isRequired && !field.isList) {
    schema = wrapNullable(schema)
  }

  if (field.documentation) {
    if ('$ref' in schema && !('oneOf' in schema) && !('allOf' in schema)) {
      schema = {
        allOf: [{ $ref: (schema as RefObject).$ref }],
        description: field.documentation,
      }
    } else if (!('$ref' in schema)) {
      schema.description = field.documentation
    }
  }

  return schema
}

function mapScalarType(type: string): SchemaObject {
  const typeMap: Record<string, SchemaObject> = {
    String: { type: 'string' },
    Int: { type: 'integer', format: 'int32' },
    BigInt: { type: 'string', description: 'BigInt serialized as string' },
    Float: { type: 'number', format: 'double' },
    Decimal: { type: 'string', description: 'Decimal serialized as string' },
    Boolean: { type: 'boolean' },
    DateTime: { type: 'string', format: 'date-time' },
    Json: { description: 'Arbitrary JSON value' },
    Bytes: {
      type: 'string',
      format: 'byte',
      description: 'Binary data serialized as base64 string',
    },
  }
  return typeMap[type] || { type: 'string' }
}

function yamlEscapeValue(value: unknown, indent: number = 0): string {
  if (value === null) return 'null'
  if (value === undefined) return 'null'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'number') return String(value)

  const str = String(value)
  if (str === '') return "''"

  const needsQuote =
    str === '~' ||
    str === '.inf' ||
    str === '-.inf' ||
    str === '.nan' ||
    str.includes(':') ||
    str.includes('#') ||
    str.includes('{') ||
    str.includes('}') ||
    str.includes('[') ||
    str.includes(']') ||
    str.includes(',') ||
    str.includes('&') ||
    str.includes('*') ||
    str.includes('!') ||
    str.includes('|') ||
    str.includes('>') ||
    str.includes("'") ||
    str.includes('"') ||
    str.includes('%') ||
    str.includes('@') ||
    str.includes('`') ||
    str.startsWith(' ') ||
    str.endsWith(' ') ||
    str === 'true' ||
    str === 'false' ||
    str === 'null' ||
    str === 'yes' ||
    str === 'no' ||
    str === 'on' ||
    str === 'off' ||
    (!isNaN(Number(str)) && str !== '')

  if (str.includes('\n')) {
    const blockIndent = '  '.repeat(indent + 1)
    return (
      '|\n' +
      str
        .split('\n')
        .map((l) => blockIndent + l)
        .join('\n')
    )
  }

  if (needsQuote) {
    return '"' + str.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'
  }

  return str
}

function yamlEscapeKey(key: string): string {
  if (key === '') return "''"

  const needsQuote =
    key === '~' ||
    key === '.inf' ||
    key === '-.inf' ||
    key === '.nan' ||
    key.includes(':') ||
    key.includes('#') ||
    key.includes('{') ||
    key.includes('}') ||
    key.includes('[') ||
    key.includes(']') ||
    key.includes(',') ||
    key.includes('&') ||
    key.includes('*') ||
    key.includes('!') ||
    key.includes('|') ||
    key.includes('>') ||
    key.includes("'") ||
    key.includes('"') ||
    key.includes('%') ||
    key.includes('@') ||
    key.includes('`') ||
    key.includes(' ') ||
    key === 'true' ||
    key === 'false' ||
    key === 'null' ||
    key === 'yes' ||
    key === 'no' ||
    key === 'on' ||
    key === 'off' ||
    (!isNaN(Number(key)) && key !== '')

  if (needsQuote) {
    return '"' + key.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'
  }

  return key
}

function toYaml(obj: any, indent = 0): string {
  const spaces = '  '.repeat(indent)
  let yaml = ''

  if (Array.isArray(obj)) {
    if (obj.length === 0) return `${spaces}[]\n`
    for (const item of obj) {
      if (typeof item === 'object' && item !== null) {
        const inner = toYaml(item, indent + 1).trimStart()
        yaml += `${spaces}- ${inner}`
      } else {
        yaml += `${spaces}- ${yamlEscapeValue(item, indent)}\n`
      }
    }
  } else if (typeof obj === 'object' && obj !== null) {
    if (Object.keys(obj).length === 0) return `${spaces}{}\n`
    for (const [key, value] of Object.entries(obj)) {
      if (value === undefined) continue
      const safeKey = yamlEscapeKey(key)
      if (typeof value === 'object' && value !== null) {
        yaml += `${spaces}${safeKey}:\n${toYaml(value, indent + 1)}`
      } else {
        yaml += `${spaces}${safeKey}: ${yamlEscapeValue(value, indent)}\n`
      }
    }
  }

  return yaml
}
