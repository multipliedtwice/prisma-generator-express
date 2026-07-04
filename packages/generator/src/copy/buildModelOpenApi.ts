import { stringify as yamlStringify } from 'yaml'
import type { RouteConfig, WriteStrategy } from './routeConfig'
import { OPERATION_BY_NAME, isOperationEnabled } from './operationDefinitions'
import { normalizePrefix, removeTrailingSlash } from './misc'
import { NUMERIC_SCALAR_TYPES, STRING_NUMERIC_TYPES } from './scalarTypes'

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
  maxItems?: number
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
  writeStrategy?: WriteStrategy
}

const WHERE_PROP: SchemaObject = { type: 'object', description: 'Filter conditions' }
const TAKE_PROP: SchemaObject = { type: 'integer', description: 'Limit results' }
const SKIP_PROP: SchemaObject = { type: 'integer', description: 'Skip results' }
const CURSOR_PROP: SchemaObject = { type: 'object', description: 'Cursor for pagination' }
const ORDERBY_PROP: SchemaObject = { description: 'Sort order (object or array of objects)' }
const SELECT_PROP: SchemaObject = { type: 'object', description: 'Select fields' }
const INCLUDE_PROP: SchemaObject = { type: 'object', description: 'Include relations' }
const OMIT_PROP: SchemaObject = { type: 'object', description: 'Omit fields from response' }
const DISTINCT_PROP: SchemaObject = { description: 'Distinct fields (string or array of strings)' }
const AGG_COUNT: SchemaObject = { description: 'Count aggregate (true or field selection object)' }
const AGG_AVG: SchemaObject = { type: 'object', description: 'Average aggregate (field selection object)' }
const AGG_SUM: SchemaObject = { type: 'object', description: 'Sum aggregate (field selection object)' }
const AGG_MIN: SchemaObject = { type: 'object', description: 'Min aggregate (field selection object)' }
const AGG_MAX: SchemaObject = { type: 'object', description: 'Max aggregate (field selection object)' }

const PROJECTION_PROPS: Record<string, SchemaObject> = {
  select: SELECT_PROP,
  include: INCLUDE_PROP,
  omit: OMIT_PROP,
}

const AGGREGATE_PROPS: Record<string, SchemaObject> = {
  _count: AGG_COUNT,
  _avg: AGG_AVG,
  _sum: AGG_SUM,
  _min: AGG_MIN,
  _max: AGG_MAX,
}

function opEnabled(config: RouteConfig, name: string): boolean {
  const meta = OPERATION_BY_NAME[name]
  return meta ? isOperationEnabled(config as Record<string, any>, meta) : false
}

function opPath(basePath: string, name: string): string {
  const meta = OPERATION_BY_NAME[name]
  if (!meta.pathSuffix) return basePath || '/'
  return `${basePath}${meta.pathSuffix}`
}

function postReadPath(basePath: string, name: string): string {
  if (name === 'findMany') return `${basePath}/read`
  return opPath(basePath, name)
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

function addErrorResponses(operation: any, codes: readonly number[]): void {
  for (const code of codes) {
    operation.responses[String(code)] = errorResponse(
      COMMON_ERRORS[code] || 'Error',
    )
  }
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

const oneOrMany = (schema: SchemaObject | RefObject): SchemaObject => ({
  oneOf: [schema, { type: 'array', items: schema }],
})

function scalarUpdateOperations(
  baseSchema: SchemaObject | RefObject,
  fieldType: string,
  fieldKind: string,
): SchemaObject {
  const ops: Record<string, SchemaObject | RefObject> = { set: baseSchema }

  if (fieldKind === 'scalar' && NUMERIC_SCALAR_TYPES.has(fieldType)) {
    ops.increment = baseSchema
    ops.decrement = baseSchema
    ops.multiply = baseSchema
    ops.divide = baseSchema
  }

  return {
    oneOf: [baseSchema, { type: 'object', properties: ops }],
  }
}

function listScalarUpdateOperations(
  itemSchema: SchemaObject | RefObject,
): SchemaObject {
  return {
    type: 'object',
    properties: {
      set: { type: 'array', items: itemSchema },
      push: {
        oneOf: [
          itemSchema as SchemaObject,
          { type: 'array', items: itemSchema },
        ],
      },
    },
  }
}

function findManyBodySchema(): SchemaObject {
  return {
    type: 'object',
    properties: {
      where: WHERE_PROP,
      orderBy: ORDERBY_PROP,
      take: TAKE_PROP,
      skip: SKIP_PROP,
      ...PROJECTION_PROPS,
      cursor: CURSOR_PROP,
      distinct: DISTINCT_PROP,
    },
  }
}

function findUniqueBodySchema(): SchemaObject {
  return {
    type: 'object',
    properties: {
      where: { type: 'object', description: 'Unique selector' },
      ...PROJECTION_PROPS,
    },
    required: ['where'],
  }
}

function countBodySchema(): SchemaObject {
  return {
    type: 'object',
    properties: {
      where: WHERE_PROP,
      orderBy: { description: 'Sort order' },
      take: TAKE_PROP,
      skip: SKIP_PROP,
      cursor: CURSOR_PROP,
      select: {
        description:
          'Count specific fields. When provided, returns per-field counts as an object instead of a single integer.',
      },
    },
  }
}

function aggregateBodySchema(): SchemaObject {
  return {
    type: 'object',
    properties: {
      where: WHERE_PROP,
      orderBy: { description: 'Sort order' },
      cursor: CURSOR_PROP,
      take: TAKE_PROP,
      skip: SKIP_PROP,
      ...AGGREGATE_PROPS,
    },
  }
}

function groupByBodySchema(): SchemaObject {
  return {
    type: 'object',
    properties: {
      by: {
        type: 'array',
        items: { type: 'string' },
        description: 'Fields to group by',
      },
      where: WHERE_PROP,
      orderBy: { description: 'Sort order. Required when using skip or take.' },
      having: {
        type: 'object',
        description: 'Having conditions (filter object)',
      },
      take: TAKE_PROP,
      skip: SKIP_PROP,
      ...AGGREGATE_PROPS,
    },
    required: ['by'],
  }
}

const POST_READ_BODY_SCHEMAS: Record<string, () => SchemaObject> = {
  findMany: findManyBodySchema,
  findFirst: findManyBodySchema,
  findFirstOrThrow: findManyBodySchema,
  findManyPaginated: findManyBodySchema,
  findUnique: findUniqueBodySchema,
  findUniqueOrThrow: findUniqueBodySchema,
  count: countBodySchema,
  aggregate: aggregateBodySchema,
  groupBy: groupByBodySchema,
}

function getPostReadBodySchema(opName: string): SchemaObject {
  return (POST_READ_BODY_SCHEMAS[opName] ?? findManyBodySchema)()
}

function applyWriteStrategy(
  spec: OpenApiSpec,
  modelName: string,
  basePath: string,
  writeStrategy: WriteStrategy | undefined,
): void {
  if (!writeStrategy || writeStrategy === 'regular') return

  const manyPath = basePath + '/many'
  const node = spec.paths[manyPath]
  if (!node) return

  if (writeStrategy === 'throwOnNonReturning') {
    delete node.post
    delete node.put
    if (Object.keys(node).length === 0) {
      delete spec.paths[manyPath]
    }
    return
  }

  const responseRef: RefObject = {
    $ref: '#/components/schemas/' + modelName + 'Response',
  }

  const injectProjectionAndArrayResponse = (
    op: any,
    successCode: '200' | '201',
    summary: string,
    description: string,
  ): void => {
    op.summary = summary
    op.description = description
    const r = op.responses?.[successCode]
    if (r?.content?.['application/json']) {
      r.content['application/json'].schema = {
        type: 'array',
        items: responseRef,
      }
    }
    const reqSchema = op.requestBody?.content?.['application/json']?.schema
    if (reqSchema && reqSchema.properties) {
      Object.assign(reqSchema.properties, PROJECTION_PROPS)
    }
  }

  const forceReturnOps: Array<{
    method: 'post' | 'put'
    successCode: '200' | '201'
    verb: string
    targetOp: string
  }> = [
    { method: 'post', successCode: '201', verb: 'Create', targetOp: 'createManyAndReturn' },
    { method: 'put',  successCode: '200', verb: 'Update', targetOp: 'updateManyAndReturn' },
  ]

  for (const entry of forceReturnOps) {
    const target = node[entry.method]
    if (!target) continue
    injectProjectionAndArrayResponse(
      target,
      entry.successCode,
      entry.verb + ' many ' + modelName + ' (forceReturn)',
      'writeStrategy="forceReturn": this endpoint silently invokes ' + entry.targetOp +
      ' and returns the ' + (entry.verb === 'Create' ? 'created' : 'updated') +
      ' records instead of { count }.',
    )
  }
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
  applyWriteStrategy(spec, modelName, basePath, options.writeStrategy)

  if (options.format === 'yaml') {
    return yamlStringify(spec)
  }
  return spec
}

function generateOperationSchemas(
  spec: OpenApiSpec,
  modelName: string,
  fields: ModelField[],
) {
  const relatedModels = new Set(
    fields.filter((f) => f.kind === 'object').map((f) => f.type),
  )

  relatedModels.forEach((relatedModel) => {
    if (!spec.components.schemas[`${relatedModel}Response`]) {
      spec.components.schemas[`${relatedModel}Response`] = {
        type: 'object',
        description: `Related ${relatedModel} object. See the ${relatedModel} docs endpoint for full schema. Shape depends on select/include parameters.`,
      }
    }
  })

  const relationFkFields = new Set(
    fields
      .filter((f) => f.kind === 'object' && f.relationFromFields?.length)
      .flatMap((f) => f.relationFromFields!),
  )

  const requiredCreateScalars = fields
    .filter(
      (f) =>
        (f.kind === 'scalar' || f.kind === 'enum') &&
        f.isRequired &&
        !f.hasDefaultValue &&
        !f.isUpdatedAt &&
        !relationFkFields.has(f.name),
    )
    .map((f) => f.name)

  const requiredCreateManyScalars = fields
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
    properties: fieldsToWriteProperties(fields, 'create'),
  }
  if (requiredCreateScalars.length > 0) {
    createInputSchema.required = [...requiredCreateScalars]
  }

  spec.components.schemas[`${modelName}CreateInput`] = createInputSchema

  spec.components.schemas[`${modelName}UpdateInput`] = {
    type: 'object',
    properties: fieldsToWriteProperties(fields, 'update'),
  }

  const createManyInputSchema: SchemaObject = {
    type: 'object',
    properties: fieldsToBulkWriteProperties(fields, 'create'),
    description:
      'Scalar-only input for bulk create. Nested relation writes are not supported in createMany operations.',
  }
  if (requiredCreateManyScalars.length > 0) {
    createManyInputSchema.required = [...requiredCreateManyScalars]
  }

  spec.components.schemas[`${modelName}CreateManyInput`] = createManyInputSchema

  spec.components.schemas[`${modelName}UpdateManyMutationInput`] = {
    type: 'object',
    properties: fieldsToBulkWriteProperties(fields, 'update'),
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

  spec.components.schemas[`${modelName}UpdateEachItemInput`] = {
    type: 'object',
    properties: {
      where: { type: 'object', description: 'Prisma unique or where filter' },
      data: { $ref: `#/components/schemas/${modelName}UpdateInput` },
    },
    required: ['where', 'data'],
  }

  spec.components.schemas[`${modelName}UpdateEachRowOk`] = {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['ok'] },
      data: { $ref: `#/components/schemas/${modelName}Response` },
    },
    required: ['status', 'data'],
  }

  spec.components.schemas[`${modelName}UpdateEachRowError`] = {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['error'] },
      error: { type: 'string' },
    },
    required: ['status', 'error'],
  }

  spec.components.schemas[`${modelName}UpdateEachResponse`] = {
    description:
      'Non-atomic mode returns per-row status objects; atomic mode (header x-batch-atomic: true) returns an array of updated records.',
    oneOf: [
      {
        type: 'array',
        items: {
          oneOf: [
            { $ref: `#/components/schemas/${modelName}UpdateEachRowOk` },
            { $ref: `#/components/schemas/${modelName}UpdateEachRowError` },
          ],
        },
      },
      {
        type: 'array',
        items: { $ref: `#/components/schemas/${modelName}Response` },
      },
    ],
  }

  const numericFields = fields.filter(
    (f) => f.kind === 'scalar' && NUMERIC_SCALAR_TYPES.has(f.type),
  )

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

function addPostReadOperation(
  spec: OpenApiSpec,
  path: string,
  modelName: string,
  opName: string,
  summary: string,
  responseSchema: any,
  errorCodes: readonly number[],
  description?: string,
) {
  const op: any = {
    tags: [modelName],
    summary: summary + ' (POST)',
    operationId: `${modelName}${opName.charAt(0).toUpperCase() + opName.slice(1)}Post`,
    description:
      (description ? description + ' ' : '') +
      'POST alternative for requests with complex query parameters that may exceed URL length limits. Accepts the same arguments as the GET endpoint but as a JSON request body instead of query parameters.',
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: getPostReadBodySchema(opName),
        },
      },
    },
    responses: {
      '200': {
        description: 'Success',
        content: { 'application/json': { schema: responseSchema } },
      },
    },
  }
  addErrorResponses(op, errorCodes)
  addPath(spec, path, 'post', op)
}

function generatePaths(
  spec: OpenApiSpec,
  modelName: string,
  basePath: string,
  config: RouteConfig,
  fields: ModelField[],
) {
  const postReads = !config.disablePostReads

  const createInputRef = { $ref: `#/components/schemas/${modelName}CreateInput` }
  const updateInputRef = { $ref: `#/components/schemas/${modelName}UpdateInput` }
  const createManyInputRef = { $ref: `#/components/schemas/${modelName}CreateManyInput` }
  const updateManyMutationRef = { $ref: `#/components/schemas/${modelName}UpdateManyMutationInput` }
  const responseRef = { $ref: `#/components/schemas/${modelName}Response` }
  const nullableResponseSchema = { oneOf: [responseRef, { type: 'null' as const }] }
  const batchCountRef = { $ref: `#/components/schemas/${modelName}BatchCountResponse` }
  const listRef = { $ref: `#/components/schemas/${modelName}ListResponse` }
  const aggregateRef = { $ref: `#/components/schemas/${modelName}AggregateResponse` }
  const groupByItemRef = { $ref: `#/components/schemas/${modelName}GroupByItem` }
  const updateEachItemRef = { $ref: `#/components/schemas/${modelName}UpdateEachItemInput` }
  const updateEachResponseRef = { $ref: `#/components/schemas/${modelName}UpdateEachResponse` }

  if (opEnabled(config, 'findMany')) {
    const meta = OPERATION_BY_NAME['findMany']
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
    addErrorResponses(op, meta.errors)
    addPath(spec, opPath(basePath, 'findMany'), 'get', op)

    if (postReads) {
      addPostReadOperation(
        spec,
        postReadPath(basePath, 'findMany'),
        modelName,
        'findMany',
        `List ${modelName}`,
        { type: 'array', items: responseRef },
        meta.errors,
      )
    }
  }

  if (opEnabled(config, 'findUnique')) {
    const meta = OPERATION_BY_NAME['findUnique']
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
    addErrorResponses(op, meta.errors)
    addPath(spec, opPath(basePath, 'findUnique'), 'get', op)

    if (postReads) {
      addPostReadOperation(
        spec,
        postReadPath(basePath, 'findUnique'),
        modelName,
        'findUnique',
        `Get ${modelName} by unique constraint`,
        nullableResponseSchema,
        meta.errors,
        'Returns null with status 200 when no record matches the unique constraint.',
      )
    }
  }

  if (opEnabled(config, 'findUniqueOrThrow')) {
    const meta = OPERATION_BY_NAME['findUniqueOrThrow']
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
    addErrorResponses(op, meta.errors)
    addPath(spec, opPath(basePath, 'findUniqueOrThrow'), 'get', op)

    if (postReads) {
      addPostReadOperation(
        spec,
        postReadPath(basePath, 'findUniqueOrThrow'),
        modelName,
        'findUniqueOrThrow',
        `Get ${modelName} by unique constraint (throws if not found)`,
        responseRef,
        meta.errors,
      )
    }
  }

  if (opEnabled(config, 'findFirst')) {
    const meta = OPERATION_BY_NAME['findFirst']
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
    addErrorResponses(op, meta.errors)
    addPath(spec, opPath(basePath, 'findFirst'), 'get', op)

    if (postReads) {
      addPostReadOperation(
        spec,
        postReadPath(basePath, 'findFirst'),
        modelName,
        'findFirst',
        `Get first ${modelName}`,
        nullableResponseSchema,
        meta.errors,
        'Returns null with status 200 when no record matches.',
      )
    }
  }

  if (opEnabled(config, 'findFirstOrThrow')) {
    const meta = OPERATION_BY_NAME['findFirstOrThrow']
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
    addErrorResponses(op, meta.errors)
    addPath(spec, opPath(basePath, 'findFirstOrThrow'), 'get', op)

    if (postReads) {
      addPostReadOperation(
        spec,
        postReadPath(basePath, 'findFirstOrThrow'),
        modelName,
        'findFirstOrThrow',
        `Get first ${modelName} (throws if not found)`,
        responseRef,
        meta.errors,
      )
    }
  }

  if (opEnabled(config, 'findManyPaginated')) {
    const meta = OPERATION_BY_NAME['findManyPaginated']
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
    addErrorResponses(op, meta.errors)
    addPath(spec, opPath(basePath, 'findManyPaginated'), 'get', op)

    if (postReads) {
      addPostReadOperation(
        spec,
        postReadPath(basePath, 'findManyPaginated'),
        modelName,
        'findManyPaginated',
        `List ${modelName} with pagination`,
        listRef,
        meta.errors,
        'Returns paginated results with total count.',
      )
    }
  }

  if (opEnabled(config, 'create')) {
    const meta = OPERATION_BY_NAME['create']
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
                ...PROJECTION_PROPS,
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
    addErrorResponses(op, meta.errors)
    addPath(spec, opPath(basePath, 'create'), 'post', op)
  }

  if (opEnabled(config, 'createMany')) {
    const meta = OPERATION_BY_NAME['createMany']
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
    addErrorResponses(op, meta.errors)
    addPath(spec, opPath(basePath, 'createMany'), 'post', op)
  }

  if (opEnabled(config, 'createManyAndReturn')) {
    const meta = OPERATION_BY_NAME['createManyAndReturn']
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
                ...PROJECTION_PROPS,
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
    addErrorResponses(op, meta.errors)
    addPath(spec, opPath(basePath, 'createManyAndReturn'), 'post', op)
  }

  if (opEnabled(config, 'update')) {
    const meta = OPERATION_BY_NAME['update']
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
                ...PROJECTION_PROPS,
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
    addErrorResponses(op, meta.errors)
    addPath(spec, opPath(basePath, 'update'), 'put', op)
  }

  if (opEnabled(config, 'updateMany')) {
    const meta = OPERATION_BY_NAME['updateMany']
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
    addErrorResponses(op, meta.errors)
    addPath(spec, opPath(basePath, 'updateMany'), 'put', op)
  }

  if (opEnabled(config, 'updateManyAndReturn')) {
    const meta = OPERATION_BY_NAME['updateManyAndReturn']
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
                ...PROJECTION_PROPS,
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
    addErrorResponses(op, meta.errors)
    addPath(spec, opPath(basePath, 'updateManyAndReturn'), 'put', op)
  }

  if (opEnabled(config, 'upsert')) {
    const meta = OPERATION_BY_NAME['upsert']
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
                ...PROJECTION_PROPS,
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
    addErrorResponses(op, meta.errors)
    addPath(spec, opPath(basePath, 'upsert'), 'patch', op)
  }

  if (opEnabled(config, 'delete')) {
    const meta = OPERATION_BY_NAME['delete']
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
                ...PROJECTION_PROPS,
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
    addErrorResponses(op, meta.errors)
    addPath(spec, opPath(basePath, 'delete'), 'delete', op)
  }

  if (opEnabled(config, 'deleteMany')) {
    const meta = OPERATION_BY_NAME['deleteMany']
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
    addErrorResponses(op, meta.errors)
    addPath(spec, opPath(basePath, 'deleteMany'), 'delete', op)
  }

  if (opEnabled(config, 'count')) {
    const meta = OPERATION_BY_NAME['count']
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
                    description: 'Per-field count object when select is provided',
                  },
                ],
              },
            },
          },
        },
      },
    }
    addErrorResponses(op, meta.errors)
    addPath(spec, opPath(basePath, 'count'), 'get', op)

    if (postReads) {
      addPostReadOperation(
        spec,
        postReadPath(basePath, 'count'),
        modelName,
        'count',
        `Count ${modelName}`,
        {
          oneOf: [
            {
              type: 'integer',
              description: 'Total count when select is not provided',
            },
            {
              type: 'object',
              description: 'Per-field count object when select is provided',
            },
          ],
        },
        meta.errors,
      )
    }
  }

  if (opEnabled(config, 'aggregate')) {
    const meta = OPERATION_BY_NAME['aggregate']
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
    addErrorResponses(op, meta.errors)
    addPath(spec, opPath(basePath, 'aggregate'), 'get', op)

    if (postReads) {
      addPostReadOperation(
        spec,
        postReadPath(basePath, 'aggregate'),
        modelName,
        'aggregate',
        `Aggregate ${modelName}`,
        aggregateRef,
        meta.errors,
      )
    }
  }

  if (opEnabled(config, 'groupBy')) {
    const meta = OPERATION_BY_NAME['groupBy']
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
    addErrorResponses(op, meta.errors)
    addPath(spec, opPath(basePath, 'groupBy'), 'get', op)

    if (postReads) {
      addPostReadOperation(
        spec,
        postReadPath(basePath, 'groupBy'),
        modelName,
        'groupBy',
        `Group ${modelName}`,
        { type: 'array', items: groupByItemRef },
        meta.errors,
        'Groups records by the specified fields and returns aggregates.',
      )
    }
  }

  if (opEnabled(config, 'updateEach')) {
    const meta = OPERATION_BY_NAME['updateEach']
    const op: any = {
      tags: [modelName],
      summary: `Update each ${modelName} (batch)`,
      operationId: `${modelName}UpdateEach`,
      description:
        'Internal batch endpoint. Not enabled by enableAll — must be opted into explicitly. ' +
        'Bypasses guard shapes; protect with before hooks. ' +
        'Non-atomic mode (default): up to 1000 items, per-row status results. ' +
        'Atomic mode (header x-batch-atomic: true): up to 100 items, single transaction, any row failure rolls back the whole batch.',
      parameters: [
        {
          name: 'x-batch-atomic',
          in: 'header',
          required: false,
          schema: { type: 'string', enum: ['true', 'false'] },
          description:
            'Set to "true" to run all rows in a single interactive transaction (max 100 items).',
        },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'array',
              maxItems: 1000,
              items: updateEachItemRef,
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Success',
          content: { 'application/json': { schema: updateEachResponseRef } },
        },
      },
    }
    addErrorResponses(op, meta.errors)
    addPath(spec, opPath(basePath, 'updateEach'), 'post', op)
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
  mode: 'create' | 'update',
): Record<string, SchemaObject | RefObject> {
  const props: Record<string, SchemaObject | RefObject> = {}
  for (const field of fields) {
    props[field.name] = mapFieldToWriteSchema(field, mode)
  }
  return props
}

function fieldsToBulkWriteProperties(
  fields: ModelField[],
  mode: 'create' | 'update',
): Record<string, SchemaObject | RefObject> {
  const props: Record<string, SchemaObject | RefObject> = {}
  for (const field of fields) {
    if (field.kind === 'object') continue
    props[field.name] = mapFieldToWriteSchema(field, mode)
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

function nestedListRelationOps(fieldType: string): SchemaObject {
  const createInput: SchemaObject = { type: 'object', description: `${fieldType} create input` }
  const uniqueId: SchemaObject = { type: 'object', description: 'Unique identifier' }
  const uniqueConnect: SchemaObject = { type: 'object', description: 'Unique identifier to connect' }
  const uniqueDisconnect: SchemaObject = { type: 'object', description: 'Unique identifier to disconnect' }
  const uniqueDelete: SchemaObject = { type: 'object', description: 'Unique identifier to delete' }
  const whereFilter: SchemaObject = { type: 'object', description: 'Where filter' }
  const whereCreatePair: SchemaObject = {
    type: 'object',
    description: '{ where, create } pair',
    properties: { where: { type: 'object' }, create: { type: 'object' } },
  }
  const whereDataPair: SchemaObject = {
    type: 'object',
    description: '{ where, data } pair',
    properties: { where: { type: 'object' }, data: { type: 'object' } },
  }
  const whereCreateUpdateTriple: SchemaObject = {
    type: 'object',
    description: '{ where, create, update } triple',
    properties: {
      where: { type: 'object' },
      create: { type: 'object' },
      update: { type: 'object' },
    },
  }

  return {
    type: 'object',
    description: `Nested ${fieldType} write operations for list relation`,
    properties: {
      create: oneOrMany(createInput),
      connect: oneOrMany(uniqueConnect),
      connectOrCreate: oneOrMany(whereCreatePair),
      createMany: {
        type: 'object',
        properties: {
          data: { type: 'array', items: createInput },
          skipDuplicates: { type: 'boolean' },
        },
      },
      set: {
        type: 'array',
        items: uniqueId,
        description: 'Replace all connected records',
      },
      disconnect: oneOrMany(uniqueDisconnect),
      delete: oneOrMany(uniqueDelete),
      update: oneOrMany(whereDataPair),
      updateMany: oneOrMany(whereDataPair),
      deleteMany: oneOrMany(whereFilter),
      upsert: oneOrMany(whereCreateUpdateTriple),
    },
  }
}

function nestedSingleRelationOps(fieldType: string): SchemaObject {
  return {
    type: 'object',
    description: `Nested ${fieldType} write operations for single relation`,
    properties: {
      create: { type: 'object', description: `${fieldType} create input` },
      connect: { type: 'object', description: 'Unique identifier to connect' },
      connectOrCreate: {
        type: 'object',
        description: '{ where, create } pair',
        properties: { where: { type: 'object' }, create: { type: 'object' } },
      },
      disconnect: { type: 'boolean', description: 'Disconnect the related record' },
      delete: { type: 'boolean', description: 'Delete the related record' },
      update: { type: 'object', description: `${fieldType} update input` },
      upsert: {
        type: 'object',
        description: '{ create, update } pair — create if not exists, update if exists',
        properties: {
          create: { type: 'object', description: `${fieldType} create input` },
          update: { type: 'object', description: `${fieldType} update input` },
        },
      },
    },
  }
}

function mapFieldToWriteSchema(
  field: ModelField,
  mode: 'create' | 'update',
): SchemaObject | RefObject {
  if (field.kind === 'object') {
    return field.isList ? nestedListRelationOps(field.type) : nestedSingleRelationOps(field.type)
  }

  let baseSchema: SchemaObject | RefObject

  switch (field.kind) {
    case 'scalar':
      baseSchema = mapScalarType(field.type)
      break
    case 'enum':
      baseSchema = { $ref: `#/components/schemas/${field.type}` }
      break
    default:
      baseSchema = { type: 'string' }
  }

  let schema: SchemaObject | RefObject

  if (field.isList) {
    if (mode === 'update') {
      schema = listScalarUpdateOperations(baseSchema)
    } else {
      schema = { type: 'array', items: baseSchema }
    }
  } else if (mode === 'update') {
    schema = scalarUpdateOperations(baseSchema, field.type, field.kind)
  } else {
    schema = baseSchema
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
      ;(schema as SchemaObject).description = field.documentation
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