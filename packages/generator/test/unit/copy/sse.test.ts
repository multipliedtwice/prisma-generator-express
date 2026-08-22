import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  acceptsEventStream,
  emitTerminalSSEError,
  initSSE,
  removeReqCloseListener,
  runProgressiveEndpoint,
  sendSSE,
  setByPath,
  startSSEKeepalive,
  withSSE,
  type EventEmitterLike,
  type SseWritable,
} from '../../../src/copy/sse'

const createResponse = () => {
  const headers = new Map<string, string>()
  const chunks: string[] = []
  const response: SseWritable = {
    statusCode: 0,
    setHeader: vi.fn((name: string, value: string) => {
      headers.set(name, value)
    }),
    flushHeaders: vi.fn(),
    flush: vi.fn(),
    write: vi.fn((chunk: string) => {
      chunks.push(chunk)
      return true
    }),
    end: vi.fn(() => {
      response.writableEnded = true
    }),
    writableEnded: false,
    destroyed: false,
  }
  return { response, headers, chunks }
}

const readEvents = (chunks: string[]): unknown[] =>
  chunks
    .filter((chunk) => chunk.startsWith('data: '))
    .map((chunk) => JSON.parse(chunk.slice(6)))

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('acceptsEventStream', () => {
  it.each([
    'text/event-stream',
    'application/json, text/event-stream',
    'TEXT/EVENT-STREAM; charset=utf-8',
  ])('accepts %s', (value) => {
    expect(acceptsEventStream(value)).toBe(true)
  })

  it.each([undefined, '', 'application/json', 'text/plain'])(
    'rejects %s',
    (value) => {
      expect(acceptsEventStream(value)).toBe(false)
    },
  )
})

describe('setByPath', () => {
  it('sets a value through existing plain-object parents', () => {
    const target = { user: { profile: {} } }

    expect(setByPath(target, 'user.profile.name', 'A')).toBe(true)
    expect(target).toEqual({ user: { profile: { name: 'A' } } })
  })

  it.each([
    '',
    '.name',
    'user..name',
    '__proto__.polluted',
    'constructor.x',
    'prototype.x',
  ])('rejects unsafe path %s', (path) => {
    const target = {}

    expect(setByPath(target, path, true)).toBe(false)
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  })

  it('rejects traversal through non-plain values', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const target = { user: null }

    expect(setByPath(target, 'user.name', 'A')).toBe(false)
    expect(target).toEqual({ user: null })
  })
})

describe('SSE writers', () => {
  it('initializes required response headers', () => {
    const { response, headers } = createResponse()

    initSSE(response)

    expect(response.statusCode).toBe(200)
    expect(Object.fromEntries(headers)).toEqual({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      'X-Stream-Protocol-Version': '1',
    })
    expect(response.flushHeaders).toHaveBeenCalledOnce()
  })

  it('serializes transformed data and flushes it', () => {
    const { response, chunks } = createResponse()

    expect(
      sendSSE(response, {
        type: 'result',
        data: { id: 1n, bytes: Buffer.from('a') },
      }),
    ).toBe(true)

    expect(readEvents(chunks)).toEqual([
      { type: 'result', data: { id: '1', bytes: 'YQ==' } },
    ])
    expect(response.flush).toHaveBeenCalledOnce()
  })

  it('does not write after the response has ended', () => {
    const { response } = createResponse()
    response.writableEnded = true

    expect(sendSSE(response, { type: 'result' })).toBe(false)
    expect(response.write).not.toHaveBeenCalled()
  })

  it('returns false when writing throws', () => {
    const { response } = createResponse()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(response.write).mockImplementation(() => {
      throw new Error('closed')
    })

    expect(sendSSE(response, { type: 'result' })).toBe(false)
  })

  it('emits and closes a terminal error response', () => {
    const { response, chunks } = createResponse()

    emitTerminalSSEError(response, 'unsupported')

    expect(readEvents(chunks)).toEqual([
      { type: 'error', message: 'unsupported' },
    ])
    expect(response.end).toHaveBeenCalledOnce()
  })
})

describe('startSSEKeepalive', () => {
  it('writes keepalive comments until the response ends', () => {
    vi.useFakeTimers()
    const { response, chunks } = createResponse()
    const handle = startSSEKeepalive(response, 100)

    vi.advanceTimersByTime(250)
    response.writableEnded = true
    vi.advanceTimersByTime(100)
    clearInterval(handle)

    expect(chunks).toEqual([': keepalive\n\n', ': keepalive\n\n'])
  })
})

describe('withSSE', () => {
  it('initializes, runs, and closes the stream', async () => {
    const { response } = createResponse()
    const callback = vi.fn(async () => {})

    await withSSE({ res: response, label: 'test' }, callback)

    expect(callback).toHaveBeenCalledOnce()
    expect(response.end).toHaveBeenCalledOnce()
  })

  it('maps callback failures to an SSE error', async () => {
    const { response, chunks } = createResponse()
    vi.spyOn(console, 'error').mockImplementation(() => {})

    await withSSE({ res: response, label: 'test' }, async () => {
      throw new Error('failed')
    })

    expect(readEvents(chunks)).toEqual([{ type: 'error', message: 'failed' }])
    expect(response.end).toHaveBeenCalledOnce()
  })
})

describe('removeReqCloseListener', () => {
  it('prefers off and falls back to removeListener', () => {
    const listener = vi.fn()
    const off = vi.fn()
    const removeListener = vi.fn()

    removeReqCloseListener({ off, removeListener }, listener)
    expect(off).toHaveBeenCalledWith('close', listener)
    expect(removeListener).not.toHaveBeenCalled()

    removeReqCloseListener({ removeListener }, listener)
    expect(removeListener).toHaveBeenCalledWith('close', listener)
  })
})

describe('runProgressiveEndpoint', () => {
  it('applies stage patches, emits progress, and removes the close listener', async () => {
    const { response, chunks } = createResponse()
    const listeners = new Map<string, () => void>()
    const req: EventEmitterLike = {
      on: vi.fn((event, listener) => {
        listeners.set(event, listener)
      }),
      off: vi.fn((event, listener) => {
        if (listeners.get(event) === listener) listeners.delete(event)
      }),
      destroyed: false,
    }

    await runProgressiveEndpoint({
      req,
      res: response,
      ctx: { userId: 1 },
      prisma: {},
      variant: 'default',
      stages: ['root', 'profile'],
      stageRegistry: {
        root: async () => ({ key: 'user', value: {} }),
        profile: async () => ({ key: 'user.name', value: 'A' }),
      },
    })

    expect(readEvents(chunks)).toEqual([
      { type: 'progress', stage: 'start', completed: 0, total: 2 },
      { type: 'field', key: 'user', value: {} },
      { type: 'progress', stage: 'root', completed: 1, total: 2 },
      { type: 'field', key: 'user.name', value: 'A' },
      { type: 'progress', stage: 'profile', completed: 2, total: 2 },
      { type: 'result', data: { user: { name: 'A' } } },
    ])
    expect(req.off).toHaveBeenCalledOnce()
    expect(listeners.has('close')).toBe(false)
  })

  it('stops immediately when a stage returns a stop result', async () => {
    const { response, chunks } = createResponse()

    await runProgressiveEndpoint({
      req: {},
      res: response,
      ctx: {},
      prisma: {},
      variant: 'default',
      stages: ['first', 'second'],
      stageRegistry: {
        first: async () => ({ stop: true, data: { cached: true } }),
        second: async () => {
          throw new Error('must not run')
        },
      },
    })

    expect(readEvents(chunks)).toEqual([
      { type: 'progress', stage: 'start', completed: 0, total: 2 },
      { type: 'result', data: { cached: true } },
    ])
  })
})
