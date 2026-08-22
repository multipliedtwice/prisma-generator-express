import { HttpError, LOG_PREFIX } from './errorMapper'
import {
  assertGuard,
  buildCountShape,
  type PrismaDelegateLike,
} from './guardHelpers'
import { countFromMaterializedView } from './materializedCount'
import { isPlainObject } from './misc'
import type { PaginationConfig, PaginationCountSource } from './routeConfig'

export const DISTINCT_COUNT_LIMIT = 100000

export function applyPaginationLimits(
  query: Record<string, unknown>,
  config?: PaginationConfig,
  hasGuardShape?: boolean,
): Record<string, unknown> {
  if (!config) return query
  const result: Record<string, unknown> = { ...query }
  if (
    !hasGuardShape &&
    result.take === undefined &&
    config.defaultLimit !== undefined
  ) {
    result.take = config.defaultLimit
  }
  if (config.maxLimit !== undefined && result.take !== undefined) {
    const takeNum =
      typeof result.take === 'number' ? result.take : Number(result.take)
    if (!Number.isFinite(takeNum)) {
      throw new HttpError(400, 'Invalid take: must be a finite number')
    }
    if (!Number.isInteger(takeNum)) {
      throw new HttpError(400, 'Invalid take: must be an integer')
    }
    if (Math.abs(takeNum) > config.maxLimit) {
      result.take = takeNum < 0 ? -config.maxLimit : config.maxLimit
    } else {
      result.take = takeNum
    }
  }
  return result
}

function mergeCountSource(
  base: PaginationCountSource | undefined,
  override: PaginationCountSource | undefined,
): PaginationCountSource | undefined {
  if (!base && !override) return undefined
  if (!base) return override
  if (!override) return base

  const overrideType = (override as { type?: string }).type
  const baseType = (base as { type?: string }).type
  const effectiveType = overrideType ?? baseType

  if (effectiveType === 'delegate' || effectiveType === undefined) {
    return { type: 'delegate' }
  }

  return {
    ...(base as Record<string, unknown>),
    ...(override as Record<string, unknown>),
    type: effectiveType,
  } as PaginationCountSource
}

export function mergePaginationConfig(
  base: PaginationConfig | undefined,
  override: Partial<PaginationConfig> | undefined,
): PaginationConfig | undefined {
  if (!base && !override) return undefined
  const merged: PaginationConfig = {
    ...(base ?? {}),
    ...(override ?? {}),
  }
  const mergedCountSource = mergeCountSource(
    base?.countSource,
    override?.countSource,
  )
  if (mergedCountSource) {
    merged.countSource = mergedCountSource
  } else {
    delete merged.countSource
  }
  return merged
}

export function normalizeDistinct(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value))
    return value.filter((v): v is string => typeof v === 'string')
  return []
}

function isEffectivelyEmpty(where: unknown): boolean {
  if (where === undefined || where === null) return true
  if (!isPlainObject(where)) return false
  return Object.keys(where).length === 0
}

export async function countForPagination(
  delegate: PrismaDelegateLike,
  query: Record<string, unknown>,
  shape: Record<string, unknown> | undefined,
  caller: string | undefined,
  distinctCountLimit?: number,
  countSource?: PaginationCountSource,
  rawClient?: unknown,
): Promise<number> {
  const normalizedDistinct = normalizeDistinct(query.distinct)
  const whereIsEmpty = isEffectivelyEmpty(query.where)
  const distinctIsEmpty = normalizedDistinct.length === 0

  if (
    countSource &&
    countSource.type === 'materializedView' &&
    !shape &&
    whereIsEmpty &&
    distinctIsEmpty
  ) {
    return countFromMaterializedView(rawClient ?? delegate, countSource)
  }

  const hasDistinct = normalizedDistinct.length > 0
  const effectiveLimit = distinctCountLimit ?? DISTINCT_COUNT_LIMIT
  const countShape = shape ? buildCountShape(shape) : undefined

  const runCount = async (): Promise<number> => {
    const countArgs: Record<string, unknown> = {}
    if (query.where) countArgs.where = query.where
    if (countShape) {
      assertGuard(delegate)
      return (await delegate
        .guard(countShape as Record<string, unknown>, caller)
        .count(countArgs)) as number
    }
    return (await delegate.count(countArgs)) as number
  }

  if (hasDistinct && shape) return runCount()

  if (hasDistinct) {
    const selectField = normalizedDistinct[0]
    const distinctArgs: Record<string, unknown> = {
      where: query.where,
      distinct: normalizedDistinct,
      select: { [selectField]: true },
      take: effectiveLimit + 1,
    }
    const results = (await delegate.findMany(distinctArgs)) as unknown[]
    if (results.length > effectiveLimit) {
      console.warn(
        LOG_PREFIX,
        'Distinct count exceeds ' +
          effectiveLimit +
          ', falling back to approximate total',
      )
      return runCount()
    }
    return results.length
  }

  return runCount()
}
