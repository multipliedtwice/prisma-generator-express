import { HttpError, LOG_PREFIX } from './errorMapper'
import { sanitizeKeys, isPlainObject } from './misc'
import type {
  ProgressivePatch,
  ProgressiveStopResult,
  ProgressiveStageResult,
  ProgressiveStageContext,
  ProgressiveStage,
  PaginationConfig,
  PaginationCountSource,
  FindManyPaginatedMode,
} from './routeConfig'

export type {
  ProgressivePatch,
  ProgressiveStopResult,
  ProgressiveStageResult,
  ProgressiveStageContext,
  ProgressiveStage,
  PaginationConfig,
  PaginationCountSource,
  FindManyPaginatedMode,
}

export interface OperationContext {
  prisma: unknown
  postgres?: unknown
  sqlite?: unknown
  parsedQuery?: Record<string, unknown>
  body?: unknown
  guardShape?: Record<string, unknown>
  guardCaller?: string
  paginationConfig?: PaginationConfig
  findManyPaginatedMode?: FindManyPaginatedMode
}

export type PrismaDelegate = {
  findMany: (args?: unknown) => Promise<unknown>
  findFirst: (args?: unknown) => Promise<unknown>
  findUnique: (args?: unknown) => Promise<unknown>
  findUniqueOrThrow: (args?: unknown) => Promise<unknown>
  findFirstOrThrow: (args?: unknown) => Promise<unknown>
  create: (args?: unknown) => Promise<unknown>
  createMany: (args?: unknown) => Promise<unknown>
  createManyAndReturn: (args?: unknown) => Promise<unknown>
  update: (args?: unknown) => Promise<unknown>
  updateMany: (args?: unknown) => Promise<unknown>
  updateManyAndReturn: (args?: unknown) => Promise<unknown>
  upsert: (args?: unknown) => Promise<unknown>
  delete: (args?: unknown) => Promise<unknown>
  deleteMany: (args?: unknown) => Promise<unknown>
  count: (args?: unknown) => Promise<unknown>
  aggregate: (args?: unknown) => Promise<unknown>
  groupBy: (args?: unknown) => Promise<unknown>
  guard?: (shape: Record<string, unknown>, caller?: string) => PrismaDelegate
}

export type PrismaClientLike = {
  $extends?: (extension: unknown) => PrismaClientLike
  $transaction?: <T>(fn: (tx: PrismaClientLike) => Promise<T>) => Promise<T>
}

type SpeedExtensionFactory = (opts: { postgres?: unknown; sqlite?: unknown; debug?: boolean }) => unknown

let _speedExtension: SpeedExtensionFactory | null = null

const _prismasqlModule = 'prisma-' + 'sql'
const _prismasqlReady = (async () => {
  try {
    const mod = (await import(_prismasqlModule)) as {
      speedExtension?: SpeedExtensionFactory
      default?: { speedExtension?: SpeedExtensionFactory }
    }
    _speedExtension = mod.speedExtension ?? mod.default?.speedExtension ?? null
  } catch (err) {
    const code = (err as { code?: string } | null)?.code
    if (code !== 'MODULE_NOT_FOUND' && code !== 'ERR_MODULE_NOT_FOUND') {
      console.warn(LOG_PREFIX, 'prisma-sql initialization failed:', err)
    }
  }
})()

const _extendedClients = new WeakMap<object, WeakMap<object, unknown>>()

export async function getExtendedClient(ctx: OperationContext): Promise<unknown> {
  const base = ctx.prisma as PrismaClientLike | null | undefined
  if (!base) {
    throw new HttpError(500, 'PrismaClient not found on request. Set req.prisma in middleware.')
  }
  await _prismasqlReady
  if (!_speedExtension) return base
  const connector = (ctx.postgres ?? ctx.sqlite) as object | undefined
  if (!connector) return base
  const innerMap = _extendedClients.get(connector)
  if (innerMap) {
    const cached = innerMap.get(base as unknown as object)
    if (cached) return cached
  }
  try {
    if (typeof base.$extends !== 'function') return base
    const extended = base.$extends(_speedExtension({
      postgres: ctx.postgres,
      sqlite: ctx.sqlite,
      debug: process.env.DEBUG === 'true',
    }))
    let map = _extendedClients.get(connector)
    if (!map) {
      map = new WeakMap<object, unknown>()
      _extendedClients.set(connector, map)
    }
    map.set(base as unknown as object, extended)
    return extended
  } catch (error) {
    console.warn('[speedExtension] Failed to initialize, using base client:', error)
    return base
  }
}

export function getDelegate(client: unknown, key: string): PrismaDelegate {
  if (!client || typeof client !== 'object') {
    throw new HttpError(500, 'PrismaClient is not a valid object')
  }
  const delegate = (client as Record<string, unknown>)[key]
  if (!delegate || typeof delegate !== 'object') {
    throw new HttpError(500, 'Prisma delegate not found: ' + key)
  }
  return delegate as PrismaDelegate
}

export function validateBody(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'Request body must be a JSON object')
  }
  return sanitizeKeys(body as Record<string, unknown>)
}

export function requireBodyField(body: Record<string, unknown>, field: string): void {
  if (!(field in body) || body[field] === undefined) {
    throw new HttpError(400, 'Missing required field: ' + field)
  }
}

export function transformResult(value: unknown): unknown {
  if (value === null || value === undefined) return value
  if (typeof value === 'bigint') return value.toString()
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(value)) return value.toString('base64')
  if (typeof Buffer !== 'undefined' && value instanceof Uint8Array) {
    return Buffer.from(value).toString('base64')
  }
  if (value instanceof Date) return value
  if (Array.isArray(value)) {
    let changed = false
    const out: unknown[] = new Array(value.length)
    for (let i = 0; i < value.length; i++) {
      const t = transformResult(value[i])
      if (t !== value[i]) changed = true
      out[i] = t
    }
    return changed ? out : value
  }
  if (isPlainObject(value)) {
    let changed = false
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) {
      const t = transformResult(v)
      if (t !== v) changed = true
      out[k] = t
    }
    return changed ? out : value
  }
  return value
}