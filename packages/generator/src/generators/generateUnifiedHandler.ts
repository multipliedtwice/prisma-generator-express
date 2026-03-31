import { DMMF } from '@prisma/generator-helper'

export interface UnifiedHandlerOptions {
  model: DMMF.Model
  prismaImportStatement: string
}

export function generateUnifiedHandler(options: UnifiedHandlerOptions): string {
  const { model, prismaImportStatement } = options
  const modelName = model.name
  const modelNameLower = modelName.charAt(0).toLowerCase() + modelName.slice(1)
  const importPath =
    prismaImportStatement.match(/from ['"](.+?)['"]/)?.[1] || ''

  return `
import { Prisma, PrismaClient } from '${importPath}'
import { Request, Response, NextFunction } from 'express'
import { sanitizeKeys } from '../misc'

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

const _extendedClients = new WeakMap<object, WeakMap<object, PrismaClient>>()

const DISTINCT_COUNT_LIMIT = 100000

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

async function getExtendedClient(req: Request): Promise<PrismaClient> {
  const base = (req as any).prisma as PrismaClient
  if (!base) {
    throw new HttpError(500, 'PrismaClient not found on request. Set req.prisma in middleware.')
  }

  await _prismasqlReady

  if (!_speedExtension) return base

  const connector = (req as any).postgres || (req as any).sqlite
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
      postgres: (req as any).postgres,
      sqlite: (req as any).sqlite,
      debug: process.env.DEBUG === 'true'
    })) as unknown as PrismaClient

    if (typeof connector === 'object' && connector !== null) {
      let innerMap = _extendedClients.get(connector)
      if (!innerMap) {
        innerMap = new WeakMap<object, PrismaClient>()
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

function handleError(error: unknown, next: NextFunction): void {
  if (error instanceof HttpError) {
    next(error)
    return
  }

  if (error && typeof error === 'object' && 'name' in error && error.name === 'ShapeError') {
    next(new HttpError(400, (error as Error).message))
    return
  }

  if (error && typeof error === 'object' && 'name' in error && error.name === 'CallerError') {
    next(new HttpError(400, (error as Error).message))
    return
  }

  if (error && typeof error === 'object' && 'name' in error && error.name === 'PolicyError') {
    next(new HttpError(403, (error as Error).message))
    return
  }

  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as any).code as string
    const mapped = PRISMA_ERROR_MAP[code]
    if (mapped) {
      next(new HttpError(mapped.status, mapped.message))
      return
    }
    if (typeof code === 'string' && code.startsWith('P')) {
      next(new HttpError(500, 'Database operation failed'))
      return
    }
  }

  if (error && typeof error === 'object' && 'name' in error) {
    const name = (error as any).name
    if (name === 'PrismaClientValidationError') {
      next(new HttpError(400, 'Invalid query parameters'))
      return
    }
  }

  console.error('[prisma-generator-express] Unhandled error:', error)
  next(new HttpError(500, 'Internal server error'))
}

function safeParseBody(req: Request): Record<string, any> {
  const body = req.body
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'Request body must be a JSON object')
  }
  return sanitizeKeys(body as Record<string, any>)
}

function requireBodyField(body: Record<string, any>, field: string): void {
  if (!(field in body) || body[field] === undefined) {
    throw new HttpError(400, 'Missing required field: ' + field)
  }
}

function applyPaginationLimits(query: Record<string, any>, res: Response): Record<string, any> {
  const routeConfig = res.locals.routeConfig
  const pagination = routeConfig?.pagination
  if (!pagination) return query

  const result = { ...query }

  if (result.take === undefined && pagination.defaultLimit !== undefined) {
    result.take = pagination.defaultLimit
  }

  if (pagination.maxLimit !== undefined && result.take !== undefined) {
    const takeNum = Number(result.take)
    if (Math.abs(takeNum) > pagination.maxLimit) {
      result.take = takeNum < 0 ? -pagination.maxLimit : pagination.maxLimit
    }
  }

  return result
}

function normalizeDistinct(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string')
  return []
}

function assertGuard(delegate: any): void {
  if (typeof delegate.guard !== 'function') {
    throw new HttpError(500, 'Guard shapes require prisma-guard extension on PrismaClient. Install: npm install prisma-guard, then extend your client with guardExtension().')
  }
}

const COUNT_PROJECTION_KEYS = new Set(['select', 'include'])

const GUARD_SHAPE_CONFIG_KEYS = new Set([
  'data', 'create', 'update', 'where', 'include', 'select', 'orderBy',
  'cursor', 'take', 'skip', 'distinct', 'having', '_count', '_avg',
  '_sum', '_min', '_max', 'by',
])

function stripProjectionKeys(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (COUNT_PROJECTION_KEYS.has(key)) continue
    result[key] = value
  }
  return result
}

function stripProjectionForCount(shape: Record<string, any>): Record<string, any> {
  if (typeof shape === 'function') {
    return (...args: any[]) => stripProjectionKeys((shape as Function)(...args))
  }

  const keys = Object.keys(shape)
  const isSingleShape = keys.length === 0 || keys.every(k => GUARD_SHAPE_CONFIG_KEYS.has(k))

  if (isSingleShape) {
    return stripProjectionKeys(shape)
  }

  const result: Record<string, any> = {}
  for (const [key, variant] of Object.entries(shape)) {
    if (typeof variant === 'function') {
      result[key] = (...args: any[]) => stripProjectionKeys(variant(...args))
    } else if (typeof variant === 'object' && variant !== null) {
      result[key] = stripProjectionKeys(variant)
    } else {
      result[key] = variant
    }
  }
  return result
}

${generateReadHandlers(modelName, modelNameLower)}

${generateWriteHandlers(modelName, modelNameLower)}
`
}

function generateReadHandlers(
  modelName: string,
  modelNameLower: string,
): string {
  const standardReadOps = [
    'findFirst',
    'findUnique',
    'findUniqueOrThrow',
    'findFirstOrThrow',
    'count',
    'aggregate',
    'groupBy',
  ]

  const standardHandlers = standardReadOps
    .map((op) => {
      const functionName = `${modelName}${op.charAt(0).toUpperCase() + op.slice(1)}`

      return `
export async function ${functionName}(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const query = res.locals.parsedQuery || {}
    const extended = await getExtendedClient(req)
    const shape = res.locals.guardShape

    let data
    if (shape) {
      assertGuard(extended.${modelNameLower})
      const caller = res.locals.guardCaller
      data = await extended.${modelNameLower}.guard(shape, caller).${op}(query)
    } else {
      data = await extended.${modelNameLower}.${op}(query)
    }

    res.locals.data = data
    next()
  } catch (error: unknown) {
    handleError(error, next)
  }
}
`
    })
    .join('\n')

  const findManyHandler = `
export async function ${modelName}FindMany(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const rawQuery = res.locals.parsedQuery || {}
    const query = applyPaginationLimits(rawQuery, res)
    const extended = await getExtendedClient(req)
    const shape = res.locals.guardShape

    let data
    if (shape) {
      assertGuard(extended.${modelNameLower})
      const caller = res.locals.guardCaller
      data = await extended.${modelNameLower}.guard(shape, caller).findMany(query)
    } else {
      data = await extended.${modelNameLower}.findMany(query)
    }

    res.locals.data = data
    next()
  } catch (error: unknown) {
    handleError(error, next)
  }
}
`

  return findManyHandler + '\n' + standardHandlers
}

function generateWriteHandlers(
  modelName: string,
  modelNameLower: string,
): string {
  const writeOps: {
    name: string
    method: string
    requiredFields?: string[]
  }[] = [
    { name: 'Create', method: 'create' },
    { name: 'CreateMany', method: 'createMany' },
    { name: 'CreateManyAndReturn', method: 'createManyAndReturn' },
    { name: 'Update', method: 'update' },
    {
      name: 'UpdateMany',
      method: 'updateMany',
      requiredFields: ['where', 'data'],
    },
    {
      name: 'UpdateManyAndReturn',
      method: 'updateManyAndReturn',
      requiredFields: ['where', 'data'],
    },
    { name: 'Delete', method: 'delete' },
    { name: 'DeleteMany', method: 'deleteMany', requiredFields: ['where'] },
    { name: 'Upsert', method: 'upsert' },
  ]

  return (
    writeOps
      .map((op) => {
        const functionName = `${modelName}${op.name}`
        const validationLines = (op.requiredFields || [])
          .map((field) => `    requireBodyField(body, '${field}')`)
          .join('\n')

        return `
export async function ${functionName}(req: Request, res: Response, next: NextFunction) {
  try {
    const body = safeParseBody(req)
${validationLines ? validationLines + '\n' : ''}    const extended = await getExtendedClient(req)
    const shape = res.locals.guardShape

    let data
    if (shape) {
      assertGuard(extended.${modelNameLower})
      const caller = res.locals.guardCaller
      data = await extended.${modelNameLower}.guard(shape, caller).${op.method}(body)
    } else {
      data = await extended.${modelNameLower}.${op.method}(body)
    }

    res.locals.data = data
    next()
  } catch (error: unknown) {
    handleError(error, next)
  }
}
`
      })
      .join('\n') +
    `

async function countForPagination(
  delegate: any,
  query: Record<string, any>,
  shape: Record<string, any> | undefined,
  caller: string | undefined,
): Promise<number> {
  const distinctFields = normalizeDistinct(query.distinct)
  const hasDistinct = distinctFields.length > 0

  const countShape = shape ? stripProjectionForCount(shape) : undefined

  if (hasDistinct) {
    const selectField = distinctFields[0]
    const distinctArgs: Record<string, any> = {
      where: query.where,
      distinct: distinctFields,
      select: { [selectField]: true },
      take: DISTINCT_COUNT_LIMIT + 1,
    }

    const results = shape
      ? await delegate.guard(shape, caller).findMany(distinctArgs)
      : await delegate.findMany(distinctArgs)

    if (results.length > DISTINCT_COUNT_LIMIT) {
      console.warn('[prisma-generator-express] Distinct count exceeds ' + DISTINCT_COUNT_LIMIT + ', falling back to approximate total')
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

export async function ${modelName}FindManyPaginated(req: Request, res: Response, next: NextFunction) {
  try {
    const rawQuery = res.locals.parsedQuery || {}
    const query = applyPaginationLimits(rawQuery, res)
    const extended = await getExtendedClient(req)
    const shape = res.locals.guardShape
    const caller = res.locals.guardCaller

    if (shape) {
      assertGuard(extended.${modelNameLower})
    }

    let items: any[]
    let total: number

    if (typeof extended.$transaction === 'function') {
      try {
        const txResult = await extended.$transaction(async (tx: any) => {
          const d = shape
            ? await tx.${modelNameLower}.guard(shape, caller).findMany(query)
            : await tx.${modelNameLower}.findMany(query)
          const t = await countForPagination(tx.${modelNameLower}, query, shape, caller)
          return { d, t }
        })
        items = txResult.d
        total = txResult.t
      } catch (txError: any) {
        if (
          txError?.message?.includes?.('interactive transactions') ||
          txError?.code === 'P2028'
        ) {
          console.warn('[prisma-generator-express] Interactive transactions not available, pagination queries are non-atomic')
          items = shape
            ? await extended.${modelNameLower}.guard(shape, caller).findMany(query)
            : await extended.${modelNameLower}.findMany(query)
          total = await countForPagination(extended.${modelNameLower}, query, shape, caller)
        } else {
          throw txError
        }
      }
    } else {
      items = shape
        ? await extended.${modelNameLower}.guard(shape, caller).findMany(query)
        : await extended.${modelNameLower}.findMany(query)
      total = await countForPagination(extended.${modelNameLower}, query, shape, caller)
    }

    const skip = (query.skip as number) ?? 0
    const absTake = Math.abs((query.take as number) ?? items.length)
    const hasMore = items.length >= absTake && skip + items.length < total

    res.locals.data = { data: items, total, hasMore }
    next()
  } catch (error: unknown) {
    handleError(error, next)
  }
}
`
  )
}