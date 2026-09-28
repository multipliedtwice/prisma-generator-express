import { describe, it, expect, afterAll } from 'vitest'
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import {
  assertMcpGuardVersion,
  compareSemver,
  parseSemver,
  resolveInstalledGuardVersion,
} from '../../src/utils/mcpGate'

const GEN =
  basename(process.cwd()) === 'generator'
    ? process.cwd()
    : resolve('packages/generator')
function basename(p: string): string {
  return p.split('/').pop() ?? p
}

describe('mcp=true prisma-guard version gate', () => {
  it('compareSemver orders plain versions', () => {
    expect(compareSemver('1.32.9', '1.33.0')).toBeLessThan(0)
    expect(compareSemver('1.33.0', '1.33.0')).toBe(0)
    expect(compareSemver('2.0.0', '1.33.0')).toBeGreaterThan(0)
  })

  it('parseSemver rejects invalid semver', () => {
    for (const bad of [
      '01.33.0',
      '1.033.0',
      '1.33.0-alpha..1',
      '1.33.0-',
      '1.33.0+',
      '1.33.0-a..b',
      '1.33',
      'v1.33.0',
      '1.33.0-alpha_1',
      '1.33.0-01',
      '1.33.0-rc.007',
    ]) {
      expect(parseSemver(bad), bad).toBeNull()
    }
    for (const good of [
      '0.0.0',
      '1.33.0',
      '1.33.0-alpha',
      '1.33.0-alpha.1',
      '1.33.0-0',
      '1.33.0+build.1',
      '1.33.0+01',
      '1.33.0-alpha.1+b.2',
    ]) {
      expect(parseSemver(good), good).not.toBeNull()
    }
  })

  it('compareSemver accepts build metadata, ignored per semver 2.0.0', () => {
    expect(parseSemver('1.33.0+build.1')).not.toBeNull()
    expect(compareSemver('1.33.0+build.1', '1.33.0')).toBe(0)
    expect(compareSemver('1.33.0+build.1', '1.32.9')).toBeGreaterThan(0)
    expect(parseSemver('1.33.0-beta.1+b.2')).not.toBeNull()
    expect(compareSemver('1.33.0-beta.1+b.2', '1.33.0')).toBeLessThan(0)
  })

  it('compareSemver follows semver 2.0.0 prerelease precedence', () => {
    // a prerelease of the target version does NOT satisfy the minimum
    expect(compareSemver('1.33.0-beta', '1.33.0')).toBeLessThan(0)
    expect(compareSemver('1.33.0-beta.1', '1.33.0')).toBeLessThan(0)
    expect(compareSemver('1.33.0-rc.1', '1.33.0')).toBeLessThan(0)
    // higher core with prerelease still satisfies 1.33.0
    expect(compareSemver('1.34.0-beta', '1.33.0')).toBeGreaterThan(0)
    // both prereleases: numeric identifiers are lower than alphanumeric
    expect(compareSemver('1.33.0-alpha.1', '1.33.0-alpha.beta')).toBeLessThan(0)
    expect(compareSemver('1.33.0-alpha.1', '1.33.0-alpha.2')).toBeLessThan(0)
    expect(compareSemver('1.33.0-alpha', '1.33.0-alpha.1')).toBeLessThan(0)
  })

  it('mcp=true refuses a prerelease below the minimum', () => {
    const dir = mkdtempSync(join(GEN, '.guard-gate-'))
    try {
      mkdirSync(join(dir, 'node_modules', 'prisma-guard'), { recursive: true })
      writeFileSync(
        join(dir, 'node_modules', 'prisma-guard', 'package.json'),
        JSON.stringify({ name: 'prisma-guard', version: '1.33.0-beta.2' }),
      )
      writeFileSync(
        join(dir, 'schema.prisma'),
        'datasource db { provider = "sqlite" }',
      )
      expect(() =>
        assertMcpGuardVersion(true, join(dir, 'schema.prisma')),
      ).toThrow(/requires prisma-guard >= 1\.33\.0/)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('resolves the installed prisma-guard from the repo', () => {
    const version = resolveInstalledGuardVersion(
      join(GEN, 'matrix/schema.prisma'),
    )
    expect(version).toMatch(/^\d+\.\d+\.\d+/)
  })

  it('mcp=true refuses generation when the schema project pins an older guard', () => {
    const dir = mkdtempSync(join(GEN, '.guard-gate-'))
    try {
      mkdirSync(join(dir, 'node_modules', 'prisma-guard'), { recursive: true })
      writeFileSync(
        join(dir, 'node_modules', 'prisma-guard', 'package.json'),
        JSON.stringify({ name: 'prisma-guard', version: '1.28.0' }),
      )
      writeFileSync(
        join(dir, 'schema.prisma'),
        'datasource db { provider = "sqlite" }',
      )
      expect(() =>
        assertMcpGuardVersion(true, join(dir, 'schema.prisma')),
      ).toThrow(/requires prisma-guard >= 1\.33\.0/)
      // mcp=false never gates
      expect(() =>
        assertMcpGuardVersion(false, join(dir, 'schema.prisma')),
      ).not.toThrow()
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('mcp=true accepts a 1.33 schema project', () => {
    const dir = mkdtempSync(join(GEN, '.guard-gate-'))
    try {
      mkdirSync(join(dir, 'node_modules', 'prisma-guard'), { recursive: true })
      writeFileSync(
        join(dir, 'node_modules', 'prisma-guard', 'package.json'),
        JSON.stringify({ name: 'prisma-guard', version: '1.33.0' }),
      )
      writeFileSync(
        join(dir, 'schema.prisma'),
        'datasource db { provider = "sqlite" }',
      )
      expect(() =>
        assertMcpGuardVersion(true, join(dir, 'schema.prisma')),
      ).not.toThrow()
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('mcp=true refuses when prisma-guard is unresolvable', () => {
    // injected resolver: no install anywhere for this schema
    expect(() =>
      assertMcpGuardVersion(true, '/nowhere/schema.prisma', () => null),
    ).toThrow(/could not be resolved/)
    expect(() =>
      assertMcpGuardVersion(false, '/nowhere/schema.prisma', () => null),
    ).not.toThrow()
  })

  it('resolution walks ancestors and stops at the first install', () => {
    const root = mkdtempSync(join(GEN, '.guard-gate-'))
    try {
      const deep = join(root, 'a', 'b', 'c')
      mkdirSync(join(root, 'a', 'node_modules', 'prisma-guard'), {
        recursive: true,
      })
      writeFileSync(
        join(root, 'a', 'node_modules', 'prisma-guard', 'package.json'),
        JSON.stringify({ name: 'prisma-guard', version: '1.30.0' }),
      )
      // nearest ancestor install wins even though the repo root has 1.33
      expect(resolveInstalledGuardVersion(join(deep, 'schema.prisma'))).toBe(
        '1.30.0',
      )
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  afterAll(() => {
    // temp dirs cleaned per-test; nothing global to release
  })
})
