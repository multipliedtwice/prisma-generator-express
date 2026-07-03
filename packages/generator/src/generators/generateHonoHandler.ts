import { DMMF } from '@prisma/generator-helper'
import { ImportStyle } from '../utils/resolveImportStyle'
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
    (m) => (m.kind === 'write' || m.kind === 'batch') && m.name !== 'updateEach',
  )

  const readHandlers = readOps.map((meta) => {
    const exportName = `${modelName}${meta.name.charAt(0).toUpperCase() + meta.name.slice(1)}`
    return `
export async function ${exportName}(c: HandlerContext): Promise<void> {
  const data = await core.${meta.coreName}(buildContext(c))
  c.set('resultData', data)
}`
  }).join('\n')

  const writeHandlers = writeOps.map((meta) => {
    const exportName = `${modelName}${meta.name.charAt(0).toUpperCase() + meta.name.slice(1)}`
    return `
export async function ${exportName}(c: HandlerContext): Promise<void> {
  const data = await core.${meta.coreName}(buildContext(c))
  c.set('resultData', data)
  c.set('resultStatus', ${meta.successStatus})
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