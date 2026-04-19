import { DMMF } from '@prisma/generator-helper'

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
}): string {
  const modelName = options.model.name

  const readHandlers = READ_OPS.map((op) => {
    const exportName = `${modelName}${op.charAt(0).toUpperCase() + op.slice(1)}`

    return `
export async function ${exportName}(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  const data = await core.${op}(buildContext(request))
  ;(request as any).resultData = data
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
  const data = await core.${op}(buildContext(request))
  ;(request as any).resultData = data
  ;(request as any).resultStatus = ${statusCode}
}`
  }).join('\n')

  return `import type { FastifyRequest, FastifyReply } from 'fastify'
import * as core from './${modelName}Core.js'
import type { OperationContext } from '../operationRuntime.js'

function buildContext(request: FastifyRequest): OperationContext {
  const req = request as any
  return {
    prisma: req.prisma,
    postgres: req.postgres,
    sqlite: req.sqlite,
    parsedQuery: req.parsedQuery,
    body: request.body,
    guardShape: req.guardShape,
    guardCaller: req.guardCaller,
    paginationConfig: req.routeConfig?.pagination,
  }
}
${readHandlers}
${writeHandlers}
`
}