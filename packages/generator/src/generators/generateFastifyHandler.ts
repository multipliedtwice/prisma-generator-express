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

export function generateFastifyHandler(options: {
  model: DMMF.Model
  importStyle: ImportStyle
}): string {
  const ext = importExt(options.importStyle)
  const modelName = options.model.name

  const readHandlers = READ_OPS.map((op) => {
    const exportName = `${modelName}${op.charAt(0).toUpperCase() + op.slice(1)}`
    return `
export async function ${exportName}(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  const data = await core.${coreFnName(op)}(buildContext(request))
  ;(request as FastifyExtended).resultData = data
}`
  }).join('\n')

  const writeHandlers = WRITE_OPS.map((op) => {
    const exportName = `${modelName}${op.charAt(0).toUpperCase() + op.slice(1)}`
    const statusCode = CREATED_OPS.has(op) ? 201 : 200

    return `
export async function ${exportName}(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  const data = await core.${coreFnName(op)}(buildContext(request))
  const ext = request as FastifyExtended
  ext.resultData = data
  ext.resultStatus = ${statusCode}
}`
  }).join('\n')

  return `import type { FastifyRequest, FastifyReply } from 'fastify'
import * as core from './${modelName}Core${ext}'
import type { OperationContext, FindManyPaginatedMode } from '../operationRuntime${ext}'

type FastifyExtended = FastifyRequest & {
  prisma?: unknown
  postgres?: unknown
  sqlite?: unknown
  parsedQuery?: Record<string, unknown>
  routeConfig?: { pagination?: OperationContext['paginationConfig'] }
  guardShape?: Record<string, unknown>
  guardCaller?: string
  findManyPaginatedMode?: FindManyPaginatedMode
  resultData?: unknown
  resultStatus?: number
}

function buildContext(request: FastifyRequest): OperationContext {
  const req = request as FastifyExtended
  return {
    prisma: req.prisma,
    postgres: req.postgres,
    sqlite: req.sqlite,
    parsedQuery: req.parsedQuery,
    body: request.body,
    guardShape: req.guardShape,
    guardCaller: req.guardCaller,
    paginationConfig: req.routeConfig?.pagination,
    findManyPaginatedMode: req.findManyPaginatedMode,
  }
}
${readHandlers}
${writeHandlers}
`
}