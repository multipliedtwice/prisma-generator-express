import { describe, expect, it } from 'vitest'
import { HttpError } from '../../../src/copy/errorMapper'
import {
  getDelegate,
  requireBodyField,
  transformResult,
  validateBody,
} from '../../../src/copy/operationRuntime'

describe('getDelegate', () => {
  it('returns an existing delegate', () => {
    const user = { findMany: async () => [] }

    expect(getDelegate({ user }, 'user')).toBe(user)
  })

  it.each([
    [null, 'PrismaClient is not a valid object'],
    [{}, 'Prisma delegate not found: user'],
    [{ user: null }, 'Prisma delegate not found: user'],
  ])('rejects invalid client or delegate %#', (client, message) => {
    expect(() => getDelegate(client, 'user')).toThrowError(HttpError)
    expect(() => getDelegate(client, 'user')).toThrow(message)
  })
})

describe('validateBody', () => {
  it('returns a sanitized object body', () => {
    const input = JSON.parse(
      '{"name":"A","nested":{"constructor":1,"value":2}}',
    )

    expect(validateBody(input)).toEqual({
      name: 'A',
      nested: { value: 2 },
    })
  })

  it.each([undefined, null, false, 'body', [], 1])(
    'rejects non-object body %s',
    (body) => {
      expect(() => validateBody(body)).toThrow(
        'Request body must be a JSON object',
      )
    },
  )
})

describe('requireBodyField', () => {
  it('accepts present values including null', () => {
    expect(() => requireBodyField({ data: null }, 'data')).not.toThrow()
  })

  it.each([{}, { data: undefined }])('rejects missing data %#', (body) => {
    expect(() => requireBodyField(body, 'data')).toThrow(
      'Missing required field: data',
    )
  })
})

describe('transformResult', () => {
  it('converts bigint and byte values recursively', () => {
    const date = new Date('2026-01-02T03:04:05.000Z')
    const result = transformResult({
      id: 9007199254740993n,
      data: Buffer.from('hello'),
      bytes: new Uint8Array([1, 2, 3]),
      date,
      nested: [1n, { value: 2n }],
    })

    expect(result).toEqual({
      id: '9007199254740993',
      data: 'aGVsbG8=',
      bytes: 'AQID',
      date,
      nested: ['1', { value: '2' }],
    })
  })

  it('preserves references when no transformation is needed', () => {
    const input = { nested: { value: 1 }, items: ['a', true] }

    expect(transformResult(input)).toBe(input)
  })
})
