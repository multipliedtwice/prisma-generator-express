import { DMMF } from '@prisma/generator-helper'
import { ImportStyle } from '../utils/resolveImportStyle'
import { importExt } from '../utils/importExt'

export function generateOperationRuntime(importStyle: ImportStyle): string {
  const ext = importExt(importStyle)
  return `import { sanitizeKeys } from './misc${ext}'
import type {
  ProgressivePatch,
  ProgressiveStopResult,
  ProgressiveStageResult,
  ProgressiveStageContext,
  ProgressiveStage,
} from './routeConfig${ext}'

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
  if (error && typeof error === 'object' && 'name' in error && (error as any).name === 'ShapeError') {
    return new HttpError(400, (error as any).message)
  }
  if (error && typeof error === 'object' && 'name' in error && (error as any).name === 'CallerError') {
    return new HttpError(400, (error as any).message)
  }
  if (error && typeof error === 'object' && 'name' in error && (error as any).name === 'PolicyError') {
    return new HttpError(403, (error as any).message)
  }
  if (error && typeof error === 'object' && 'issues' in error && 'name' in error && (error as any).name === 'ZodError') {
    const issues = (error as any).issues
    const message = Array.isArray(issues) ? issues.map((i: any) => i.message).join('; ') : (error as any).message
    return new HttpError(400, message)
  }
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as any).code as string
    const mapped = PRISMA_ERROR_MAP[code]
    if (mapped) {
      const detail = (error as any).message
      return new HttpError(mapped.status, detail ? mapped.message + ': ' + detail : mapped.message)
    }
    if (typeof code === 'string' && code.startsWith('P')) {
      const msg = (error as any).message || 'Database operation failed'
      console.warn('[prisma-generator-express] Unmapped Prisma error code:', code, msg)
      return new HttpError(500, msg)
    }
  }
  if (error && typeof error === 'object' && 'name' in error) {
    const name = (error as any).name
    if (name === 'PrismaClientValidationError') return new HttpError(400, (error as any).message || 'Invalid query parameters')
    if (name === 'PrismaClientKnownRequestError') return new HttpError(400, (error as any).message || 'Database request error')
    if (name === 'PrismaClientInitializationError') return new HttpError(503, (error as any).message || 'Database connection failed')
    if (name === 'PrismaClientRustPanicError') return new HttpError(500, (error as any).message || 'Internal database engine error')
    if (name === 'PrismaClientUnknownRequestError') return new HttpError(500, (error as any).message || 'Unknown database error')
  }
  const msg = error instanceof Error ? error.message : String(error)
  console.error('[prisma-generator-express] Unhandled error:', error)
  return new HttpError(500, msg || 'Internal server error')
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

export function applyPaginationLimits(query: Record<string, any>, config?: PaginationConfig): Record<string, any> {
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
    throw new HttpError(500, 'Guard shapes require prisma-guard extension on PrismaClient.')
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
  if (isSingleShape) return keepWhereOnly(shape)
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
      console.warn('[prisma-generator-express] Distinct count exceeds ' + effectiveLimit + ', falling back to approximate total')
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

function removeReqCloseListener(req: any, listener: () => void): void {
  if (typeof req.off === 'function') {
    req.off('close', listener)
  } else if (typeof req.removeListener === 'function') {
    req.removeListener('close', listener)
  }
}

export function initSSE(res: any): void {
  res.statusCode = 200
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  if (typeof res.flushHeaders === 'function') res.flushHeaders()
}

export function flushSSE(res: any): void {
  if (typeof res.flush === 'function') {
    try { res.flush() } catch {}
  }
}

export function sendSSE(res: any, payload: unknown): boolean {
  if (res.writableEnded || res.destroyed) return false
  try {
    res.write('data: ' + JSON.stringify(transformResult(payload)) + '\\n\\n')
    flushSSE(res)
    return true
  } catch (err) {
    console.error('[progressive] failed to send SSE event:', err)
    return false
  }
}

export function sendSSEProgress(res: any, stage: string, completed: number, total: number): boolean {
  return sendSSE(res, { type: 'progress', stage, completed, total })
}

export function sendSSEField(res: any, key: string, value: unknown): boolean {
  return sendSSE(res, { type: 'field', key, value })
}

export function sendSSEResult(res: any, data: unknown): boolean {
  return sendSSE(res, { type: 'result', data })
}

export function sendSSEError(res: any, message: string): boolean {
  if (res.writableEnded || res.destroyed) return false
  try {
    res.write('data: ' + JSON.stringify({ type: 'error', message }) + '\\n\\n')
    flushSSE(res)
    return true
  } catch (err) {
    console.error('[progressive] failed to send SSE error event:', err)
    return false
  }
}

export function startSSEKeepalive(res: any, intervalMs: number = 15000): any {
  const handle = setInterval(() => {
    if (res.writableEnded || res.destroyed) return
    try {
      res.write(': keepalive\\n\\n')
      flushSSE(res)
    } catch {}
  }, intervalMs)
  if (typeof (handle as any).unref === 'function') (handle as any).unref()
  return handle
}

export function endSSE(res: any, keepaliveHandle: any): void {
  if (keepaliveHandle) {
    try { clearInterval(keepaliveHandle) } catch {}
  }
  if (!res.writableEnded && !res.destroyed) {
    try { res.end() } catch {}
  }
}

export interface RunSingleResultSSEOptions {
  req: any
  res: any
  coreQueryFn: () => Promise<unknown>
}

export async function runSingleResultSSE(options: RunSingleResultSSEOptions): Promise<void> {
  const { req, res, coreQueryFn } = options
  let keepalive: any = null
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
  return typeof value === 'object' && value !== null && (value as any).stop === true
}

export interface RunProgressiveOptions {
  req: any
  res: any
  ctx: unknown
  prisma: any
  variant: string
  stages: string[]
  stageRegistry: Record<string, ProgressiveStage<any, any>>
}

export async function runProgressiveEndpoint(options: RunProgressiveOptions): Promise<void> {
  const { req, res, ctx, prisma, variant, stages, stageRegistry } = options
  let keepalive: any = null
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
        if (typeof (patch as any).key !== 'string') continue
        if (!('value' in patch)) continue
        const p = patch as ProgressivePatch
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
`
}

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
  if (ctx.guardShape) {
    assertGuard((extended as any).${modelNameLower})
    return (extended as any).${modelNameLower}.guard(ctx.guardShape, ctx.guardCaller).${op}(query)
  }
  return (extended as any).${modelNameLower}.${op}(query)
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
  if (ctx.guardShape) {
    assertGuard((extended as any).${modelNameLower})
    return (extended as any).${modelNameLower}.guard(ctx.guardShape, ctx.guardCaller).${op.method}(body)
  }
  return (extended as any).${modelNameLower}.${op.method}(body)
}`
  }).join('\n')

  return `import {
  OperationContext,
  getExtendedClient,
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
  const delegate = (extended as any).${modelNameLower}

  if (shape) assertGuard(delegate)

  let items: any[]
  let total: number

  if (shape || typeof extended.$transaction !== 'function') {
    const [data, count] = await Promise.all([
      shape ? delegate.guard(shape, caller).findMany(query) : delegate.findMany(query),
      countForPagination(delegate, query, shape, caller, distinctCountLimit),
    ])
    items = data
    total = count
  } else {
    try {
      const txResult = await extended.$transaction(async (tx: any) => {
        const d = await tx.${modelNameLower}.findMany(query)
        const t = await countForPagination(tx.${modelNameLower}, query, undefined, undefined, distinctCountLimit)
        return { d, t }
      })
      items = txResult.d
      total = txResult.t
    } catch (txError: any) {
      if (txError?.message?.includes?.('interactive transactions') || txError?.code === 'P2028') {
        console.warn('[prisma-generator-express] Interactive transactions not available, pagination queries are non-atomic')
        items = await delegate.findMany(query)
        total = await countForPagination(delegate, query, undefined, undefined, distinctCountLimit)
      } else {
        throw txError
      }
    }
  }

  const skip = (query.skip as number) ?? 0
  const absTake = Math.abs((query.take as number) ?? items.length)
  const hasMore = items.length >= absTake && skip + items.length < total

  return { data: items, total, hasMore }
}
`
}