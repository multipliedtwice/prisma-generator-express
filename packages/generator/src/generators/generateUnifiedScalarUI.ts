import { DMMF } from '@prisma/generator-helper'

function exampleValueForType(fieldType: string): unknown {
  switch (fieldType) {
    case 'String':
      return 'example'
    case 'Int':
      return 1
    case 'BigInt':
      return '1'
    case 'Float':
      return 1.0
    case 'Decimal':
      return '1.0'
    case 'Boolean':
      return true
    case 'DateTime':
      return '2025-01-01T00:00:00.000Z'
    case 'Json':
      return {}
    case 'Bytes':
      return 'base64data'
    default:
      return 'example'
  }
}

export function generateScalarUIHandler(options: {
  model: DMMF.Model
  enums: DMMF.DatamodelEnum[]
}): string {
  const { model, enums } = options
  const modelName = model.name

  const fieldsMeta = model.fields.map((f: any) => ({
    name: f.name,
    kind: f.kind,
    type: f.type,
    isList: f.isList,
    isRequired: f.isRequired,
    hasDefaultValue: f.hasDefaultValue,
    isUpdatedAt: Boolean(f.isUpdatedAt),
    documentation: f.documentation,
    isId: Boolean(f.isId),
    isUnique: Boolean(f.isUnique),
    relationFromFields: f.relationFromFields,
  }))

  const referencedEnumTypes = new Set(
    model.fields.filter((f: any) => f.kind === 'enum').map((f: any) => f.type),
  )

  const enumsMeta = enums
    .filter((e) => referencedEnumTypes.has(e.name))
    .map((e) => ({
      name: e.name,
      values: e.values.map((v) => ({ name: v.name })),
    }))

  const exampleValueMap = JSON.stringify(
    Object.fromEntries(
      model.fields
        .filter(
          (f: any) =>
            f.isId || f.isUnique || f.kind === 'scalar' || f.kind === 'enum',
        )
        .map((f: any) => {
          if (f.kind === 'enum') {
            const enumDef = enums.find((e) => e.name === f.type)
            return [f.name, enumDef?.values[0]?.name || 'VALUE']
          }
          return [f.name, exampleValueForType(f.type)]
        }),
    ),
  )

  const compoundIdMeta =
    model.primaryKey && model.primaryKey.fields.length > 1
      ? { fields: model.primaryKey.fields }
      : null

  const compoundUniquesMeta = ((model as any).uniqueIndexes || [])
    .filter((idx: any) => idx.fields && idx.fields.length > 1)
    .map((idx: any) => ({
      name: idx.name || idx.fields.join('_'),
      fields: idx.fields,
    }))

  return `import type { Context } from 'hono'
import { buildModelOpenApi } from '../buildModelOpenApi'
import type { RouteConfig } from '../routeConfig'
import { OPERATION_DEFS, isOperationEnabled } from '../operationDefinitions'

const _env = typeof process !== 'undefined' && process.env ? process.env : {} as Record<string, string | undefined>

export const MODEL_FIELDS = ${JSON.stringify(fieldsMeta, null, 2)} as const
export const MODEL_ENUMS = ${JSON.stringify(enumsMeta, null, 2)} as const

const COMPOUND_ID: { fields: string[] } | null = ${JSON.stringify(compoundIdMeta)}

const COMPOUND_UNIQUES: { name: string, fields: string[] }[] = ${JSON.stringify(compoundUniquesMeta)}

const EXAMPLE_VALUES: Record<string, unknown> = ${exampleValueMap}

const DEFAULT_SCALAR_CDN = 'https://cdn.jsdelivr.net/npm/@scalar/api-reference'
const PRISM_CSS = 'https://cdn.jsdelivr.net/npm/prismjs@1/themes/prism.min.css'
const PRISM_JS = 'https://cdn.jsdelivr.net/npm/prismjs@1/prism.min.js'
const PRISM_JSON = 'https://cdn.jsdelivr.net/npm/prismjs@1/components/prism-json.min.js'

type DocsUI = 'docs' | 'scalar' | 'json' | 'yaml' | 'playground'

type DocsConfig = RouteConfig & {
  docsTitle?: string
  docsUi?: DocsUI
}

type FieldMeta = typeof MODEL_FIELDS[number]

interface OpDetail {
  transport: string
  required: string[]
  optional: string[]
  responseDesc: string
  errors: number[]
  supportsSelect: boolean
  supportsInclude: boolean
  supportsOmit: boolean
  notes: string
}

const OP_DETAIL_MAP: Record<string, OpDetail> = {
  findMany: {
    transport: 'GET query params',
    required: [],
    optional: ['where', 'select', 'include', 'omit', 'orderBy', 'cursor', 'take', 'skip', 'distinct'],
    responseDesc: 'Array of records',
    errors: [400, 403, 500, 501, 503],
    supportsSelect: true,
    supportsInclude: true,
    supportsOmit: true,
    notes: 'Pagination limits may apply when configured.',
  },
  findUnique: {
    transport: 'GET query params',
    required: ['where'],
    optional: ['select', 'include', 'omit'],
    responseDesc: 'Single record or null',
    errors: [400, 403, 500, 501, 503],
    supportsSelect: true,
    supportsInclude: true,
    supportsOmit: true,
    notes: 'Returns null (not 404) when no record matches.',
  },
  findUniqueOrThrow: {
    transport: 'GET query params',
    required: ['where'],
    optional: ['select', 'include', 'omit'],
    responseDesc: 'Single record',
    errors: [400, 403, 404, 500, 501, 503],
    supportsSelect: true,
    supportsInclude: true,
    supportsOmit: true,
    notes: 'Returns 404 when no record matches.',
  },
  findFirst: {
    transport: 'GET query params',
    required: [],
    optional: ['where', 'select', 'include', 'omit', 'orderBy', 'cursor', 'take', 'skip', 'distinct'],
    responseDesc: 'Single record or null',
    errors: [400, 403, 500, 501, 503],
    supportsSelect: true,
    supportsInclude: true,
    supportsOmit: true,
    notes: 'Returns null (not 404) when no record matches.',
  },
  findFirstOrThrow: {
    transport: 'GET query params',
    required: [],
    optional: ['where', 'select', 'include', 'omit', 'orderBy', 'cursor', 'take', 'skip', 'distinct'],
    responseDesc: 'Single record',
    errors: [400, 403, 404, 500, 501, 503],
    supportsSelect: true,
    supportsInclude: true,
    supportsOmit: true,
    notes: 'Returns 404 when no record matches.',
  },
  findManyPaginated: {
    transport: 'GET query params',
    required: [],
    optional: ['where', 'select', 'include', 'omit', 'orderBy', 'cursor', 'take', 'skip', 'distinct'],
    responseDesc: '{ data: Record[], total: number, hasMore: boolean }',
    errors: [400, 403, 409, 500, 501, 503],
    supportsSelect: true,
    supportsInclude: true,
    supportsOmit: true,
    notes: 'Wraps findMany with total count. hasMore is reliable for forward offset pagination (skip + take) only. Distinct count over 100k falls back to approximate total. 409 possible on transaction conflict.',
  },
  create: {
    transport: 'POST JSON body',
    required: ['data'],
    optional: ['select', 'include', 'omit'],
    responseDesc: 'Created record (201)',
    errors: [400, 403, 409, 500, 501, 503],
    supportsSelect: true,
    supportsInclude: true,
    supportsOmit: true,
    notes: '409 on unique constraint violation.',
  },
  createMany: {
    transport: 'POST JSON body',
    required: ['data'],
    optional: ['skipDuplicates'],
    responseDesc: '{ count: number } (201)',
    errors: [400, 403, 409, 500, 501, 503],
    supportsSelect: false,
    supportsInclude: false,
    supportsOmit: false,
    notes: 'data is an array of scalar-only inputs. Nested relation writes are not supported. skipDuplicates silently ignores conflicts (not supported on all providers).',
  },
  createManyAndReturn: {
    transport: 'POST JSON body',
    required: ['data'],
    optional: ['skipDuplicates', 'select', 'include', 'omit'],
    responseDesc: 'Array of created records (201)',
    errors: [400, 403, 409, 500, 501, 503],
    supportsSelect: true,
    supportsInclude: true,
    supportsOmit: true,
    notes: 'Like createMany but returns created records. data items are scalar-only. Requires Prisma 5.14.0+, PostgreSQL/CockroachDB/SQLite only. The order of returned records is not guaranteed.',
  },
  update: {
    transport: 'PUT JSON body',
    required: ['where', 'data'],
    optional: ['select', 'include', 'omit'],
    responseDesc: 'Updated record',
    errors: [400, 403, 404, 409, 500, 501, 503],
    supportsSelect: true,
    supportsInclude: true,
    supportsOmit: true,
    notes: '404 when the record to update is not found. 409 on unique constraint violation or transaction conflict.',
  },
  updateMany: {
    transport: 'PUT JSON body',
    required: ['where', 'data'],
    optional: [],
    responseDesc: '{ count: number }',
    errors: [400, 403, 409, 500, 501, 503],
    supportsSelect: false,
    supportsInclude: false,
    supportsOmit: false,
    notes: 'Updates all matching records with scalar-only data. Nested relation writes are not supported. Returns count, not records. 409 on unique constraint violation.',
  },
  updateManyAndReturn: {
    transport: 'PUT JSON body',
    required: ['where', 'data'],
    optional: ['select', 'include', 'omit'],
    responseDesc: 'Array of updated records',
    errors: [400, 403, 409, 500, 501, 503],
    supportsSelect: true,
    supportsInclude: true,
    supportsOmit: true,
    notes: 'Like updateMany but returns updated records. data is scalar-only. Requires Prisma 6.2.0+, PostgreSQL/CockroachDB/SQLite only. 409 on unique constraint violation.',
  },
  upsert: {
    transport: 'PATCH JSON body',
    required: ['where', 'create', 'update'],
    optional: ['select', 'include', 'omit'],
    responseDesc: 'Created or updated record',
    errors: [400, 403, 409, 500, 501, 503],
    supportsSelect: true,
    supportsInclude: true,
    supportsOmit: true,
    notes: 'Creates if not found, updates if found.',
  },
  delete: {
    transport: 'DELETE JSON body',
    required: ['where'],
    optional: ['select', 'include', 'omit'],
    responseDesc: 'Deleted record',
    errors: [400, 403, 404, 500, 501, 503],
    supportsSelect: true,
    supportsInclude: true,
    supportsOmit: true,
    notes: '404 when the record to delete is not found.',
  },
  deleteMany: {
    transport: 'DELETE JSON body',
    required: ['where'],
    optional: [],
    responseDesc: '{ count: number }',
    errors: [400, 403, 500, 501, 503],
    supportsSelect: false,
    supportsInclude: false,
    supportsOmit: false,
    notes: 'Deletes all matching records. Returns count, not records.',
  },
  count: {
    transport: 'GET query params',
    required: [],
    optional: ['where', 'orderBy', 'cursor', 'take', 'skip', 'select'],
    responseDesc: 'Integer, or per-field count object when select is provided',
    errors: [400, 403, 500, 501, 503],
    supportsSelect: false,
    supportsInclude: false,
    supportsOmit: false,
    notes: 'select here means count-specific field selection, not record field selection.',
  },
  aggregate: {
    transport: 'GET query params',
    required: [],
    optional: ['where', 'orderBy', 'cursor', 'take', 'skip', '_count', '_avg', '_sum', '_min', '_max'],
    responseDesc: 'Object with requested aggregate fields (_count, _avg, _sum, _min, _max)',
    errors: [400, 403, 500, 501, 503],
    supportsSelect: false,
    supportsInclude: false,
    supportsOmit: false,
    notes: '_avg, _sum only apply to numeric fields.',
  },
  groupBy: {
    transport: 'GET query params',
    required: ['by'],
    optional: ['where', 'orderBy', 'having', 'take', 'skip', '_count', '_avg', '_sum', '_min', '_max'],
    responseDesc: 'Array of objects, each with grouped field values and requested aggregates',
    errors: [400, 403, 500, 501, 503],
    supportsSelect: false,
    supportsInclude: false,
    supportsOmit: false,
    notes: 'by is a JSON-encoded array of scalar field names. orderBy is required when using skip or take. Response contains only the by-fields plus requested aggregates.',
  },
}

function exampleValue(fieldName: string): unknown {
  return EXAMPLE_VALUES[fieldName] ?? 'example'
}

function compoundWhereExample(): Record<string, any> | null {
  if (COMPOUND_ID) {
    const keyName = COMPOUND_ID.fields.join('_')
    const val: Record<string, unknown> = {}
    for (const f of COMPOUND_ID.fields) val[f] = exampleValue(f)
    return { [keyName]: val }
  }
  if (COMPOUND_UNIQUES.length > 0) {
    const u = COMPOUND_UNIQUES[0]
    const keyName = u.name || u.fields.join('_')
    const val: Record<string, unknown> = {}
    for (const f of u.fields) val[f] = exampleValue(f)
    return { [keyName]: val }
  }
  return null
}

function isOpenApiDisabled(disableOpenApi?: boolean) {
  if (disableOpenApi === true) return true
  if (disableOpenApi === false) return false
  return _env.DISABLE_OPENAPI === 'true' || _env.NODE_ENV === 'production'
}

function isPlaygroundAvailable(config: DocsConfig) {
  if (config.queryBuilder === false) return false
  if (typeof config.queryBuilder === 'object' && config.queryBuilder.enabled === false) return false
  if (_env.NODE_ENV === 'production') return false
  return true
}

function escapeHtml(input: string) {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function safeJsonForHtml(obj: unknown): string {
  return JSON.stringify(obj).replace(/</g, '\\\\u003c')
}

function renderScalar(_modelName: string, spec: unknown, title: string, cdnUrl?: string) {
  const scalarSrc = cdnUrl || DEFAULT_SCALAR_CDN
  return \`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>\${escapeHtml(title)}</title>
</head>
<body>
  <script id="api-reference" type="application/json">\${safeJsonForHtml(spec)}</script>
  <script src="\${escapeHtml(scalarSrc)}"></script>
</body>
</html>\`
}

function renderPlayground(modelName: string, config: DocsConfig) {
  const qbConfig = (typeof config.queryBuilder === 'object' && config.queryBuilder) ? config.queryBuilder : {}
  const host = qbConfig.host || 'localhost'
  const port = qbConfig.port || 5173
  const baseUrl = \`http://\${host}:\${port}\`
  const iframeSrc = \`\${baseUrl}?embedded=true&hideHeader=true\`
  const title = config.docsTitle || \`\${modelName} Query Playground\`

  const openApiLinks =
    '<a class="inline-block border border-gray-200 bg-white rounded-full py-1 px-2.5 text-[11px] no-underline text-inherit hover:border-gray-400" href="?ui=docs">Docs</a>' +
    '<a class="inline-block border border-gray-200 bg-white rounded-full py-1 px-2.5 text-[11px] no-underline text-inherit hover:border-gray-400" href="?ui=scalar">Scalar</a>' +
    '<a class="inline-block border border-gray-200 bg-white rounded-full py-1 px-2.5 text-[11px] no-underline text-inherit hover:border-gray-400" href="?ui=json">JSON</a>' +
    '<a class="inline-block border border-gray-200 bg-white rounded-full py-1 px-2.5 text-[11px] no-underline text-inherit hover:border-gray-400" href="?ui=yaml">YAML</a>' +
    '<a class="inline-block border border-gray-900 bg-gray-900 text-white rounded-full py-1 px-2.5 text-[11px] no-underline" href="?ui=playground">Playground</a>'

  return \`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>\${escapeHtml(title)}</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="m-0 bg-white text-gray-900 font-sans">
  <div class="flex items-center justify-between px-4 py-2.5 border-b border-gray-200 bg-gray-50 flex-wrap gap-2">
    <div class="flex items-center gap-3">
      <span class="text-sm font-bold">Query Playground</span>
      <span class="text-xs text-gray-500 font-mono">\${escapeHtml(modelName)}</span>
    </div>
    <div class="flex gap-1.5 flex-wrap">\${openApiLinks}</div>
  </div>
  <div class="h-[calc(100vh-52px)] w-full" id="frame-container">
    <iframe
      id="qb-frame"
      class="w-full h-full border-none"
      src="\${escapeHtml(iframeSrc)}"
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      loading="lazy"
    ></iframe>
  </div>
  <script>
    (function() {
      var frame = document.getElementById('qb-frame');
      var container = document.getElementById('frame-container');
      var timer = null;

      frame.addEventListener('error', showError);

      timer = setTimeout(function() {
        try {
          if (!frame.contentWindow || !frame.contentWindow.document) {
            showError();
          }
        } catch(e) {}
      }, 5000);

      frame.addEventListener('load', function() {
        if (timer) clearTimeout(timer);
      });

      function showError() {
        if (timer) clearTimeout(timer);
        container.innerHTML =
          '<div class="flex items-center justify-center h-[calc(100vh-52px)] text-gray-500 text-sm flex-col gap-3">' +
          '<div>Query builder is not running</div>' +
          '<code class="font-mono bg-gray-50 py-2 px-3.5 rounded-md text-[13px]">npx prisma-query-builder</code>' +
          '<div class="text-xs mt-1">Expected at: \${escapeHtml(baseUrl)}</div>' +
          '</div>';
      }
    })();
  </script>
</body>
</html>\`
}

function isScalarField(f: FieldMeta) {
  return f.kind === 'scalar'
}

function isRelationField(f: FieldMeta) {
  return f.kind === 'object'
}

function isEnumField(f: FieldMeta) {
  return f.kind === 'enum'
}

function scalarFilterOperators(scalarType: string) {
  if (scalarType === 'String') {
    return [
      'equals',
      'in',
      'notIn',
      'lt',
      'lte',
      'gt',
      'gte',
      'contains',
      'startsWith',
      'endsWith',
      'mode',
      'not',
    ]
  }

  if (
    scalarType === 'Int' ||
    scalarType === 'BigInt' ||
    scalarType === 'Float' ||
    scalarType === 'Decimal'
  ) {
    return ['equals', 'in', 'notIn', 'lt', 'lte', 'gt', 'gte', 'not']
  }

  if (scalarType === 'DateTime') {
    return ['equals', 'in', 'notIn', 'lt', 'lte', 'gt', 'gte', 'not']
  }

  if (scalarType === 'Boolean') {
    return ['equals', 'not']
  }

  if (scalarType === 'Json') {
    return ['equals', 'path', 'string_contains', 'array_contains', 'not']
  }

  if (scalarType === 'Bytes') {
    return ['equals', 'in', 'notIn', 'not']
  }

  return ['equals', 'in', 'notIn', 'not']
}

function listFilterOperators() {
  return ['has', 'hasEvery', 'hasSome', 'isEmpty']
}

function whereFieldKind(f: FieldMeta) {
  if (isRelationField(f)) return f.isList ? 'relation-list' : 'relation-single'
  if (isEnumField(f)) return 'enum'
  if (isScalarField(f)) return f.isList ? 'scalar-list' : 'scalar'
  return 'unknown'
}

function whereFieldShape(f: FieldMeta) {
  const kind = whereFieldKind(f)

  if (kind === 'relation-list') {
    return '{ some?: RelatedWhere, every?: RelatedWhere, none?: RelatedWhere }'
  }

  if (kind === 'relation-single') {
    return '{ is?: RelatedWhere, isNot?: RelatedWhere }'
  }

  if (kind === 'scalar-list') {
    return '{ has?, hasEvery?, hasSome?, isEmpty? }'
  }

  if (kind === 'scalar') {
    return 'scalar value OR filter object'
  }

  if (kind === 'enum') {
    return 'enum value OR enum filter'
  }

  return 'n/a'
}

function describeFieldType(f: FieldMeta) {
  const base = String(f.type) + (f.isList ? '[]' : '')
  const optional = f.isRequired ? '' : ' (optional/nullable)'
  const flags = [
    f.isId ? 'id' : '',
    f.isUnique ? 'unique' : '',
    f.hasDefaultValue ? 'default' : '',
    f.isUpdatedAt ? 'updatedAt' : '',
  ].filter(Boolean)
  const suffix = flags.length ? ' [' + flags.join(', ') + ']' : ''
  return base + optional + suffix
}

function jsonBlock(v: unknown) {
  return '<pre class="my-2 rounded-xl !p-3 overflow-auto text-xs"><code class="language-json">' + escapeHtml(JSON.stringify(v, null, 2)) + '</code></pre>'
}

function codeBlock(text: string) {
  return '<pre class="my-2 rounded-xl !p-3 overflow-auto text-xs"><code class="language-javascript">' + escapeHtml(text) + '</code></pre>'
}

function anchors() {
  return [
    { id: 'ops', label: '1. Operations' },
    { id: 'transport', label: '2. Transport' },
    { id: 'args-read', label: '3. Read Args Reference' },
    { id: 'args-write', label: '4. Write Args Reference' },
    { id: 'where', label: '5. where' },
    { id: 'select-include', label: '6. select, include & omit' },
    { id: 'nested-writes', label: '7. Nested Writes' },
    { id: 'order', label: '8. orderBy / cursor / distinct' },
    { id: 'pagination', label: '9. Pagination' },
    { id: 'errors', label: '10. Error Handling' },
    { id: 'examples', label: '11. Examples' },
    { id: 'guard-shapes', label: '12. Guard Shapes' },
    { id: 'runtime', label: '13. Runtime Notes' },
  ]
}

function normalizeExamplePrefix(p: string): string {
  if (!p) return ''
  let result = p.replace(/\\/$/, '')
  if (result && !result.startsWith('/')) result = '/' + result
  return result
}

function buildExampleBasePath(modelName: string, config: DocsConfig) {
  const prefixSource = config.specBasePath ?? config.customUrlPrefix ?? ''
  const prefix = normalizeExamplePrefix(prefixSource)
  const modelPrefix = config.addModelPrefix !== false ? '/' + modelName.toLowerCase() : ''
  return prefix + modelPrefix
}

function buildFullPath(basePath: string, suffix: string) {
  if (!suffix) return basePath || '/'
  return basePath ? basePath + suffix : suffix
}

function renderDocs(modelName: string, config: DocsConfig) {
  const title = config.docsTitle || modelName + ' API'
  const generatedAt = new Date().toISOString()

  const modelLower = modelName.charAt(0).toLowerCase() + modelName.slice(1)
  const exampleBasePath = buildExampleBasePath(modelName, config)

  const scalarFields = MODEL_FIELDS.filter((f) => isScalarField(f) || isEnumField(f))
  const relationFields = MODEL_FIELDS.filter((f) => isRelationField(f))

  const uniqueFields = MODEL_FIELDS.filter((f) => f.isId || f.isUnique)
  const requiredCreateFields = scalarFields.filter((sf) => sf.isRequired && !sf.hasDefaultValue && !sf.isUpdatedAt)
  const listRelations = relationFields.filter((f) => f.isList)
  const singleRelations = relationFields.filter((f) => !f.isList)

  const ops = OPERATION_DEFS
    .filter((d) => isOperationEnabled(config as Record<string, any>, d))
    .map((d) => {
      const detail = OP_DETAIL_MAP[d.name]
      return {
        op: d.name,
        method: d.method.toUpperCase(),
        path: buildFullPath(exampleBasePath, d.pathSuffix),
        transport: detail ? detail.transport : d.method === 'get' ? 'GET query params' : 'JSON body',
        responseDesc: detail ? detail.responseDesc : '',
        errors: detail ? detail.errors.join(', ') : '',
        required: detail ? detail.required : [],
        optional: detail ? detail.optional : [],
        supportsSelect: detail ? detail.supportsSelect : false,
        supportsInclude: detail ? detail.supportsInclude : false,
        supportsOmit: detail ? detail.supportsOmit : false,
        notes: detail ? detail.notes : '',
      }
    })

  const firstUnique = uniqueFields[0]
  const firstUniqueExample = firstUnique ? exampleValue(firstUnique.name) : null
  const compoundWhere = !firstUnique ? compoundWhereExample() : null
  const uniqueWhereExample = firstUnique
    ? { [firstUnique.name]: firstUniqueExample }
    : compoundWhere

  const firstFilterFieldName = firstUnique
    ? firstUnique.name
    : (COMPOUND_ID ? COMPOUND_ID.fields[0] : null)
      || (COMPOUND_UNIQUES.length > 0 ? COMPOUND_UNIQUES[0].fields[0] : null)

  const firstStringField = scalarFields.find((f) => f.type === 'String')
  const firstBooleanField = scalarFields.find((f) => f.type === 'Boolean')

  const whereExample: Record<string, any> = {}
  const andClauses: Record<string, any>[] = []
  if (firstFilterFieldName) {
    andClauses.push({ [firstFilterFieldName]: { equals: exampleValue(firstFilterFieldName) } })
  }
  if (firstStringField) {
    andClauses.push({ [firstStringField.name]: { contains: 'example', mode: 'insensitive' } })
  }
  if (andClauses.length > 0) {
    whereExample.AND = andClauses
  }
  if (firstBooleanField) {
    whereExample.OR = [{ [firstBooleanField.name]: { equals: true } }]
  }

  const selectExample: any = {}
  for (const f of scalarFields.slice(0, 10)) selectExample[f.name] = true

  const includeExample: any = {}
  for (const f of relationFields.slice(0, 6)) includeExample[f.name] = true

  const omitExample: any = {}
  const omitCandidates = scalarFields.filter((f) => !f.isId && !f.isUnique)
  for (const f of omitCandidates.slice(0, 3)) omitExample[f.name] = true

  const orderByField = firstUnique
    ? firstUnique.name
    : firstFilterFieldName

  const findManyQueryArgs: any = {
    where: whereExample,
    select: selectExample,
    orderBy: orderByField ? { [orderByField]: 'asc' } : undefined,
    take: 20,
    skip: 0,
  }
  if (!findManyQueryArgs.orderBy) delete findManyQueryArgs.orderBy

  const findManyFetchExample =
    'import { encodeQueryParams } from "./client/encodeQueryParams"\\n\\n' +
    'const params = encodeQueryParams(' + JSON.stringify(findManyQueryArgs, null, 2) + ')\\n\\n' +
    'const res = await fetch(BASE_URL + "' + exampleBasePath + '?" + params)\\n' +
    'const data = await res.json()'

  const findUniqueFetchExample = uniqueWhereExample
    ? 'const params = encodeQueryParams({\\n' +
      '  where: ' + JSON.stringify(uniqueWhereExample) + ',\\n' +
      '  include: ' + JSON.stringify(includeExample) + '\\n' +
      '})\\n\\n' +
      'const res = await fetch(BASE_URL + "' + exampleBasePath + '/unique?" + params)\\n' +
      'const data = await res.json()'
    : null

  const createBodyExample: any = { data: {} }
  for (const f of requiredCreateFields.slice(0, 5)) {
    createBodyExample.data[f.name] = exampleValue(f.name)
  }

  const createFetchExample =
    'const res = await fetch(BASE_URL + "' + exampleBasePath + '", {\\n' +
    '  method: "POST",\\n' +
    '  headers: { "Content-Type": "application/json" },\\n' +
    '  body: JSON.stringify(' + JSON.stringify(createBodyExample, null, 2) + ')\\n' +
    '})\\n' +
    'const created = await res.json()'

  const updateBodyExample: any = uniqueWhereExample
    ? { where: uniqueWhereExample, data: {} }
    : null
  if (updateBodyExample) {
    const firstEditableString = scalarFields.find((sf) => sf.type === 'String' && !sf.isId)
    if (firstEditableString) {
      updateBodyExample.data[firstEditableString.name] = 'updated'
    }
  }

  const updateFetchExample = updateBodyExample
    ? 'const res = await fetch(BASE_URL + "' + exampleBasePath + '", {\\n' +
      '  method: "PUT",\\n' +
      '  headers: { "Content-Type": "application/json" },\\n' +
      '  body: JSON.stringify(' + JSON.stringify(updateBodyExample, null, 2) + ')\\n' +
      '})\\n' +
      'const updated = await res.json()'
    : null

  const deleteFetchExample = uniqueWhereExample
    ? 'const res = await fetch(BASE_URL + "' + exampleBasePath + '", {\\n' +
      '  method: "DELETE",\\n' +
      '  headers: { "Content-Type": "application/json" },\\n' +
      '  body: JSON.stringify({\\n' +
      '    where: ' + JSON.stringify(uniqueWhereExample) + '\\n' +
      '  })\\n' +
      '})\\n' +
      'const deleted = await res.json()'
    : null

  const guardVariantHeader = config.guard?.variantHeader || 'x-api-variant'

  const guardFetchExample = uniqueWhereExample
    ? 'const params = encodeQueryParams({\\n' +
      '  where: ' + JSON.stringify(uniqueWhereExample) + '\\n' +
      '})\\n\\n' +
      'const res = await fetch(BASE_URL + "' + exampleBasePath + '/unique?" + params, {\\n' +
      '  headers: { "' + guardVariantHeader + '": "admin" }\\n' +
      '})\\n' +
      'const data = await res.json()'
    : null

  const writeFieldRows = MODEL_FIELDS.map((f) => {
    let writeContract = ''
    if (isRelationField(f)) {
      writeContract = f.isList ? 'Nested list write object' : 'Nested single write object'
    } else if (f.hasDefaultValue || f.isUpdatedAt) {
      writeContract = 'Optional on create (has default)'
    } else if (f.isRequired) {
      writeContract = 'Required on create'
    } else {
      writeContract = 'Optional (nullable)'
    }
    return {
      name: f.name,
      type: describeFieldType(f),
      writeContract,
    }
  })

  const argsReferenceRead = {
    findMany: {
      where: 'WhereInput',
      select: 'Select',
      include: 'Include',
      omit: 'Omit',
      orderBy: 'OrderByInput | OrderByInput[]',
      cursor: 'UniqueInput',
      take: 'number',
      skip: 'number',
      distinct: 'ScalarFieldEnum | ScalarFieldEnum[]',
    },
    findUnique: {
      where: 'UniqueInput (required)',
      select: 'Select',
      include: 'Include',
      omit: 'Omit',
    },
    findFirst: {
      where: 'WhereInput',
      select: 'Select',
      include: 'Include',
      omit: 'Omit',
      orderBy: 'OrderByInput | OrderByInput[]',
      cursor: 'UniqueInput',
      take: 'number',
      skip: 'number',
      distinct: 'ScalarFieldEnum | ScalarFieldEnum[]',
    },
    count: {
      where: 'WhereInput',
      orderBy: 'OrderByInput | OrderByInput[]',
      cursor: 'UniqueInput',
      take: 'number',
      skip: 'number',
      select: 'true | { _all?: true, fieldName?: true, ... }',
    },
    aggregate: {
      where: 'WhereInput',
      orderBy: 'OrderByInput | OrderByInput[]',
      cursor: 'UniqueInput',
      take: 'number',
      skip: 'number',
      _count: 'true | CountAggregateInput',
      _avg: 'AvgAggregateInput',
      _sum: 'SumAggregateInput',
      _min: 'MinAggregateInput',
      _max: 'MaxAggregateInput',
    },
    groupBy: {
      by: 'ScalarFieldEnum[] (required)',
      where: 'WhereInput',
      orderBy: 'OrderByWithAggregationInput | OrderByWithAggregationInput[] (required when using skip or take)',
      having: 'ScalarWhereWithAggregatesInput',
      take: 'number',
      skip: 'number',
      _count: 'true | CountAggregateInput',
      _avg: 'AvgAggregateInput',
      _sum: 'SumAggregateInput',
      _min: 'MinAggregateInput',
      _max: 'MaxAggregateInput',
    },
  }

  const argsReferenceWrite = {
    create: {
      data: modelName + 'CreateInput (required)',
      select: 'Select',
      include: 'Include',
      omit: 'Omit',
    },
    createMany: {
      data: modelName + 'CreateManyInput[] (required, scalar-only)',
      skipDuplicates: 'boolean',
    },
    createManyAndReturn: {
      data: modelName + 'CreateManyInput[] (required, scalar-only)',
      skipDuplicates: 'boolean',
      select: 'Select',
      include: 'Include',
      omit: 'Omit',
    },
    update: {
      where: 'UniqueInput (required)',
      data: modelName + 'UpdateInput (required)',
      select: 'Select',
      include: 'Include',
      omit: 'Omit',
    },
    updateMany: {
      where: 'WhereInput (required)',
      data: modelName + 'UpdateManyMutationInput (required, scalar-only)',
    },
    updateManyAndReturn: {
      where: 'WhereInput (required)',
      data: modelName + 'UpdateManyMutationInput (required, scalar-only)',
      select: 'Select',
      include: 'Include',
      omit: 'Omit',
    },
    upsert: {
      where: 'UniqueInput (required)',
      create: modelName + 'CreateInput (required)',
      update: modelName + 'UpdateInput (required)',
      select: 'Select',
      include: 'Include',
      omit: 'Omit',
    },
    delete: {
      where: 'UniqueInput (required)',
      select: 'Select',
      include: 'Include',
      omit: 'Omit',
    },
    deleteMany: {
      where: 'WhereInput (required)',
    },
  }

  const transportNotes = [
    'GET endpoints: Prisma args as JSON-encoded query parameter strings via encodeQueryParams.',
    'POST/PUT/DELETE/PATCH endpoints: Prisma args as JSON request body. Body must be a JSON object.',
    'findManyPaginated returns { data, total, hasMore }. hasMore is reliable for forward offset pagination only.',
    'Batch mutations (createMany, updateMany, deleteMany) return { count }. Batch data inputs are scalar-only — nested relation writes are not supported.',
    'findUnique and findFirst return null (not 404) when no record matches. Use the OrThrow variants for 404 behavior.',
    'createManyAndReturn requires Prisma 5.14.0+, updateManyAndReturn requires Prisma 6.2.0+. Both are limited to PostgreSQL, CockroachDB, and SQLite.',
  ]

  const errorRows = [
    { status: '400', description: 'Bad request', causes: 'Invalid JSON body, invalid query parameters, query validation failure, guard shape rejection, field value out of range, non-object request body.' },
    { status: '403', description: 'Forbidden', causes: 'Guard policy rejected the operation.' },
    { status: '404', description: 'Not found', causes: 'Record not found. Only from OrThrow operations, update, and delete.' },
    { status: '409', description: 'Conflict', causes: 'Unique constraint violation on create/update/upsert, or transaction conflict (e.g. in findManyPaginated).' },
    { status: '500', description: 'Internal server error', causes: 'Database error, table/column missing, raw query failure, or unhandled error.' },
    { status: '501', description: 'Not implemented', causes: 'Database provider does not support the requested feature.' },
    { status: '503', description: 'Service unavailable', causes: 'Database connection pool timeout.' },
  ]

  const hasPlayground = isPlaygroundAvailable(config)

  const chipClass = 'inline-block border border-gray-200 bg-gray-50 rounded-full py-[5px] px-2.5 text-xs no-underline text-inherit hover:border-gray-400'

  const openApiLinks =
    '<a class="' + chipClass + ' !bg-gray-900 !text-white !border-gray-900" href="?ui=docs">Docs</a>' +
    '<a class="' + chipClass + '" href="?ui=scalar">Scalar</a>' +
    '<a class="' + chipClass + '" href="?ui=json">JSON</a>' +
    '<a class="' + chipClass + '" href="?ui=yaml">YAML</a>' +
    (hasPlayground ? '<a class="' + chipClass + '" href="?ui=playground">Playground</a>' : '')

  const tocHtml = '<ol class="m-0 pl-[18px]">' + anchors().map((a) => '<li class="my-1.5"><a href="#' + escapeHtml(a.id) + '" class="text-inherit">' + escapeHtml(a.label) + '</a></li>').join('') + '</ol>'

  const whereRows = MODEL_FIELDS.map((f) => {
    const kind = whereFieldKind(f)
    const shape = whereFieldShape(f)
    const filterOps =
      kind === 'scalar'
        ? scalarFilterOperators(String(f.type)).map((x) => '<span class="inline-block border border-gray-200 bg-gray-50 rounded-full py-0.5 px-2 text-[11px] mr-1.5 mb-0.5 font-mono">' + escapeHtml(x) + '</span>').join(' ')
        : kind === 'enum'
          ? ['equals', 'in', 'notIn', 'not'].map((x) => '<span class="inline-block border border-gray-200 bg-gray-50 rounded-full py-0.5 px-2 text-[11px] mr-1.5 mb-0.5 font-mono">' + escapeHtml(x) + '</span>').join(' ')
          : kind === 'scalar-list'
            ? listFilterOperators().map((x) => '<span class="inline-block border border-gray-200 bg-gray-50 rounded-full py-0.5 px-2 text-[11px] mr-1.5 mb-0.5 font-mono">' + escapeHtml(x) + '</span>').join(' ')
            : kind === 'relation-single'
              ? ['is', 'isNot'].map((x) => '<span class="inline-block border border-gray-200 bg-gray-50 rounded-full py-0.5 px-2 text-[11px] mr-1.5 mb-0.5 font-mono">' + escapeHtml(x) + '</span>').join(' ')
              : kind === 'relation-list'
                ? ['some', 'every', 'none'].map((x) => '<span class="inline-block border border-gray-200 bg-gray-50 rounded-full py-0.5 px-2 text-[11px] mr-1.5 mb-0.5 font-mono">' + escapeHtml(x) + '</span>').join(' ')
                : '<span class="text-gray-500">n/a</span>'

    const doc = f.documentation ? '<div class="text-gray-500 mt-1.5">' + escapeHtml(String(f.documentation)) + '</div>' : ''

    return (
      '<tr>' +
      '<td class="text-left p-2 border-b border-gray-200 align-top font-mono">' + escapeHtml(f.name) + '</td>' +
      '<td class="text-left p-2 border-b border-gray-200 align-top font-mono">' + escapeHtml(kind) + '</td>' +
      '<td class="text-left p-2 border-b border-gray-200 align-top font-mono">' + escapeHtml(describeFieldType(f)) + '</td>' +
      '<td class="text-left p-2 border-b border-gray-200 align-top"><div class="text-gray-500 font-mono">' + escapeHtml(shape) + '</div><div class="mt-2">' + filterOps + '</div>' + doc + '</td>' +
      '</tr>'
    )
  }).join('')

  const whereCoreShapes = {
    where: {
      AND: ['WhereInput', 'WhereInput[]'],
      OR: ['WhereInput[]'],
      NOT: ['WhereInput', 'WhereInput[]'],
      field: 'ScalarFilter | scalar value | RelationFilter | EnumFilter',
    },
  }

  const selectRules = [
    'select and include cannot be used together at the same level.',
    'omit cannot be used together with select at the same level. omit can be used with include.',
    'select: booleans for scalars, nested objects for relations.',
    'include: booleans for relations, nested include/select for deep loading.',
    'omit: booleans for scalar fields to exclude from the response.',
  ]

  const orderRules = [
    'orderBy: { field: "asc" | "desc" } or array for multiple.',
    'cursor: unique selector, e.g. { id: 123 }.',
    'distinct: scalar field names, e.g. ["email", "status"].',
    'take/skip applied after cursor/orderBy.',
  ]

  const paginationNotes = [
    'findMany and findManyPaginated support offset pagination via take and skip.',
    'Both also support cursor-based pagination via cursor + take.',
    'findManyPaginated wraps findMany with a total count query and returns { data, total, hasMore }.',
    'hasMore is reliable for forward offset pagination (skip + take) only. With cursor pagination or negative take, hasMore may be inaccurate.',
    'When the server config sets pagination.defaultLimit, take is automatically applied to findMany and findManyPaginated if omitted.',
    'When the server config sets pagination.maxLimit, take is capped by absolute value to that limit for findMany and findManyPaginated. This applies to both positive and negative take values.',
    'Clients cannot detect these server-side limits from the API alone. Check with the API provider for configured limits.',
  ]

  const nestedWriteListOps = [
    { key: 'create', desc: 'Create new related records inline. Accepts a single object or array.' },
    { key: 'connect', desc: 'Connect existing records by unique identifier. Accepts a single object or array.' },
    { key: 'connectOrCreate', desc: 'Connect if exists, create if not. Each item: { where, create }.' },
    { key: 'createMany', desc: 'Bulk create related records. Shape: { data: [...], skipDuplicates?: boolean }.' },
    { key: 'set', desc: 'Replace all connections. Provide an array of unique identifiers.' },
    { key: 'disconnect', desc: 'Disconnect related records without deleting them.' },
    { key: 'delete', desc: 'Delete related records by unique identifier.' },
    { key: 'update', desc: 'Update related records. Each item: { where, data }.' },
    { key: 'updateMany', desc: 'Bulk update related records matching a filter. Each item: { where, data }.' },
    { key: 'deleteMany', desc: 'Bulk delete related records matching a filter.' },
    { key: 'upsert', desc: 'Create or update related records. Each item: { where, create, update }.' },
  ]

  const nestedWriteSingleOps = [
    { key: 'create', desc: 'Create a new related record inline.' },
    { key: 'connect', desc: 'Connect an existing record by unique identifier.' },
    { key: 'connectOrCreate', desc: 'Connect if exists, create if not. Shape: { where, create }.' },
    { key: 'disconnect', desc: 'Disconnect the related record (set relation to null). Pass true.' },
    { key: 'delete', desc: 'Delete the related record. Pass true.' },
    { key: 'update', desc: 'Update the related record inline with update input.' },
    { key: 'upsert', desc: 'Create the related record if it does not exist, update if it does. Shape: { create, update }.' },
  ]

  const guardShapeInfo = [
    'When a guard shape is configured on an operation, prisma-guard validates and enforces allowed query patterns before the query reaches the database.',
    'Named shapes route to different guard configs based on a caller value resolved from the <span class="font-mono">' + escapeHtml(guardVariantHeader) + '</span> header or a custom resolver function.',
    'Forced values (literals instead of true) are injected server-side and cannot be overridden by the client.',
  ]

  const runtimeNotes = [
    '<strong>Query parameter parsing:</strong> GET query values are parsed server-side. Strings starting with <span class="font-mono">{</span>, <span class="font-mono">[</span>, or <span class="font-mono">\\"</span> are JSON-parsed. The strings <span class="font-mono">true</span>, <span class="font-mono">false</span>, <span class="font-mono">null</span> are converted to their JS equivalents. Numeric conversion only applies to <span class="font-mono">take</span> and <span class="font-mono">skip</span>. Use <span class="font-mono">encodeQueryParams</span> to avoid encoding issues.',
    '<strong>Request body validation:</strong> All write endpoints require a JSON object body. Sending <span class="font-mono">null</span>, arrays, or non-object JSON values returns 400.',
    '<strong>Documentation in production:</strong> Docs endpoints are disabled by default when <span class="font-mono">NODE_ENV=production</span> or <span class="font-mono">DISABLE_OPENAPI=true</span>. To enable in production, set <span class="font-mono">disableOpenApi: false</span> in the route config.',
    '<strong>Paginated query atomicity:</strong> findManyPaginated wraps data + count in a database transaction when available. If interactive transactions are not supported (e.g. some edge adapters), the queries run separately and data/total may be slightly inconsistent under concurrent writes.',
    '<strong>Distinct count approximation:</strong> When findManyPaginated is used with distinct and the number of unique values exceeds 100,000, the total falls back to a non-distinct count which may overcount. The hasMore value is affected accordingly.',
    '<strong>Serialization:</strong> BigInt values are serialized as strings. Bytes/Buffer values are serialized as base64 strings. Decimal values are serialized as strings. DateTime values are serialized as ISO 8601 strings.',
    '<strong>Playground:</strong> The query playground embeds an iframe to a local prisma-query-builder-ui instance. It connects to your real database using the configured DATABASE_URL. It is disabled in production and when queryBuilder is set to false or queryBuilder.enabled is set to false.',
    '<strong>Prototype pollution protection:</strong> All incoming JSON bodies and query parameters are sanitized to reject __proto__, constructor, and prototype keys.',
    '<strong>Batch operation safety:</strong> deleteMany, updateMany, and updateManyAndReturn require a where field in the request body. Requests without where are rejected with 400 to prevent accidental mass operations.',
    '<strong>Bulk write constraints:</strong> createMany, createManyAndReturn, updateMany, and updateManyAndReturn accept scalar-only data inputs. Nested relation writes are not supported in these operations.',
    '<strong>Provider compatibility:</strong> createManyAndReturn requires Prisma 5.14.0+ and is limited to PostgreSQL, CockroachDB, and SQLite. updateManyAndReturn requires Prisma 6.2.0+ with the same provider restrictions. skipDuplicates is not supported on all database providers.',
    '<strong>omit compatibility:</strong> The omit parameter requires Prisma 5.13.0+ (preview) or 6.2.0+ (GA). On older Prisma versions, requests using omit will return 400.',
  ]

  const noUniqueFieldNote = '<div class="bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs text-gray-500">This model has no unique or id fields suitable for a generated example. Use the unique constraint from your schema.</div>'

  const thClass = 'text-left p-2 border-b border-gray-200 align-top font-black'
  const tdClass = 'text-left p-2 border-b border-gray-200 align-top'
  const calloutClass = 'bg-gray-50 border border-gray-200 rounded-xl p-3'

  const html = \`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>\${escapeHtml(title)}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="\${PRISM_CSS}" />
  <style>
    .example :not(pre)>code[class*=language-], .example pre[class*=language-] { border: 1px solid rgb(229 230 234); }
    :not(pre)>code[class*=language-], pre[class*=language-] { background: #f9fafb; }
    pre[class*="language-"] { border-radius: 12px; padding: 12px; margin: 8px 0; font-size: 12px; }
    code[class*="language-"] { font-size: 12px; }
  </style>
</head>
<body class="m-0 bg-white text-gray-900 font-sans leading-relaxed">
  <div class="max-w-[1120px] mx-auto px-5 pt-[30px] pb-20">
    <div class="border-b-2 border-gray-900 pb-3 mb-[18px] flex gap-3.5 items-start justify-between flex-wrap">
      <div class="min-w-[280px]">
        <div class="text-xl font-black">\${escapeHtml(title)}</div>
        <div class="mt-2 text-xs text-gray-500">
          <span class="font-mono">\${escapeHtml(modelLower)}</span>
          <span class="mx-2">·</span>
          <span>\${escapeHtml(generatedAt)}</span>
        </div>
      </div>
      <div class="flex gap-2 flex-wrap items-center pt-0.5">\${openApiLinks}</div>
    </div>

    <div class="\${calloutClass}">\${tocHtml}</div>

    <h2 class="mt-[18px] mb-2 text-base border-t border-gray-200 pt-3.5" id="ops">1. Operations</h2>
    <div class="overflow-x-auto">
    <table class="w-full border-collapse text-xs">
      <thead>
        <tr>
          <th class="\${thClass}">Operation</th>
          <th class="\${thClass}">Method</th>
          <th class="\${thClass}">Path</th>
          <th class="\${thClass}">Transport</th>
          <th class="\${thClass}">Required Args</th>
          <th class="\${thClass}">Response</th>
          <th class="\${thClass}">Errors</th>
          <th class="\${thClass}">Notes</th>
        </tr>
      </thead>
      <tbody>
        \${ops.map((o) => \`
          <tr>
            <td class="\${tdClass} font-mono">\${escapeHtml(o.op)}</td>
            <td class="\${tdClass} font-mono">\${escapeHtml(o.method)}</td>
            <td class="\${tdClass} font-mono">\${escapeHtml(o.path)}</td>
            <td class="\${tdClass}">\${escapeHtml(o.transport)}</td>
            <td class="\${tdClass} font-mono">\${o.required.length > 0 ? escapeHtml(o.required.join(', ')) : '<span class="text-gray-400">none</span>'}</td>
            <td class="\${tdClass}">\${escapeHtml(o.responseDesc)}</td>
            <td class="\${tdClass} font-mono">\${escapeHtml(o.errors)}</td>
            <td class="\${tdClass} text-gray-500">\${escapeHtml(o.notes)}</td>
          </tr>
        \`).join('')}
      </tbody>
    </table>
    </div>

    <h2 class="mt-[18px] mb-2 text-base border-t border-gray-200 pt-3.5" id="transport">2. Transport</h2>
    <div class="\${calloutClass}">
      <ul class="text-[13px]">\${transportNotes.map((t) => '<li>' + escapeHtml(t) + '</li>').join('')}</ul>
    </div>

    <h2 class="mt-[18px] mb-2 text-base border-t border-gray-200 pt-3.5" id="args-read">3. Read Args Reference</h2>
    <div class="grid grid-cols-2 gap-3.5 max-[920px]:grid-cols-1">
      <div>
        <h3 class="mt-3.5 mb-2 text-sm">3.1 Read operations</h3>
        <div class="\${calloutClass}">
          \${jsonBlock(argsReferenceRead)}
        </div>
      </div>
      <div>
        <h3 class="mt-3.5 mb-2 text-sm">3.2 Rules</h3>
        <div class="\${calloutClass}">
          <ul class="text-[13px]">
            <li><span class="font-mono">where</span> — filtering</li>
            <li><span class="font-mono">select</span> — field selection</li>
            <li><span class="font-mono">include</span> — relation loading</li>
            <li><span class="font-mono">omit</span> — exclude fields from response</li>
            <li><span class="font-mono">select</span> and <span class="font-mono">include</span> cannot be combined at the same level</li>
            <li><span class="font-mono">select</span> and <span class="font-mono">omit</span> cannot be combined at the same level</li>
            <li><span class="font-mono">orderBy</span>, <span class="font-mono">cursor</span>, <span class="font-mono">take</span>, <span class="font-mono">skip</span>, <span class="font-mono">distinct</span> — pagination and ordering</li>
            <li><span class="font-mono">groupBy</span>: <span class="font-mono">orderBy</span> is required when using <span class="font-mono">skip</span> or <span class="font-mono">take</span></li>
          </ul>
        </div>
      </div>
    </div>

    <h2 class="mt-[18px] mb-2 text-base border-t border-gray-200 pt-3.5" id="args-write">4. Write Args Reference</h2>
    <div class="grid grid-cols-2 gap-3.5 max-[920px]:grid-cols-1">
      <div>
        <h3 class="mt-3.5 mb-2 text-sm">4.1 Write operations</h3>
        <div class="\${calloutClass}">
          \${jsonBlock(argsReferenceWrite)}
        </div>
      </div>
      <div>
        <h3 class="mt-3.5 mb-2 text-sm">4.2 Field write contract</h3>
        <div class="overflow-x-auto">
        <table class="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th class="\${thClass}">Field</th>
              <th class="\${thClass}">Type</th>
              <th class="\${thClass}">Write Behavior</th>
            </tr>
          </thead>
          <tbody>
            \${writeFieldRows.map((r) => \`
              <tr>
                <td class="\${tdClass} font-mono">\${escapeHtml(r.name)}</td>
                <td class="\${tdClass} font-mono">\${escapeHtml(r.type)}</td>
                <td class="\${tdClass}">\${escapeHtml(r.writeContract)}</td>
              </tr>
            \`).join('')}
          </tbody>
        </table>
        </div>
      </div>
    </div>

    <h2 class="mt-[18px] mb-2 text-base border-t border-gray-200 pt-3.5" id="where">5. where</h2>

    <div class="grid grid-cols-2 gap-3.5 max-[920px]:grid-cols-1">
      <div>
        <h3 class="mt-3.5 mb-2 text-sm">5.1 Boolean composition</h3>
        <div class="\${calloutClass}">
          \${jsonBlock(whereCoreShapes)}
        </div>
      </div>
      <div>
        <h3 class="mt-3.5 mb-2 text-sm">5.2 Example</h3>
        <div class="\${calloutClass}">
          \${jsonBlock(whereExample)}
        </div>
      </div>
    </div>

    <h3 class="mt-3.5 mb-2 text-sm">5.3 Per-field filters</h3>

    <table class="w-full border-collapse text-xs">
      <thead>
        <tr>
          <th class="\${thClass}">Field</th>
          <th class="\${thClass}">Kind</th>
          <th class="\${thClass}">Type</th>
          <th class="\${thClass}">Accepted filters</th>
        </tr>
      </thead>
      <tbody>\${whereRows}</tbody>
    </table>

    <h2 class="mt-[18px] mb-2 text-base border-t border-gray-200 pt-3.5" id="select-include">6. select, include & omit</h2>
    <div class="grid grid-cols-2 gap-3.5 max-[920px]:grid-cols-1">
      <div>
        <h3 class="mt-3.5 mb-2 text-sm">6.1 Rules</h3>
        <div class="\${calloutClass}">
          <ul class="text-[13px]">\${selectRules.map((r) => '<li>' + escapeHtml(r) + '</li>').join('')}</ul>
        </div>
      </div>
      <div>
        <h3 class="mt-3.5 mb-2 text-sm">6.2 Examples</h3>
        <div class="\${calloutClass}">
          <div class="text-gray-500 text-xs mb-1">select</div>
          \${jsonBlock(selectExample)}
          <div class="text-gray-500 text-xs mb-1 mt-2">include</div>
          \${jsonBlock(includeExample)}
          <div class="text-gray-500 text-xs mb-1 mt-2">omit</div>
          \${jsonBlock(omitExample)}
        </div>
      </div>
    </div>

    <h2 class="mt-[18px] mb-2 text-base border-t border-gray-200 pt-3.5" id="nested-writes">7. Nested Writes</h2>
    <div class="grid grid-cols-2 gap-3.5 max-[920px]:grid-cols-1">
      <div>
        <h3 class="mt-3.5 mb-2 text-sm">7.1 List relation operations</h3>
        <div class="\${calloutClass}">
          \${listRelations.length > 0
            ? '<div class="text-xs text-gray-500 mb-2">Relations: ' + listRelations.map((f) => '<span class="font-mono">' + escapeHtml(f.name) + '</span> (' + escapeHtml(String(f.type)) + '[])').join(', ') + '</div>'
            : '<div class="text-xs text-gray-500 mb-2">This model has no list relations.</div>'}
          <table class="w-full border-collapse text-xs">
            <tbody>
              \${nestedWriteListOps.map((op) => '<tr><td class="py-1.5 pr-2 align-top font-mono border-b border-gray-200">' + escapeHtml(op.key) + '</td><td class="py-1.5 border-b border-gray-200">' + escapeHtml(op.desc) + '</td></tr>').join('')}
            </tbody>
          </table>
        </div>
        <div class="\${calloutClass} mt-2 text-xs text-gray-500">Nested write shapes depend on the related model's schema. See the related model's API docs for valid create and connect inputs. These operations are not available in bulk write endpoints (createMany, updateMany).</div>
      </div>
      <div>
        <h3 class="mt-3.5 mb-2 text-sm">7.2 Single relation operations</h3>
        <div class="\${calloutClass}">
          \${singleRelations.length > 0
            ? '<div class="text-xs text-gray-500 mb-2">Relations: ' + singleRelations.map((f) => '<span class="font-mono">' + escapeHtml(f.name) + '</span> (' + escapeHtml(String(f.type)) + ')').join(', ') + '</div>'
            : '<div class="text-xs text-gray-500 mb-2">This model has no single relations.</div>'}
          <table class="w-full border-collapse text-xs">
            <tbody>
              \${nestedWriteSingleOps.map((op) => '<tr><td class="py-1.5 pr-2 align-top font-mono border-b border-gray-200">' + escapeHtml(op.key) + '</td><td class="py-1.5 border-b border-gray-200">' + escapeHtml(op.desc) + '</td></tr>').join('')}
            </tbody>
          </table>
        </div>
        <div class="\${calloutClass} mt-2 text-xs text-gray-500">Nested write shapes depend on the related model's schema. See the related model's API docs for valid create and connect inputs. These operations are not available in bulk write endpoints (createMany, updateMany).</div>
      </div>
    </div>

    <h2 class="mt-[18px] mb-2 text-base border-t border-gray-200 pt-3.5" id="order">8. orderBy / cursor / distinct</h2>
    <div class="\${calloutClass}">
      <ul class="text-[13px]">\${orderRules.map((r) => '<li>' + escapeHtml(r) + '</li>').join('')}</ul>
    </div>

    <h2 class="mt-[18px] mb-2 text-base border-t border-gray-200 pt-3.5" id="pagination">9. Pagination</h2>
    <div class="\${calloutClass}">
      <ul class="text-[13px]">\${paginationNotes.map((r) => '<li>' + escapeHtml(r) + '</li>').join('')}</ul>
    </div>

    <h2 class="mt-[18px] mb-2 text-base border-t border-gray-200 pt-3.5" id="errors">10. Error Handling</h2>
    <div class="\${calloutClass}">
      <div class="text-[13px] mb-2">All errors return JSON with a <span class="font-mono">message</span> field.</div>
    </div>
    <table class="w-full border-collapse text-xs mt-2">
      <thead>
        <tr>
          <th class="\${thClass}">Status</th>
          <th class="\${thClass}">Description</th>
          <th class="\${thClass}">Common Causes</th>
        </tr>
      </thead>
      <tbody>
        \${errorRows.map((r) => \`
          <tr>
            <td class="\${tdClass} font-mono">\${escapeHtml(r.status)}</td>
            <td class="\${tdClass}">\${escapeHtml(r.description)}</td>
            <td class="\${tdClass} text-gray-500">\${escapeHtml(r.causes)}</td>
          </tr>
        \`).join('')}
      </tbody>
    </table>

    <h2 class="mt-[18px] mb-2 text-base border-t border-gray-200 pt-3.5" id="examples">11. Examples</h2>
    <div class="grid grid-cols-2 gap-3.5 max-[920px]:grid-cols-1 example">
      <div>
        <h3 class="mt-3.5 mb-2 text-sm">11.1 GET — findMany</h3>
        \${codeBlock(findManyFetchExample)}
      </div>
      <div>
        <h3 class="mt-3.5 mb-2 text-sm">11.2 GET — findUnique</h3>
        \${findUniqueFetchExample
          ? codeBlock(findUniqueFetchExample)
          : noUniqueFieldNote}
      </div>
      <div>
        <h3 class="mt-3.5 mb-2 text-sm">11.3 POST — create</h3>
        \${codeBlock(createFetchExample)}
      </div>
      <div>
        <h3 class="mt-3.5 mb-2 text-sm">11.4 PUT — update</h3>
        \${updateFetchExample
          ? codeBlock(updateFetchExample)
          : noUniqueFieldNote}
      </div>
      <div>
        <h3 class="mt-3.5 mb-2 text-sm">11.5 DELETE — delete</h3>
        \${deleteFetchExample
          ? codeBlock(deleteFetchExample)
          : noUniqueFieldNote}
      </div>
      <div>
        <h3 class="mt-3.5 mb-2 text-sm">11.6 Guard variant header</h3>
        \${guardFetchExample
          ? codeBlock(guardFetchExample)
          : noUniqueFieldNote}
      </div>
    </div>

    <h2 class="mt-[18px] mb-2 text-base border-t border-gray-200 pt-3.5" id="guard-shapes">12. Guard Shapes</h2>
    <div class="\${calloutClass}">
      <ul class="text-[13px]">\${guardShapeInfo.map((r) => '<li>' + r + '</li>').join('')}</ul>
    </div>

    <h2 class="mt-[18px] mb-2 text-base border-t border-gray-200 pt-3.5" id="runtime">13. Runtime Notes</h2>
    <div class="\${calloutClass}">
      <ul class="text-[13px] [&>li]:mb-2">\${runtimeNotes.map((r) => '<li>' + r + '</li>').join('')}</ul>
    </div>

  </div>
  <script src="\${PRISM_JS}"></script>
  <script src="\${PRISM_JSON}"></script>
</body>
</html>\`

  return html
}

export function ${modelName}Docs(config: DocsConfig = {}) {
  return (c: Context) => {
    const disabled = isOpenApiDisabled(config.disableOpenApi)
    if (disabled) return c.text('OpenAPI documentation is disabled in production', 404)

    const rawUi = c.req.query('ui') || config.docsUi || 'docs'
    const validUis: DocsUI[] = ['docs', 'scalar', 'json', 'yaml', 'playground']
    const ui: DocsUI = validUis.includes(rawUi as DocsUI) ? (rawUi as DocsUI) : 'docs'

    if (ui === 'playground') {
      if (!isPlaygroundAvailable(config)) {
        return c.text('Query builder is disabled', 404)
      }
      return c.html(renderPlayground('${modelName}', config))
    }

    if (ui === 'yaml') {
      const yaml = buildModelOpenApi(
        '${modelName}',
        MODEL_FIELDS as any,
        MODEL_ENUMS as any,
        config,
        { format: 'yaml' }
      )
      return c.text(yaml as string, 200, { 'Content-Type': 'application/yaml' })
    }

    const spec = buildModelOpenApi(
      '${modelName}',
      MODEL_FIELDS as any,
      MODEL_ENUMS as any,
      config,
      { format: 'json' }
    )

    if (ui === 'json') return c.json(spec)

    const pageTitle = config.docsTitle || \`${modelName} API\`

    if (ui === 'scalar') {
      return c.html(renderScalar('${modelName}', spec, pageTitle, config.scalarCdnUrl))
    }

    const html = renderDocs('${modelName}', config)
    return c.html(html)
  }
}
`
}
