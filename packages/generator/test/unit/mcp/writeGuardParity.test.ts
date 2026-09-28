import { describe, it, expect } from 'vitest'
import { createGuard, force } from 'prisma-guard'
import { fromJsonSchema } from '@modelcontextprotocol/server'
import {
  buildModelAwareWriteArgsSchema,
  dataConfigProblem,
  findUniqueWhereConfigProblem,
  writeShapeConfigProblem,
  type SchemaFieldMeta,
  type SchemaModelMeta,
} from '../../../src/copy/operationSchemas'

/**
 * DIFFERENTIAL WRITE PARITY — every forced data-config fixture is compiled by
 * the REAL prisma-guard 1.33 runtime (`guard(shape).create(...)` against a
 * recording delegate) and by `dataConfigProblem`. Contract per fixture:
 * guard accepts <-> the MCP validator accepts. A stricter validator would
 * refuse a valid shape at registration; a looser one would register a tool
 * guard rejects on every call.
 */

type GuardFieldMeta = {
  type: string
  isList: boolean
  isRequired: boolean
  isId: boolean
  isRelation: boolean
  hasDefault: boolean
  isUpdatedAt: boolean
  isEnum?: boolean
}

type Fixture = {
  label: string
  type: string
  isRequired: boolean
  isList?: boolean
  isEnum?: boolean
  value: unknown
}

const COLORS = ['RED', 'GREEN']

const FIXTURES: Fixture[] = [
  {
    label: 'DateTime ISO string',
    type: 'DateTime',
    isRequired: true,
    value: '2024-01-01T00:00:00Z',
  },
  {
    label: 'DateTime Date instance',
    type: 'DateTime',
    isRequired: true,
    value: new Date('2024-01-01'),
  },
  {
    label: 'DateTime garbage string',
    type: 'DateTime',
    isRequired: true,
    value: 'nope',
  },
  { label: 'DateTime number', type: 'DateTime', isRequired: true, value: 5 },
  { label: 'BigInt bigint', type: 'BigInt', isRequired: true, value: 10n },
  {
    label: 'BigInt digit string',
    type: 'BigInt',
    isRequired: true,
    value: '12',
  },
  { label: 'BigInt fraction', type: 'BigInt', isRequired: true, value: 1.5 },
  {
    label: 'Bytes Uint8Array',
    type: 'Bytes',
    isRequired: true,
    value: new Uint8Array([1]),
  },
  { label: 'Bytes string', type: 'Bytes', isRequired: true, value: 'abc' },
  { label: 'Bytes number', type: 'Bytes', isRequired: true, value: 5 },
  {
    label: 'String number (coerced)',
    type: 'String',
    isRequired: true,
    value: 5,
  },
  { label: 'String array', type: 'String', isRequired: true, value: ['x'] },
  {
    label: 'String force()',
    type: 'String',
    isRequired: true,
    value: force('x'),
  },
  {
    label: 'Int digit string (coerced)',
    type: 'Int',
    isRequired: true,
    value: '7',
  },
  { label: 'Int fraction', type: 'Int', isRequired: true, value: 1.5 },
  { label: 'Int fraction string', type: 'Int', isRequired: true, value: '1.5' },
  {
    label: 'Float numeric string',
    type: 'Float',
    isRequired: true,
    value: '1.5',
  },
  {
    label: 'Float garbage string',
    type: 'Float',
    isRequired: true,
    value: 'x',
  },
  { label: 'Float Infinity', type: 'Float', isRequired: true, value: Infinity },
  {
    label: 'Boolean true-literal is client control, false literal forced',
    type: 'Boolean',
    isRequired: true,
    value: false,
  },
  { label: 'Boolean string', type: 'Boolean', isRequired: true, value: 'yes' },
  { label: 'Json object', type: 'Json', isRequired: true, value: { a: 1 } },
  { label: 'Json array', type: 'Json', isRequired: true, value: [1, 2] },
  {
    label: 'Json null on required',
    type: 'Json',
    isRequired: true,
    value: null,
  },
  {
    label: 'optional String null',
    type: 'String',
    isRequired: false,
    value: null,
  },
  {
    label: 'required String null',
    type: 'String',
    isRequired: true,
    value: null,
  },
  {
    label: 'String list',
    type: 'String',
    isRequired: true,
    isList: true,
    value: ['a', 'b'],
  },
  {
    label: 'String list non-array',
    type: 'String',
    isRequired: true,
    isList: true,
    value: 'a',
  },
  {
    label: 'Int list',
    type: 'Int',
    isRequired: true,
    isList: true,
    value: [1, 2],
  },
  {
    label: 'enum member',
    type: 'Color',
    isRequired: true,
    isEnum: true,
    value: 'RED',
  },
  {
    label: 'enum non-member',
    type: 'Color',
    isRequired: true,
    isEnum: true,
    value: 'BLUE',
  },
]

function guardAccepts(fx: Fixture): boolean {
  const field: GuardFieldMeta = {
    type: fx.type,
    isList: fx.isList ?? false,
    isRequired: fx.isRequired,
    isId: false,
    isRelation: false,
    hasDefault: false,
    isUpdatedAt: false,
    ...(fx.isEnum ? { isEnum: true } : {}),
  }
  const guard = createGuard({
    scopeMap: {},
    typeMap: {
      W: {
        id: {
          type: 'String',
          isList: false,
          isRequired: true,
          isId: true,
          isRelation: false,
          hasDefault: true,
          isUpdatedAt: false,
        },
        v: field,
      },
    },
    enumMap: { Color: COLORS },
    zodChains: {},
    guardConfig: { onMissingScopeContext: 'error' },
    uniqueMap: { W: [{ selector: 'id', fields: ['id'] }] },
    zodDefaults: {},
  })
  const ext = guard.extension() as unknown as {
    model: {
      w: {
        guard: (
          this: unknown,
          shape: unknown,
        ) => {
          create: (body: unknown) => unknown
        }
      }
    }
  }
  const delegate = { create: (args: unknown) => args }
  try {
    ext.model.w.guard
      .call(
        { $parent: { w: delegate } },
        {
          data: { v: fx.value },
        },
      )
      .create({ data: {} })
    return true
  } catch {
    return false
  }
}

function mcpAccepts(fx: Fixture): boolean {
  const field: SchemaFieldMeta = {
    name: 'v',
    kind: fx.isEnum ? 'enum' : 'scalar',
    type: fx.type,
    isList: fx.isList ?? false,
    isRequired: fx.isRequired,
  }
  const meta: SchemaModelMeta = {
    name: 'W',
    fields: [
      {
        name: 'id',
        kind: 'scalar',
        type: 'String',
        isList: false,
        isRequired: true,
        isId: true,
        hasDefaultValue: true,
      },
      field,
    ],
    enums: new Map([['Color', COLORS]]),
    uniqueFields: ['id'],
    compoundUniques: [],
    modelIndex: new Map(),
  }
  return dataConfigProblem(meta, { v: fx.value }, 'create') === null
}

describe('forced write data configs: MCP validator vs prisma-guard 1.33', () => {
  for (const fx of FIXTURES) {
    it(fx.label, () => {
      expect(mcpAccepts(fx)).toBe(guardAccepts(fx))
    })
  }

  it('the fixture set exercises both verdicts', () => {
    const verdicts = new Set(FIXTURES.map(guardAccepts))
    expect(verdicts).toEqual(new Set([true, false]))
  })
})

/**
 * Client-input parity for create data: the advertised schema must NEVER be
 * more permissive than guard (a body the schema accepts, guard accepts).
 * The schema is allowed to be stricter only in the documented places:
 * guard's input coercion (String accepts numbers, DateTime any Date.parse
 * string) is not advertised for data — agents send canonical JSON types.
 */
describe('create data client input: MCP schema never more permissive than guard', () => {
  const typeMap = {
    W: {
      id: {
        type: 'String',
        isList: false,
        isRequired: true,
        isId: true,
        isRelation: false,
        hasDefault: true,
        isUpdatedAt: false,
      },
      a: {
        type: 'String',
        isList: false,
        isRequired: true,
        isId: false,
        isRelation: false,
        hasDefault: false,
        isUpdatedAt: false,
      },
      b: {
        type: 'String',
        isList: false,
        isRequired: false,
        isId: false,
        isRelation: false,
        hasDefault: false,
        isUpdatedAt: false,
      },
      c: {
        type: 'Boolean',
        isList: false,
        isRequired: true,
        isId: false,
        isRelation: false,
        hasDefault: true,
        isUpdatedAt: false,
      },
      n: {
        type: 'Int',
        isList: false,
        isRequired: false,
        isId: false,
        isRelation: false,
        hasDefault: false,
        isUpdatedAt: false,
      },
    },
  }
  const shape = { data: { a: true, b: true, c: true, n: true } }

  function guardCreate(body: unknown): boolean {
    const guard = createGuard({
      scopeMap: {},
      typeMap,
      enumMap: {},
      zodChains: {},
      guardConfig: { onMissingScopeContext: 'error' },
      uniqueMap: { W: [{ selector: 'id', fields: ['id'] }] },
      zodDefaults: {},
    })
    const ext = guard.extension() as unknown as {
      model: {
        w: {
          guard: (
            this: unknown,
            s: unknown,
          ) => { create: (b: unknown) => unknown }
        }
      }
    }
    try {
      ext.model.w.guard
        .call({ $parent: { w: { create: (x: unknown) => x } } }, shape)
        .create(body)
      return true
    } catch {
      return false
    }
  }

  const meta: SchemaModelMeta = {
    name: 'W',
    fields: [
      {
        name: 'id',
        kind: 'scalar',
        type: 'String',
        isList: false,
        isRequired: true,
        isId: true,
        hasDefaultValue: true,
      },
      {
        name: 'a',
        kind: 'scalar',
        type: 'String',
        isList: false,
        isRequired: true,
      },
      {
        name: 'b',
        kind: 'scalar',
        type: 'String',
        isList: false,
        isRequired: false,
      },
      {
        name: 'c',
        kind: 'scalar',
        type: 'Boolean',
        isList: false,
        isRequired: true,
        hasDefaultValue: true,
      },
      {
        name: 'n',
        kind: 'scalar',
        type: 'Int',
        isList: false,
        isRequired: false,
      },
    ],
    enums: new Map(),
    uniqueFields: ['id'],
    compoundUniques: [],
    modelIndex: new Map(),
  }

  const bodies: Array<[string, Record<string, unknown>, boolean]> = [
    ['required field only', { data: { a: 'x' } }, true],
    ['missing required field', { data: { b: 'y' } }, false],
    ['optional null', { data: { a: 'x', b: null } }, true],
    ['required null', { data: { a: null } }, false],
    ['defaulted required omitted', { data: { a: 'x' } }, true],
    ['defaulted required null', { data: { a: 'x', c: null } }, false],
    ['defaulted required set', { data: { a: 'x', c: false } }, true],
    ['unknown field', { data: { a: 'x', z: 1 } }, false],
    ['id not advertised', { data: { a: 'x', id: 'i' } }, false],
    ['optional Int null', { data: { a: 'x', n: null } }, true],
    ['Int fraction', { data: { a: 'x', n: 1.5 } }, false],
    ['missing data', {}, false],
  ]

  for (const [label, body, schemaExpected] of bodies) {
    it(label, async () => {
      const schema = fromJsonSchema<Record<string, unknown>>(
        buildModelAwareWriteArgsSchema('create', meta, shape) as Parameters<
          typeof fromJsonSchema
        >[0],
      )
      const schemaAccepts =
        (await schema['~standard'].validate(body)).issues === undefined
      expect(schemaAccepts).toBe(schemaExpected)
      if (schemaAccepts) expect(guardCreate(body)).toBe(true)
    })
  }

  it('a body guard rejects is never accepted by the schema (whole fixture set)', async () => {
    const schema = fromJsonSchema<Record<string, unknown>>(
      buildModelAwareWriteArgsSchema('create', meta, shape) as Parameters<
        typeof fromJsonSchema
      >[0],
    )
    for (const [label, body] of bodies) {
      const schemaAccepts =
        (await schema['~standard'].validate(body)).issues === undefined
      if (!guardCreate(body)) expect(schemaAccepts, label).toBe(false)
    }
  })
})

/**
 * Unique-where CONFIG parity for update/upsert/delete (and findUnique):
 * guard's buildUniqueWhereSchema + validateUniqueEquality vs
 * findUniqueWhereConfigProblem, including the extended form that carries a
 * forced tenant beside the unique selector.
 */
describe('unique-where configs: MCP validator vs prisma-guard 1.33', () => {
  const typeMap = {
    W: {
      id: {
        type: 'String',
        isList: false,
        isRequired: true,
        isId: true,
        isRelation: false,
        hasDefault: true,
        isUpdatedAt: false,
      },
      email: {
        type: 'String',
        isList: false,
        isRequired: true,
        isId: false,
        isRelation: false,
        hasDefault: false,
        isUpdatedAt: false,
        isUnique: true,
      },
      siteId: {
        type: 'String',
        isList: false,
        isRequired: true,
        isId: false,
        isRelation: false,
        hasDefault: false,
        isUpdatedAt: false,
      },
      notes: {
        type: 'String',
        isList: false,
        isRequired: false,
        isId: false,
        isRelation: false,
        hasDefault: false,
        isUpdatedAt: false,
      },
      owner: {
        type: 'W',
        isList: false,
        isRequired: false,
        isId: false,
        isRelation: true,
        hasDefault: false,
        isUpdatedAt: false,
      },
    },
  }
  const meta: SchemaModelMeta = {
    name: 'W',
    fields: [
      {
        name: 'id',
        kind: 'scalar',
        type: 'String',
        isList: false,
        isRequired: true,
        isId: true,
      },
      {
        name: 'email',
        kind: 'scalar',
        type: 'String',
        isList: false,
        isRequired: true,
        isUnique: true,
      },
      {
        name: 'siteId',
        kind: 'scalar',
        type: 'String',
        isList: false,
        isRequired: true,
      },
      {
        name: 'notes',
        kind: 'scalar',
        type: 'String',
        isList: false,
        isRequired: false,
      },
      {
        name: 'owner',
        kind: 'object',
        type: 'W',
        isList: false,
        isRequired: false,
      },
    ],
    enums: new Map(),
    uniqueFields: ['id', 'email'],
    compoundUniques: [],
    modelIndex: new Map(),
  }

  function guardDeleteAccepts(where: Record<string, unknown>): boolean {
    const guard = createGuard({
      scopeMap: {},
      typeMap,
      enumMap: {},
      zodChains: {},
      guardConfig: { onMissingScopeContext: 'error' },
      uniqueMap: {
        W: [
          { selector: 'id', fields: ['id'] },
          { selector: 'email', fields: ['email'] },
        ],
      },
      zodDefaults: {},
    })
    const ext = guard.extension() as unknown as {
      model: {
        w: {
          guard: (
            this: unknown,
            s: unknown,
          ) => { delete: (b: unknown) => unknown }
        }
      }
    }
    // the client sends a value for every client-controlled key, so only
    // the CONFIG decides acceptance
    const body = Object.fromEntries(
      Object.entries(where)
        .filter(([, v]) => v === true)
        .map(([k]) => [k, 'x']),
    )
    try {
      ext.model.w.guard
        .call({ $parent: { w: { delete: (x: unknown) => x } } }, { where })
        .delete({ where: body })
      return true
    } catch {
      return false
    }
  }

  const cases: Array<[string, Record<string, unknown>]> = [
    ['flat unique true', { id: true }],
    ['two unique selectors', { id: true, email: true }],
    ['unique + forced tenant (extended)', { id: true, siteId: force('a') }],
    ['unique + literal tenant (extended)', { id: true, siteId: 'a' }],
    ['unique + client non-unique filter', { id: true, siteId: true }],
    ['unique + coerced forced number', { id: true, siteId: force(5) }],
    ['unique + forced null on optional', { id: true, notes: force(null) }],
    ['unique + forced null on required', { id: true, siteId: force(null) }],
    ['non-unique only (no covering selector)', { siteId: force('a') }],
    ['operator object beside unique', { id: true, siteId: { equals: true } }],
    ['relation beside unique', { id: true, owner: true }],
    ['unknown key beside unique', { id: true, nope: true }],
  ]
  for (const [label, where] of cases) {
    it(label, () => {
      const mcp = findUniqueWhereConfigProblem(meta, where) === null
      expect(mcp).toBe(guardDeleteAccepts(where))
    })
  }
})

/**
 * writeStrategy parity: under `forceReturn` the createMany/updateMany cores
 * call guard's RETURNING methods, whose shape tables allow a projection; the
 * non-returning methods refuse one. The MCP validator must agree with the
 * guard method the core really invokes.
 */
describe('writeStrategy: shape tables vs the guard method the core invokes', () => {
  const typeMap = {
    W: {
      id: {
        type: 'String',
        isList: false,
        isRequired: true,
        isId: true,
        isRelation: false,
        hasDefault: true,
        isUpdatedAt: false,
      },
      t: {
        type: 'String',
        isList: false,
        isRequired: true,
        isId: false,
        isRelation: false,
        hasDefault: false,
        isUpdatedAt: false,
      },
    },
  }
  const meta: SchemaModelMeta = {
    name: 'W',
    fields: [
      {
        name: 'id',
        kind: 'scalar',
        type: 'String',
        isList: false,
        isRequired: true,
        isId: true,
        hasDefaultValue: true,
      },
      {
        name: 't',
        kind: 'scalar',
        type: 'String',
        isList: false,
        isRequired: true,
      },
    ],
    enums: new Map(),
    uniqueFields: ['id'],
    compoundUniques: [],
    modelIndex: new Map(),
  }

  function guardAcceptsShape(
    method:
      | 'createMany'
      | 'createManyAndReturn'
      | 'updateMany'
      | 'updateManyAndReturn',
    shape: Record<string, unknown>,
    body: Record<string, unknown>,
  ): boolean {
    const guard = createGuard({
      scopeMap: {},
      typeMap,
      enumMap: {},
      zodChains: {},
      guardConfig: { onMissingScopeContext: 'error' },
      uniqueMap: { W: [{ selector: 'id', fields: ['id'] }] },
      zodDefaults: {},
    })
    const ext = guard.extension() as unknown as {
      model: {
        w: {
          guard: (
            this: unknown,
            s: unknown,
          ) => Record<string, (b: unknown) => unknown>
        }
      }
    }
    const delegate = { [method]: (x: unknown) => x }
    try {
      const methods = ext.model.w.guard.call(
        { $parent: { w: delegate } },
        shape,
      )
      methods[method]?.(body)
      return true
    } catch {
      return false
    }
  }

  const createShape = { data: { t: true }, select: { id: true } }
  const updateShape = {
    where: { t: { equals: 'x' } },
    data: { t: true },
    select: { id: true },
  }
  const cases: Array<
    [
      (
        | 'createMany'
        | 'createManyAndReturn'
        | 'updateMany'
        | 'updateManyAndReturn'
      ),
      Record<string, unknown>,
      Record<string, unknown>,
    ]
  > = [
    ['createMany', createShape, { data: [{ t: 'a' }] }],
    ['createManyAndReturn', createShape, { data: [{ t: 'a' }] }],
    ['updateMany', updateShape, { data: { t: 'b' } }],
    ['updateManyAndReturn', updateShape, { data: { t: 'b' } }],
  ]
  for (const [method, shape, body] of cases) {
    it(`${method} with a projection shape`, () => {
      const mcp = writeShapeConfigProblem(meta, method, shape) === null
      expect(mcp).toBe(guardAcceptsShape(method, shape, body))
    })
  }
})
