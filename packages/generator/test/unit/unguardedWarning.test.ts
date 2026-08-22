import { describe, it, expect, vi, afterEach } from 'vitest'
import type { DMMF } from '@prisma/generator-helper'
import { warnIfUnguardedRoutes } from '../../src/copy/routeConfig'
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

const isEnabledDefault = (value: unknown): boolean =>
  value !== false && !!(value || false)

const OPS = ['findMany', 'create', 'update'] as const

afterEach(() => {
  vi.restoreAllMocks()
})

describe('warnIfUnguardedRoutes', () => {
  it('warns once per model when operations are enabled without shapes', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const config = { enableAll: true }
    warnIfUnguardedRoutes('Alpha', OPS, config, (v) => v !== false)
    warnIfUnguardedRoutes('Alpha', OPS, config, (v) => v !== false)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0]?.[0])).toContain('Alpha')
    expect(String(warn.mock.calls[0]?.[0])).toContain('guard shapes')
  })

  it('stays silent when at least one enabled operation has a shape or variants', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    warnIfUnguardedRoutes(
      'Bravo',
      OPS,
      { findMany: { shape: {} }, create: {}, update: {} },
      isEnabledDefault,
    )
    expect(warn).not.toHaveBeenCalled()

    warnIfUnguardedRoutes(
      'Charlie',
      OPS,
      { create: { variants: { admin: { shape: {} } } } },
      (v) => v === undefined || v !== false,
    )
    expect(warn).not.toHaveBeenCalled()
  })

  it('stays silent when nothing is enabled or suppression is on', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    warnIfUnguardedRoutes('Delta', OPS, {}, isEnabledDefault)
    expect(warn).not.toHaveBeenCalled()
  })
})

describe('emitted routers run the construction-time check', () => {
  it('express router calls warnIfUnguardedRoutes with its op keys', () => {
    const out = generateRouterFunction({
      model,
      enums: [],
      guardShapesImport: null,
      importStyle: 'esm' as never,
      writeStrategy: 'regular' as never,
      findManyPaginatedMode: 'promiseAll' as never,
      dropGuard: false,
      pathCase: 'lower',
    })
    expect(out).toContain("warnIfUnguardedRoutes('User'")
    expect(out).toContain("'findManyPaginated'")
    expect(out).not.toContain("'updateEach'")
  })
})
