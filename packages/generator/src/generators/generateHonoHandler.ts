import { DMMF } from '@prisma/generator-helper'
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

  const readHandlers = READ_OPS.map((op) => {
    const exportName = `${modelName}${op.charAt(0).toUpperCase() + op.slice(1)}`
    return `
export async function ${exportName}(c: HandlerContext): Promise<void> {
  const data = await core.${coreFnName(op)}(buildContext(c))
  c.set('resultData', data)
}`
  }).join('\n')

  const writeHandlers = WRITE_OPS.map((op) => {
    const exportName = `${modelName}${op.charAt(0).toUpperCase() + op.slice(1)}`
    const statusCode = CREATED_OPS.has(op) ? 201 : 200

    return `
export async function ${exportName}(c: HandlerContext): Promise<void> {
  const data = await core.${coreFnName(op)}(buildContext(c))
  c.set('resultData', data)
  c.set('resultStatus', ${statusCode})
}`
  }).join('\n')

  const updateEachExportName = `${modelName}UpdateEach`
  const updateEachHandler = `
export async function ${updateEachExportName}(c: HandlerContext): Promise<void> {
  const atomic = c.req.header('x-batch-atomic') === 'true'
  const data = await core.updateEach(buildContext(c), atomic)
  c.set('resultData', data)
}`

  return `import type { Context } from 'hono'
import * as core from './${modelName}Core${ext}'
import type { OperationContext } from '../operationRuntime${ext}'
import type { HonoInternalVariables } from '../routeConfig.target${ext}'

type HandlerContext = Context<{ Variables: HonoInternalVariables }>

function buildContext(c: HandlerContext): OperationContext {
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
${updateEachHandler}
`
}