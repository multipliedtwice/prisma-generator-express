/**
 * Shared operation-contract / JSON Schema builder.
 *
 * One definition of what an operation's arguments look like, consumed by the
 * OpenAPI builder (POST-read request bodies) and the MCP tools (input
 * schemas). Neither consumer converts the other's output.
 */

export type OperationSchemaObject = {
  type?: string | string[]
  format?: string
  enum?: string[]
  items?: OperationSchemaObject
  properties?: Record<string, OperationSchemaObject>
  required?: string[]
  description?: string
  oneOf?: OperationSchemaObject[]
  anyOf?: OperationSchemaObject[]
  nullable?: boolean
  maxItems?: number
  minimum?: number
  maximum?: number
  minItems?: number
  minProperties?: number
  pattern?: string
  const?: true
  additionalProperties?: boolean | OperationSchemaObject
}

const WHERE_PROP: OperationSchemaObject = {
  type: 'object',
  description: 'Filter conditions',
}
const TAKE_PROP: OperationSchemaObject = {
  type: 'integer',
  description: 'Limit results',
}
const SKIP_PROP: OperationSchemaObject = {
  type: 'integer',
  description: 'Skip results',
}
const CURSOR_PROP: OperationSchemaObject = {
  type: 'object',
  description: 'Cursor for pagination',
}
const ORDERBY_PROP: OperationSchemaObject = {
  description: 'Sort order (object or array of objects)',
}
const SELECT_PROP: OperationSchemaObject = {
  type: 'object',
  description: 'Select fields',
}
const INCLUDE_PROP: OperationSchemaObject = {
  type: 'object',
  description: 'Include relations',
}
const OMIT_PROP: OperationSchemaObject = {
  type: 'object',
  description: 'Omit fields from response',
}
const DISTINCT_PROP: OperationSchemaObject = {
  description: 'Distinct fields (string or array of strings)',
}
const AGG_COUNT: OperationSchemaObject = {
  description: 'Count aggregate (true or field selection object)',
}
const AGG_AVG: OperationSchemaObject = {
  type: 'object',
  description: 'Average aggregate (field selection object)',
}
const AGG_SUM: OperationSchemaObject = {
  type: 'object',
  description: 'Sum aggregate (field selection object)',
}
const AGG_MIN: OperationSchemaObject = {
  type: 'object',
  description: 'Min aggregate (field selection object)',
}
const AGG_MAX: OperationSchemaObject = {
  type: 'object',
  description: 'Max aggregate (field selection object)',
}

const PROJECTION_PROPS: Record<string, OperationSchemaObject> = {
  select: SELECT_PROP,
  include: INCLUDE_PROP,
  omit: OMIT_PROP,
}

const AGGREGATE_PROPS: Record<string, OperationSchemaObject> = {
  _count: AGG_COUNT,
  _avg: AGG_AVG,
  _sum: AGG_SUM,
  _min: AGG_MIN,
  _max: AGG_MAX,
}

/** Argument keys every read operation may accept, by operation name. */
export const READ_OPERATION_ARG_KEYS: Record<string, readonly string[]> = {
  findMany: [
    'where',
    'select',
    'include',
    'omit',
    'orderBy',
    'cursor',
    'take',
    'skip',
    'distinct',
  ],
  findUnique: ['where', 'select', 'include', 'omit'],
  findFirst: [
    'where',
    'select',
    'include',
    'omit',
    'orderBy',
    'cursor',
    'take',
    'skip',
    'distinct',
  ],
  count: ['where', 'orderBy', 'cursor', 'take', 'skip', 'select'],
  findManyPaginated: [
    'where',
    'select',
    'include',
    'omit',
    'orderBy',
    'cursor',
    'take',
    'skip',
    'distinct',
  ],
}

function findManyBodySchema(): OperationSchemaObject {
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

function findUniqueBodySchema(): OperationSchemaObject {
  return {
    type: 'object',
    properties: {
      where: { type: 'object', description: 'Unique selector' },
      ...PROJECTION_PROPS,
    },
    required: ['where'],
  }
}

function countBodySchema(): OperationSchemaObject {
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

function aggregateBodySchema(): OperationSchemaObject {
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

function groupByBodySchema(): OperationSchemaObject {
  return {
    type: 'object',
    properties: {
      by: {
        type: 'array',
        items: { type: 'string' },
        description: 'Fields to group by',
      },
      where: WHERE_PROP,
      orderBy: {
        description: 'Sort order. Required when using skip or take.',
      },
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

const POST_READ_BODY_SCHEMAS: Record<string, () => OperationSchemaObject> = {
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

export function getPostReadBodySchema(opName: string): OperationSchemaObject {
  return (POST_READ_BODY_SCHEMAS[opName] ?? findManyBodySchema)()
}

/**
 * The JSON Schema for one read operation's arguments — the same contract for
 * OpenAPI POST-read bodies and MCP tool inputs.
 */
export function buildOperationArgsSchema(
  opName: string,
): OperationSchemaObject {
  return getPostReadBodySchema(opName)
}

// ---------------------------------------------------------------------------
// Model-aware schemas (MCP). The same contract source as the generic bodies
// above, narrowed with real model metadata: declared fields only, recursive
// over the static guard shape's select/include trees, additionalProperties
// false everywhere the set of keys is enumerated.
// ---------------------------------------------------------------------------

export type SchemaFieldMeta = {
  name: string
  kind: string
  type: string
  isList: boolean
  isRequired: boolean
  isId?: boolean
  isUnique?: boolean
  isUpdatedAt?: boolean
  /** Prisma @default / autoincrement — drives create-mode requiredness. */
  hasDefaultValue?: boolean
  documentation?: string | null
}

export type SchemaModelMeta = {
  /** Model name; used in schema descriptions. */
  name: string
  fields: readonly SchemaFieldMeta[]
  enums: ReadonlyMap<string, readonly string[]>
  /** Unique field names (id/unique columns), for unique-selector schemas. */
  uniqueFields: readonly string[]
  /**
   * Compound unique constraints. `selector` is the client-input key
   * (fields joined with '_'); `fields` are the constraint columns.
   */
  compoundUniques: ReadonlyArray<{
    selector: string
    fields: readonly string[]
  }>
  /** Related models by name, for recursion into select/include shapes. */
  modelIndex: ReadonlyMap<string, SchemaModelMeta>
}

const SCALAR_JSON: Record<string, OperationSchemaObject> = {
  String: { type: 'string' },
  Int: { type: 'integer' },
  // guard accepts: safe-range integers and /^-?\d+$/ strings for BigInt;
  // numbers and decimal-pattern strings for Decimal (verified runtime)
  BigInt: {
    anyOf: [
      {
        type: 'integer',
        minimum: -9007199254740991,
        maximum: 9007199254740991,
      },
      { type: 'string', pattern: '^-?[0-9]+$' },
    ],
  },
  Float: { type: 'number' },
  Decimal: {
    anyOf: [
      { type: 'number' },
      {
        type: 'string',
        pattern: '^-?([0-9]+[.]?[0-9]*|[.][0-9]+)([eE][+-]?[0-9]+)?$',
      },
    ],
  },
  Boolean: { type: 'boolean' },
  DateTime: { type: 'string', format: 'date-time' },
  Json: { description: 'Arbitrary JSON value' },
  Bytes: {
    type: 'string',
    description: 'Binary data serialized as base64 string',
  },
}

const MAX_PROJECTION_DEPTH = 4
/** Shared budget for combinator and relation recursion in where schemas. */
const MAX_WHERE_DEPTH = 3

const ORDERED_FIELD_TYPES = [
  'Int',
  'Float',
  'DateTime',
  'BigInt',
  'Decimal',
  // guard accepts ordered comparisons on String too (verified runtime)
  'String',
]
const STRING_SEARCH_OPS = ['contains', 'startsWith', 'endsWith'] as const
const LIST_FILTER_OPS = ['has', 'hasSome', 'hasEvery', 'isEmpty'] as const
const JSON_FILTER_OPS = [
  'string_contains',
  'string_starts_with',
  'string_ends_with',
  'path',
  'array_contains',
  'array_starts_with',
  'array_ends_with',
] as const
const MODE_VALUES = ['default', 'insensitive'] as const

function enumSchema(
  meta: SchemaModelMeta,
  typeName: string,
): OperationSchemaObject {
  const values = meta.enums.get(typeName)
  if (values) return { type: 'string', enum: [...values] }
  return { type: 'string' }
}

function scalarBaseSchema(
  meta: SchemaModelMeta,
  field: SchemaFieldMeta,
): OperationSchemaObject {
  // the single-item form first; list fields wrap it in an array (guard:
  // createBaseType builds the item base, then z.array for isList)
  const single: OperationSchemaObject =
    field.kind === 'enum'
      ? enumSchema(meta, field.type)
      : (SCALAR_JSON[field.type] ?? { type: 'string' })
  return field.isList ? { type: 'array', items: single } : single
}

/**
 * Operators guard 1.33 supports for one field (verified against the
 * runtime): scalar lists expose ONLY has/hasSome/hasEvery/isEmpty/equals;
 * Json exposes equals/not; enums expose no string search and no ordered
 * comparisons; `mode` rides along with String search/equality operators.
 */
export function allowedFilterOperators(
  field: SchemaFieldMeta,
): readonly string[] {
  if (field.kind !== 'scalar' && field.kind !== 'enum') return []
  // list membership comes FIRST (guard: getSupportedOperators checks
  // isList before type) — Bytes[] exposes has/hasSome/hasEvery/isEmpty/
  // equals even though scalar Bytes has no where filters at all
  if (field.isList) {
    return [...LIST_FILTER_OPS, 'equals']
  }
  if (field.type === 'Bytes') {
    // guard: "Bytes field cannot be used in where filters" — no operators
    return []
  }
  const ops = ['equals', 'not', 'in', 'notIn']
  // guard ENUM_OPERATORS = equals/not/in/notIn (verified with isEnum: true)
  if (field.kind === 'enum') return ops
  if (field.type === 'Json') return ['equals', 'not', ...JSON_FILTER_OPS]
  if (field.type === 'String') {
    ops.push(...STRING_SEARCH_OPS, 'search', 'mode')
  }
  if (ORDERED_FIELD_TYPES.includes(field.type)) {
    ops.push('lt', 'lte', 'gt', 'gte')
  }
  return ops
}

/** Filter-object surface for one field (verified guard 1.33 forms). */
function filterOperatorsSchema(
  meta: SchemaModelMeta,
  field: SchemaFieldMeta,
): Record<string, OperationSchemaObject> {
  const base = scalarBaseSchema(meta, field)
  if (field.kind !== 'scalar' && field.kind !== 'enum') return {}
  const item = base.items ?? base
  if (field.isList) {
    // scalar lists: has/hasSome/hasEvery take ITEM values, isEmpty a
    // boolean, equals an array of items; in/notIn/not/search ops are
    // unsupported (verified runtime)
    return {
      equals: field.isRequired ? base : { anyOf: [base, { type: 'null' }] },
      has: field.isRequired ? item : { anyOf: [item, { type: 'null' }] },
      hasSome: { type: 'array', items: item },
      hasEvery: { type: 'array', items: item },
      isEmpty: { type: 'boolean' },
    }
  }
  const coercing = ['String', 'Int', 'Float'].includes(field.type)
  const coerced = coercing ? coercionSchema(field.type, base) : base
  // null rides along ONLY where guard wraps nullableIfOptional: equals/not
  // values and in/notIn ITEMS, and only on OPTIONAL fields (source-verified)
  const nullable = (node: OperationSchemaObject): OperationSchemaObject =>
    field.isRequired ? node : { anyOf: [node, { type: 'null' }] }
  const operators: Record<string, OperationSchemaObject> = {
    equals: nullable(coerced),
    in: { type: 'array', items: nullable(coerced) },
    notIn: { type: 'array', items: nullable(coerced) },
  }
  if (coercing) {
    operators.lt = coerced
    operators.lte = coerced
    operators.gt = coerced
    operators.gte = coerced
  }
  if (field.type === 'String') {
    // guard coerces search-operator inputs too (verified: contains 5)
    const searchNode = coercionSchema('String', { type: 'string' })
    for (const op of STRING_SEARCH_OPS) operators[op] = searchNode
    operators.search = searchNode
  }
  if (field.type === 'Json') {
    operators.string_contains = { type: 'string' }
    operators.string_starts_with = { type: 'string' }
    operators.string_ends_with = { type: 'string' }
    // path: a NON-EMPTY array of string segments (verified: empty arrays,
    // mixed elements and bare strings are all guard-rejected)
    operators.path = {
      type: 'array',
      items: { type: 'string' },
      minItems: 1,
    }
    // array_* ops accept arbitrary JSON values, not just arrays (verified)
    operators.array_contains = { description: 'JSON value' }
    operators.array_starts_with = { description: 'JSON value' }
    operators.array_ends_with = { description: 'JSON value' }
  }
  if (
    !coercing &&
    field.kind === 'scalar' &&
    ORDERED_FIELD_TYPES.includes(field.type)
  ) {
    operators.lt = base
    operators.lte = base
    operators.gt = base
    operators.gte = base
  }
  // `not` accepts a scalar (nullable if optional) or a nested filter
  // object over EVERY other supported operator (guard: buildNotFilterSchema);
  // the nested properties are a SHALLOW COPY so the node never references
  // itself
  if (allowedFilterOperators(field).includes('not')) {
    operators.not = {
      anyOf: [
        nullable(coerced),
        {
          type: 'object',
          properties: { ...operators },
          additionalProperties: false,
          minProperties: 1,
        },
      ],
    }
  }
  return operators
}

/**
 * Guard coerces String/Int/Float operator inputs (verified source:
 * wrapWithInputCoercion) — String accepts numbers, Int accepts /^-?\d+$/
 * strings, Float accepts numeric strings. The emitted schema mirrors it.
 */
function coercionSchema(
  type: string,
  base: OperationSchemaObject,
): OperationSchemaObject {
  if (type === 'String') {
    return { anyOf: [base, { type: 'number' }] }
  }
  if (type === 'Int') {
    return { anyOf: [base, { type: 'string', pattern: '^-?[0-9]+$' }] }
  }
  return {
    anyOf: [
      base,
      {
        type: 'string',
        pattern: '^-?([0-9]+[.]?[0-9]*|[.][0-9]+)([eE][+-]?[0-9]+)?$',
      },
    ],
  }
}

/**
 * The `mode` sibling, from the shape's own config: `mode: true` is
 * client-controlled (advertised as the enum); a literal value is forced
 * (guard injects it server-side and REJECTS a client-sent mode) and is
 * never advertised. Null = no mode in the schema.
 */
function configuredModeSchema(
  modeVal: unknown,
  hasStringOp: boolean,
): OperationSchemaObject | null {
  if (!hasStringOp) return null
  // no config or `mode: true`: client-controlled (guard accepts a client
  // mode beside any configured String operator); a literal value is forced
  // (guard injects it and REJECTS a client-sent mode) and never advertised
  if (modeVal === undefined || modeVal === true) {
    return { type: 'string', enum: [...MODE_VALUES] }
  }
  return null
}

function scalarFilterSchema(
  meta: SchemaModelMeta,
  field: SchemaFieldMeta,
): OperationSchemaObject {
  const base = scalarBaseSchema(meta, field)
  const operators = filterOperatorsSchema(meta, field)
  if (field.type === 'String') {
    operators.mode = { type: 'string', enum: [...MODE_VALUES] }
  }
  return {
    anyOf: [
      base,
      {
        type: 'object',
        properties: operators,
        additionalProperties: false,
        minProperties: 1,
      },
    ],
  }
}

/**
 * The filter object accepted UNDER `not`: every operator key, never `mode`
 * (guard rejects mode inside not) and never a nested `not`.
 */
function nestedNotFilterSchema(
  meta: SchemaModelMeta,
  field: SchemaFieldMeta,
): OperationSchemaObject {
  const {
    not: _not,
    mode: _mode,
    ...operators
  } = filterOperatorsSchema(meta, field)
  return {
    type: 'object',
    properties: operators,
    additionalProperties: false,
    minProperties: 1,
  }
}

const WHERE_COMBINATORS = new Set(['AND', 'OR', 'NOT'])

function takeSchema(max: number | undefined): OperationSchemaObject {
  return {
    type: 'integer',
    minimum: 1,
    ...(max !== undefined ? { maximum: max } : {}),
    description:
      'Limit results (positive integer)' +
      (max !== undefined ? '; at most ' + max : ''),
  }
}

/**
 * Whether a shape subtree carries CLIENT-CONTROLLED input (some operator
 * configured with exactly `true`) and whether it carries server-owned
 * values (literals or force() wrappers). Guard 1.33 accepts an empty
 * condition whenever at least one forced leaf participates (it merges
 * them), and requires at least one operator only when every leaf is
 * client-controlled.
 */
function scanShapeClientState(
  val: unknown,
  acc: { client: boolean; forced: boolean } = { client: false, forced: false },
): { client: boolean; forced: boolean } {
  if (isForcedShapeValue(val)) {
    acc.forced = true
    return acc
  }
  if (!isShapeObject(val)) {
    if (val === true) acc.client = true
    else if (val !== undefined) acc.forced = true
    return acc
  }
  for (const v of Object.values(val)) scanShapeClientState(v, acc)
  return acc
}

/**
 * Where schema narrowed by the guard shape's OWN `where` value, recursively.
 * Scalar configs are operator objects (`{ contains: true }`) — a bare-`true`
 * scalar is guard-invalid and advertises nothing (registration flags it).
 * Relations recurse into the related model via the metadata index, and
 * AND/OR/NOT appear only when the shape configures them with an object.
 * `depth` bounds relation hops so nothing runs away.
 */
function whereSchema(
  meta: SchemaModelMeta,
  shapeWhere: unknown,
  depth: number = 4,
): OperationSchemaObject {
  if (!isShapeObject(shapeWhere)) {
    // shape has no usable where tree: advertise the model's declared
    // where-carrying surface without combinator gymnastics
    return whereAllFields(meta, depth)
  }
  const properties: Record<string, OperationSchemaObject> = {}

  for (const [key, val] of Object.entries(shapeWhere)) {
    if (WHERE_COMBINATORS.has(key)) {
      if (depth <= 0) continue
      // guard configures combinators with a NON-EMPTY OBJECT of fields;
      // `AND`/`OR` input is an ARRAY (minItems 1), `NOT` object or array;
      // every MEMBER must carry a condition unless the config is fully
      // forced (guard merges forced members and accepts `{}`)
      if (!isShapeObject(val) || Object.keys(val).length === 0) continue
      const node = whereSchema(meta, val, depth - 1)
      const state = scanShapeClientState(val)
      if (state.client && !state.forced) node.minProperties = 1
      properties[key] =
        key === 'NOT'
          ? {
              anyOf: [node, { type: 'array', items: node, minItems: 1 }],
            }
          : { type: 'array', items: node, minItems: 1 }
      continue
    }

    const field = meta.fields.find((f) => f.name === key)
    if (!field) continue

    if (field.kind === 'object') {
      const relatedMeta = meta.modelIndex.get(field.type)
      const nestedVal =
        isShapeObject(val) &&
        Object.keys(val).length > 0 &&
        !isForcedShapeValue(val)
          ? val
          : undefined
      if (field.isList) {
        // to-many: EXACTLY the operators the shape declares under
        // some/every/none — a shape with only `some` must not advertise
        // `every`/`none`, and vice versa
        const relationProps: Record<string, OperationSchemaObject> = {}
        if (nestedVal && relatedMeta && depth > 0) {
          for (const op of ['some', 'every', 'none'] as const) {
            const opShape = nestedVal[op]
            if (opShape === undefined) continue
            const inner = whereSchema(relatedMeta, opShape, depth - 1)
            // guard accepts an empty condition only when a forced leaf
            // participates; all-client configs demand at least one operator
            const state = scanShapeClientState(opShape)
            if (state.client && !state.forced) inner.minProperties = 1
            relationProps[op] = inner
          }
        }
        if (Object.keys(relationProps).length === 0) continue
        properties[key] = {
          type: 'object',
          properties: relationProps,
          additionalProperties: false,
          minProperties: 1,
        }
        continue
      }
      // to-one: prisma-guard 1.33 accepts ONLY is/isNot; a direct nested
      // where config without them is guard-internal, not client input
      if (!relatedMeta || depth <= 0) {
        properties[key] = {
          type: 'object',
          description: 'Relation filter over ' + field.type,
        }
        continue
      }
      const oneProps: Record<string, OperationSchemaObject> = {}
      const nestedCfg = nestedVal ?? {}
      for (const op of ['is', 'isNot'] as const) {
        if (nestedCfg[op] === undefined) continue
        // `is: null` (and isNot) is a legal forced config: clients send the
        // literal null; no nested properties are advertised
        if (nestedCfg[op] === null) {
          oneProps[op] = { type: 'null' }
          continue
        }
        const inner = whereSchema(relatedMeta, nestedCfg[op], depth - 1)
        const state = scanShapeClientState(nestedCfg[op])
        if (state.client && !state.forced) inner.minProperties = 1
        oneProps[op] = inner
      }
      if (Object.keys(oneProps).length === 0) continue
      // a client-controlled to-one condition must not be sent empty;
      // forced-only conditions are merged server-side and may be empty
      const wrapperMin =
        scanShapeClientState(nestedCfg).client &&
        !scanShapeClientState(nestedCfg).forced
          ? { minProperties: 1 }
          : {}
      properties[key] = {
        type: 'object',
        properties: oneProps,
        additionalProperties: false,
        ...wrapperMin,
      }
      continue
    }

    if (field.kind !== 'scalar' && field.kind !== 'enum') continue
    const narrowed = scalarWhereFromShape(meta, field, val)
    if (narrowed === null) continue
    properties[key] = narrowed
  }

  return {
    type: 'object',
    properties,
    additionalProperties: false,
  }
}

/**
 * One scalar field's where schema in FILTER context: only operator objects
 * are guard-valid here, only operator values of exactly `true` are
 * client-controlled, and the bare-scalar shortcut exists ONLY alongside
 * `equals: true`. Bare-`true` and literal configs are guard-invalid or
 * server-owned — nothing is advertised.
 */
function scalarWhereFromShape(
  meta: SchemaModelMeta,
  field: SchemaFieldMeta,
  val: unknown,
): OperationSchemaObject | null {
  const base = scalarBaseSchema(meta, field)

  // bare-`true` filter configs and shorthand values (literals, force()
  // wrappers) are guard-invalid in filter context — nothing is advertised;
  // registration refuses the config
  const cfg = isShapeObject(val) && !isForcedShapeValue(val) ? val : undefined
  if (!cfg || Object.keys(cfg).length === 0) return null

  const allowed = new Set(allowedFilterOperators(field))
  const table = filterOperatorsSchema(meta, field)
  const operators: Record<string, OperationSchemaObject> = {}
  let hasEqualsTrue = false
  for (const [op, opVal] of Object.entries(cfg)) {
    if (op === 'mode') continue // handled below from the configured value
    if (opVal !== true) continue // forced value — server-owned
    if (!allowed.has(op)) continue
    if (op === 'equals') hasEqualsTrue = true
    // the shared table already carries coercion, nullability and the
    // nested-`not` union exactly as guard builds them
    operators[op] = table[op]
  }
  if (Object.keys(operators).length === 0) return null // fully forced key

  // `mode` is a String-only sibling — never on enums or other scalars
  const hasStringOp =
    field.type === 'String' &&
    ['equals', ...STRING_SEARCH_OPS].some((op) => operators[op])
  const mode = configuredModeSchema(cfg.mode, hasStringOp)
  if (mode) operators.mode = mode

  const node: OperationSchemaObject = {
    type: 'object',
    properties: operators,
    additionalProperties: false,
    minProperties: 1,
  }
  // the bare-value shortcut exists only alongside client-controlled
  // `equals: true`; it shares the operator's coercion and optional-null
  // surface (guard: nullableIfOptional(coerced))
  if (!hasEqualsTrue) return node
  return {
    anyOf: [table.equals ?? base, node],
  }
}

function whereAllFields(
  meta: SchemaModelMeta,
  depth: number,
): OperationSchemaObject {
  const properties: Record<string, OperationSchemaObject> = {}
  for (const field of meta.fields) {
    if (field.kind === 'object') {
      const relatedMeta = meta.modelIndex.get(field.type)
      if (relatedMeta && depth > 0) {
        const inner = whereSchema(relatedMeta, {}, depth - 1)
        properties[field.name] = field.isList
          ? {
              type: 'object',
              properties: { some: inner, every: inner, none: inner },
              additionalProperties: false,
            }
          : {
              type: 'object',
              properties: { is: inner, isNot: inner },
              additionalProperties: false,
            }
      } else {
        properties[field.name] = {
          type: 'object',
          description: 'Relation filter over ' + field.type,
        }
      }
      continue
    }
    if (field.kind === 'scalar' || field.kind === 'enum') {
      properties[field.name] = scalarFilterSchema(meta, field)
    }
  }
  return {
    type: 'object',
    properties,
    additionalProperties: false,
  }
}

/**
 * One recursive orderBy builder for every model level. Scalar fields accept
 * `asc`/`desc` or `{ sort, nulls }`; a configured to-one relation orders by
 * its own fields, a configured to-many relation additionally by `_count`
 * (guard: `_count` orderBy config must be exactly `true`). Only keys the
 * shape declares are advertised.
 */
/** Guard orderBy surface: Json and list fields are unsortable (verified);
 * enums and Bytes are sortable. */
function isSortableField(field: SchemaFieldMeta): boolean {
  if (field.kind === 'enum') return true
  return field.kind === 'scalar' && !field.isList && field.type !== 'Json'
}

function orderBySchema(
  meta: SchemaModelMeta,
  shapeVal?: unknown,
  depth: number = 2,
): OperationSchemaObject {
  const shapeKeys = isShapeObject(shapeVal)
    ? new Set(Object.keys(shapeVal))
    : undefined
  const properties: Record<string, OperationSchemaObject> = {}
  for (const field of meta.fields) {
    if (shapeKeys && !shapeKeys.has(field.name)) continue
    if (field.kind === 'object' && depth > 0) {
      // to-many relations order ONLY by `_count` (guard: "To-many relation
      // orderBy only supports _count"); to-one relations order by fields
      if (field.isList) {
        const nestedShape = isShapeObject(shapeVal)
          ? isShapeObject(shapeVal[field.name])
            ? (shapeVal[field.name] as Record<string, unknown>)
            : undefined
          : undefined
        if (nestedShape?._count !== true) continue
        properties[field.name] = {
          type: 'object',
          properties: { _count: { type: 'string', enum: ['asc', 'desc'] } },
          additionalProperties: false,
          required: ['_count'],
        }
        continue
      }
      const relatedMeta = meta.modelIndex.get(field.type)
      if (!relatedMeta) continue
      const nestedShape = isShapeObject(shapeVal)
        ? isShapeObject(shapeVal[field.name])
          ? (shapeVal[field.name] as Record<string, unknown>)
          : undefined
        : undefined
      const nestedSingle = orderBySchema(relatedMeta, nestedShape, depth - 1)
        .anyOf?.[0]
      properties[field.name] = {
        type: 'object',
        properties: { ...nestedSingle?.properties },
        additionalProperties: false,
        minProperties: 1,
      }
      continue
    }
    if (!isSortableField(field)) continue
    properties[field.name] = {
      anyOf: [
        { type: 'string', enum: ['asc', 'desc'] },
        {
          type: 'object',
          properties: {
            sort: { type: 'string', enum: ['asc', 'desc'] },
            nulls: { type: 'string', enum: ['first', 'last'] },
          },
          additionalProperties: false,
          required: ['sort'],
        },
      ],
    }
  }
  const single = {
    type: 'object',
    properties,
    additionalProperties: false,
    minProperties: 1,
  }
  return { anyOf: [single, { type: 'array', items: single }] }
}

function distinctSchema(
  meta: SchemaModelMeta,
  shapeVal?: unknown,
): OperationSchemaObject {
  // narrowed to the distinct values the shape declares
  const shapeNames = Array.isArray(shapeVal)
    ? shapeVal.filter((v): v is string => typeof v === 'string')
    : typeof shapeVal === 'string'
      ? [shapeVal]
      : meta.fields
          .filter((f) => f.kind === 'scalar' || f.kind === 'enum')
          .map((f) => f.name)
  const names = shapeNames.filter((n) =>
    meta.fields.some(
      (f) => f.name === n && (f.kind === 'scalar' || f.kind === 'enum'),
    ),
  )
  return {
    anyOf: [
      { type: 'string', enum: names },
      { type: 'array', items: { type: 'string', enum: names }, minItems: 1 },
    ],
  }
}

const FORCED_MARKER = Symbol.for('prisma-guard.forced')

/** prisma-guard `force(x)` wrapper: the value is server-owned, never client input. */
function isForcedShapeValue(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as Record<PropertyKey, unknown>)[
      Symbol.for('prisma-guard.forced')
    ] === true
  )
}

/**
 * Whether a forced (literal or force()-wrapped) value matches the field's
 * type. Guard type-checks forced values inside compound selectors and
 * filter operators (verified runtime); flat unique literals are only
 * checked by Prisma at execution — refusing a mismatched one here is
 * fail-closed, never more permissive than guard.
 */
export function forcedValueMatchesField(
  meta: SchemaModelMeta,
  field: SchemaFieldMeta,
  value: unknown,
): boolean {
  const v = isForcedShapeValue(value)
    ? (value as { value: unknown }).value
    : value
  // guard rejects null unique-selector values ("Unique field ... cannot be
  // null"); Json accepts anything (verified)
  if (v === null || v === undefined) return field.type === 'Json'
  if (field.kind === 'enum') {
    const values = meta.enums.get(field.type)
    return !values || values.includes(v as string)
  }
  if (field.kind !== 'scalar') return true
  if (field.isList) return Array.isArray(v)
  switch (field.type) {
    case 'String':
    case 'DateTime':
    case 'Bytes':
      return typeof v === 'string'
    case 'BigInt':
      // safe-range integer or /^-?\d+$/ string (leading zeros allowed —
      // verified: '007' is accepted)
      return (
        (typeof v === 'number' &&
          Number.isInteger(v) &&
          v >= -9007199254740991 &&
          v <= 9007199254740991) ||
        (typeof v === 'string' && /^-?[0-9]+$/.test(v))
      )
    case 'Decimal':
      // number or decimal-pattern string (verified)
      return (
        typeof v === 'number' ||
        (typeof v === 'string' &&
          /^-?([0-9]+[.]?[0-9]*|[.][0-9]+)([eE][+-]?[0-9]+)?$/.test(v))
      )
    case 'Int':
      return typeof v === 'number' && Number.isInteger(v)
    case 'Float':
      return typeof v === 'number'
    case 'Boolean':
      return typeof v === 'boolean'
    default:
      return true // Json and unknown types accept any forced value
  }
}

/**
 * Whether a forced operator VALUE matches guard's per-operator schema
 * (verified runtime): comparison operators take the field's scalar, `in`
 * takes an array (elements are not element-type-checked by guard), list
 * operators take item values, `isEmpty` a boolean, Json path/array ops
 * arrays, and `mode` never reaches here.
 */
export function forcedOperatorValueMatches(
  meta: SchemaModelMeta,
  field: SchemaFieldMeta,
  op: string,
  value: unknown,
): boolean {
  const v = isForcedShapeValue(value)
    ? (value as { value: unknown }).value
    : value
  // null is legal ONLY for `equals`/`not` (and list `has`/`equals`) on
  // OPTIONAL fields — every other operator rejects null outright, even on
  // optional fields (source-verified: nullableIfOptional wraps only those)
  if (v === null || v === undefined) {
    // LIST null rules first — the whole equals/has value may be null only
    // on optional fields; a Json[] list is z.array(itemBase), NOT
    // z.unknown, so required Json[] equals:null is rejected
    if (field.isList) {
      return (op === 'equals' || op === 'has') && !field.isRequired
    }
    if (op === 'equals' || op === 'not') {
      return field.type === 'Json' || !field.isRequired
    }
    // Json array_* operators are z.unknown() — null accepted even on
    // required fields (verified); string_/path operators reject it
    if (
      field.type === 'Json' &&
      (op === 'array_contains' ||
        op === 'array_starts_with' ||
        op === 'array_ends_with')
    ) {
      return true
    }
    return false
  }
  // nested `not`: a filter object over supported operators (excluding
  // `not` and `mode`) with plain coerced values — guard validates the
  // exact operator set and rejects unknown names and empty objects
  if (op === 'not' && isShapeObject(v) && !isForcedShapeValue(v)) {
    return nestedNotValueMatches(meta, field, v)
  }
  return plainOperatorValueMatches(meta, field, op, v)
}

function nestedNotValueMatches(
  meta: SchemaModelMeta,
  field: SchemaFieldMeta,
  obj: Record<string, unknown>,
): boolean {
  const entries = Object.entries(obj)
  if (entries.length === 0) return false // "not filter must specify at least one operator"
  const allowed = allowedFilterOperators(field).filter(
    (op) => op !== 'not' && op !== 'mode',
  )
  for (const [nop, nval] of entries) {
    if (!allowed.includes(nop)) return false
    if (isShapeObject(nval) || isForcedShapeValue(nval)) return false
    if (nval === null) {
      // nested `equals` alone accepts null on optional fields (verified);
      // nested search/ordered operators reject it — keep validating the
      // remaining entries either way
      if (!(nop === 'equals' && (field.type === 'Json' || !field.isRequired))) {
        return false
      }
      continue
    }
    if (!plainOperatorValueMatches(meta, field, nop, nval)) return false
  }
  return true
}

/**
 * Guard's input coercion (verified source + runtime): String accepts
 * numbers, Int accepts /^-?\d+$/ strings, Float accepts numeric strings;
 * every other type keeps its base form.
 */
function coercedScalarMatches(field: SchemaFieldMeta, x: unknown): boolean {
  switch (field.type) {
    case 'String':
      return typeof x === 'string' || typeof x === 'number'
    case 'Int':
      return (
        (typeof x === 'number' && Number.isInteger(x)) ||
        (typeof x === 'string' && /^-?\d+$/.test(x))
      )
    case 'Float':
      return (
        typeof x === 'number' ||
        (typeof x === 'string' &&
          /^-?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(x))
      )
    default:
      return true
  }
}

function plainOperatorValueMatches(
  meta: SchemaModelMeta,
  field: SchemaFieldMeta,
  op: string,
  x: unknown,
): boolean {
  // list operators come first and cover EVERY list field (scalar and
  // enum — guard: getSupportedOperators branches on isList before type):
  // items are the PLAIN item types — no coercion, and NEVER null items
  // (guard: z.array(itemBase) without nullableIfOptional on items; only
  // the WHOLE value may be null on optional fields)
  if (field.isList) {
    const itemOk = (e: unknown): boolean =>
      field.kind === 'enum'
        ? enumMember(meta, field, e)
        : itemValueMatches(field.type, e)
    switch (op) {
      case 'equals':
        return Array.isArray(x) && x.every(itemOk)
      case 'has':
        return x === null ? !field.isRequired : itemOk(x)
      case 'hasSome':
      case 'hasEvery':
        return Array.isArray(x) && x.every(itemOk)
      case 'isEmpty':
        return typeof x === 'boolean'
      default:
        return false
    }
  }
  if (field.kind === 'enum') {
    if (op === 'in' || op === 'notIn') {
      // items are nullableIfOptional(enum) — null rides along only on
      // optional fields (verified)
      return (
        Array.isArray(x) &&
        x.every((e) =>
          e === null ? !field.isRequired : enumMember(meta, field, e),
        )
      )
    }
    return enumMember(meta, field, x)
  }
  if (field.kind !== 'scalar') return true
  const coercing = ['String', 'Int', 'Float'].includes(field.type)
  switch (op) {
    case 'equals':
    case 'not':
    case 'lt':
    case 'lte':
    case 'gt':
    case 'gte':
      // coerced types accept their coerced forms (verified: Int "2")
      if (coercing) return coercedScalarMatches(field, x)
      return forcedValueMatchesField(meta, field, x)
    case 'in':
    case 'notIn': {
      if (!Array.isArray(x)) return false
      const itemOk = (e: unknown): boolean => {
        if (e === null) return !field.isRequired
        if (isShapeObject(e) || isForcedShapeValue(e)) return false
        if (coercing) return coercedScalarMatches(field, e)
        return itemValueMatches(field.type, e)
      }
      return x.every(itemOk)
    }
    case 'contains':
    case 'startsWith':
    case 'endsWith':
    case 'search':
      return field.type === 'String' && coercedScalarMatches(field, x)
    case 'mode':
      return false // handled by the mode-specific config rules
    case 'string_contains':
    case 'string_starts_with':
    case 'string_ends_with':
      return field.type === 'Json' && typeof x === 'string'
    case 'path':
      // non-empty array of string segments (verified)
      return (
        field.type === 'Json' &&
        Array.isArray(x) &&
        x.length > 0 &&
        x.every((e) => typeof e === 'string')
      )
    case 'array_contains':
    case 'array_starts_with':
    case 'array_ends_with':
      // arbitrary JSON values (verified)
      return field.type === 'Json'
    default:
      return true
  }
}

function enumMember(
  meta: SchemaModelMeta,
  field: SchemaFieldMeta,
  v: unknown,
): boolean {
  const values = meta.enums.get(field.type)
  return !values || values.includes(v as string)
}

function itemValueMatches(type: string, v: unknown): boolean {
  switch (type) {
    case 'Int':
      return typeof v === 'number' && Number.isInteger(v)
    case 'Float':
      return typeof v === 'number'
    case 'Boolean':
      return typeof v === 'boolean'
    case 'String':
    case 'DateTime':
    case 'Bytes':
      return typeof v === 'string'
    case 'BigInt':
      return (
        (typeof v === 'number' &&
          Number.isInteger(v) &&
          v >= -9007199254740991 &&
          v <= 9007199254740991) ||
        (typeof v === 'string' && /^-?[0-9]+$/.test(v))
      )
    case 'Decimal':
      return (
        typeof v === 'number' ||
        (typeof v === 'string' &&
          /^-?([0-9]+[.]?[0-9]*|[.][0-9]+)([eE][+-]?[0-9]+)?$/.test(v))
      )
    default:
      return true
  }
}

/**
 * Whether a findUnique/findUniqueOrThrow shape's `where` config is
 * guard-valid. Guard 1.33 rejects (or crashes on) anything else, so the
 * MCP runtime refuses to register a tool exposing such a shape:
 *  - `where` must be a non-empty object (missing / empty / `where: true`
 *    are all guard-invalid),
 *  - at least one key must be a flat unique field or a compound selector
 *    key; other scalar keys ride along as extended unique filters (guard
 *    buildUniqueWhereSchema accepts them — the tenant-safe
 *    `{ id: true, siteId: force(t) }` form); relations are invalid,
 *  - a flat field is configured with exactly `true`, a literal or a
 *    force() wrapper — never filter operators,
 *  - a compound selector is configured with an object carrying EVERY
 *    constraint field (guard: "Missing field ... in compound unique
 *    selector"), each `true`, a literal or a force() wrapper.
 * Forced values are type-checked (see forcedValueMatchesField).
 * Returns null when the config is valid, else the problem description.
 */
export function findUniqueWhereConfigProblem(
  meta: SchemaModelMeta,
  shapeWhere: unknown,
): string | null {
  if (!isShapeObject(shapeWhere)) {
    return 'findUnique where must be an object of unique-field configs'
  }
  const keys = Object.keys(shapeWhere)
  if (keys.length === 0) {
    return 'findUnique where must cover at least one unique constraint'
  }
  let covered = false
  for (const [key, val] of Object.entries(shapeWhere)) {
    const constraint = meta.compoundUniques.find((c) => c.selector === key)
    if (constraint) {
      covered = true
      if (!isShapeObject(val) || isForcedShapeValue(val)) {
        return `compound selector "${key}" must be configured with an object of field configs`
      }
      for (const fk of constraint.fields) {
        if (!(fk in val)) {
          return `compound selector "${key}" is missing field "${fk}"`
        }
      }
      for (const [fk, fv] of Object.entries(val)) {
        if (!constraint.fields.includes(fk)) {
          return `unknown field "${fk}" in compound selector "${key}"`
        }
        if (isShapeObject(fv) && !isForcedShapeValue(fv)) {
          return `compound selector field "${key}.${fk}" accepts only true or a forced value, not filter operators`
        }
        const fkField = fieldByName(meta, fk)
        if (
          fv !== true &&
          !forcedValueMatchesField(meta, fkField ?? scalarGuess(fk), fv)
        ) {
          return `forced value for "${key}.${fk}" does not match the field type`
        }
      }
      continue
    }
    const flatUnique =
      meta.uniqueFields.includes(key) &&
      meta.fields.some((f) => f.name === key && (f.isId || f.isUnique))
    const keyField = fieldByName(meta, key)
    if (!flatUnique) {
      // extended unique where (Prisma 5+, guard buildUniqueWhereSchema): a
      // NON-unique scalar may ride beside a covering selector — the
      // tenant-safe `{ id: true, siteId: force(tenant) }` form. Relations
      // and unknown keys are guard-invalid.
      if (
        !keyField ||
        (keyField.kind !== 'scalar' && keyField.kind !== 'enum')
      ) {
        return `"${key}" is not a scalar field or compound selector of ${meta.name}`
      }
      if (isShapeObject(val) && !isForcedShapeValue(val)) {
        return `unique where "${key}" accepts only true or a forced value, not filter operators`
      }
      // guard parses it as a direct scalar with input coercion, nullable
      // on optional fields — the same parse as forced data values
      if (val !== true && !forcedDataValueMatches(meta, keyField, val)) {
        return `forced value for "${key}" does not match the field type`
      }
      continue
    }
    covered = true
    if (isShapeObject(val) && !isForcedShapeValue(val)) {
      return `unique where "${key}" accepts only true or a forced value, not filter operators`
    }
    if (
      val !== true &&
      keyField &&
      !forcedValueMatchesField(meta, keyField, val)
    ) {
      return `forced value for "${key}" does not match the field type`
    }
  }
  if (!covered) {
    return `unique where must cover a unique constraint of ${meta.name} (a unique field or compound selector)`
  }
  return null
}

function fieldByName(
  meta: SchemaModelMeta,
  name: string,
): SchemaFieldMeta | undefined {
  return meta.fields.find((f) => f.name === name)
}

/** Fallback meta for constraint fields missing from the model metadata. */
function scalarGuess(name: string): SchemaFieldMeta {
  return {
    name,
    kind: 'scalar',
    type: 'String',
    isList: false,
    isRequired: true,
  }
}

/**
 * Whether a FILTER-context where config is guard-valid (verified against
 * the 1.33 runtime): operator objects with known per-type operators, no
 * shorthand values, non-empty configs everywhere, some/every/none on
 * to-many relations and is/isNot on to-one relations only, and NO forced
 * values under the negating operators `none`/`isNot` (guard: "mixes
 * client-controlled and forced" even when the config is forced-only).
 * Returns null when valid, else the problem description.
 */
export function filterWhereConfigProblem(
  meta: SchemaModelMeta,
  shapeWhere: unknown,
  negated: boolean = false,
): string | null {
  if (!isShapeObject(shapeWhere)) {
    return 'where config must be an object'
  }
  if (Object.keys(shapeWhere).length === 0) {
    return 'where config must define at least one field'
  }
  for (const [key, val] of Object.entries(shapeWhere)) {
    if (WHERE_COMBINATORS.has(key)) {
      if (!isShapeObject(val) || Object.keys(val).length === 0) {
        return `combinator "${key}" must be configured with a non-empty object of fields`
      }
      const nested = filterWhereConfigProblem(meta, val)
      if (nested) return nested
      continue
    }
    const field = meta.fields.find((f) => f.name === key)
    if (!field) return `"${key}" is not a field of ${meta.name}`
    if (field.kind === 'object') {
      if (!isShapeObject(val) || isForcedShapeValue(val)) {
        return `relation "${key}" must be configured with an object`
      }
      if (Object.keys(val).length === 0) {
        return `relation "${key}" must define at least one operator`
      }
      const relatedMeta = meta.modelIndex.get(field.type)
      if (!relatedMeta) continue
      if (field.isList) {
        for (const k of Object.keys(val)) {
          if (k !== 'some' && k !== 'every' && k !== 'none') {
            return `to-many relation "${key}" accepts only some/every/none, not "${k}"`
          }
        }
        for (const op of ['some', 'every', 'none'] as const) {
          const opVal = val[op]
          if (opVal === undefined) continue
          if (!isShapeObject(opVal) || Object.keys(opVal).length === 0) {
            return `relation operator "${key}.${op}" must define at least one operator config`
          }
          const nested = filterWhereConfigProblem(
            relatedMeta,
            opVal,
            negated || op === 'none',
          )
          if (nested) return nested
        }
      } else {
        for (const k of Object.keys(val)) {
          if (k !== 'is' && k !== 'isNot') {
            return `to-one relation "${key}" accepts only is/isNot, not "${k}"`
          }
        }
        for (const op of ['is', 'isNot'] as const) {
          const opVal = val[op]
          if (opVal === undefined) continue
          // `is: null` / `isNot: null` are legal forced configs
          if (opVal === null) continue
          if (!isShapeObject(opVal) || Object.keys(opVal).length === 0) {
            return `relation operator "${key}.${op}" must define at least one operator config`
          }
          const nested = filterWhereConfigProblem(
            relatedMeta,
            opVal,
            negated || op === 'isNot',
          )
          if (nested) return nested
        }
      }
      continue
    }
    if (field.kind !== 'scalar' && field.kind !== 'enum') continue
    if (negated && isForcedShapeValue(val)) {
      return `"${key}" under a negating operator (none/isNot) cannot carry forced values`
    }
    if (!isShapeObject(val) || isForcedShapeValue(val)) {
      return `filter "${key}" must be configured with an object of operators`
    }
    if (Object.keys(val).length === 0) {
      return `filter "${key}" must configure at least one operator`
    }
    const allowed = allowedFilterOperators(field)
    const opKeys = Object.keys(val).filter((k) => k !== 'mode')
    if (opKeys.length === 0) {
      return `filter "${key}" configures only "mode" but no operator`
    }
    for (const [op, opVal] of Object.entries(val)) {
      if (op === 'mode') {
        if (field.type !== 'String') {
          return `"mode" is only valid on String fields, not "${key}"`
        }
        if (negated && opVal !== true) {
          return `"mode" of "${key}" cannot be forced under a negating operator`
        }
        if (opVal !== true && opVal !== 'default' && opVal !== 'insensitive') {
          return `"mode" of "${key}" must be true, 'default' or 'insensitive'`
        }
        continue
      }
      if (!allowed.includes(op)) {
        return `operator "${op}" is not supported for ${field.kind === 'enum' ? 'enum' : field.type} field "${key}"`
      }
      if (opVal === true) continue
      if (negated) {
        return `"${key}" under a negating operator (none/isNot) cannot carry forced values`
      }
      // `not` also accepts a nested filter object of plain values; every
      // other operator takes true or a forced value
      if (isShapeObject(opVal) && !isForcedShapeValue(opVal) && op !== 'not') {
        return `operator "${op}" of "${key}" accepts only true or a forced value`
      }
      if (!forcedOperatorValueMatches(meta, field, op, opVal)) {
        return `forced value for "${key}.${op}" does not match the operator`
      }
    }
  }
  return null
}

/**
 * Shape-config keys guard 1.33 accepts per read operation (verified
 * runtime: "Arg X not allowed for method Y"). `omit` is NOT a shape key.
 */
const OP_SHAPE_KEYS: Record<string, readonly string[]> = {
  findMany: [
    'where',
    'orderBy',
    'distinct',
    'cursor',
    'take',
    'skip',
    'select',
    'include',
  ],
  findManyPaginated: [
    'where',
    'orderBy',
    'distinct',
    'cursor',
    'take',
    'skip',
    'select',
    'include',
  ],
  findFirst: [
    'where',
    'orderBy',
    'distinct',
    'cursor',
    'take',
    'skip',
    'select',
    'include',
  ],
  findUnique: ['where', 'select', 'include'],
  count: ['where', 'orderBy', 'select', 'take', 'cursor', 'skip'],
}

/**
 * Validates the COMPLETE static shape of one read operation the way
 * prisma-guard 1.33 compiles it (verified runtime): per-operation allowed
 * keys (unknown keys refused, `where` required for findUnique), where
 * (filter or unique-selector per operation), orderBy, distinct, cursor,
 * select, include, `_count` and the take/skip config forms. The full
 * config tree is validated — it is a finite literal, no depth cap.
 * Registration refuses a shape with any problem.
 * Returns null when valid, else the problem description.
 */
export function argsShapeConfigProblem(
  meta: SchemaModelMeta,
  operation: string,
  shape: unknown,
): string | null {
  if (!isShapeObject(shape)) return null // dynamic shape: checked per call
  const allowedKeys = OP_SHAPE_KEYS[operation]
  if (allowedKeys) {
    for (const key of Object.keys(shape)) {
      if (!allowedKeys.includes(key)) {
        return `"${key}" is not a valid shape config key for ${operation}`
      }
    }
  }
  if (operation === 'findUnique' || operation === 'findUniqueOrThrow') {
    if (shape.where === undefined) {
      return 'findUnique shape must define "where"'
    }
    const problem = findUniqueWhereConfigProblem(meta, shape.where)
    if (problem) return problem
  } else if (shape.where !== undefined) {
    const problem = filterWhereConfigProblem(meta, shape.where)
    if (problem) return problem
  }
  if (shape.orderBy !== undefined) {
    const problem = orderByConfigProblem(meta, shape.orderBy)
    if (problem) return problem
  }
  if (shape.distinct !== undefined) {
    const problem = distinctConfigProblem(meta, shape.distinct)
    if (problem) return problem
  }
  if (shape.cursor !== undefined) {
    const problem = cursorConfigProblem(meta, shape.cursor)
    if (problem) return problem
  }
  for (const key of ['select', 'include'] as const) {
    if (shape[key] === undefined) continue
    if (operation === 'count' && key === 'select') {
      // count select is a COUNT-FIELD selection: `_all` plus scalars —
      // no relations (guard: verified). The generic projection validator
      // would reject the legal `_all` key.
      const problem = countFieldSelectConfigProblem(meta, shape.select)
      if (problem) return problem
      continue
    }
    const problem = projectionConfigProblem(meta, shape[key], key)
    if (problem) return problem
  }
  if (shape.take !== undefined) {
    const problem = takeConfigProblem(shape.take)
    if (problem) return problem
  }
  if (shape.skip !== undefined && shape.skip !== true) {
    return 'skip config must be true'
  }
  return null
}

// ---------------------------------------------------------------------------
// Write operations (create / update / upsert / delete). The config validators
// mirror prisma-guard 1.33 buildDataSchema + the unique-where mutation path
// (source-read and runtime-verified): per-operation allowed shape keys, data
// configs of true / literal / force() (never relation writes or inline
// refines for MCP), and unique-selector wheres for update/upsert/delete.
// ---------------------------------------------------------------------------

const WRITE_OP_SHAPE_KEYS: Record<string, readonly string[]> = {
  create: ['data', 'select', 'include'],
  createMany: ['data'],
  createManyAndReturn: ['data', 'select', 'include'],
  update: ['where', 'data', 'select', 'include'],
  updateMany: ['where', 'data'],
  updateManyAndReturn: ['where', 'data', 'select', 'include'],
  upsert: ['where', 'create', 'update', 'select', 'include'],
  delete: ['where', 'select', 'include'],
  deleteMany: ['where'],
}

/** Write ops whose `where` is a unique selector (guard UNIQUE_MUTATION_METHODS). */
const UNIQUE_WHERE_WRITE_OPS = new Set(['update', 'upsert', 'delete'])
/** Write ops whose `where` is a filter (guard BULK_MUTATION_METHODS). */
const FILTER_WHERE_WRITE_OPS = new Set([
  'updateMany',
  'updateManyAndReturn',
  'deleteMany',
])
/** Write ops carrying `data` (create-mode or update-mode). */
const CREATE_DATA_WRITE_OPS = new Set([
  'create',
  'createMany',
  'createManyAndReturn',
])
const UPDATE_DATA_WRITE_OPS = new Set([
  'update',
  'updateMany',
  'updateManyAndReturn',
])

/**
 * Whether a forced (literal or force()-wrapped) DATA value parses under
 * guard's data field schema (source-read: buildFieldSchema = base type +
 * wrapWithInputCoercion, .nullable() on optional fields). Beyond the
 * where-side forms that means: DateTime accepts Date instances, BigInt
 * accepts bigint, Bytes accepts Uint8Array, String/Int/Float accept their
 * coerced forms, Json accepts any JSON value (plain objects included).
 */
function forcedDataValueMatches(
  meta: SchemaModelMeta,
  field: SchemaFieldMeta,
  value: unknown,
): boolean {
  const v = isForcedShapeValue(value)
    ? (value as { value: unknown }).value
    : value
  if (v === undefined) return false
  if (v === null) return field.type === 'Json' || !field.isRequired
  const itemOk = (x: unknown): boolean => {
    if (field.kind === 'enum') return enumMember(meta, field, x)
    switch (field.type) {
      case 'DateTime':
        return (
          (x instanceof Date && !isNaN(x.getTime())) ||
          (typeof x === 'string' && !isNaN(Date.parse(x)))
        )
      case 'BigInt':
        return typeof x === 'bigint' || itemValueMatches('BigInt', x)
      case 'Bytes':
        return typeof x === 'string' || x instanceof Uint8Array
      case 'Float':
        // guard Float base is z.number().finite()
        return (
          coercedScalarMatches(field, x) &&
          (typeof x !== 'number' || Number.isFinite(x))
        )
      case 'String':
      case 'Int':
        return coercedScalarMatches(field, x)
      case 'Json':
        return true
      default:
        return itemValueMatches(field.type, x)
    }
  }
  if (field.isList) return Array.isArray(v) && v.every(itemOk)
  return itemOk(v)
}

/**
 * Validates one write data config (create / update / upsert's create+update)
 * the way guard's buildDataSchema compiles it. MCP refuses — at registration,
 * before any tool exists — the two config forms it cannot mirror in a static
 * JSON Schema: relation writes and inline refine functions. Everything else
 * must be guard-valid: known fields, true, a typed literal or force().
 * Returns null when valid, else the problem description.
 */
export function dataConfigProblem(
  meta: SchemaModelMeta,
  dataConfig: unknown,
  mode: 'create' | 'update',
): string | null {
  if (!isShapeObject(dataConfig)) {
    return `${mode} data must be an object of field configs`
  }
  for (const [name, val] of Object.entries(dataConfig)) {
    const field = fieldByName(meta, name)
    if (!field) {
      return `unknown field "${name}" in ${mode} data`
    }
    if (field.isUpdatedAt) {
      return `updatedAt field "${name}" cannot be configured in ${mode} data`
    }
    if (field.kind === 'object') {
      return `relation field "${name}" cannot be exposed as MCP ${mode} data — keep relation writes REST-only`
    }
    if (field.kind === 'unsupported') {
      if (val === true || typeof val === 'function') {
        return `unsupported field "${name}" cannot be client-controlled`
      }
      continue
    }
    if (typeof val === 'function') {
      return `inline refine on "${name}" cannot be mirrored in an MCP ${mode} schema`
    }
    if (val === true) continue
    // a plain object is a forced JSON literal on Json fields; anywhere else
    // it is an operator/relation-style config guard cannot parse as data
    if (
      field.type !== 'Json' &&
      isShapeObject(val) &&
      !isForcedShapeValue(val)
    ) {
      return `"${name}" in ${mode} data accepts true, a literal or force(), not an object`
    }
    if (!forcedDataValueMatches(meta, field, val)) {
      return `forced value for "${name}" does not match the field type`
    }
  }
  return null
}

/**
 * Validates the COMPLETE static shape of one write operation the way
 * prisma-guard 1.33 compiles mutations: per-operation allowed keys, required
 * keys (data for create/update families, where+create+update for upsert,
 * where for every where-carrying op — guard refuses unique mutations without
 * a unique where and bulk mutations without a where), unique-selector wheres
 * for update/upsert/delete, filter wheres for the bulk ops, data configs,
 * and the shared projection rules. Registration refuses a shape with any
 * problem. Only STATIC shapes reach here: MCP refuses dynamic write shapes
 * at tool creation. Returns null when valid, else the problem description.
 */
export function writeShapeConfigProblem(
  meta: SchemaModelMeta,
  operation: string,
  shape: unknown,
): string | null {
  if (!isShapeObject(shape)) {
    return `${operation} shape must be a static object`
  }
  const allowedKeys = WRITE_OP_SHAPE_KEYS[operation]
  if (!allowedKeys) return `${operation} is not an MCP write operation`
  for (const key of Object.keys(shape)) {
    if (!allowedKeys.includes(key)) {
      return `"${key}" is not a valid shape config key for ${operation}`
    }
  }
  const requiredKeys =
    operation === 'upsert'
      ? ['where', 'create', 'update']
      : allowedKeys.filter((k) => k === 'where' || k === 'data')
  for (const key of requiredKeys) {
    if (shape[key] === undefined) {
      return `${operation} shape must define "${key}"`
    }
  }
  if (UNIQUE_WHERE_WRITE_OPS.has(operation)) {
    const problem = findUniqueWhereConfigProblem(meta, shape.where)
    if (problem) return problem
  }
  if (FILTER_WHERE_WRITE_OPS.has(operation)) {
    const problem = filterWhereConfigProblem(meta, shape.where)
    if (problem) return problem
  }
  if (CREATE_DATA_WRITE_OPS.has(operation)) {
    const problem = dataConfigProblem(meta, shape.data, 'create')
    if (problem) return problem
  }
  if (UPDATE_DATA_WRITE_OPS.has(operation)) {
    const problem = dataConfigProblem(meta, shape.data, 'update')
    if (problem) return problem
  }
  if (operation === 'upsert') {
    const createProblem = dataConfigProblem(meta, shape.create, 'create')
    if (createProblem) return createProblem
    const updateProblem = dataConfigProblem(meta, shape.update, 'update')
    if (updateProblem) return updateProblem
  }
  for (const key of ['select', 'include'] as const) {
    if (shape[key] === undefined) continue
    const problem = projectionConfigProblem(meta, shape[key], key)
    if (problem) return problem
  }
  return null
}

/** Guard take config: positive finite integer, or { max, default? }. */
function takeConfigProblem(take: unknown): string | null {
  const okNumber =
    typeof take === 'number' &&
    Number.isInteger(take) &&
    Number.isFinite(take) &&
    take > 0
  if (okNumber) return null
  if (isShapeObject(take)) {
    const max = take.max
    const def = take.default
    if (
      typeof max === 'number' &&
      Number.isInteger(max) &&
      Number.isFinite(max) &&
      max > 0
    ) {
      if (def === undefined) return null
      const okDefault =
        typeof def === 'number' &&
        Number.isInteger(def) &&
        Number.isFinite(def) &&
        def > 0 &&
        def <= max
      return okDefault
        ? null
        : 'take.default must be a positive integer <= take.max'
    }
  }
  return 'take must be a positive integer or { max, default? }'
}

/** Count-field selection: `_all` plus scalar/enum fields, each `true`. */
function countFieldSelectConfigProblem(
  meta: SchemaModelMeta,
  cfg: unknown,
): string | null {
  if (!isShapeObject(cfg) || Object.keys(cfg).length === 0) {
    return 'count select must be a non-empty object'
  }
  for (const [key, val] of Object.entries(cfg)) {
    if (key === '_all') {
      if (val !== true) return 'count select "_all" must be true'
      continue
    }
    const field = meta.fields.find((f) => f.name === key)
    if (!field) return `unknown field "${key}" in count select`
    if (field.kind !== 'scalar' && field.kind !== 'enum') {
      return `count select field "${key}" must be a scalar`
    }
    if (val !== true) return `count select config for "${key}" must be true`
  }
  return null
}

function orderByConfigProblem(
  meta: SchemaModelMeta,
  cfg: unknown,
): string | null {
  if (!isShapeObject(cfg) || Object.keys(cfg).length === 0) {
    return 'orderBy config must be a non-empty object of fields'
  }
  for (const [key, val] of Object.entries(cfg)) {
    const field = meta.fields.find((f) => f.name === key)
    if (!field) return `unknown field "${key}" in orderBy`
    if (field.kind === 'object') {
      if (!isShapeObject(val) || Object.keys(val).length === 0) {
        return `orderBy relation "${key}" must be configured with a non-empty object`
      }
      const relatedMeta = meta.modelIndex.get(field.type)
      if (!relatedMeta) continue
      if (field.isList) {
        for (const k of Object.keys(val)) {
          if (k !== '_count') {
            return `to-many relation orderBy "${key}" only supports _count, not "${k}"`
          }
        }
        if (val._count !== true) {
          return `orderBy relation "${key}" _count must be exactly true`
        }
        continue
      }
      // to-one: validate the ENTIRE nested tree (finite literal, no cap)
      const nested = orderByConfigProblem(relatedMeta, val)
      if (nested) return nested
      continue
    }
    if (!isSortableField(field)) {
      return `${field.isList ? 'list' : 'Json'} field "${key}" cannot be used in orderBy`
    }
    if (val !== true) {
      return `orderBy config for "${key}" must be true`
    }
  }
  return null
}

function distinctConfigProblem(
  meta: SchemaModelMeta,
  cfg: unknown,
): string | null {
  if (!Array.isArray(cfg) || cfg.length === 0) {
    return 'distinct config must be a non-empty array of scalar field names'
  }
  for (const name of cfg) {
    if (typeof name !== 'string') {
      return 'distinct config must be a non-empty array of scalar field names'
    }
    const field = meta.fields.find((f) => f.name === name)
    if (!field) return `unknown field "${name}" in distinct`
    if (field.kind !== 'scalar' && field.kind !== 'enum') {
      return `distinct field "${name}" must be a scalar`
    }
  }
  return null
}

function cursorConfigProblem(
  meta: SchemaModelMeta,
  cfg: unknown,
): string | null {
  if (!isShapeObject(cfg) || Object.keys(cfg).length === 0) {
    return 'cursor config must be a non-empty object of unique selectors'
  }
  for (const [key, val] of Object.entries(cfg)) {
    const constraint = meta.compoundUniques.find((c) => c.selector === key)
    if (constraint) {
      // guard requires the EXACT compound key set with literal `true` —
      // extra fields and force() wrappers are both refused
      if (!isShapeObject(val) || isForcedShapeValue(val)) {
        return `cursor compound selector "${key}" must be configured with an object`
      }
      const keys = Object.keys(val)
      if (keys.length !== constraint.fields.length) {
        return `cursor compound selector "${key}" must configure exactly ${constraint.fields.join(', ')}`
      }
      for (const fk of constraint.fields) {
        if (val[fk] !== true) {
          return `cursor compound selector "${key}" requires every field configured as literal true`
        }
      }
      continue
    }
    const flatUnique =
      meta.uniqueFields.includes(key) &&
      meta.fields.some((f) => f.name === key && (f.isId || f.isUnique))
    if (!flatUnique) {
      return `cursor key "${key}" is not a unique field or compound selector of ${meta.name}`
    }
    if (val !== true) {
      return `cursor config for "${key}" must be true`
    }
  }
  return null
}

/**
 * Nested list-relation argument keys guard accepts (verified runtime,
 * guard's KNOWN_NESTED_KEYS): where/orderBy/take/skip/cursor on list
 * relations; to-one relations accept only select/include projections.
 */
const NESTED_LIST_KEYS = new Set([
  'where',
  'orderBy',
  'take',
  'skip',
  'cursor',
  'select',
  'include',
])

function projectionConfigProblem(
  meta: SchemaModelMeta,
  cfg: unknown,
  mode: 'select' | 'include',
): string | null {
  if (!isShapeObject(cfg) || Object.keys(cfg).length === 0) {
    return `${mode} config must be a non-empty object`
  }
  for (const [key, val] of Object.entries(cfg)) {
    if (key === '_count') {
      const problem = countSelectConfigProblem(meta, val)
      if (problem) return problem
      continue
    }
    const field = meta.fields.find((f) => f.name === key)
    if (!field) return `unknown field "${key}" in ${mode}`
    if (field.kind !== 'object') {
      if (mode === 'include') {
        return `"${key}" is not a relation and cannot appear in include`
      }
      if (val !== true) return `${mode} config for "${key}" must be true`
      continue
    }
    if (val === true) continue
    if (!isShapeObject(val) || isForcedShapeValue(val)) {
      return `${mode} relation "${key}" must be true or an object`
    }
    const relatedMeta = meta.modelIndex.get(field.type)
    if (!relatedMeta) continue
    if (!field.isList) {
      // to-one: only nested select/include projections (non-empty)
      for (const k of Object.keys(val)) {
        if (k !== 'select' && k !== 'include') {
          return `to-one relation "${key}" accepts only select/include, not "${k}"`
        }
      }
      if (val.select !== undefined && val.include !== undefined) {
        return `nested select for "${key}" cannot define both "select" and "include"`
      }
      for (const k of ['select', 'include'] as const) {
        if (val[k] === undefined) continue
        if (!isShapeObject(val[k]) || Object.keys(val[k]).length === 0) {
          return `${k} config for "${key}" must be a non-empty object`
        }
        const nested = projectionConfigProblem(relatedMeta, val[k], k)
        if (nested) return nested
      }
      continue
    }
    for (const k of Object.keys(val)) {
      if (!NESTED_LIST_KEYS.has(k)) {
        return `nested list argument "${k}" is not allowed for "${key}"`
      }
    }
    if (val.select !== undefined && val.include !== undefined) {
      return `nested select for "${key}" cannot define both "select" and "include"`
    }
    if (val.where !== undefined) {
      const nested = filterWhereConfigProblem(relatedMeta, val.where)
      if (nested) return nested
    }
    if (val.orderBy !== undefined) {
      const nested = orderByConfigProblem(relatedMeta, val.orderBy)
      if (nested) return nested
    }
    if (val.cursor !== undefined) {
      const nested = cursorConfigProblem(relatedMeta, val.cursor)
      if (nested) return nested
    }
    if (val.take !== undefined) {
      const nested = takeConfigProblem(val.take)
      if (nested) return `nested take for "${key}": ${nested}`
    }
    if (val.skip !== undefined && val.skip !== true) {
      return `nested skip for "${key}" must be true`
    }
    for (const k of ['select', 'include'] as const) {
      if (val[k] === undefined) continue
      if (!isShapeObject(val[k]) || Object.keys(val[k]).length === 0) {
        return `nested ${k} for "${key}" must be a non-empty object`
      }
      const nested = projectionConfigProblem(relatedMeta, val[k], k)
      if (nested) return nested
    }
  }
  return null
}

function countSelectConfigProblem(
  meta: SchemaModelMeta,
  val: unknown,
): string | null {
  if (val === true) return null
  // guard: "Unknown key X in _count config" — ONLY `select` may appear
  if (!isShapeObject(val) || isForcedShapeValue(val)) {
    return '_count config must be true or { select: { relation: ... } }'
  }
  const keys = Object.keys(val)
  if (keys.length !== 1 || keys[0] !== 'select') {
    return '_count config accepts only the "select" key'
  }
  const sel = val.select
  if (!isShapeObject(sel) || Object.keys(sel).length === 0) {
    return '_count config must be true or { select: { relation: ... } }'
  }
  for (const [rk, rv] of Object.entries(sel)) {
    const rel = meta.fields.find((f) => f.name === rk)
    if (!rel || rel.kind !== 'object') {
      return `unknown relation "${rk}" in _count.select`
    }
    if (!rel.isList) {
      return `"${rk}" is a to-one relation and cannot be counted in _count.select`
    }
    if (rv === true) continue
    const relatedMeta = meta.modelIndex.get(rel.type)
    if (
      !isShapeObject(rv) ||
      Object.keys(rv).length !== 1 ||
      rv.where === undefined ||
      !relatedMeta
    ) {
      return `_count.select entry "${rk}" accepts true or { where: ... }`
    }
    const nested = filterWhereConfigProblem(relatedMeta, rv.where)
    if (nested) return nested
  }
  return null
}

/**
 * Unique-selector where schema for findUnique (prisma-guard 1.33 semantics,
 * verified against the real runtime). ALL advertised selector keys sit on
 * the parent object (guard accepts several simultaneously); `anyOf` only
 * chooses which key is REQUIRED when more than one is advertised.
 *
 * - a flat unique field is advertised when the shape configures it with
 *   exactly `true`; literal / force() configs are server-owned (guard
 *   merges them) and never advertised.
 * - a compound selector is advertised when the shape configures its key
 *   with an object; only `true`-configured constraint fields are
 *   advertised (and required inside the selector).
 * - guard-invalid configs advertise nothing; registration refuses them
 *   (see findUniqueWhereConfigProblem).
 */
export function uniqueSelectorWhereSchema(
  meta: SchemaModelMeta,
  shapeWhere: unknown,
): OperationSchemaObject {
  const shapeObj = isShapeObject(shapeWhere) ? shapeWhere : undefined
  const shapeKeys = shapeObj ? new Set(Object.keys(shapeObj)) : undefined

  const properties: Record<string, OperationSchemaObject> = {}
  const requiredKeys: string[] = []

  if (shapeObj && shapeKeys) {
    for (const f of meta.fields) {
      if (!(f.isId || f.isUnique) || !meta.uniqueFields.includes(f.name)) {
        continue
      }
      if (!shapeKeys.has(f.name) || shapeObj[f.name] !== true) continue
      properties[f.name] = scalarBaseSchema(meta, f)
      requiredKeys.push(f.name)
    }
    for (const cu of meta.compoundUniques) {
      if (!shapeKeys.has(cu.selector)) continue
      const inner = shapeObj[cu.selector]
      if (!isShapeObject(inner) || isForcedShapeValue(inner)) continue
      const clientFields = cu.fields.filter((f) => inner[f] === true)
      if (clientFields.length === 0) continue // fully forced — server-owned
      properties[cu.selector] = {
        type: 'object',
        properties: Object.fromEntries(
          clientFields.map((f) => {
            const fm = meta.fields.find((x) => x.name === f)
            return [f, fm ? scalarBaseSchema(meta, fm) : { type: 'string' }]
          }),
        ),
        required: [...clientFields],
        additionalProperties: false,
      }
      requiredKeys.push(cu.selector)
    }
    // extended unique filters: client-controlled NON-unique scalars beside
    // the selector — optional, nullable on optional fields (guard parses
    // them with .nullable() when the field is optional). Only when the
    // config covers a unique constraint: without one the config is
    // guard-invalid and nothing beyond the selectors is advertised.
    const coversConstraint = [...shapeKeys].some(
      (k) =>
        meta.compoundUniques.some((c) => c.selector === k) ||
        (meta.uniqueFields.includes(k) &&
          meta.fields.some((f) => f.name === k && (f.isId || f.isUnique))),
    )
    for (const f of coversConstraint ? meta.fields : []) {
      if (f.kind !== 'scalar' && f.kind !== 'enum') continue
      if (properties[f.name] !== undefined) continue
      if (meta.compoundUniques.some((c) => c.selector === f.name)) continue
      if (shapeObj[f.name] !== true) continue
      const base = scalarBaseSchema(meta, f)
      properties[f.name] = f.isRequired ? base : nullableUnion(base)
    }
  }

  const node: OperationSchemaObject = {
    type: 'object',
    properties,
    additionalProperties: false,
  }
  if (requiredKeys.length === 0) {
    // fully forced (or guard-invalid): client sends nothing for where;
    // guard enforces the selector server-side or errors on the config
    return node
  }
  if (requiredKeys.length === 1) {
    node.required = [requiredKeys[0]]
    return node
  }
  // alternatives choose the required key only — the parent already
  // constrains the properties, and guard accepts several selector keys
  // in one input
  node.anyOf = requiredKeys.map((key) => ({ required: [key] }))
  return node
}

/**
 * Unique-cursor schema shared by root list args and nested relation list
 * args: flat unique fields configured with exactly `true`, plus compound
 * selectors whose inner object maps EVERY constraint field to `true`
 * (any other cursor config is guard-invalid and advertises nothing).
 * Guard accepts several cursor keys in one input; at least one is required.
 */
export function uniqueCursorSchema(
  meta: SchemaModelMeta,
  cursorCfg: unknown,
): OperationSchemaObject {
  const cfg =
    isShapeObject(cursorCfg) && !isForcedShapeValue(cursorCfg)
      ? cursorCfg
      : undefined
  const properties: Record<string, OperationSchemaObject> = {}
  if (cfg) {
    for (const f of meta.fields) {
      if (!(f.isId || f.isUnique) || !meta.uniqueFields.includes(f.name)) {
        continue
      }
      if (cfg[f.name] !== true) continue
      properties[f.name] = scalarBaseSchema(meta, f)
    }
    for (const cu of meta.compoundUniques) {
      const inner = cfg[cu.selector]
      if (!isShapeObject(inner) || isForcedShapeValue(inner)) continue
      if (!cu.fields.every((f) => inner[f] === true)) continue
      properties[cu.selector] = {
        type: 'object',
        properties: Object.fromEntries(
          cu.fields.map((f) => {
            const fm = meta.fields.find((x) => x.name === f)
            return [f, fm ? scalarBaseSchema(meta, fm) : { type: 'string' }]
          }),
        ),
        required: [...cu.fields],
        additionalProperties: false,
      }
    }
  }
  return {
    type: 'object',
    properties,
    additionalProperties: false,
    minProperties: 1,
  }
}

function isShapeObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  )
}

/**
 * Builds one relation entry for include/projection trees: `true` or an
 * object whose keys mirror EXACTLY what the nested shape configures, with
 * the configured take bound preserved.
 */
function relationEntrySchema(
  meta: SchemaModelMeta,
  field: SchemaFieldMeta,
  nestedShape: unknown,
  relatedMeta: SchemaModelMeta | undefined,
  depth: number,
  mode: 'select' | 'include',
): OperationSchemaObject {
  const wrapperProps: Record<string, OperationSchemaObject> = {}

  // nested projections, only when the nested shape configures that key —
  // in BOTH modes (a select-mode shape may configure include and vice versa)
  const nestedSelectConfigured =
    isShapeObject(nestedShape) && nestedShape.select !== undefined
  const nestedIncludeConfigured =
    isShapeObject(nestedShape) && nestedShape.include !== undefined
  if (nestedSelectConfigured && relatedMeta && depth < MAX_PROJECTION_DEPTH) {
    wrapperProps.select = projectionSchema(
      relatedMeta,
      (nestedShape as Record<string, unknown>).select,
      'select',
      depth + 1,
    )
  }
  if (nestedIncludeConfigured && relatedMeta && depth < MAX_PROJECTION_DEPTH) {
    wrapperProps.include = projectionSchema(
      relatedMeta,
      (nestedShape as Record<string, unknown>).include,
      'include',
      depth + 1,
    )
  }

  // list relations may carry where/orderBy/take/skip/cursor under BOTH
  // select and include (prisma-guard 1.33 permits the configured arguments
  // in either projection) — only for the keys the nested shape configures;
  // orderBy narrows to the shape's declared fields, take preserves its bound
  if (field.isList && isShapeObject(nestedShape)) {
    if (nestedShape.where !== undefined) {
      // pass the nested where OBJECT: whereSchema narrows recursively from
      // the configured tree (a key Set here would fall back to every field)
      wrapperProps.where = whereSchema(
        relatedMeta ?? meta,
        nestedShape.where,
        Math.max(0, depth),
      )
    }
    if (nestedShape.orderBy !== undefined && relatedMeta) {
      wrapperProps.orderBy = orderBySchema(relatedMeta, nestedShape.orderBy)
    }
    if (nestedShape.take !== undefined) {
      const takeMax =
        typeof nestedShape.take === 'number'
          ? nestedShape.take
          : isShapeObject(nestedShape.take) &&
              typeof nestedShape.take.max === 'number'
            ? nestedShape.take.max
            : undefined
      wrapperProps.take = takeSchema(takeMax)
    }
    if (nestedShape.skip !== undefined) {
      // guard configures nested skip as `true`; input is a non-negative int
      wrapperProps.skip = {
        type: 'integer',
        minimum: 0,
        description: 'Skip related rows',
      }
    }
    if (nestedShape.cursor !== undefined) {
      wrapperProps.cursor = uniqueCursorSchema(
        relatedMeta ?? meta,
        nestedShape.cursor,
      )
    }
  }

  if (Object.keys(wrapperProps).length === 0) {
    // nothing configured: the relation literal `true` is the only legal value
    return { type: 'boolean', const: true }
  }
  return {
    anyOf: [
      { type: 'boolean', const: true },
      {
        type: 'object',
        properties: wrapperProps,
        additionalProperties: false,
      },
    ],
  }
}

/**
 * Projection (select/include) narrowed by the static guard shape's own tree.
 * BOTH modes narrow by the shape's keys; include accepts relations only
 * (scalar keys are never advertised).
 */
/**
 * `_count` projection schema in both guard-1.33 forms: `true` and
 * `{ select: { relation: true } }` (empty select is guard-invalid).
 */
function countProjectionSchema(
  meta: SchemaModelMeta,
  cfg: unknown,
): OperationSchemaObject {
  if (cfg === true) return { type: 'boolean', const: true }
  if (
    isShapeObject(cfg) &&
    !isForcedShapeValue(cfg) &&
    isShapeObject(cfg.select)
  ) {
    const props: Record<string, OperationSchemaObject> = {}
    for (const f of meta.fields) {
      // _count counts LIST relations only (guard rejects to-one entries)
      if (f.kind !== 'object' || !f.isList) continue
      const entry = cfg.select[f.name]
      if (entry === undefined) continue
      const relatedMeta = meta.modelIndex.get(f.type)
      if (entry === true || !relatedMeta) {
        props[f.name] = { type: 'boolean', const: true }
        continue
      }
      // configured filtered count: guard accepts `true`, `{}`,
      // `{where:{}}` and the where mirror (all verified) — the union
      // covers every form for forced AND client-controlled configs
      if (isShapeObject(entry) && entry.where !== undefined) {
        const whereNode = whereSchema(relatedMeta, entry.where)
        props[f.name] = {
          anyOf: [
            { type: 'boolean', const: true },
            {
              type: 'object',
              properties: { where: whereNode },
              additionalProperties: false,
            },
          ],
        }
      }
    }
    // input mirrors the config: { select: { relation: ..., ... } }
    return {
      type: 'object',
      properties: {
        select: {
          type: 'object',
          properties: props,
          additionalProperties: false,
          minProperties: 1,
        },
      },
      additionalProperties: false,
      required: ['select'],
    }
  }
  // guard-invalid config: advertise nothing selectable
  return {
    type: 'object',
    properties: {},
    additionalProperties: false,
    minProperties: 1,
  }
}

function projectionSchema(
  meta: SchemaModelMeta,
  shapeValue: unknown,
  mode: 'select' | 'include',
  depth: number,
): OperationSchemaObject {
  const shapeKeys = isShapeObject(shapeValue)
    ? new Set(Object.keys(shapeValue))
    : undefined
  const properties: Record<string, OperationSchemaObject> = {}
  for (const field of meta.fields) {
    if (shapeKeys && !shapeKeys.has(field.name)) continue
    if (mode === 'include' && field.kind !== 'object') {
      // prisma-guard rejects scalar keys inside include; never advertise them
      continue
    }
    if (field.kind === 'object') {
      const nestedShape = isShapeObject(shapeValue)
        ? shapeValue[field.name]
        : undefined
      const relatedMeta = meta.modelIndex.get(field.type)
      properties[field.name] = relationEntrySchema(
        meta,
        field,
        nestedShape,
        relatedMeta,
        depth,
        mode,
      )
      continue
    }
    properties[field.name] = { type: 'boolean', const: true }
  }
  // _count is advertised only when the shape configures it — same parity
  // rule as every other projection key; both guard forms are mirrored:
  // `_count: true` (input `true`) and `_count: { select: { ... } }`
  // (input object over the configured relations, at least one key)
  if (shapeKeys && shapeKeys.has('_count') && isShapeObject(shapeValue)) {
    properties._count = countProjectionSchema(meta, shapeValue._count)
  }
  const node: OperationSchemaObject = {
    type: 'object',
    properties,
    additionalProperties: false,
  }
  // an empty projection selects nothing — guard requires at least one key
  node.minProperties = 1
  return node
}

/**
 * The model-aware argument schema for one read operation under one static
 * guard shape. Only keys the shape declares are advertised; `where`,
 * `orderBy`, `distinct` and the projection keys are built from model
 * metadata, recursively for nested select/include trees.
 */
export function buildModelAwareArgsSchema(
  operation: string,
  meta: SchemaModelMeta,
  shape: unknown,
): OperationSchemaObject {
  if (!isShapeObject(shape)) {
    // dynamic (function) shape: broad schema, runtime rejection
    return buildOperationArgsSchema(operation)
  }
  const shapeKeys = new Set(Object.keys(shape))
  const properties: Record<string, OperationSchemaObject> = {}
  const required: string[] = []

  if (shapeKeys.has('where')) {
    // where is narrowed by the shape's OWN where tree. findUnique gets a
    // DEDICATED unique-selector schema (flat unique fields + compound
    // selector objects, per prisma-guard 1.33) — never the generic filter
    // schema, which would advertise filter operators on unique fields.
    if (operation === 'findUnique') {
      properties.where = uniqueSelectorWhereSchema(meta, shape.where)
      const whereNode = properties.where as {
        required?: string[]
        anyOf?: unknown[]
      }
      // client-controlled selectors make `where` mandatory (guard rejects
      // findUnique without it); anyOf alternatives each require their key
      if (
        (whereNode.required && whereNode.required.length > 0) ||
        whereNode.anyOf
      ) {
        required.push('where')
      }
    } else {
      properties.where = whereSchema(meta, shape.where)
    }
  } else if (operation === 'findUnique') {
    // fully-forced (or absent) unique shape: clients send no where at all;
    // guard enforces the forced selector server-side.
  }
  if (shapeKeys.has('orderBy')) {
    properties.orderBy = orderBySchema(meta, shape.orderBy)
  }
  if (shapeKeys.has('distinct')) {
    properties.distinct = distinctSchema(meta, shape.distinct)
  }
  if (shapeKeys.has('cursor')) {
    // cursor follows the UNIQUE-SELECTOR surface (guard 1.33 semantics),
    // the same builder used for nested relation list args
    properties.cursor = uniqueCursorSchema(meta, shape.cursor)
  }
  if (operation === 'count' && shapeKeys.has('select')) {
    // count select: ONLY the keys the shape configures, at least one
    // selected — no implicit _all, no relations
    const selectShape = isShapeObject(shape.select)
      ? new Set(Object.keys(shape.select))
      : undefined
    const props: Record<string, OperationSchemaObject> = {}
    for (const field of meta.fields) {
      if (field.kind !== 'scalar' && field.kind !== 'enum') continue
      if (selectShape && !selectShape.has(field.name)) continue
      props[field.name] = { type: 'boolean', const: true }
    }
    if (selectShape && selectShape.has('_all')) {
      props._all = { type: 'boolean', const: true }
    }
    properties.select = {
      type: 'object',
      properties: props,
      additionalProperties: false,
      minProperties: 1,
    }
  }
  for (const key of ['select', 'include', 'omit'] as const) {
    if (!shapeKeys.has(key)) continue
    // count select is a COUNT-FIELD selection (handled above with _all +
    // scalars only); the generic projection loop would advertise relations
    if (operation === 'count' && key === 'select') continue
    if (key === 'omit') {
      const omitKeys = isShapeObject(shape[key])
        ? new Set(Object.keys(shape[key] as Record<string, unknown>))
        : undefined
      const props: Record<string, OperationSchemaObject> = {}
      for (const field of meta.fields) {
        if (omitKeys && !omitKeys.has(field.name)) continue
        props[field.name] = { type: 'boolean', const: true }
      }
      properties.omit = {
        type: 'object',
        properties: props,
        additionalProperties: false,
      }
      continue
    }
    properties[key] = projectionSchema(meta, shape[key], key, 0)
  }
  if (shapeKeys.has('take')) {
    // advertise the shape's own bound so clients learn the limit upfront and
    // the SDK rejects violations before the handler runs
    const take = shape.take
    const takeMax =
      typeof take === 'number'
        ? take
        : isShapeObject(take) && typeof take.max === 'number'
          ? take.max
          : undefined
    properties.take = takeSchema(takeMax)
  }
  if (shapeKeys.has('skip')) {
    properties.skip = {
      type: 'integer',
      minimum: 0,
      description: 'Skip results',
    }
  }

  const schema: OperationSchemaObject = {
    type: 'object',
    properties,
    additionalProperties: false,
  }
  if (required.length > 0) schema.required = required
  return schema
}

// ---------------------------------------------------------------------------
// Model-aware WRITE argument schemas (MCP). data/create/update advertise ONLY
// the client-controlled (`true`) fields of the guard data config — forced
// values are server-owned and never client input. Nullability mirrors guard's
// applyCreateUpdateNullability: optional fields accept null, required fields
// never do; a required, default-less field stays mandatory in create data.
// ---------------------------------------------------------------------------

function nullableUnion(base: OperationSchemaObject): OperationSchemaObject {
  // only an UNCONSTRAINED schema (Json: no type, no anyOf) already accepts
  // null; BigInt/Decimal are typeless anyOf unions that must gain it
  if (base.type === undefined && base.anyOf === undefined) return base
  if (base.type === undefined && base.anyOf) {
    return { ...base, anyOf: [...base.anyOf, { type: 'null' }] }
  }
  return { anyOf: [base, { type: 'null' }] }
}

function dataInputSchema(
  meta: SchemaModelMeta,
  dataConfig: unknown,
  mode: 'create' | 'update',
): OperationSchemaObject {
  const cfg = isShapeObject(dataConfig) ? dataConfig : undefined
  const properties: Record<string, OperationSchemaObject> = {}
  const required: string[] = []
  if (cfg) {
    for (const field of meta.fields) {
      if (cfg[field.name] !== true) continue
      const base = scalarBaseSchema(meta, field)
      properties[field.name] = field.isRequired ? base : nullableUnion(base)
      if (mode === 'create' && field.isRequired && !field.hasDefaultValue) {
        required.push(field.name)
      }
    }
  }
  const node: OperationSchemaObject = {
    type: 'object',
    properties,
    additionalProperties: false,
  }
  if (required.length > 0) node.required = required
  return node
}

export type WriteSchemaOperation =
  | 'create'
  | 'createMany'
  | 'createManyAndReturn'
  | 'update'
  | 'updateMany'
  | 'updateManyAndReturn'
  | 'upsert'
  | 'delete'
  | 'deleteMany'

/**
 * The model-aware argument schema for one write operation under one STATIC
 * guard shape (MCP refuses dynamic write shapes at tool creation — there is
 * no opaque fallback). Only keys the shape declares are advertised:
 *  - unique-where ops (update/upsert/delete) reuse the findUnique selector
 *    surface, extended unique filters included;
 *  - bulk ops (updateMany*, deleteMany) reuse the filter where surface; a
 *    filter with ANY client-controlled key requires at least one client
 *    condition (stricter than guard, which accepts `{}` beside a forced
 *    tenant and then touches every tenant row);
 *  - `where` is optional only when fully forced (every selector value or
 *    filter leaf server-owned) — the runtime then injects `where: {}` so
 *    the operation core's required-field check passes and guard merges the
 *    forced values;
 *  - data/create/update are narrowed to the shape's client-controlled
 *    fields; createMany* take a non-empty array of them plus
 *    `skipDuplicates`;
 *  - select/include reuse the projection builder.
 */
export function buildModelAwareWriteArgsSchema(
  operation: WriteSchemaOperation,
  meta: SchemaModelMeta,
  shape: unknown,
): OperationSchemaObject {
  if (!isShapeObject(shape)) {
    throw new Error(
      operation + ': MCP write schemas require a static guard shape',
    )
  }
  const properties: Record<string, OperationSchemaObject> = {}
  const required: string[] = []
  const shapeKeys = new Set(Object.keys(shape))

  if (shapeKeys.has('where') && UNIQUE_WHERE_WRITE_OPS.has(operation)) {
    properties.where = uniqueSelectorWhereSchema(meta, shape.where)
    const whereNode = properties.where as {
      required?: string[]
      anyOf?: unknown[]
    }
    if (
      (whereNode.required && whereNode.required.length > 0) ||
      whereNode.anyOf
    ) {
      required.push('where')
    }
  }
  if (shapeKeys.has('where') && FILTER_WHERE_WRITE_OPS.has(operation)) {
    const node = whereSchema(meta, shape.where)
    // any client-controlled filter key makes the client state at least one
    // condition — stricter than guard (which would merge a forced tenant
    // into `{}` and touch EVERY tenant row): an agent cannot bulk-write a
    // whole scope by omission. Fully forced filters stay optional.
    if (scanShapeClientState(shape.where).client) {
      node.minProperties = 1
      required.push('where')
    }
    properties.where = node
  }
  if (CREATE_DATA_WRITE_OPS.has(operation)) {
    const item = dataInputSchema(meta, shape.data, 'create')
    if (operation === 'create') {
      properties.data = item
    } else {
      // guard: "expects data to be an array", "received empty data array"
      properties.data = { type: 'array', items: item, minItems: 1 }
      properties.skipDuplicates = { type: 'boolean' }
    }
    required.push('data')
  }
  if (UPDATE_DATA_WRITE_OPS.has(operation)) {
    properties.data = dataInputSchema(meta, shape.data, 'update')
    required.push('data')
  }
  if (operation === 'upsert') {
    properties.create = dataInputSchema(meta, shape.create, 'create')
    properties.update = dataInputSchema(meta, shape.update, 'update')
    required.push('create', 'update')
  }
  for (const key of ['select', 'include'] as const) {
    if (!shapeKeys.has(key)) continue
    properties[key] = projectionSchema(meta, shape[key], key, 0)
  }

  return {
    type: 'object',
    properties,
    required,
    additionalProperties: false,
  }
}
