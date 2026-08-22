import { describe, it, expect } from 'vitest'
import type { DMMF } from '@prisma/generator-helper'
import { acceptsNdjson, runNdjsonFindMany } from '../../src/copy/ndjson'
import { generateRouterFunction } from '../../src/generators/generateRouter'

const model = {
  name: 'User',
  dbName: null,
  schema: null,
  fields: [],
  primaryKey: null,
  uniqueFields: [],
  uniqueIndexes: [],
  isGenerated: false,
} as unknown as DMMF.Model

const fakeRes = () => {
  const headers: Record<string, string> = {}
  const chunks: string[] = []
  return {
    headers,
    chunks,
    statusCode: 0,
    writableEnded: false,
    destroyed: false,
    setHeader: (n: string, v: string) => {
      headers[n] = v
    },
    write: (c: string) => {
      chunks.push(c)
    },
    end: () => {
      ;(fakeRes as unknown).valueOf // noop reference guard
    },
  }
}

describe('acceptsNdjson', () => {
  it('matches the exact media type with optional parameters', () => {
    expect(acceptsNdjson('application/x-ndjson')).toBe(true)
    expect(acceptsNdjson('text/html,application/x-ndjson;q=0.9')).toBe(true)
    expect(acceptsNdjson('application/json')).toBe(false)
    expect(acceptsNdjson(undefined)).toBe(false)
  })
})

describe('runNdjsonFindMany', () => {
  const run = async (
    pages: unknown[][],
    requestedTake?: number,
    maxLimit = 1000,
    initialSkip = 0,
  ) => {
    let call = 0
    const calls: Array<[number, number]> = []
    const res = fakeRes() as never as Parameters<
      typeof runNdjsonFindMany
    >[0]['res']
    await runNdjsonFindMany({
      res,
      isClosed: () => false,
      fetchPage: async (skip, take) => {
        calls.push([skip, take])
        return pages[call++] ?? []
      },
      initialSkip,
      requestedTake,
      maxLimit,
    })
    return { res, calls }
  }

  it('streams one JSON document per row and a terminal done line', async () => {
    const { res } = await run([[{ id: 1 }, { id: 2 }], [{ id: 3 }]], 2)
    expect(res.chunks).toEqual([
      '{"id":1}\n',
      '{"id":2}\n',
      '{"id":3}\n',
      '{"done":true,"rows":3}\n',
    ])
    expect(res.headers['Content-Type']).toBe('application/x-ndjson')
    expect(res.headers['X-Stream-Protocol-Version']).toBe('1')
  })

  it('stops after a short page and paginates by skip/take', async () => {
    const { calls } = await run([[new Array(10).fill({})]], 10)
    expect(calls).toEqual([[0, 10]])
  })

  it('caps total rows at maxLimit even when pages keep coming', async () => {
    const page = new Array(50).fill(null)
    const { res } = await run([page, page, page, page], 50, 120)
    expect(res.chunks.filter((c) => c !== null)).toHaveLength(121)
  })

  it('rejects non-array core results loudly', async () => {
    const res = fakeRes() as never as Parameters<
      typeof runNdjsonFindMany
    >[0]['res']
    await expect(
      runNdjsonFindMany({
        res,
        isClosed: () => false,
        fetchPage: async () => ({ data: [] }),
        initialSkip: 0,
        maxLimit: 10,
      }),
    ).rejects.toThrow(/array result/)
  })

  it('respects an initial client-provided skip', async () => {
    const { calls } = await run([[], [], []], 5, 1000, 15)
    expect(calls[0]).toEqual([15, 5])
  })
})

describe('emitted express router NDJSON + experimental gate', () => {
  const emit = () =>
    generateRouterFunction({
      model,
      enums: [],
      guardShapesImport: null,
      importStyle: 'esm' as never,
      writeStrategy: 'regular' as never,
      findManyPaginatedMode: 'promiseAll' as never,
      dropGuard: false,
      pathCase: 'lower',
    })

  it('attaches the NDJSON middleware to findMany only', () => {
    const out = emit()
    expect(out.match(/maybeNdjsonFindMany\(core\.findMany\)/g)).toHaveLength(1)
  })

  it('refuses auto-include unless it is explicitly experimental', () => {
    const out = emit()
    expect(out).toContain('progressiveConfig.experimental !== true')
    expect(out).toContain('auto-include requires experimental: true')
  })
})
