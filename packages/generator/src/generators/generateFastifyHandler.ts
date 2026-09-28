import type { DMMF } from '@prisma/generator-helper'
import type { ImportStyle } from '../utils/resolveImportStyle'
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
    (m) =>
      (m.kind === 'write' || m.kind === 'batch') && m.name !== 'updateEach',
  )

  const readHandlers = readOps
    .map((meta) => {
      const exportName = `${modelName}${meta.name.charAt(0).toUpperCase() + meta.name.slice(1)}`
      return `
export async function ${exportName}(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  const fx = request as FastifyExtended
  const data = await executeOperation(
    { variantKey: fx.guardVariantKey, caller: fx.guardCaller },
    { guardShape: fx.guardShape },
    {
      core: core.${meta.coreName},
      args: queryChannel(request),
      body: request.body,
      prisma: requirePrisma(fx.prisma),
      postgres: fx.postgres,
      sqlite: fx.sqlite,
      pagination: fx.routeConfig?.pagination,
      override: fx.operationOverride,
      getContext: fx.getContext,
      findManyPaginatedMode: fx.findManyPaginatedMode,
    },
  )
  fx.resultData = data
}`
    })
    .join('\n')

  const writeHandlers = writeOps
    .map((meta) => {
      const exportName = `${modelName}${meta.name.charAt(0).toUpperCase() + meta.name.slice(1)}`
      return `
export async function ${exportName}(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  const fx = request as FastifyExtended
  const data = await executeOperation(
    { variantKey: fx.guardVariantKey, caller: fx.guardCaller },
    { guardShape: fx.guardShape },
    {
      core: core.${meta.coreName},
      args: queryChannel(request),
      body: request.body,
      prisma: requirePrisma(fx.prisma),
      postgres: fx.postgres,
      sqlite: fx.sqlite,
      pagination: fx.routeConfig?.pagination,
      override: fx.operationOverride,
      getContext: fx.getContext,
    },
  )
  fx.resultData = data
  fx.resultStatus = ${meta.successStatus}
}`
    })
    .join('\n')

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
import type { RuntimeOperationOverride, OperationContext, FindManyPaginatedMode } from '../operationRuntime${ext}'
import type { PaginationConfig } from '../routeConfig${ext}'
import {
  executeOperation,
  requirePrisma,
  type ArgsChannel,
} from '../operationPipeline${ext}'

type FastifyExtended = FastifyRequest & {
  prisma?: unknown
  postgres?: unknown
  sqlite?: unknown
  parsedQuery?: Record<string, unknown>
  routeConfig?: { pagination?: PaginationConfig }
  guardShape?: Record<string, unknown>
  guardCaller?: string
  guardVariantKey?: string
  operationOverride?: RuntimeOperationOverride
  getContext?: () => Promise<unknown>
  findManyPaginatedMode?: FindManyPaginatedMode
  resultData?: unknown
  resultStatus?: number
}

function queryChannel(request: FastifyRequest): ArgsChannel {
  const fx = request as FastifyExtended
  return {
    read: () => fx.parsedQuery,
    write: (next) => {
      fx.parsedQuery = next
    },
  }
}

function buildContext(request: FastifyRequest): OperationContext {
  const req = request as FastifyExtended
  return {
    operationOverride: req.operationOverride,
    resolveOperationContext: req.getContext,
    prisma: req.prisma,
    postgres: req.postgres,
    sqlite: req.sqlite,
    parsedQuery: req.parsedQuery,
    body: request.body,
    guardShape: req.guardShape,
    guardCaller: req.guardCaller,
    guardVariantKey: req.guardVariantKey,
    paginationConfig: req.routeConfig?.pagination,
    findManyPaginatedMode: req.findManyPaginatedMode,
  }
}
${readHandlers}
${writeHandlers}
${updateEachHandler}
`
}
