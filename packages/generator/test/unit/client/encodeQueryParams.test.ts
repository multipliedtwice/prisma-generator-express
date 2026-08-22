import { describe, expect, it } from 'vitest'
import { encodeQueryParams } from '../../../src/client/encodeQueryParams'

describe('encodeQueryParams', () => {
  it('encodes primitive values and omits undefined values', () => {
    expect(
      encodeQueryParams({
        take: 10,
        active: true,
        missing: undefined,
        nullable: null,
      }),
    ).toBe('take=10&active=true&nullable=null')
  })

  it('JSON-encodes strings so their type survives parsing', () => {
    expect(encodeQueryParams({ value: 'true', text: 'a b&c' })).toBe(
      'value=%22true%22&text=%22a%20b%26c%22',
    )
  })

  it('encodes bigint values without losing precision', () => {
    expect(encodeQueryParams({ id: 9007199254740993n })).toBe(
      'id=9007199254740993',
    )
  })

  it('converts nested bigint values inside arrays and objects', () => {
    const encoded = encodeQueryParams({
      where: {
        id: 9007199254740993n,
        values: [1n, 2n],
      },
    })
    const value = new URLSearchParams(encoded).get('where')

    expect(value).toBe('{"id":"9007199254740993","values":["1","2"]}')
  })

  it('preserves object entry order', () => {
    expect(encodeQueryParams({ z: 1, a: 2, m: 3 })).toBe('z=1&a=2&m=3')
  })
})
