import { DMMF } from '@prisma/generator-helper'
import { ImportStyle } from '../utils/resolveImportStyle'
import { importExt } from '../utils/importExt'
import { OPERATION_METADATA } from '../copy/operationDefinitions'

export function generateFastifyHandler(options: {
  model: DMMF.Model
  importStyle: ImportStyle
}): string {
  const ext = importExt(options.importStyle)
  const modelName = options.model.name

  const readOps = OPERATION_METADATA.filter((m) => m.kind === 'read')
  const writeOps = OPERATION_METADATA.filter(
    (m) => (m.kind === 'write' || m.kind === 'batch') && m.name !== 'updateEach',
  )

  const readHandlers = readOps.map((meta) => {
    const exportName = `${modelName}${meta.name.charAt(0).toUpperCase() + meta.name.slice(1)}`
    return `
export async function ${exportName}(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  const data = await core.${meta.coreName}(buildContext(request))
  ;(request as FastifyExtended).resultData = data
}`
  }).join('\n')

  const writeHandlers = writeOps.map((meta) => {
    const exportName = `${modelName}${meta.name.charAt(0).toUpperCase() + meta.name.slice(1)}`
    return `
export async function ${exportName}(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  const data = await core.${meta.coreName}(buildContext(request))
  const ext = request as FastifyExtended
  ext.resultData = data
  ext.resultStatus = ${meta.successStatus}
}`
  }).join('\n')

  const updateEachExportName = `${modelName}UpdateEach`
  const updateEachHandler = `
export async function ${updateEachExportName}(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  const atomic = request.headers['x-batch-atomic'] === 'true'
  const data = await core.updateEach(buildContext(request), atomic)
  ;(request as FastifyExtended).resultData = data
}`

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
${updateEachHandler}
`
}