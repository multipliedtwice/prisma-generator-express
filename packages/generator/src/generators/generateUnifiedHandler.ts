import { DMMF } from '@prisma/generator-helper'
import { ImportStyle } from '../utils/resolveImportStyle'
import { importExt } from '../utils/importExt'
import { OPERATION_METADATA } from '../copy/operationDefinitions'

export interface UnifiedHandlerOptions {
  model: DMMF.Model
  importStyle: ImportStyle
}

export function generateUnifiedHandler(options: UnifiedHandlerOptions): string {
  const ext = importExt(options.importStyle)
  const modelName = options.model.name

  const dispatchOps = OPERATION_METADATA.filter((m) => m.name !== 'updateEach')

  const handlers = dispatchOps.map((meta) => {
    const exportName = `${modelName}${meta.name.charAt(0).toUpperCase() + meta.name.slice(1)}`

    return `
export async function ${exportName}(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    ;(res.locals as LocalsBag).data = await core.${meta.coreName}(buildContext(req, res))
    next()
  } catch (error: unknown) {
    next(mapError(error))
  }
}`
  }).join('\n')

  return `import type { Request, Response, NextFunction } from 'express'
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