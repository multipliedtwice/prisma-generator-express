import { sanitizeKeys } from './misc'
import type {
  ProgressivePatch,
  ProgressiveStopResult,
  ProgressiveStageResult,
  ProgressiveStageContext,
  ProgressiveStage,
} from './routeConfig'

export type {
  ProgressivePatch,
  ProgressiveStopResult,
  ProgressiveStageResult,
  ProgressiveStageContext,
  ProgressiveStage,
}

export interface PaginationConfig {
  defaultLimit?: number
  maxLimit?: number
  distinctCountLimit?: number
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

type ErrorShape = {
  name?: string
  code?: string
  message?: string
  issues?: unknown
}

function asErrorShape(error: unknown): ErrorShape {
  if (error && typeof error === 'object') return error as ErrorShape
  return {}
}

export function mapError(error: unknown): HttpError {
  if (error instanceof HttpError) return error
  const e = asErrorShape(error)
  if (e.name === 'ShapeError') return new HttpError(400, e.message || 'Shape validation failed')
  if (e.name === 'CallerError') return new HttpError(400, e.message || 'Caller validation failed')
  if (e.name === 'PolicyError') return new HttpError(403, e.message || 'Policy denied')
  if (e.name === 'ZodError') {
    const issues = e.issues
    const message = Array.isArray(issues)
      ? (issues as Array<{ message?: string }>).map((i) => i.message ?? '').filter(Boolean).join('; ')
      : (e.message || 'Validation failed')
    return new HttpError(400, message)
  }
  if (typeof e.code === 'string') {
    const mapped = PRISMA_ERROR_MAP[e.code]
    if (mapped) {
      const detail = e.message
      return new HttpError(mapped.status, detail ? mapped.message + ': ' + detail : mapped.message)
    }
    if (e.code.startsWith('P')) {
      const msg = e.message || 'Database operation failed'
      console.warn('[prisma-generator-express] Unmapped Prisma error code:', e.code, msg)
      return new HttpError(500, msg)
    }
  }
  if (typeof e.name === 'string') {
    if (e.name === 'PrismaClientValidationError') return new HttpError(400, e.message || 'Invalid query parameters')
    if (e.name === 'PrismaClientKnownRequestError') return new HttpError(400, e.message || 'Database request error')
    if (e.name === 'PrismaClientInitializationError') return new HttpError(503, e.message || 'Database connection failed')
    if (e.name === 'PrismaClientRustPanicError') return new HttpError(500, e.message || 'Internal database engine error')
    if (e.name === 'PrismaClientUnknownRequestError') return new HttpError(500, e.message || 'Unknown database error')
  }
  const msg = error instanceof Error ? error.message : String(error)
  console.error('[prisma-generator-express] Unhandled error:', error)
  return new HttpError(500, msg || 'Internal server error')
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
      console.warn('[prisma-generator-express] prisma-sql initialization failed:', err)
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
  if (typeof connector === 'object' && connector !== null) {
    const innerMap = _extendedClients.get(connector)
    if (innerMap) {
      const cached = innerMap.get(base as unknown as object)
      if (cached) return cached
    }
  }
  try {
    if (typeof base.$extends !== 'function') return base
    const extended = base.$extends(_speedExtension({
      postgres: ctx.postgres,
      sqlite: ctx.sqlite,
      debug: process.env.DEBUG === 'true',
    }))
    if (typeof connector === 'object' && connector !== null) {
      let innerMap = _extendedClients.get(connector)
      if (!innerMap) {
        innerMap = new WeakMap<object, unknown>()
        _extendedClients.set(connector, innerMap)
      }
      innerMap.set(base as unknown as object, extended)
    }
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

export function applyPaginationLimits(
  query: Record<string, unknown>,
  config?: PaginationConfig,
): Record<string, unknown> {
  if (!config) return query
  const result: Record<string, unknown> = { ...query }
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

export function assertGuard(
  delegate: PrismaDelegate,
): asserts delegate is PrismaDelegate & { guard: NonNullable<PrismaDelegate['guard']> } {
  if (typeof delegate.guard !== 'function') {
    throw new HttpError(500, 'Guard shapes require prisma-guard extension on PrismaClient.')
  }
}

const GUARD_SHAPE_CONFIG_KEYS = new Set([
  'data', 'create', 'update', 'where', 'include', 'select', 'orderBy',
  'cursor', 'take', 'skip', 'distinct', 'having', '_count', '_avg',
  '_sum', '_min', '_max', 'by',
])

function keepWhereOnly(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  if ('where' in obj) result.where = obj.where
  return result
}

type ShapeFn = (...args: unknown[]) => Record<string, unknown>

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

export async function countForPagination(
  delegate: PrismaDelegate,
  query: Record<string, unknown>,
  shape: Record<string, unknown> | undefined,
  caller: string | undefined,
  distinctCountLimit?: number,
): Promise<number> {
  const distinctFields = normalizeDistinct(query.distinct)
  const hasDistinct = distinctFields.length > 0
  const effectiveLimit = distinctCountLimit ?? DISTINCT_COUNT_LIMIT
  const countShape = shape ? buildCountShape(shape) : undefined

  if (hasDistinct) {
    const selectField = distinctFields[0]
    const distinctArgs: Record<string, unknown> = {
      where: query.where,
      distinct: distinctFields,
      select: { [selectField]: true },
      take: effectiveLimit + 1,
    }
    const results = shape
      ? await (delegate.guard as NonNullable<PrismaDelegate['guard']>)(shape, caller).findMany(distinctArgs)
      : await delegate.findMany(distinctArgs)
    const resultArray = results as unknown[]
    if (resultArray.length > effectiveLimit) {
      console.warn('[prisma-generator-express] Distinct count exceeds ' + effectiveLimit + ', falling back to approximate total')
      const countArgs: Record<string, unknown> = {}
      if (query.where) countArgs.where = query.where
      const total = countShape
        ? await (delegate.guard as NonNullable<PrismaDelegate['guard']>)(countShape as Record<string, unknown>, caller).count(countArgs)
        : await delegate.count(countArgs)
      return total as number
    }
    return resultArray.length
  }

  const countArgs: Record<string, unknown> = {}
  if (query.where) countArgs.where = query.where
  const total = countShape
    ? await (delegate.guard as NonNullable<PrismaDelegate['guard']>)(countShape as Record<string, unknown>, caller).count(countArgs)
    : await delegate.count(countArgs)
  return total as number
}

export function transformResult(value: unknown): unknown {
  if (value === null || value === undefined) return value
  if (typeof value === 'bigint') return value.toString()
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(value)) return value.toString('base64')
  if (value instanceof Uint8Array) return Buffer.from(value).toString('base64')
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

export function acceptsEventStream(accept: string | undefined): boolean {
  if (!accept) return false
  return accept.toLowerCase().includes('text/event-stream')
}

const UNSAFE_PATH_SEGMENTS = new Set(['__proto__', 'constructor', 'prototype'])

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false
  if (Array.isArray(value)) return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

export function setByPath(target: Record<string, unknown>, path: string, value: unknown): boolean {
  const parts = path.split('.')
  if (parts.length === 0) return false
  for (const p of parts) {
    if (p === '' || UNSAFE_PATH_SEGMENTS.has(p)) return false
  }
  let cursor: Record<string, unknown> = target
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]
    const next = cursor[part]
    if (!isPlainObject(next)) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(
          '[progressive] Dropping patch for "' + path +
          '": cannot traverse non-plain-object at segment "' + part + '"',
        )
      }
      return false
    }
    cursor = next
  }
  cursor[parts[parts.length - 1]] = value
  return true
}

type EventEmitterLike = {
  on?: (event: string, listener: () => void) => unknown
  off?: (event: string, listener: () => void) => unknown
  removeListener?: (event: string, listener: () => void) => unknown
  destroyed?: boolean
}

type SseWritable = {
  statusCode: number
  setHeader: (name: string, value: string) => unknown
  flushHeaders?: () => unknown
  flush?: () => unknown
  write: (chunk: string) => unknown
  end: () => unknown
  writableEnded: boolean
  destroyed: boolean
}

export function removeReqCloseListener(req: EventEmitterLike, listener: () => void): void {
  if (typeof req.off === 'function') {
    req.off('close', listener)
  } else if (typeof req.removeListener === 'function') {
    req.removeListener('close', listener)
  }
}

export function initSSE(res: SseWritable): void {
  res.statusCode = 200
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  if (typeof res.flushHeaders === 'function') res.flushHeaders()
}

export function flushSSE(res: SseWritable): void {
  if (typeof res.flush === 'function') {
    try { res.flush() } catch { /* ignore */ }
  }
}

export function sendSSE(res: SseWritable, payload: unknown): boolean {
  if (res.writableEnded || res.destroyed) return false
  try {
    res.write('data: ' + JSON.stringify(transformResult(payload)) + '\n\n')
    flushSSE(res)
    return true
  } catch (err) {
    console.error('[progressive] failed to send SSE event:', err)
    return false
  }
}

export function sendSSEProgress(res: SseWritable, stage: string, completed: number, total: number): boolean {
  return sendSSE(res, { type: 'progress', stage, completed, total })
}

export function sendSSEField(res: SseWritable, key: string, value: unknown): boolean {
  return sendSSE(res, { type: 'field', key, value })
}

export function sendSSEResult(res: SseWritable, data: unknown): boolean {
  return sendSSE(res, { type: 'result', data })
}

export function sendSSEError(res: SseWritable, message: string): boolean {
  if (res.writableEnded || res.destroyed) return false
  try {
    res.write('data: ' + JSON.stringify({ type: 'error', message }) + '\n\n')
    flushSSE(res)
    return true
  } catch (err) {
    console.error('[progressive] failed to send SSE error event:', err)
    return false
  }
}

type IntervalHandle = ReturnType<typeof setInterval>

export function startSSEKeepalive(res: SseWritable, intervalMs: number = 15000): IntervalHandle {
  const handle = setInterval(() => {
    if (res.writableEnded || res.destroyed) return
    try {
      res.write(': keepalive\n\n')
      flushSSE(res)
    } catch { /* ignore */ }
  }, intervalMs)
  const maybeUnref = (handle as unknown as { unref?: () => void }).unref
  if (typeof maybeUnref === 'function') maybeUnref.call(handle)
  return handle
}

export function endSSE(res: SseWritable, keepaliveHandle: IntervalHandle | null): void {
  if (keepaliveHandle) {
    try { clearInterval(keepaliveHandle) } catch { /* ignore */ }
  }
  if (!res.writableEnded && !res.destroyed) {
    try { res.end() } catch { /* ignore */ }
  }
}

export function emitTerminalSSEError(res: SseWritable, message: string): void {
  let keepalive: IntervalHandle | null = null
  try {
    initSSE(res)
    keepalive = startSSEKeepalive(res)
    sendSSEError(res, message)
  } finally {
    endSSE(res, keepalive)
  }
}

export interface RunSingleResultSSEOptions {
  req: EventEmitterLike
  res: SseWritable
  coreQueryFn: () => Promise<unknown>
}

export async function runSingleResultSSE(options: RunSingleResultSSEOptions): Promise<void> {
  const { req, res, coreQueryFn } = options
  let keepalive: IntervalHandle | null = null
  try {
    initSSE(res)
    keepalive = startSSEKeepalive(res)
    if (req.destroyed) return
    const data = await coreQueryFn()
    if (res.writableEnded || res.destroyed) return
    sendSSEResult(res, data)
  } catch (err) {
    console.error('[progressive] single-result error:', err)
    if (!res.writableEnded && !res.destroyed) {
      sendSSEError(res, 'Internal server error')
    }
  } finally {
    endSSE(res, keepalive)
  }
}

function isStopResult(value: unknown): value is ProgressiveStopResult<unknown> {
  return typeof value === 'object' && value !== null && (value as { stop?: unknown }).stop === true
}

export interface RunProgressiveOptions {
  req: EventEmitterLike
  res: SseWritable
  ctx: unknown
  prisma: unknown
  variant: string
  stages: string[]
  stageRegistry: Record<string, ProgressiveStage>
}

export async function runProgressiveEndpoint(options: RunProgressiveOptions): Promise<void> {
  const { req, res, ctx, prisma, variant, stages, stageRegistry } = options
  let keepalive: IntervalHandle | null = null
  const controller = new AbortController()
  const onClose = () => controller.abort()
  if (typeof req.on === 'function') req.on('close', onClose)

  const accumulated: Record<string, unknown> = {}
  const signal = controller.signal

  try {
    initSSE(res)
    keepalive = startSSEKeepalive(res)
    sendSSEProgress(res, 'start', 0, stages.length)

    for (let i = 0; i < stages.length; i++) {
      if (res.writableEnded || res.destroyed || signal.aborted) return
      const stageName = stages[i]
      const stage = stageRegistry[stageName]
      if (!stage) throw new Error('Missing progressive stage: ' + stageName)

      const result = await stage({ ctx, req, res, prisma, variant, accumulated, signal })
      if (res.writableEnded || res.destroyed) return

      if (isStopResult(result)) {
        sendSSEResult(res, result.data)
        return
      }

      const patches = Array.isArray(result) ? result : result ? [result] : []
      for (const patch of patches) {
        if (!patch || typeof patch !== 'object') continue
        const p = patch as ProgressivePatch
        if (typeof p.key !== 'string') continue
        if (!('value' in p)) continue
        const applied = setByPath(accumulated, p.key, p.value)
        if (applied) sendSSEField(res, p.key, p.value)
      }
      sendSSEProgress(res, stageName, i + 1, stages.length)
    }
    if (res.writableEnded || res.destroyed) return
    sendSSEResult(res, accumulated)
  } catch (err) {
    console.error('[progressive] stage error:', err)
    if (!res.writableEnded && !res.destroyed) {
      sendSSEError(res, 'Could not load progressive response')
    }
  } finally {
    removeReqCloseListener(req, onClose)
    endSSE(res, keepalive)
  }
}