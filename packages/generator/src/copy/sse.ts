import { HttpError, LOG_PREFIX, mapError } from './errorMapper'
import { isPlainObject } from './misc'
import { transformResult } from './operationRuntime'
import type {
  ProgressiveStage,
  ProgressiveStopResult,
  ProgressivePatch,
  PrismaClientLike,
} from './routeConfig'

export function acceptsEventStream(accept: string | undefined): boolean {
  if (!accept) return false
  return accept
    .toLowerCase()
    .split(',')
    .some((entry) => entry.split(';')[0].trim() === 'text/event-stream')
}

const UNSAFE_PATH_SEGMENTS = new Set(['__proto__', 'constructor', 'prototype'])

export function setByPath(
  target: Record<string, unknown>,
  path: string,
  value: unknown,
): boolean {
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
          LOG_PREFIX,
          'Dropping patch for "' +
            path +
            '": cannot traverse non-plain-object at segment "' +
            part +
            '"',
        )
      }
      return false
    }
    cursor = next
  }
  cursor[parts[parts.length - 1]] = value
  return true
}

export type EventEmitterLike = {
  on?: (event: string, listener: () => void) => unknown
  off?: (event: string, listener: () => void) => unknown
  removeListener?: (event: string, listener: () => void) => unknown
  destroyed?: boolean
}

export type SseWritable = {
  statusCode: number
  setHeader: (name: string, value: string) => unknown
  flushHeaders?: () => unknown
  flush?: () => unknown
  write: (chunk: string) => unknown
  end: () => unknown
  writableEnded: boolean
  destroyed: boolean
}

export function removeReqCloseListener(
  req: EventEmitterLike,
  listener: () => void,
): void {
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
  res.setHeader('X-Stream-Protocol-Version', '1')
  if (typeof res.flushHeaders === 'function') res.flushHeaders()
}

export function flushSSE(res: SseWritable): void {
  if (typeof res.flush === 'function') {
    try {
      res.flush()
    } catch {}
  }
}

export function sendSSE(res: SseWritable, payload: unknown): boolean {
  if (res.writableEnded || res.destroyed) return false
  try {
    res.write('data: ' + JSON.stringify(transformResult(payload)) + '\n\n')
    flushSSE(res)
    return true
  } catch (err) {
    console.error(LOG_PREFIX, 'failed to send SSE event:', err)
    return false
  }
}

export function sendSSEProgress(
  res: SseWritable,
  stage: string,
  completed: number,
  total: number,
): boolean {
  return sendSSE(res, { type: 'progress', stage, completed, total })
}

export function sendSSEField(
  res: SseWritable,
  key: string,
  value: unknown,
): boolean {
  return sendSSE(res, { type: 'field', key, value })
}

export function sendSSEResult(res: SseWritable, data: unknown): boolean {
  return sendSSE(res, { type: 'result', data })
}

export function sendSSERootArray(res: SseWritable, rows: unknown[]): boolean {
  return sendSSE(res, { type: 'rootArray', data: rows })
}

export function sendSSERelationBatch(
  res: SseWritable,
  relationPath: string,
  values: unknown[],
): boolean {
  return sendSSE(res, { type: 'relationBatch', relationPath, values })
}

export function sendSSENestedRelationBatch(
  res: SseWritable,
  relationPath: string,
  depth: number,
  attachments: Array<{ locator: Array<number | string>; value: unknown }>,
): boolean {
  return sendSSE(res, {
    type: 'nestedRelationBatch',
    relationPath,
    depth,
    attachments,
  })
}

export function sendSSEPageMeta(
  res: SseWritable,
  total: number,
  hasMore: boolean,
): boolean {
  return sendSSE(res, { type: 'pageMeta', total, hasMore })
}

export function sendSSEError(res: SseWritable, message: string): boolean {
  if (res.writableEnded || res.destroyed) return false
  try {
    res.write('data: ' + JSON.stringify({ type: 'error', message }) + '\n\n')
    flushSSE(res)
    return true
  } catch (err) {
    console.error(LOG_PREFIX, 'failed to send SSE error event:', err)
    return false
  }
}

export function safeSendError(res: SseWritable, message: string): void {
  if (!res.writableEnded && !res.destroyed) {
    sendSSEError(res, message)
  }
}

type IntervalHandle = ReturnType<typeof setInterval>

export function startSSEKeepalive(
  res: SseWritable,
  intervalMs: number = 15000,
): IntervalHandle {
  const handle = setInterval(() => {
    if (res.writableEnded || res.destroyed) return
    try {
      res.write(': keepalive\n\n')
      flushSSE(res)
    } catch {}
  }, intervalMs)
  const maybeUnref = (handle as unknown as { unref?: () => void }).unref
  if (typeof maybeUnref === 'function') maybeUnref.call(handle)
  return handle
}

export function endSSE(
  res: SseWritable,
  keepaliveHandle: IntervalHandle | null,
): void {
  if (keepaliveHandle) {
    clearInterval(keepaliveHandle)
  }
  if (!res.writableEnded && !res.destroyed) {
    try {
      res.end()
    } catch {}
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

export interface WithSSEOptions {
  res: SseWritable
  signal?: AbortSignal
  label: string
}

export async function withSSE(
  options: WithSSEOptions,
  fn: () => Promise<void>,
): Promise<void> {
  const { res, signal, label } = options
  let keepalive: IntervalHandle | null = null
  const isClientGone = () =>
    signal?.aborted === true || res.writableEnded || res.destroyed

  try {
    initSSE(res)
    keepalive = startSSEKeepalive(res)
    if (isClientGone()) return
    await fn()
  } catch (err) {
    if (isClientGone()) return
    console.error(LOG_PREFIX, label + ' dispatch error:', err)
    safeSendError(res, mapError(err).message)
  } finally {
    endSSE(res, keepalive)
  }
}

export interface RunSingleResultSSEOptions {
  req: EventEmitterLike
  res: SseWritable
  coreQueryFn: () => Promise<unknown>
}

export async function runSingleResultSSE(
  options: RunSingleResultSSEOptions,
): Promise<void> {
  const { req, res, coreQueryFn } = options
  await withSSE({ res, label: 'single-result' }, async () => {
    if (req.destroyed) return
    const data = await coreQueryFn()
    if (res.writableEnded || res.destroyed) return
    sendSSEResult(res, data)
  })
}

function isStopResult(value: unknown): value is ProgressiveStopResult<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { stop?: unknown }).stop === true
  )
}

export interface RunProgressiveOptions {
  req: EventEmitterLike
  res: SseWritable
  ctx: unknown
  prisma: PrismaClientLike
  variant: string
  stages: string[]
  stageRegistry: Record<string, ProgressiveStage>
}

export async function runProgressiveEndpoint(
  options: RunProgressiveOptions,
): Promise<void> {
  const { req, res, ctx, prisma, variant, stages, stageRegistry } = options
  const controller = new AbortController()
  const onClose = () => controller.abort()
  if (typeof req.on === 'function') req.on('close', onClose)

  const accumulated: Record<string, unknown> = {}
  const signal = controller.signal

  try {
    await withSSE({ res, signal, label: 'stage' }, async () => {
      sendSSEProgress(res, 'start', 0, stages.length)

      for (let i = 0; i < stages.length; i++) {
        if (res.writableEnded || res.destroyed || signal.aborted) return
        const stageName = stages[i]
        const stage = stageRegistry[stageName]
        if (!stage)
          throw new HttpError(500, 'Missing progressive stage: ' + stageName)

        const result = await stage({
          ctx,
          req,
          res,
          prisma,
          variant,
          accumulated,
          signal,
        })
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
    })
  } finally {
    removeReqCloseListener(req, onClose)
  }
}
