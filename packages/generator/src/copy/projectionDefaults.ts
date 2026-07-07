import { isPlainObject } from './misc'

const SHAPE_KEYS = new Set([
  'where',
  'select',
  'include',
  'orderBy',
  'cursor',
  'take',
  'skip',
  'distinct',
  'having',
  '_count',
  '_avg',
  '_sum',
  '_min',
  '_max',
  'by',
  'data',
  'create',
  'update',
])

const COMBINATOR_KEYS = new Set(['AND', 'OR', 'NOT'])
const TO_ONE_RELATION_OPS = new Set(['is', 'isNot'])
const TO_MANY_RELATION_OPS = new Set(['some', 'every', 'none'])
const ALL_RELATION_OPS = new Set([
  ...TO_ONE_RELATION_OPS,
  ...TO_MANY_RELATION_OPS,
])

const FORCED_MARKER = Symbol.for('prisma-guard.forced')

function isForcedValue(v: unknown): v is { value: unknown } {
  return (
    v !== null &&
    typeof v === 'object' &&
    (v as Record<PropertyKey, unknown>)[FORCED_MARKER] === true
  )
}

export type ContextResolver = () => unknown | Promise<unknown>

export type OpKind =
  | 'read'
  | 'readUnique'
  | 'create'
  | 'createMany'
  | 'update'
  | 'updateMany'
  | 'upsert'
  | 'delete'
  | 'deleteMany'
  | 'noop'

interface WhereForced {
  conditions: Record<string, unknown>
  relations: Record<string, Record<string, WhereForced>>
}

function emptyForced(): WhereForced {
  return { conditions: {}, relations: {} }
}

function hasForced(f: WhereForced): boolean {
  return (
    Object.keys(f.conditions).length > 0 ||
    Object.keys(f.relations).length > 0
  )
}

function isDirectGuardShape(input: Record<string, unknown>): boolean {
  const keys = Object.keys(input)
  if (keys.length === 0) return true
  return keys.every((k) => SHAPE_KEYS.has(k))
}

async function callShapeFn(
  fn: (ctx: unknown) => unknown,
  resolveContext: ContextResolver | undefined,
): Promise<Record<string, unknown> | null> {
  if (!resolveContext) return null
  const ctx = await resolveContext()
  const result = fn(ctx)
  if (!isPlainObject(result)) return null
  return result
}

async function resolveShape(
  input: unknown,
  caller: string | undefined,
  resolveContext: ContextResolver | undefined,
): Promise<Record<string, unknown> | null> {
  if (!input) return null

  if (typeof input === 'function') {
    return callShapeFn(input as (ctx: unknown) => unknown, resolveContext)
  }

  if (!isPlainObject(input)) return null
  if (isDirectGuardShape(input)) return input

  let entry: unknown = undefined
  if (caller !== undefined && caller in input) entry = input[caller]
  if (entry === undefined && 'default' in input) entry = input['default']
  if (entry === undefined) return null

  if (typeof entry === 'function') {
    return callShapeFn(entry as (ctx: unknown) => unknown, resolveContext)
  }
  if (!isPlainObject(entry)) return null
  return entry
}

function buildDefaultCount(config: unknown): unknown {
  if (config === true) return true
  if (!isPlainObject(config)) return true
  const selectVal = config.select
  if (!isPlainObject(selectVal)) return true
  const result: Record<string, unknown> = {}
  for (const key of Object.keys(selectVal)) result[key] = true
  return { select: result }
}

function buildRelSkeleton(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const skel: Record<string, unknown> = {}
  if (isPlainObject(config.select)) {
    skel.select = buildDefaultProjectionInput(config.select)
  }
  if (isPlainObject(config.include)) {
    skel.include = buildDefaultProjectionInput(config.include)
  }
  return skel
}

function buildDefaultProjectionInput(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(config)) {
    if (key === '_count') {
      result[key] = buildDefaultCount(value)
      continue
    }
    if (value === true) {
      result[key] = true
      continue
    }
    if (isPlainObject(value)) {
      result[key] = buildRelSkeleton(value)
    }
  }
  return result
}

function buildDefaultProjectionBody(
  shape: Record<string, unknown>,
): Record<string, unknown> | null {
  if (isPlainObject(shape.select)) {
    return { select: buildDefaultProjectionInput(shape.select) }
  }
  if (isPlainObject(shape.include)) {
    return { include: buildDefaultProjectionInput(shape.include) }
  }
  return null
}

function extractForcedFromWhereConfig(
  whereConfig: Record<string, unknown>,
): WhereForced {
  const forced = emptyForced()

  for (const [key, value] of Object.entries(whereConfig)) {
    if (COMBINATOR_KEYS.has(key)) continue

    if (isForcedValue(value)) {
      forced.conditions[key] = value.value
      continue
    }

    if (isPlainObject(value)) {
      const relOps: Record<string, WhereForced> = {}
      let hasRelOp = false

      for (const [op, opValue] of Object.entries(value)) {
        if (!ALL_RELATION_OPS.has(op)) continue
        if (opValue === null) continue
        if (!isPlainObject(opValue)) continue
        const nested = extractForcedFromWhereConfig(opValue)
        if (hasForced(nested)) {
          relOps[op] = nested
          hasRelOp = true
        }
      }

      if (hasRelOp) {
        forced.relations[key] = relOps
        continue
      }

      const forcedOps: Record<string, unknown> = {}
      let hasForcedOp = false
      for (const [op, opValue] of Object.entries(value)) {
        if (isForcedValue(opValue)) {
          forcedOps[op] = opValue.value
          hasForcedOp = true
        }
      }
      if (hasForcedOp) {
        forced.conditions[key] = forcedOps
      }
    }
  }

  return forced
}

function extractForcedFromDataConfig(
  dataConfig: Record<string, unknown>,
): Record<string, unknown> {
  const forced: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(dataConfig)) {
    if (isForcedValue(value)) {
      forced[key] = value.value
      continue
    }
    if (typeof value === 'function') continue
    if (value === true) continue
    if (isPlainObject(value)) continue
    forced[key] = value
  }
  return forced
}

function mergeWhereForced(
  where: Record<string, unknown> | undefined,
  forced: WhereForced,
): Record<string, unknown> {
  if (!hasForced(forced)) return where ?? {}

  let result: Record<string, unknown> = where ? { ...where } : {}

  for (const [relName, opMap] of Object.entries(forced.relations)) {
    if (!isPlainObject(result[relName])) {
      result[relName] = {}
    }
    const relObj = { ...(result[relName] as Record<string, unknown>) }
    for (const [op, nestedForced] of Object.entries(opMap)) {
      relObj[op] = mergeWhereForced(
        isPlainObject(relObj[op])
          ? (relObj[op] as Record<string, unknown>)
          : undefined,
        nestedForced,
      )
    }
    result[relName] = relObj
  }

  if (Object.keys(forced.conditions).length > 0) {
    const remaining: Record<string, unknown> = {}
    for (const [field, forcedValue] of Object.entries(forced.conditions)) {
      const existing = result[field]

      if (existing === undefined) {
        remaining[field] = forcedValue
        continue
      }

      if (isPlainObject(existing) && isPlainObject(forcedValue)) {
        result[field] = { ...existing, ...forcedValue }
        continue
      }

      if (isPlainObject(existing) && !isPlainObject(forcedValue)) {
        result[field] = { ...existing, equals: forcedValue }
        continue
      }

      if (!isPlainObject(existing) && isPlainObject(forcedValue)) {
        result[field] = { equals: existing, ...forcedValue }
        continue
      }

      remaining[field] = forcedValue
    }

    if (Object.keys(remaining).length > 0) {
      if (Object.keys(result).length === 0) {
        result = remaining
      } else {
        result = { AND: [result, remaining] }
      }
    }
  }

  return result
}

function mergeUniqueWhereForced(
  where: Record<string, unknown> | undefined,
  forced: WhereForced,
): Record<string, unknown> {
  if (!hasForced(forced)) return where ?? {}

  const result: Record<string, unknown> = where ? { ...where } : {}

  for (const [key, value] of Object.entries(forced.conditions)) {
    if (!(key in result)) {
      result[key] = value
      continue
    }
    if (isPlainObject(result[key]) && isPlainObject(value)) {
      result[key] = {
        ...(result[key] as Record<string, unknown>),
        ...(value as Record<string, unknown>),
      }
    } else {
      result[key] = value
    }
  }

  return result
}

function applyProjectionToTarget(
  target: Record<string, unknown>,
  projection: Record<string, unknown>,
): void {
  if ('select' in target || 'include' in target) return
  Object.assign(target, projection)
}

function mergeForcedData(
  targetData: unknown,
  forced: Record<string, unknown>,
): Record<string, unknown> | unknown[] {
  if (Array.isArray(targetData)) {
    return targetData.map((item) => {
      if (!isPlainObject(item)) return { ...forced }
      return { ...item, ...forced }
    })
  }
  if (isPlainObject(targetData)) {
    return { ...targetData, ...forced }
  }
  return { ...forced }
}

interface WhereMergeOptions {
  targetContainer: Record<string, unknown>
  whereKey: string
  forced: WhereForced
  isUnique: boolean
}

function applyForcedWhere(opts: WhereMergeOptions): void {
  if (!hasForced(opts.forced)) return
  const existing = opts.targetContainer[opts.whereKey]
  const merged = opts.isUnique
    ? mergeUniqueWhereForced(
        isPlainObject(existing)
          ? (existing as Record<string, unknown>)
          : undefined,
        opts.forced,
      )
    : mergeWhereForced(
        isPlainObject(existing)
          ? (existing as Record<string, unknown>)
          : undefined,
        opts.forced,
      )
  opts.targetContainer[opts.whereKey] = merged
}

export async function applyDroppedGuard(
  shape: unknown,
  caller: string | undefined,
  resolveContext: ContextResolver |