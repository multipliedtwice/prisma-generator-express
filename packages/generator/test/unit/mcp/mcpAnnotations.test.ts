import { describe, it, expect } from 'vitest'
import { OPERATION_METADATA } from '../../../src/copy/operationDefinitions'

/**
 * Every operation metadata entry carries EXPLICIT readOnly/destructive/
 * idempotent values — never inferred from `kind` — and every exposed MCP
 * action (five reads, nine guarded writes) maps them to the MCP hints
 * verbatim.
 */
describe('operation annotations are explicit and exhaustive', () => {
  it('every metadata entry has all three annotation fields as booleans', () => {
    expect(OPERATION_METADATA.length).toBeGreaterThan(0)
    for (const meta of OPERATION_METADATA) {
      expect(typeof meta.readOnly, meta.name + '.readOnly').toBe('boolean')
      expect(typeof meta.destructive, meta.name + '.destructive').toBe(
        'boolean',
      )
      expect(typeof meta.idempotent, meta.name + '.idempotent').toBe('boolean')
    }
  })

  it('covers every operation, including updateEach, which has no MCP action', () => {
    const names = new Set(OPERATION_METADATA.map((m) => m.name))
    for (const name of [
      'findMany',
      'findUnique',
      'findUniqueOrThrow',
      'findFirst',
      'findFirstOrThrow',
      'findManyPaginated',
      'count',
      'aggregate',
      'groupBy',
      'create',
      'createMany',
      'createManyAndReturn',
      'update',
      'updateMany',
      'updateManyAndReturn',
      'upsert',
      'delete',
      'deleteMany',
      'updateEach',
    ]) {
      expect(names.has(name), 'missing metadata for ' + name).toBe(true)
    }
  })
})

describe('MCP hint mapping for the exposed read operations', () => {
  const byName = new Map(OPERATION_METADATA.map((m) => [m.name, m]))

  const expected: Record<string, [boolean, boolean, boolean]> = {
    findMany: [true, false, true],
    findUnique: [true, false, true],
    findFirst: [true, false, true],
    count: [true, false, true],
    findManyPaginated: [true, false, true],
  }

  for (const [name, [ro, de, idem]] of Object.entries(expected)) {
    it(`${name} maps to readOnlyHint=${ro}, destructiveHint=${de}, idempotentHint=${idem}`, () => {
      const meta = byName.get(name)
      expect(meta).toBeDefined()
      // the mapping in mcpRuntime is literal:
      // { readOnlyHint: meta.readOnly, destructiveHint: meta.destructive, idempotentHint: meta.idempotent }
      const hints = {
        readOnlyHint: meta?.readOnly,
        destructiveHint: meta?.destructive,
        idempotentHint: meta?.idempotent,
      }
      expect(hints).toEqual({
        readOnlyHint: ro,
        destructiveHint: de,
        idempotentHint: idem,
      })
    })
  }
})

describe('MCP hint mapping for every exposed write action', () => {
  const byName = new Map(OPERATION_METADATA.map((m) => [m.name, m]))

  const expected: Record<string, [boolean, boolean, boolean]> = {
    create: [false, false, false],
    createMany: [false, false, false],
    createManyAndReturn: [false, false, false],
    update: [false, true, false],
    updateMany: [false, true, false],
    updateManyAndReturn: [false, true, false],
    upsert: [false, true, true],
    delete: [false, true, true],
    deleteMany: [false, true, true],
  }

  for (const [name, [ro, de, idem]] of Object.entries(expected)) {
    it(`${name} maps to readOnlyHint=${ro}, destructiveHint=${de}, idempotentHint=${idem}`, () => {
      const meta = byName.get(name)
      expect(meta).toBeDefined()
      // the mapping in mcpRuntime is literal:
      // { readOnlyHint: meta.readOnly, destructiveHint: meta.destructive, idempotentHint: meta.idempotent }
      expect({
        readOnlyHint: meta?.readOnly,
        destructiveHint: meta?.destructive,
        idempotentHint: meta?.idempotent,
      }).toEqual({
        readOnlyHint: ro,
        destructiveHint: de,
        idempotentHint: idem,
      })
    })
  }

  it('the table covers every guarded write action and nothing else', () => {
    const guardedWrites = OPERATION_METADATA.filter(
      (m) =>
        (m.kind === 'write' || m.kind === 'batch') && m.name !== 'updateEach',
    ).map((m) => m.name)
    expect(Object.keys(expected).sort()).toEqual(guardedWrites.sort())
  })
})
