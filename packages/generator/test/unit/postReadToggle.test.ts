import { describe, it, expect } from 'vitest'
import type { DMMF } from '@prisma/generator-helper'
import { generateRouterFunction } from '../../src/generators/generateRouter'
import {
  normalizeOperation,
  resolvePostReadsEnabled,
} from '../../src/copy/routeConfig'
import { buildModelOpenApi } from '../../src/copy/buildModelOpenApi'

const model = {
  name: 'User',
  dbName: null,
  schema: null,
  fields: [
    {
      name: 'id',
      kind: 'scalar',
      isList: false,
      isRequired: true,
      isUnique: false,
      isId: true,
      isReadOnly: false,
      hasDefaultValue: false,
      type: 'String',
      isGenerated: false,
      isUpdatedAt: false,
    },
    {
      name: 'email',
      kind: 'scalar',
      isList: false,
      isRequired: true,
      isUnique: true,
      isId: false,
      isReadOnly: false,
      hasDefaultValue: false,
      type: 'String',
      isGenerated: false,
      isUpdatedAt: false,
    },
  ],
  primaryKey: null,
  uniqueFields: [],
  uniqueIndexes: [],
  isGenerated: false,
} as unknown as DMMF.Model

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

describe('resolvePostReadsEnabled', () => {
  it('is enabled by default', () => {
    expect(resolvePostReadsEnabled(undefined, undefined)).toBe(true)
  })

  it('global disable wins when the operation says nothing', () => {
    expect(resolvePostReadsEnabled(true, undefined)).toBe(false)
  })

  it('operation value overrides the global in both directions', () => {
    expect(resolvePostReadsEnabled(true, false)).toBe(true)
    expect(resolvePostReadsEnabled(false, true)).toBe(false)
  })
})

describe('normalizeOperation carries the per-operation toggle', () => {
  it('keeps disablePostReads through normalization', () => {
    expect(
      normalizeOperation({ disablePostReads: true }).disablePostReads,
    ).toBe(true)
    expect(normalizeOperation({ before: [] }).disablePostReads).toBeUndefined()
  })
})

describe('emitted express router gates each POST read per operation', () => {
  it('resolves availability from config + opConfig at runtime', () => {
    const out = emit()
    expect(out).toContain(
      'resolvePostReadsEnabled(config.disablePostReads, opConfig.disablePostReads)',
    )
    expect(out).not.toContain('const postReadsEnabled')
    expect(out).toContain("from '../routeConfig")
  })

  it('embeds the model path segment into the route prefix', () => {
    const out = emit()
    expect(out).toContain("'/user'")
  })
})

describe('buildModelOpenApi honours per-operation POST read toggles', () => {
  const fields = [
    {
      name: 'id',
      type: { toString: () => 'String' },
      isId: true,
      isList: false,
      isRequired: true,
    },
  ] as never

  const build = (config: Record<string, unknown>) =>
    buildModelOpenApi(
      'User',
      fields,
      [],
      config as never,
      {
        format: 'json',
        writeStrategy: 'regular',
        pathSegment: 'user',
      } as never,
    ) as { paths: Record<string, unknown> }

  it('omits /read when findMany disables post reads only', () => {
    const spec = build({ findMany: { disablePostReads: true } })
    expect(spec.paths['/user/read']).toBeUndefined()
  })

  it('omits every post path under the global switch', () => {
    const spec = build({ disablePostReads: true })
    expect(Object.keys(spec.paths).filter((p) => p.endsWith('/read'))).toEqual(
      [],
    )
  })

  it('operation false re-enables against a global true', () => {
    const spec = build({
      disablePostReads: true,
      findUnique: { disablePostReads: false },
    })
    expect(spec.paths['/user/unique'] !== undefined).toBe(true)
    expect(spec.paths['/user/read']).toBeUndefined()
  })
})
