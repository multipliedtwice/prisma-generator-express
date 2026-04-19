import { DMMF } from '@prisma/generator-helper'

export interface UnifiedHandlerOptions {
  model: DMMF.Model
}

const ALL_OPS = [
  'findMany',
  'findFirst',
  'findFirstOrThrow',
  'findUnique',
  'findUniqueOrThrow',
  'findManyPaginated',
  'create',
  'createMany',
  'createManyAndReturn',
  'update',
  'updateMany',
  'updateManyAndReturn',
  'upsert',
  'delete',
  'deleteMany',
  'aggregate',
  'count',
  'groupBy',
]

export function generateUnifiedHandler(options: UnifiedHandlerOptions): string {
  const modelName = options.model.name

  const handlers = ALL_OPS.map((op) => {
    const exportName = `${modelName}${op.charAt(0).toUpperCase() + op.slice(1)}`

    return `
export async function ${exportName}(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    res.locals.data = await core.${op}(buildContext(req, res))
    next()
  } catch (error: unknown) {
    next(mapError(error))
  }
}`
  }).join('\n')

  return `import { Request, Response, NextFunction } from 'express'
import * as core from './${modelName}Core.js'
import { OperationContext, mapError } from '../operationRuntime.js'

function buildContext(req: Request, res: Response): OperationContext {
  return {
    prisma: (req as any).prisma,
    postgres: (req as any).postgres,
    sqlite: (req as any).sqlite,
    parsedQuery: res.locals.parsedQuery,
    body: req.body,
    guardShape: res.locals.guardShape,
    guardCaller: res.locals.guardCaller,
    paginationConfig: res.locals.routeConfig?.pagination,
  }
}
${handlers}
`
}