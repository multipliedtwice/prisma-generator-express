import type { DMMF } from '@prisma/generator-helper'
import type { ImportStyle } from '../utils/resolveImportStyle'
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

  const handlers = dispatchOps
    .map((meta) => {
      const exportName = `${modelName}${meta.name.charAt(0).toUpperCase() + meta.name.slice(1)}`

      return `
export async function ${exportName}(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const locals = readLocals(res)
    ;locals.data = await executeOperation(
      { variantKey: locals.guardVariantKey, caller: locals.guardCaller },
      { guardShape: locals.guardShape },
      {
        core: core.${meta.coreName},
        args: queryChannel(res),
        body: req.body,
        prisma: requirePrisma((req as ExtendedRequest).prisma),
        postgres: (req as ExtendedRequest).postgres,
        sqlite: (req as ExtendedRequest).sqlite,
        pagination: locals.routeConfig?.pagination,
        override: locals.operationOverride,
        getContext: locals.getContext,
      },
    )
    next()
  } catch (error: unknown) {
    next(classifyError(error))
  }
}`
    })
    .join('\n')

  return `import type { Request, Response, NextFunction } from 'express'
import * as core from './${modelName}Core${ext}'
import type { RuntimeOperationOverride } from '../operationRuntime${ext}'
import type { PaginationConfig } from '../routeConfig${ext}'
import {
  executeOperation,
  classifyError,
  requirePrisma,
  type ArgsChannel,
} from '../operationPipeline${ext}'

type ExtendedRequest = Request & {
  prisma?: unknown
  postgres?: unknown
  sqlite?: unknown
}

type LocalsBag = {
  parsedQuery?: Record<string, unknown>
  routeConfig?: { pagination?: PaginationConfig }
  guardShape?: Record<string, unknown>
  guardCaller?: string
  guardVariantKey?: string
  operationOverride?: RuntimeOperationOverride
  getContext?: () => Promise<unknown>
  data?: unknown
}

function readLocals(res: Response): LocalsBag {
  return res.locals as LocalsBag
}

function queryChannel(res: Response): ArgsChannel {
  return {
    read: () => readLocals(res).parsedQuery,
    write: (next) => {
      readLocals(res).parsedQuery = next
    },
  }
}
${handlers}
`
}
