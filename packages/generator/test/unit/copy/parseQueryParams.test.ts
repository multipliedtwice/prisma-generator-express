import { describe, expect, it } from 'vitest'
import { encodeQueryParams } from '../../../src/client/encodeQueryParams'
import { parseQueryParams } from '../../../src/copy/parseQueryParams'

describe('parseQueryParams', () => {
  it('parses JSON, booleans, null, and numeric pagination values', () => {
    expect(
      parseQueryParams({
        where: '{"active":true}',
        enabled: 'false',
        nullable: 'null',
        take: '-25',
        skip: '10',
        id: '10',
      }),
    ).toEqual({
      where: { active: true },
      enabled: false,
      nullable: null,
      take: -25,
      skip: 10,
      id: '10',
    })
  })

  it('preserves JSON-encoded strings as strings', () => {
    expect(parseQueryParams({ value: '"true"', number: '"12"' })).toEqual({
      value: 'true',
      number: '12',
    })
  })

  it('falls back to the original string for invalid JSON', () => {
    expect(parseQueryParams('{invalid')).toBe('{invalid')
  })

  it('parses string arrays', () => {
    expect(parseQueryParams(['true', '3', 'null'])).toEqual([true, '3', null])
  })

  it('sanitizes object arrays', () => {
    const unsafe = JSON.parse('{"ok":1,"prototype":2}') as Record<
      string,
      unknown
    >

    expect(parseQueryParams([unsafe])).toEqual([{ ok: 1 }])
  })

  it('drops unsafe top-level and nested keys', () => {
    const params = JSON.parse(
      '{"safe":"{\\"constructor\\":1,\\"value\\":2}","__proto__":"polluted"}',
    ) as Record<string, unknown>

    expect(parseQueryParams(params)).toEqual({ safe: { value: 2 } })
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  })

  it('round-trips supported encoded query values', () => {
    const encoded = encodeQueryParams({
      where: { active: true, score: { gte: 5 } },
      select: { id: true, name: true },
      take: 20,
      skip: 0,
      label: 'true',
      nullable: null,
    })
    const params = Object.fromEntries(new URLSearchParams(encoded))

    expect(parseQueryParams(params)).toEqual({
      where: { active: true, score: { gte: 5 } },
      select: { id: true, name: true },
      take: 20,
      skip: 0,
      label: 'true',
      nullable: null,
    })
  })
})
