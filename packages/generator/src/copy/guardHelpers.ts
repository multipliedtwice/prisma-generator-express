import { HttpError } from './errorMapper'

export type PrismaDelegateLike = {
  count: (args?: unknown) => Promise<unknown>
  findMany: (args?: unknown) => Promise<unknown>
  guard?: (shape: Record<string, unknown>, caller?: string) => PrismaDelegateLike
}

export function assertGuard(
  delegate: PrismaDelegateLike,
): asserts delegate is PrismaDelegateLike & { guard: NonNullable<PrismaDelegateLike['guard']> } {
  if (typeof delegate.guard !== 'function') {
    throw new HttpError(
      500,
      'Guard shapes require prisma-guard extension on PrismaClient. Install: npm install prisma-guard, then extend your client with guardExtension().',
    )
  }
}

export const GUARD_SHAPE_CONFIG_KEYS = new Set([
  'data', 'create', 'update', 'where', 'include', 'select', 'orderBy',
  'cursor', 'take', 'skip', 'distinct', 'having', '_count', '_avg',
  '_sum', '_min', '_max', 'by',
])

function keepWhereOnly(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  if ('where' in obj) result.where = obj.where
  return result
}

export type ShapeFn = (...args: unknown[]) => Record<string, unknown>

export function buildCountShape(
  shape: Record<string, unknown> | ShapeFn,
): Record<string, unknown> | ShapeFn {
  if (typeof shape === 'function') {
    const fn = shape as ShapeFn
    return (...args: unknown[]) => keepWhereOnly(fn(...args))
  }
  const keys = Object.keys(shape)
  const isSingleShape = keys.length === 0 || keys.every((k) => GUARD_SHAPE_CONFIG_KEYS.has(k))
  if (isSingleShape) return keepWhereOnly(shape)
  const result: Record<string, unknown> = {}
  for (const [key, variant] of Object.entries(shape)) {
    if (typeof variant === 'function') {
      const vfn = variant as ShapeFn
      result[key] = (...args: unknown[]) => keepWhereOnly(vfn(...args))
    } else if (variant && typeof variant === 'object') {
      result[key] = keepWhereOnly(variant as Record<string, unknown>)
    } else {
      result[key] = variant
    }
  }
  return result
}