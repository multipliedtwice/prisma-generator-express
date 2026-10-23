import { describe, it, expect } from 'vitest'
import { ownedPostgresUrl } from './ownedPostgresUrl'

describe('ownedPostgresUrl', () => {
  it('refuses a missing or blank URL instead of choosing a database', () => {
    expect(() => ownedPostgresUrl(undefined)).toThrow(
      /PARITY_DATABASE_URL is required/,
    )
    expect(() => ownedPostgresUrl('  ')).toThrow(
      /PARITY_DATABASE_URL is required/,
    )
  })

  it('refuses the shared pool port 55433', () => {
    expect(() =>
      ownedPostgresUrl('postgresql://postgres:parity@127.0.0.1:55433/parity'),
    ).toThrow(/shared pool port/)
  })

  it('refuses a remote host', () => {
    expect(() =>
      ownedPostgresUrl(
        'postgresql://postgres:parity@db.example.com:55439/parity',
      ),
    ).toThrow(/loopback host/)
  })

  it('refuses the default port whether explicit or implicit', () => {
    expect(() =>
      ownedPostgresUrl('postgresql://postgres:parity@127.0.0.1:5432/parity'),
    ).toThrow(/explicit test-owned port/)
    expect(() =>
      ownedPostgresUrl('postgresql://postgres:parity@127.0.0.1/parity'),
    ).toThrow(/explicit test-owned port/)
  })

  it('refuses malformed and non-Postgres URLs', () => {
    expect(() => ownedPostgresUrl('not a url')).toThrow(/not a valid URL/)
    expect(() => ownedPostgresUrl('mysql://root@127.0.0.1:3306/db')).toThrow(
      /postgresql:\/\//,
    )
  })

  it('accepts an explicit Postgres URL on another port, unchanged', () => {
    const url = 'postgresql://postgres:parity@127.0.0.1:55439/parity'
    expect(ownedPostgresUrl(url)).toBe(url)
    expect(ownedPostgresUrl('postgres://u@localhost:55440/db')).toBe(
      'postgres://u@localhost:55440/db',
    )
    expect(ownedPostgresUrl('postgres://u@[::1]:55441/db')).toBe(
      'postgres://u@[::1]:55441/db',
    )
  })
})
