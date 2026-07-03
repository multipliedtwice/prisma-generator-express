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

type WriteOpDecision = { throw?: true; method: string }

function decideWriteOp(
  name: string,
  defaultMethod: string,
  strategy: WriteStrategy,
): WriteOpDecision {
  if (strategy === 'throwOnNonReturning' && (name === 'createMany' || name === 'updateMany')) {
    return { throw: true, method: defaultMethod }
  }
  if (strategy === 'forceReturn') {
    if (name === 'createMany') return { method: 'createManyAndReturn' }
    if (name === 'updateMany') return { method: 'updateManyAndReturn' }
  }
  return { method: defaultMethod }
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

    if (decision.throw) {
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
  const hasMore = absTake > 0 && items.length >= absTake && skip + items.length < total

  return { data: items, total, hasMore }
}

export async function updateEach(
  ctx: OperationContext,
  atomic: boolean,
): Promise<unknown> {
  const rawBody = ctx.body
  if (!Array.isArray(rawBody)) {
    throw new HttpError(400, 'updateEach body must be an array of { where, data } items')
  }

  const MAX_ITEMS_NON_ATOMIC = 1000
  const MAX_ITEMS_ATOMIC = 100

  if (atomic && rawBody.length > MAX_ITEMS_ATOMIC) {
    throw new HttpError(
      400,
      'atomic updateEach body exceeds max size of ' + MAX_ITEMS_ATOMIC + ' items',
    )
  }
  if (!atomic && rawBody.length > MAX_ITEMS_NON_ATOMIC) {
    throw new HttpError(
      400,
      'updateEach body exceeds max size of ' + MAX_ITEMS_NON_ATOMIC + ' items',
    )
  }

  const items = rawBody.map((item, index) => {
    const sanitized = validateBody(item)
    if (!('where' in sanitized) || sanitized.where === undefined) {
      throw new HttpError(400, 'updateEach item at index ' + index + ' is missing "where"')
    }
    if (!('data' in sanitized) || sanitized.data === undefined) {
      throw new HttpError(400, 'updateEach item at index ' + index + ' is missing "data"')
    }
    return sanitized
  })
  const extended = await getExtendedClient(ctx)

  if (atomic) {
    const txClient = extended as PrismaClientLike
    if (typeof txClient.$transaction !== 'function') {
      throw new HttpError(500, 'Atomic updateEach requires transaction support on the Prisma client')
    }
    const runInteractive = txClient.$transaction as unknown as <T>(
      fn: (tx: unknown) => Promise<T>,
    ) => Promise<T>
    return runInteractive(async (tx) => {
      const txDelegate = getDelegate(tx, '${modelNameLower}')
      const out: unknown[] = new Array(items.length)
      for (let i = 0; i < items.length; i++) {
        out[i] = await txDelegate.update(items[i])
      }
      return out
    })
  }

  const delegate = getDelegate(extended, '${modelNameLower}')
  const CONCURRENCY = 8
  const results: Array<{ status: 'ok'; data: unknown } | { status: 'error'; error: string }> =
    new Array(items.length)
  let cursor = 0
  const workerCount = Math.min(CONCURRENCY, items.length)
  const workers = Array.from({ length: workerCount }, async () => {
    for (;;) {
      const i = cursor++
      if (i >= items.length) return
      try {
        results[i] = { status: 'ok', data: await delegate.update(items[i]) }
      } catch (err) {
        results[i] = { status: 'error', error: mapError(err).message }
      }
    }
  })
  await Promise.all(workers)
  return results
}
`
}