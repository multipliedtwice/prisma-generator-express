import { describe, expect, it, vi, afterEach } from 'vitest'
import {
  isObject,
  isPlainObject,
  isSafeKey,
  normalizePrefix,
  removeTrailingSlash,
  resolveDropGuardEnv,
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

describe('resolveDropGuardEnv', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('honours PGE_DROP_GUARD=true', () => {
    expect(resolveDropGuardEnv({ PGE_DROP_GUARD: 'true' })).toBe(true)
    expect(resolveDropGuardEnv({ PGE_DROP_GUARD: 'false' })).toBe(false)
    expect(resolveDropGuardEnv({})).toBe(false)
  })

  it('keeps E2E=true working as a deprecated alias with a warning', async () => {
    vi.resetModules()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const fresh = await import('../../../src/copy/misc')
    expect(fresh.resolveDropGuardEnv({ E2E: 'true' })).toBe(true)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0]?.[0])).toContain('PGE_DROP_GUARD')
    expect(fresh.resolveDropGuardEnv({ E2E: 'false' })).toBe(false)
  })

  it('prefers the new variable and warns at most once per process', async () => {
    vi.resetModules()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const fresh = await import('../../../src/copy/misc')
    expect(
      fresh.resolveDropGuardEnv({ PGE_DROP_GUARD: 'true', E2E: 'true' }),
    ).toBe(true)
    expect(warn).not.toHaveBeenCalled()
    expect(fresh.resolveDropGuardEnv({ E2E: 'true' })).toBe(true)
    expect(fresh.resolveDropGuardEnv({ E2E: 'true' })).toBe(true)
    expect(warn).toHaveBeenCalledTimes(1)
  })
})
