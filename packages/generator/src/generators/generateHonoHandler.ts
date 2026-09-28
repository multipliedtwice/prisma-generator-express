import type { DMMF } from '@prisma/generator-helper'
import type { ImportStyle } from '../utils/resolveImportStyle'
import { importExt } from '../utils/importExt'
import { OPERATION_METADATA } from '../copy/operationDefinitions'

export function generateHonoHandler(options: {
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
export async function ${exportName}(c: HandlerContext): Promise<void> {
  const data = await executeOperation(
    { variantKey: c.get('guardVariantKey'), caller: c.get('guardCaller') },
    { guardShape: c.get('guardShape') },
    {
      core: core.${meta.coreName},
      args: queryChannel(c),
      body: c.get('body'),
      prisma: requirePrisma(c.get('prisma')),
      postgres: c.get('postgres'),
      sqlite: c.get('sqlite'),
      pagination: c.get('routeConfig')?.pagination,
      override: c.get('operationOverride'),
      getContext: c.get('getContext'),
    },
  )
  c.set('resultData', data)
}`
    })
    .join('\n')

  const writeHandlers = writeOps
    .map((meta) => {
      const exportName = `${modelName}${meta.name.charAt(0).toUpperCase() + meta.name.slice(1)}`
      return `
export async function ${exportName}(c: HandlerContext): Promise<void> {
  const data = await executeOperation(
    { variantKey: c.get('guardVariantKey'), caller: c.get('guardCaller') },
    { guardShape: c.get('guardShape') },
    {
      core: core.${meta.coreName},
      args: queryChannel(c),
      body: c.get('body'),
      prisma: requirePrisma(c.get('prisma')),
      postgres: c.get('postgres'),
      sqlite: c.get('sqlite'),
      pagination: c.get('routeConfig')?.pagination,
      override: c.get('operationOverride'),
      getContext: c.get('getContext'),
    },
  )
  c.set('resultData', data)
  c.set('resultStatus', ${meta.successStatus})
}`
    })
    .join('\n')

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
import {
  executeOperation,
  requirePrisma,
  type ArgsChannel,
} from '../operationPipeline${ext}'
import type { HonoInternalVariables } from '../routeConfig.target${ext}'

type HandlerContext = Context<{ Variables: HonoInternalVariables }>

function queryChannel(c: HandlerContext): ArgsChannel {
  return {
    read: () => c.get('parsedQuery'),
    write: (next) => c.set('parsedQuery', next),
  }
}

function buildContext(c: HandlerContext): OperationContext {
  return {
    operationOverride: c.get('operationOverride'),
    resolveOperationContext: c.get('getContext'),
    prisma: c.get('prisma'),
    postgres: c.get('postgres'),
    sqlite: c.get('sqlite'),
    parsedQuery: c.get('parsedQuery'),
    body: c.get('body'),
    guardShape: c.get('guardShape'),
    guardCaller: c.get('guardCaller'),
    guardVariantKey: c.get('guardVariantKey'),
    paginationConfig: c.get('routeConfig')?.pagination,
  }
}
${readHandlers}
${writeHandlers}
${updateEachHandler}
`
}
