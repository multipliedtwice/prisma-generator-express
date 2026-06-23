import { DMMF } from '@prisma/generator-helper'
import { ImportStyle } from '../utils/resolveImportStyle'
import { importExt } from '../utils/importExt'
import { WriteStrategy, FindManyPaginatedMode } from '../constants'

export interface ModelCoreOptions {
  model: DMMF.Model
  importStyle: ImportStyle
  writeStrategy: WriteStrategy
  findManyPaginatedMode: FindManyPaginatedMode
}

type WriteOpDecision =
  | { mode: 'normal'; method: string }
  | { mode: 'redirect'; method: string }
  | { mode: 'throw' }

function decideWriteOp(
  name: string,
  defaultMethod: string,
  strategy: WriteStrategy,
): WriteOpDecision {
  if (strategy === 'regular') {
    return { mode: 'normal', method: defaultMethod }
  }
  if (strategy === 'throwOnNonReturning') {
    if (name === 'createMany' || name === 'updateMany') {
      return { mode: 'throw' }
    }
    return { mode: 'normal', method: defaultMethod }
  }
  if (name === 'createMany') return { mode: 'redirect', method: 'createManyAndReturn' }
  if (name === 'updateMany') return { mode: 'redirect', method: 'updateManyAndReturn' }
  return { mode: 'normal', method: defaultMethod }
}

function renderPaginatedBody(modelNameLower: string, mode: FindManyPaginatedMode): string {
  if (mode === 'transaction') {
    return `
  const txClient = extended as { $transaction?: <T>(fn: (tx: unknown) => Promise<T>) => Promise<T> }
  if (typeof txClient.$transaction !== 'function') {
    throw new HttpError(500, 'findManyPaginatedMode="transaction" requires transaction support on the Prisma client')
  }

  const txResult = await txClient.$transaction(async (tx: unknown) => {
    const txDelegate = getDelegate(tx, '${modelNameLower}')
    if (shape) assertGuard(txDelegate)
    const findP = shape
      ? (txDelegate.guard as NonNullable<typeof txDelegate.guard>)(shape, caller).findMany(query)
      : txDelegate.findMany(query)
    const countP = countForPagination(
      txDelegate, query, shape, caller, distinctCountLimit, countSource, tx,
    )
    const [data, count] = await Promise.all([findP, countP])
    return { data, count }
  })
  items = txResult.data as unknown[]
  total = txResult.count`
  }

  return `
  const delegate = getDelegate(extended, '${modelNameLower}')
  if (shape) assertGuard(delegate)
  const [data, count] = await Promise.all([
    shape
      ? (delegate.guard as NonNullable<typeof delegate.guard>)(shape, caller).findMany(query)
      : delegate.findMany(query),
    countForPagination(delegate, query, shape, caller, distinctCountLimit, countSource, extended),
  ])
  items = data as unknown[]
  total = count`
}

export function generateModelCore(options: ModelCoreOptions): string {
  const ext = importExt(options.importStyle)
  const modelName = options.model.name
  const modelNameLower = modelName.charAt(0).toLowerCase() + modelName.slice(1)
  const writeStrategy = options.writeStrategy
  const paginatedBody = renderPaginatedBody(modelNameLower, options.findManyPaginatedMode)

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
    const decision = decideWriteOp(op.name, op.method, writeStrategy)

    if (decision.mode === 'throw') {
      return `
export async function ${op.name}(_ctx: OperationContext): Promise<unknown> {
  throw new HttpError(501, '${op.name} is disabled by writeStrategy="${writeStrategy}"')
}`
    }

    const method = decision.method
    const validationLines = op.requiredFields
      .map((field) => `  requireBodyField(body, '${field}')`)
      .join('\n')

    return `
export async function ${op.name}(ctx: OperationContext): Promise<unknown> {
  const body = validateBody(ctx.body)
${validationLines}
  const extended = await getExtendedClient(ctx)
  const delegate = getDelegate(extended, '${modelNameLower}')
  if (ctx.guardShape) {
    assertGuard(delegate)
    return delegate.guard(ctx.guardShape, ctx.guardCaller).${method}(body)
  }
  return delegate.${method}(body)
}`
  }).join('\n')

  return `import {
  OperationContext,
  PrismaClientLike,
  HttpError,
  getExtendedClient,
  getDelegate,
  validateBody,
  requireBodyField,
  applyPaginationLimits,
  assertGuard,
  countForPagination,
  mapError,
} from '../operationRuntime${ext}'

export async function findMany(ctx: OperationContext): Promise<unknown> {
  const rawQuery = ctx.parsedQuery || {}
  const query = applyPaginationLimits(rawQuery, ctx.paginationConfig, !!ctx.guardShape)
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
  const query = applyPaginationLimits(rawQuery, ctx.paginationConfig, !!ctx.guardShape)
  const extended = await getExtendedClient(ctx)
  const shape = ctx.guardShape
  const caller = ctx.guardCaller
  const distinctCountLimit = ctx.paginationConfig?.distinctCountLimit
  const countSource = ctx.paginationConfig?.countSource

  let items: unknown[]
  let total: number
${paginatedBody}

  const skip = (typeof query.skip === 'number' ? query.skip : 0)
  const takeRaw = (typeof query.take === 'number' ? query.take : items.length)
  const absTake = Math.abs(takeRaw)
  const hasMore = items.length >= absTake && skip + items.length < total

  return { data: items, total, hasMore }
}

export async function updateEach(
  ctx: OperationContext,
  atomic: boolean,
): Promise<unknown> {
  const body = ctx.body
  if (!Array.isArray(body)) {
    throw new HttpError(400, 'updateEach body must be an array of { where, data } items')
  }
  const items = body as Record<string, unknown>[]
  const client = ctx.prisma as PrismaClientLike

  if (atomic) {
    if (typeof client.$transaction !== 'function') {
      throw new HttpError(500, 'Atomic updateEach requires transaction support on the Prisma client')
    }
    const runInteractive = client.$transaction as unknown as <T>(
      fn: (tx: unknown) => Promise<T>,
    ) => Promise<T>
    return runInteractive(async (tx) => {
      const txDelegate = getDelegate(tx, '${modelNameLower}')
      return Promise.all(items.map((item) => txDelegate.update(item)))
    })
  }

  const delegate = getDelegate(client, '${modelNameLower}')
  const settled = await Promise.allSettled(
    items.map((item) => delegate.update(item)),
  )
  return settled.map((result) =>
    result.status === 'fulfilled'
      ? { status: 'ok', data: result.value }
      : { status: 'error', error: mapError(result.reason).message },
  )
}
`
}