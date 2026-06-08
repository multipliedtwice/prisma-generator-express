import { DMMF } from '@prisma/generator-helper'
import { ImportStyle } from '../utils/resolveImportStyle'
import { importExt } from '../utils/importExt'

export interface ModelCoreOptions {
  model: DMMF.Model
  importStyle: ImportStyle
}

export function generateModelCore(options: ModelCoreOptions): string {
  const ext = importExt(options.importStyle)
  const modelName = options.model.name
  const modelNameLower = modelName.charAt(0).toLowerCase() + modelName.slice(1)

  const standardReadOps = [
    'findFirst', 'findUnique', 'findUniqueOrThrow', 'findFirstOrThrow',
    'count', 'aggregate', 'groupBy',
  ]

  const standardReadHandlers = standardReadOps
    .map((op) => `
export async function ${op}(ctx: OperationContext): Promise<unknown> {
  const query = ctx.parsedQuery || {}
  const extended = await getExtendedClient(ctx)
  const delegate = getDelegate(extended, '${modelNameLower}')
  if (ctx.guardShape) {
    assertGuard(delegate)
    return delegate.guard(ctx.guardShape, ctx.guardCaller).${op}(query)
  }
  return delegate.${op}(query)
}`)
    .join('\n')

  const writeOps = [
    { name: 'create', method: 'create', requiredFields: ['data'] },
    { name: 'createMany', method: 'createMany', requiredFields: ['data'] },
    { name: 'createManyAndReturn', method: 'createManyAndReturn', requiredFields: ['data'] },
    { name: 'update', method: 'update', requiredFields: ['where', 'data'] },
    { name: 'updateMany', method: 'updateMany', requiredFields: ['where', 'data'] },
    { name: 'updateManyAndReturn', method: 'updateManyAndReturn', requiredFields: ['where', 'data'] },
    { name: 'deleteUnique', method: 'delete', requiredFields: ['where'] },
    { name: 'deleteMany', method: 'deleteMany', requiredFields: ['where'] },
    { name: 'upsert', method: 'upsert', requiredFields: ['where', 'create', 'update'] },
  ]

  const writeHandlers = writeOps.map((op) => {
    const validationLines = op.requiredFields.map((field) => `  requireBodyField(body, '${field}')`).join('\n')
    return `
export async function ${op.name}(ctx: OperationContext): Promise<unknown> {
  const body = validateBody(ctx.body)
${validationLines}
  const extended = await getExtendedClient(ctx)
  const delegate = getDelegate(extended, '${modelNameLower}')
  if (ctx.guardShape) {
    assertGuard(delegate)
    return delegate.guard(ctx.guardShape, ctx.guardCaller).${op.method}(body)
  }
  return delegate.${op.method}(body)
}`
  }).join('\n')

  return `import {
  OperationContext,
  getExtendedClient,
  getDelegate,
  validateBody,
  requireBodyField,
  applyPaginationLimits,
  assertGuard,
  countForPagination,
} from '../operationRuntime${ext}'

export async function findMany(ctx: OperationContext): Promise<unknown> {
  const rawQuery = ctx.parsedQuery || {}
  const query = applyPaginationLimits(rawQuery, ctx.paginationConfig)
  const extended = await getExtendedClient(ctx)
  const delegate = getDelegate(extended, '${modelNameLower}')
  if (ctx.guardShape) {
    assertGuard(delegate)
    return delegate.guard(ctx.guardShape, ctx.guardCaller).findMany(query)
  }
  return delegate.findMany(query)
}
${standardReadHandlers}
${writeHandlers}

export async function findManyPaginated(
  ctx: OperationContext,
): Promise<{ data: unknown[]; total: number; hasMore: boolean }> {
  const rawQuery = ctx.parsedQuery || {}
  const query = applyPaginationLimits(rawQuery, ctx.paginationConfig)
  const extended = await getExtendedClient(ctx)
  const shape = ctx.guardShape
  const caller = ctx.guardCaller
  const distinctCountLimit = ctx.paginationConfig?.distinctCountLimit
  const delegate = getDelegate(extended, '${modelNameLower}')

  if (shape) assertGuard(delegate)

  let items: unknown[]
  let total: number

  const txClient = extended as { $transaction?: <T>(fn: (tx: unknown) => Promise<T>) => Promise<T> }

  if (shape || typeof txClient.$transaction !== 'function') {
    const [data, count] = await Promise.all([
      shape
        ? (delegate.guard as NonNullable<typeof delegate.guard>)(shape, caller).findMany(query)
        : delegate.findMany(query),
      countForPagination(delegate, query, shape, caller, distinctCountLimit),
    ])
    items = data as unknown[]
    total = count
  } else {
    try {
      const txResult = await txClient.$transaction(async (tx: unknown) => {
        const txDelegate = getDelegate(tx, '${modelNameLower}')
        const d = await txDelegate.findMany(query)
        const t = await countForPagination(txDelegate, query, undefined, undefined, distinctCountLimit)
        return { d, t }
      })
      items = txResult.d as unknown[]
      total = txResult.t
    } catch (txError: unknown) {
      const txe = txError as { message?: string; code?: string }
      if (txe?.code === 'P2028') {
        console.warn('[prisma-generator-express] Interactive transactions not available, pagination queries are non-atomic')
        items = (await delegate.findMany(query)) as unknown[]
        total = await countForPagination(delegate, query, undefined, undefined, distinctCountLimit)
      } else {
        throw txError
      }
    }
  }

  const skip = (typeof query.skip === 'number' ? query.skip : 0)
  const takeRaw = (typeof query.take === 'number' ? query.take : items.length)
  const absTake = Math.abs(takeRaw)
  const hasMore = items.length >= absTake && skip + items.length < total

  return { data: items, total, hasMore }
}
`
}