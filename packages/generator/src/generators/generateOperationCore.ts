import { DMMF } from '@prisma/generator-helper'

export function generateOperationRuntime(): string {
  return `import { sanitizeKeys } from './misc.js'

export interface PaginationConfig {
  defaultLimit?: number
  maxLimit?: number
  distinctCountLimit?: number
}

export interface OperationContext {
  prisma: any
  postgres?: any
  sqlite?: any
  parsedQuery?: Record<string, unknown>
  body?: unknown
  guardShape?: Record<string, unknown>
  guardCaller?: string
  paginationConfig?: PaginationConfig
}

export const DISTINCT_COUNT_LIMIT = 100000

export class HttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'HttpError'
    this.status = status
  }
}

const PRISMA_ERROR_MAP: Record<string, { status: number; message: string }> = {
  P2000: { status: 400, message: 'Value too long for column' },
  P2001: { status: 404, message: 'Record not found' },
  P2002: { status: 409, message: 'Unique constraint violation' },
  P2003: { status: 400, message: 'Foreign key constraint failed' },
  P2004: { status: 400, message: 'Constraint failed on the database' },
  P2005: { status: 400, message: 'Invalid field value' },
  P2006: { status: 400, message: 'Invalid value provided' },
  P2007: { status: 400, message: 'Data validation error' },
  P2008: { status: 400, message: 'Failed to parse the query' },
  P2009: { status: 400, message: 'Failed to validate the query' },
  P2010: { status: 500, message: 'Raw query failed' },
  P2011: { status: 400, message: 'Null constraint violation' },
  P2012: { status: 400, message: 'Missing required value' },
  P2013: { status: 400, message: 'Missing required argument' },
  P2014: { status: 400, message: 'Required relation violation' },
  P2015: { status: 404, message: 'Related record not found' },
  P2016: { status: 400, message: 'Query interpretation error' },
  P2017: { status: 400, message: 'Records not connected' },
  P2018: { status: 404, message: 'Required connected record not found' },
  P2019: { status: 400, message: 'Input error' },
  P2020: { status: 400, message: 'Value out of range for the field type' },
  P2021: { status: 500, message: 'Table does not exist in the database' },
  P2022: { status: 500, message: 'Column does not exist in the database' },
  P2023: { status: 500, message: 'Inconsistent column data' },
  P2024: { status: 503, message: 'Connection pool timeout' },
  P2025: { status: 404, message: 'Record not found' },
  P2026: { status: 501, message: 'Feature not supported by the current database provider' },
  P2028: { status: 500, message: 'Transaction API error' },
  P2030: { status: 400, message: 'Cannot find a fulltext index for the search' },
  P2033: { status: 400, message: 'Number out of range for the field type' },
  P2034: { status: 409, message: 'Transaction conflict, please retry' },
}

export function mapError(error: unknown): HttpError {
  if (error instanceof HttpError) return error

  if (
    error &&
    typeof error === 'object' &&
    'name' in error &&
    error.name === 'ShapeError'
  ) {
    return new HttpError(400, (error as any).message)
  }

  if (
    error &&
    typeof error === 'object' &&
    'name' in error &&
    error.name === 'CallerError'
  ) {
    return new HttpError(400, (error as any).message)
  }

  if (
    error &&
    typeof error === 'object' &&
    'name' in error &&
    error.name === 'PolicyError'
  ) {
    return new HttpError(403, (error as any).message)
  }

  if (
    error &&
    typeof error === 'object' &&
    'issues' in error &&
    'name' in error &&
    (error as any).name === 'ZodError'
  ) {
    const issues = (error as any).issues
    const message = Array.isArray(issues)
      ? issues.map((i: any) => i.message).join('; ')
      : (error as any).message
    return new HttpError(400, message)
  }

  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as any).code as string
    const mapped = PRISMA_ERROR_MAP[code]
    if (mapped) {
      return new HttpError(mapped.status, mapped.message)
    }
    if (typeof code === 'string' && code.startsWith('P')) {
      console.warn(
        '[prisma-generator-express] Unmapped Prisma error code:',
        code,
        (error as any).message || '',
      )
      return new HttpError(500, 'Database operation failed')
    }
  }

  if (error && typeof error === 'object' && 'name' in error) {
    const name = (error as any).name
    if (name === 'PrismaClientValidationError') {
      return new HttpError(400, 'Invalid query parameters')
    }
  }

  console.error('[prisma-generator-express] Unhandled error:', error)
  return new HttpError(500, 'Internal server error')
}

let _speedExtension: ((opts: any) => any) | null = null

const _prismasqlModule = 'prisma-' + 'sql'
const _prismasqlReady = (async () => {
  try {
    const mod = await import(_prismasqlModule)
    _speedExtension = mod.speedExtension ?? mod.default?.speedExtension ?? null
  } catch (err: any) {
    const code = err?.code
    if (code !== 'MODULE_NOT_FOUND' && code !== 'ERR_MODULE_NOT_FOUND') {
      console.warn('[prisma-generator-express] prisma-sql initialization failed:', err)
    }
  }
})()

const _extendedClients = new WeakMap<object, WeakMap<object, any>>()

export async function getExtendedClient(ctx: OperationContext): Promise<any> {
  const base = ctx.prisma
  if (!base) {
    throw new HttpError(500, 'PrismaClient not found on request. Set req.prisma in middleware.')
  }

  await _prismasqlReady

  if (!_speedExtension) return base

  const connector = ctx.postgres || ctx.sqlite
  if (!connector) return base

  if (typeof connector === 'object' && connector !== null) {
    const innerMap = _extendedClients.get(connector)
    if (innerMap) {
      const cached = innerMap.get(base)
      if (cached) return cached
    }
  }

  try {
    const extended = base.$extends(_speedExtension({
      postgres: ctx.postgres,
      sqlite: ctx.sqlite,
      debug: process.env.DEBUG === 'true',
    }))

    if (typeof connector === 'object' && connector !== null) {
      let innerMap = _extendedClients.get(connector)
      if (!innerMap) {
        innerMap = new WeakMap<object, any>()
        _extendedClients.set(connector, innerMap)
      }
      innerMap.set(base, extended)
    }

    return extended
  } catch (error) {
    console.warn('[speedExtension] Failed to initialize, using base client:', error)
    return base
  }
}

export function validateBody(body: unknown): Record<string, any> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'Request body must be a JSON object')
  }
  return sanitizeKeys(body as Record<string, any>)
}

export function requireBodyField(body: Record<string, any>, field: string): void {
  if (!(field in body) || body[field] === undefined) {
    throw new HttpError(400, 'Missing required field: ' + field)
  }
}

export function applyPaginationLimits(
  query: Record<string, any>,
  config?: PaginationConfig,
): Record<string, any> {
  if (!config) return query

  const result = { ...query }

  if (result.take === undefined && config.defaultLimit !== undefined) {
    result.take = config.defaultLimit
  }

  if (config.maxLimit !== undefined && result.take !== undefined) {
    const takeNum = Number(result.take)
    if (Math.abs(takeNum) > config.maxLimit) {
      result.take = takeNum < 0 ? -config.maxLimit : config.maxLimit
    }
  }

  return result
}

export function normalizeDistinct(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string')
  return []
}

export function assertGuard(delegate: any): void {
  if (typeof delegate.guard !== 'function') {
    throw new HttpError(
      500,
      'Guard shapes require prisma-guard extension on PrismaClient. Install: npm install prisma-guard, then extend your client with guardExtension().',
    )
  }
}

const GUARD_SHAPE_CONFIG_KEYS = new Set([
  'data', 'create', 'update', 'where', 'include', 'select', 'orderBy',
  'cursor', 'take', 'skip', 'distinct', 'having', '_count', '_avg',
  '_sum', '_min', '_max', 'by',
])

function keepWhereOnly(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {}
  if ('where' in obj) result.where = obj.where
  return result
}

export function buildCountShape(shape: Record<string, any>): Record<string, any> {
  if (typeof shape === 'function') {
    return (...args: any[]) => keepWhereOnly((shape as Function)(...args))
  }

  const keys = Object.keys(shape)
  const isSingleShape = keys.length === 0 || keys.every((k) => GUARD_SHAPE_CONFIG_KEYS.has(k))

  if (isSingleShape) {
    return keepWhereOnly(shape)
  }

  const result: Record<string, any> = {}
  for (const [key, variant] of Object.entries(shape)) {
    if (typeof variant === 'function') {
      result[key] = (...args: any[]) => keepWhereOnly(variant(...args))
    } else if (typeof variant === 'object' && variant !== null) {
      result[key] = keepWhereOnly(variant)
    } else {
      result[key] = variant
    }
  }
  return result
}

export async function countForPagination(
  delegate: any,
  query: Record<string, any>,
  shape: Record<string, any> | undefined,
  caller: string | undefined,
  distinctCountLimit?: number,
): Promise<number> {
  const distinctFields = normalizeDistinct(query.distinct)
  const hasDistinct = distinctFields.length > 0
  const effectiveLimit = distinctCountLimit ?? DISTINCT_COUNT_LIMIT

  const countShape = shape ? buildCountShape(shape) : undefined

  if (hasDistinct) {
    const selectField = distinctFields[0]
    const distinctArgs: Record<string, any> = {
      where: query.where,
      distinct: distinctFields,
      select: { [selectField]: true },
      take: effectiveLimit + 1,
    }

    const results = shape
      ? await delegate.guard(shape, caller).findMany(distinctArgs)
      : await delegate.findMany(distinctArgs)

    if (results.length > effectiveLimit) {
      console.warn(
        '[prisma-generator-express] Distinct count exceeds ' +
          effectiveLimit +
          ', falling back to approximate total',
      )
      const countArgs: Record<string, any> = {}
      if (query.where) countArgs.where = query.where
      return countShape
        ? await delegate.guard(countShape, caller).count(countArgs)
        : await delegate.count(countArgs)
    }

    return results.length
  }

  const countArgs: Record<string, any> = {}
  if (query.where) countArgs.where = query.where

  return countShape
    ? await delegate.guard(countShape, caller).count(countArgs)
    : await delegate.count(countArgs)
}

export function transformResult(value: unknown): unknown {
  if (value === null || value === undefined) return value
  if (typeof value === 'bigint') return value.toString()
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(value)) {
    return value.toString('base64')
  }
  if (value instanceof Uint8Array) {
    return Buffer.from(value).toString('base64')
  }
  if (value instanceof Date) return value
  if (Array.isArray(value)) return value.map(transformResult)
  if (typeof value === 'object') {
    const proto = Object.getPrototypeOf(value)
    if (proto !== Object.prototype && proto !== null) return value
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = transformResult(v)
    }
    return out
  }
  return value
}
`
}

export interface ModelCoreOptions {
  model: DMMF.Model
}

export function generateModelCore(options: ModelCoreOptions): string {
  const modelName = options.model.name
  const modelNameLower =
    modelName.charAt(0).toLowerCase() + modelName.slice(1)

  const standardReadOps = [
    'findFirst',
    'findUnique',
    'findUniqueOrThrow',
    'findFirstOrThrow',
    'count',
    'aggregate',
    'groupBy',
  ]

  const standardReadHandlers = standardReadOps
    .map(
      (op) => `
export async function ${op}(ctx: OperationContext): Promise<unknown> {
  const query = ctx.parsedQuery || {}
  const extended = await getExtendedClient(ctx)
  if (ctx.guardShape) {
    assertGuard((extended as any).${modelNameLower})
    return (extended as any).${modelNameLower}.guard(ctx.guardShape, ctx.guardCaller).${op}(query)
  }
  return (extended as any).${modelNameLower}.${op}(query)
}`,
    )
    .join('\n')

  const writeOps = [
    { name: 'create', method: 'create', requiredFields: ['data'] },
    { name: 'createMany', method: 'createMany', requiredFields: ['data'] },
    {
      name: 'createManyAndReturn',
      method: 'createManyAndReturn',
      requiredFields: ['data'],
    },
    {
      name: 'update',
      method: 'update',
      requiredFields: ['where', 'data'],
    },
    {
      name: 'updateMany',
      method: 'updateMany',
      requiredFields: ['where', 'data'],
    },
    {
      name: 'updateManyAndReturn',
      method: 'updateManyAndReturn',
      requiredFields: ['where', 'data'],
    },
    { name: 'deleteUnique', method: 'delete', requiredFields: ['where'] },
    {
      name: 'deleteMany',
      method: 'deleteMany',
      requiredFields: ['where'],
    },
    {
      name: 'upsert',
      method: 'upsert',
      requiredFields: ['where', 'create', 'update'],
    },
  ]

  const writeHandlers = writeOps
    .map((op) => {
      const validationLines = op.requiredFields
        .map((field) => `  requireBodyField(body, '${field}')`)
        .join('\n')

      return `
export async function ${op.name}(ctx: OperationContext): Promise<unknown> {
  const body = validateBody(ctx.body)
${validationLines}
  const extended = await getExtendedClient(ctx)
  if (ctx.guardShape) {
    assertGuard((extended as any).${modelNameLower})
    return (extended as any).${modelNameLower}.guard(ctx.guardShape, ctx.guardCaller).${op.method}(body)
  }
  return (extended as any).${modelNameLower}.${op.method}(body)
}`
    })
    .join('\n')

  return `import {
  OperationContext,
  getExtendedClient,
  validateBody,
  requireBodyField,
  applyPaginationLimits,
  assertGuard,
  countForPagination,
} from '../operationRuntime.js'

export async function findMany(ctx: OperationContext): Promise<unknown> {
  const rawQuery = ctx.parsedQuery || {}
  const query = applyPaginationLimits(rawQuery, ctx.paginationConfig)
  const extended = await getExtendedClient(ctx)
  if (ctx.guardShape) {
    assertGuard((extended as any).${modelNameLower})
    return (extended as any).${modelNameLower}.guard(ctx.guardShape, ctx.guardCaller).findMany(query)
  }
  return (extended as any).${modelNameLower}.findMany(query)
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

  if (shape) {
    assertGuard((extended as any).${modelNameLower})
  }

  let items: any[]
  let total: number

  if (typeof extended.$transaction === 'function') {
    try {
      const txResult = await extended.$transaction(async (tx: any) => {
        const d = shape
          ? await tx.${modelNameLower}.guard(shape, caller).findMany(query)
          : await tx.${modelNameLower}.findMany(query)
        const t = await countForPagination(tx.${modelNameLower}, query, shape, caller, distinctCountLimit)
        return { d, t }
      })
      items = txResult.d
      total = txResult.t
    } catch (txError: any) {
      if (
        txError?.message?.includes?.('interactive transactions') ||
        txError?.code === 'P2028'
      ) {
        console.warn(
          '[prisma-generator-express] Interactive transactions not available, pagination queries are non-atomic',
        )
        items = shape
          ? await (extended as any).${modelNameLower}.guard(shape, caller).findMany(query)
          : await (extended as any).${modelNameLower}.findMany(query)
        total = await countForPagination(
          (extended as any).${modelNameLower},
          query,
          shape,
          caller,
          distinctCountLimit,
        )
      } else {
        throw txError
      }
    }
  } else {
    items = shape
      ? await (extended as any).${modelNameLower}.guard(shape, caller).findMany(query)
      : await (extended as any).${modelNameLower}.findMany(query)
    total = await countForPagination(
      (extended as any).${modelNameLower},
      query,
      shape,
      caller,
      distinctCountLimit,
    )
  }

  const skip = (query.skip as number) ?? 0
  const absTake = Math.abs((query.take as number) ?? items.length)
  const hasMore = items.length >= absTake && skip + items.length < total

  return { data: items, total, hasMore }
}
`
}