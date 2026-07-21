import { describe, expect, it } from 'vitest'
import { formatGuardVariantResolutionError } from '../../../src/copy/guardVariantError'
import { resolveGuardVariantKey } from '../../../src/copy/guardVariantRouting'

const reservedKeys = new Set(['where', 'select', 'include'])

describe('resolveGuardVariantKey', () => {
  it('resolves a single shape to _default', () => {
    expect(resolveGuardVariantKey({ kind: 'single' })).toEqual({
      ok: true,
      key: '_default',
    })
  })

  it('rejects reserved named keys before caller resolution', () => {
    const result = resolveGuardVariantKey({
      kind: 'named',
      keys: ['admin', 'where'],
      caller: 'admin',
      reservedKeys,
    })

    expect(result).toEqual({
      ok: false,
      code: 'reserved-key',
      key: 'where',
      keys: ['admin', 'where'],
    })
  })

  it('uses default when caller is missing or blank', () => {
    expect(
      resolveGuardVariantKey({
        kind: 'named',
        keys: ['default', 'admin'],
        reservedKeys,
      }),
    ).toEqual({ ok: true, key: 'default' })

    expect(
      resolveGuardVariantKey({
        kind: 'named',
        keys: ['default', 'admin'],
        caller: '   ',
        reservedKeys,
      }),
    ).toEqual({ ok: true, key: 'default' })
  })

  it('reports a missing caller when no default exists', () => {
    expect(
      resolveGuardVariantKey({
        kind: 'named',
        keys: ['admin'],
        reservedKeys,
      }),
    ).toEqual({
      ok: false,
      code: 'missing-caller',
      keys: ['admin'],
    })
  })

  it('prefers an exact caller over parameterized patterns', () => {
    expect(
      resolveGuardVariantKey({
        kind: 'named',
        keys: ['users/:id', 'users/me'],
        caller: 'users/me',
        reservedKeys,
      }),
    ).toEqual({ ok: true, key: 'users/me' })
  })

  it('resolves one parameterized pattern', () => {
    expect(
      resolveGuardVariantKey({
        kind: 'named',
        keys: ['users/:id', 'teams/:id'],
        caller: 'users/42',
        reservedKeys,
      }),
    ).toEqual({ ok: true, key: 'users/:id' })
  })

  it('reports all ambiguous parameterized matches', () => {
    expect(
      resolveGuardVariantKey({
        kind: 'named',
        keys: ['users/:id', ':resource/42'],
        caller: 'users/42',
        reservedKeys,
      }),
    ).toEqual({
      ok: false,
      code: 'ambiguous-caller',
      caller: 'users/42',
      keys: ['users/:id', ':resource/42'],
      matches: ['users/:id', ':resource/42'],
    })
  })

  it('falls back to default only after exact and pattern matching fail', () => {
    expect(
      resolveGuardVariantKey({
        kind: 'named',
        keys: ['default', 'users/:id'],
        caller: 'teams/42',
        reservedKeys,
      }),
    ).toEqual({ ok: true, key: 'default' })
  })

  it('reports unknown callers without a default', () => {
    expect(
      resolveGuardVariantKey({
        kind: 'named',
        keys: ['users/:id'],
        caller: 'teams/42',
        reservedKeys,
      }),
    ).toEqual({
      ok: false,
      code: 'unknown-caller',
      caller: 'teams/42',
      keys: ['users/:id'],
    })
  })
})

describe('formatGuardVariantResolutionError', () => {
  it('formats every resolution error', () => {
    expect(
      formatGuardVariantResolutionError({
        ok: false,
        code: 'reserved-key',
        key: 'where',
        keys: ['where'],
      }),
    ).toBe(
      'Caller key "where" collides with reserved guard shape key. Rename the caller path.',
    )

    expect(
      formatGuardVariantResolutionError({
        ok: false,
        code: 'missing-caller',
        keys: ['admin', 'user'],
      }),
    ).toBe(
      'Missing caller. This guard uses named shape routing with keys: "admin", "user". Provide caller via guard(input, caller).',
    )

    expect(
      formatGuardVariantResolutionError({
        ok: false,
        code: 'ambiguous-caller',
        caller: 'users/42',
        keys: ['users/:id', ':resource/42'],
        matches: ['users/:id', ':resource/42'],
      }),
    ).toBe(
      'Ambiguous caller "users/42" matches multiple patterns: "users/:id", ":resource/42"',
    )

    expect(
      formatGuardVariantResolutionError({
        ok: false,
        code: 'unknown-caller',
        caller: 'guest',
        keys: ['admin'],
      }),
    ).toBe('Unknown caller: "guest". Allowed: "admin"')
  })
})
