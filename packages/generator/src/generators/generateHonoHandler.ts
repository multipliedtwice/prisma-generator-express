import { DMMF } from '@prisma/generator-helper'
import { toCamelCase } from '../utils/strings'
import { ImportStyle } from '../utils/resolveImportStyle'
import { importExt } from '../utils/importExt'

const CORE_NAME_MAP: Record<string, string> = {
  delete: 'deleteUnique',
}

function coreFnName(op: string): string {
  return CORE_NAME_MAP[op] || op
}

const READ_OPS = [
  'findMany',
  'findFirst',
  'findFirstOrThrow',
  'findUnique',
  'findUniqueOrThrow',
  'findManyPaginated',
  'aggregate',
  'count',
  'groupBy',
]

const WRITE_OPS = [
  'create',
  'createMany',
  'createManyAndReturn',
  'update',
  'updateMany',
  'updateManyAndReturn',
  'upsert',
  'delete',
  'deleteMany',
]

const CREATED_OPS = new Set([
  'create',
  'createMany',
  'createManyAndReturn',
])

export function generateHonoHandler(options: {
  model: DMMF.Model
  importStyle: ImportStyle
}): string {
  const ext = importExt(options.importStyle)
  const modelName = options.model.name
  const prefix = toCamelCase(modelName)

  const readHandlers = READ_OPS.map((op) => {
    const exportName = `${prefix}${op.charAt(0).toUpperCase() + op.slice(1)}`

    return `
export async function ${exportName}(c: Context<HonoEnv>): Promise<void> {
  const data = await core.${coreFnName(op)}(buildContext(c))
  c.set('resultData', data)
}`
  }).join('\n')

  const writeHandlers = WRITE_OPS.map((op) => {
    const exportName = `${prefix}${op.charAt(0).toUpperCase() + op.slice(1)}`
    const statusCode = CREATED_OPS.has(op) ? 201 : 200

    return `
export async function ${exportName}(c: Context<HonoEnv>): Promise<void> {
  const data = await core.${coreFnName(op)}(buildContext(c))
  c.set('resultData', data)
  c.set('resultStatus', ${statusCode})
}`
  }).join('\n')

  return `import type { Context } from 'hono'
import * as core from './${modelName}Core${ext}'
import type { OperationContext } from '../operationRuntime${ext}'

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

function buildContext(c: Context<HonoEnv>): OperationContext {
  return {
    prisma: c.get('prisma'),
    postgres: c.get('postgres'),
    sqlite: c.get('sqlite'),
    parsedQuery: c.get('parsedQuery'),
    body: c.get('body'),
    guardShape: c.get('guardShape'),
    guardCaller: c.get('guardCaller'),
    paginationConfig: c.get('routeConfig')?.pagination,
  }
}
${readHandlers}
${writeHandlers}
`
}