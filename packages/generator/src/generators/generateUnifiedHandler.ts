import { DMMF } from '@prisma/generator-helper'
import { toCamelCase } from '../utils/strings'
import { ImportStyle } from '../utils/resolveImportStyle'
import { importExt } from '../utils/importExt'

export interface UnifiedHandlerOptions {
  model: DMMF.Model
  importStyle: ImportStyle
}

const CORE_NAME_MAP: Record<string, string> = {
  delete: 'deleteUnique',
}

function coreFnName(op: string): string {
  return CORE_NAME_MAP[op] || op
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
  const ext = importExt(options.importStyle)
  const modelName = options.model.name
  const prefix = toCamelCase(modelName)

  const handlers = ALL_OPS.map((op) => {
    const exportName = `${prefix}${op.charAt(0).toUpperCase() + op.slice(1)}`

    return `
export async function ${exportName}(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    ;(res.locals as LocalsBag).data = await core.${coreFnName(op)}(buildContext(req, res))
    next()
  } catch (error: unknown) {
    next(mapError(error))
  }
}`
  }).join('\n')

  return `import { Request, Response, NextFunction } from 'express'
import * as core from './${modelName}Core${ext}'
import { OperationContext, mapError } from '../operationRuntime${ext}'

type ExtendedRequest = Request & {
  prisma?: unknown
  postgres?: unknown
  sqlite?: unknown
}

type LocalsBag = {
  parsedQuery?: Record<string, unknown>
  routeConfig?: { pagination?: unknown }
  guardShape?: Record<string, unknown>
  guardCaller?: string
  data?: unknown
}

function buildContext(req: Request, res: Response): OperationContext {
  const extReq = req as ExtendedRequest
  const locals = res.locals as LocalsBag
  return {
    prisma: extReq.prisma,
    postgres: extReq.postgres,
    sqlite: extReq.sqlite,
    parsedQuery: locals.parsedQuery,
    body: req.body,
    guardShape: locals.guardShape,
    guardCaller: locals.guardCaller,
    paginationConfig: (locals.routeConfig?.pagination) as OperationContext['paginationConfig'],
  }
}
${handlers}
`
}