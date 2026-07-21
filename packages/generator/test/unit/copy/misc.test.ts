import { describe, expect, it } from 'vitest'
import {
  isObject,
  isPlainObject,
  isSafeKey,
  normalizePrefix,
  removeTrailingSlash,
  sanitizeKeys,
} from '../../../src/copy/misc'

describe('misc', () => {
  it('distinguishes objects from arrays and null', () => {
    expect(isObject({})).toBe(true)
    expect(isObject(new Date())).toBe(true)
    expect(isObject([])).toBe(false)
    expect(isObject(null)).toBe(false)
  })

  it('accepts only plain objects', () => {
    expect(isPlainObject({})).toBe(true)
    expect(isPlainObject(Object.create(null))).toBe(true)
    expect(isPlainObject([])).toBe(false)
    expect(isPlainObject(new Date())).toBe(false)
    expect(isPlainObject(null)).toBe(false)
  })

  it('rejects prototype-pollution keys', () => {
    expect(isSafeKey('field')).toBe(true)
    expect(isSafeKey('__proto__')).toBe(false)
    expect(isSafeKey('constructor')).toBe(false)
    expect(isSafeKey('prototype')).toBe(false)
  })

  it('removes unsafe keys recursively without mutating the input', () => {
    const input = JSON.parse(
      '{"safe":{"value":1,"__proto__":{"polluted":true}},"items":[{"constructor":1,"ok":2}]}',
    ) as Record<string, unknown>

    const result = sanitizeKeys(input)

    expect(result).toEqual({ safe: { value: 1 }, items: [{ ok: 2 }] })
    expect(result).not.toBe(input)
    expect((input.safe as Record<string, unknown>).__proto__).toEqual({
      polluted: true,
    })
  })

  it('preserves references when no sanitization is needed', () => {
    const input = { nested: { value: 1 }, items: [{ value: 2 }] }

    expect(sanitizeKeys(input)).toBe(input)
  })

  it('normalizes route prefixes', () => {
    expect(normalizePrefix('')).toBe('')
    expect(normalizePrefix('/')).toBe('')
    expect(normalizePrefix('api/v1/')).toBe('/api/v1')
    expect(normalizePrefix('/api/v1///')).toBe('/api/v1')
  })

  it('removes one trailing slash while preserving other paths', () => {
    expect(removeTrailingSlash('/')).toBe('')
    expect(removeTrailingSlash('/api/')).toBe('/api')
    expect(removeTrailingSlash('/api')).toBe('/api')
  })
})
