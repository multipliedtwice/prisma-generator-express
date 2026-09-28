import { describe, it, expect } from 'vitest'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { fromJsonSchema } from '@modelcontextprotocol/server'
import {
  argsShapeConfigProblem,
  buildModelAwareArgsSchema,
  filterWhereConfigProblem,
  findUniqueWhereConfigProblem,
  forcedValueMatchesField,
  type SchemaFieldMeta,
  type SchemaModelMeta,
} from '../../../src/copy/operationSchemas'
import {
  createMcpReadTool,
  registerMcpTools,
} from '../../../src/copy/mcpRuntime'
import { fakeServer, fakeAuthInfo } from './mcpTestHarness'

/**
 * DIFFERENTIAL GUARD PARITY — every MCP where-schema fixture is ALSO parsed
 * by the real prisma-guard 1.33 runtime (the generated guard client from
 * article-labs/guard, whose node_modules tree pins prisma-guard 1.33.0).
 *
 * Parity contract per fixture:
 *  - guard accepts  ->  the MCP schema accepts the same input
 *  - guard rejects  ->  the MCP schema rejects too (never more permissive)
 * The one documented divergence: forced shape values are not advertised in
 * the MCP schema at all, so clients cannot send them (guard merges
 * same-value input) — asserted explicitly where it applies.
 */

type GuardClient = {
  guard: {
    query: (
      model: string,
      method: string,
      shape: unknown,
    ) => { parse: (body: unknown, opts?: unknown) => unknown }
  }
}

const GUARD_CLIENT_TS = resolve(
  __dirname,
  '../../../../../article-labs/guard/generated/guard/client.ts',
)

let guardClient: Promise<GuardClient> | undefined
function loadGuard(): Promise<GuardClient> {
  guardClient ??= import(
    /* @vite-ignore */ pathToFileURL(GUARD_CLIENT_TS).href
  ) as Promise<GuardClient>
  return guardClient
}

// Plant metadata (article-labs schema: id, name, priceCents Int,
// isPublished/isDeleted Boolean, nurseryId; relations nursery + orderItems)
const PLANT_FIELDS = [
  {
    name: 'id',
    kind: 'scalar',
    type: 'String',
    isList: false,
    isRequired: true,
  },
  {
    name: 'name',
    kind: 'scalar',
    type: 'String',
    isList: false,
    isRequired: true,
  },
  {
    name: 'priceCents',
    kind: 'scalar',
    type: 'Int',
    isList: false,
    isRequired: true,
  },
  {
    name: 'isPublished',
    kind: 'scalar',
    type: 'Boolean',
    isList: false,
    isRequired: true,
  },
  {
    name: 'isDeleted',
    kind: 'scalar',
    type: 'Boolean',
    isList: false,
    isRequired: true,
  },
  {
    name: 'nurseryId',
    kind: 'scalar',
    type: 'String',
    isList: false,
    isRequired: true,
  },
  {
    name: 'nursery',
    kind: 'object',
    type: 'Nursery',
    isList: false,
    isRequired: true,
  },
  {
    name: 'orderItems',
    kind: 'object',
    type: 'OrderItem',
    isList: true,
    isRequired: true,
  },
] as const

const ORDER_ITEM_META: SchemaModelMeta = {
  name: 'OrderItem',
  fields: [
    {
      name: 'id',
      kind: 'scalar',
      type: 'String',
      isList: false,
      isRequired: true,
      isId: true,
      isUnique: true,
    },
    {
      name: 'quantity',
      kind: 'scalar',
      type: 'Int',
      isList: false,
      isRequired: true,
    },
  ] as never,
  enums: new Map(),
  uniqueFields: ['id'],
  compoundUniques: [],
  modelIndex: new Map(),
}

const PLANT_META: SchemaModelMeta = {
  name: 'Plant',
  fields: PLANT_FIELDS as never,
  enums: new Map(),
  uniqueFields: ['id'],
  compoundUniques: [],
  modelIndex: new Map([['OrderItem', ORDER_ITEM_META]]),
}

// guard shape and client body share the SAME arg surface (where/orderBy/
// take), so acceptance compares like-for-like
const PLANT_SHAPE = {
  where: {
    name: { contains: true },
    priceCents: { gte: true },
    isDeleted: { equals: false },
    orderItems: { some: { quantity: { gte: true } } },
  },
  orderBy: { name: true },
  take: { max: 50 },
}

interface ParityFixture {
  label: string
  body: Record<string, unknown>
  bothAccept: boolean
}

const PARITY_FIXTURES: ParityFixture[] = [
  {
    label: 'contains (client-controlled)',
    body: { where: { name: { contains: 'fern' } } },
    bothAccept: true,
  },
  {
    label: 'gte (client-controlled)',
    body: { where: { priceCents: { gte: 10 } } },
    bothAccept: true,
  },
  {
    label: 'undeclared field rejected by both',
    body: { where: { description: { contains: 'x' } } },
    bothAccept: false,
  },
  {
    label: 'some relation filter (client-controlled)',
    body: { where: { orderItems: { some: { quantity: { gte: 5 } } } } },
    bothAccept: true,
  },
  {
    label: 'empty some condition rejected by both',
    body: { where: { orderItems: { some: {} } } },
    bothAccept: false,
  },
  {
    label: 'every when only some configured — rejected by both',
    body: { where: { orderItems: { every: { quantity: { gte: 5 } } } } },
    bothAccept: false,
  },
  {
    label: 'orderBy declared field (client-controlled)',
    body: { orderBy: { name: 'asc' } },
    bothAccept: true,
  },
  {
    label: 'orderBy {sort, nulls} object form (client-controlled)',
    body: {
      where: { name: { contains: 'x' } },
      orderBy: { name: { sort: 'asc', nulls: 'last' } },
      take: 2,
    },
    bothAccept: true,
  },
  {
    label: 'orderBy object form without sort rejected by both',
    body: {
      where: { name: { contains: 'x' } },
      orderBy: { name: { nulls: 'last' } },
      take: 2,
    },
    bothAccept: false,
  },
  {
    label: 'orderBy object form with invalid nulls rejected by both',
    body: {
      where: { name: { contains: 'x' } },
      orderBy: { name: { sort: 'asc', nulls: 'middle' } },
      take: 2,
    },
    bothAccept: false,
  },
  {
    label: 'orderBy undeclared field rejected by both',
    body: { orderBy: { priceCents: 'asc' } },
    bothAccept: false,
  },
]

describe('differential guard parity (prisma-guard 1.33 runtime)', () => {
  for (const fixture of PARITY_FIXTURES) {
    const accept = fixture.bothAccept
    it(`${fixture.label}: guard and MCP ${accept ? 'accept' : 'reject'}`, async () => {
      const client = await loadGuard()

      // guard side
      let guardOk = true
      let guardErr = ''
      try {
        client.guard
          .query('Plant' as never, 'findMany', PLANT_SHAPE as never)
          .parse(fixture.body, { caller: 'backoffice' })
      } catch (error) {
        guardOk = false
        guardErr = (error as Error).message
      }
      expect(
        guardOk,
        `guard ${guardOk ? 'accepted' : 'rejected'}: ${guardErr}`,
      ).toBe(accept)

      // MCP side: schema built from the same shape via the shipped builder
      // MCP side: schema built from the same shape via the shipped builder
      const schema = buildModelAwareArgsSchema('findMany', PLANT_META, {
        where: PLANT_SHAPE.where,
        orderBy: PLANT_SHAPE.orderBy,
        take: PLANT_SHAPE.take.max,
      })
      const wrapped = fromJsonSchema(schema as never) as {
        '~standard': { validate: (x: unknown) => { issues?: unknown[] } }
      }
      const result = wrapped['~standard'].validate(fixture.body)
      const mcpRejected =
        result.issues !== undefined && result.issues.length > 0
      expect(
        mcpRejected,
        `MCP ${mcpRejected ? 'rejected' : 'accepted'}: ${JSON.stringify(result.issues)}`,
      ).toBe(!accept)
    }, 30_000)
  }

  it('forced equals: guard merges same-value input, MCP schema rejects the key outright (documented divergence)', async () => {
    const client = await loadGuard()

    // guard side
    let guardOk = true
    let guardErr = ''
    try {
      client.guard
        .query('Plant' as never, 'findMany', PLANT_SHAPE as never)
        .parse(
          { where: { isDeleted: { equals: false } } },
          { caller: 'backoffice' },
        )
    } catch (error) {
      guardOk = false
      guardErr = (error as Error).message
    }
    // guard merges the forced value and accepts the query
    expect(guardOk, `guard rejected: ${guardErr}`).toBe(true)

    // MCP side: forced key not advertised — client input rejected
    const { server, tools } = fakeServer()
    registerMcpTools(server as never, {
      ...sharedOpts(),
      tools: [
        createMcpReadTool({
          model: 'Plant',
          operation: 'findMany' as const,
          config: {
            findMany: {
              shape: {
                where: PLANT_SHAPE.where,
                orderBy: PLANT_SHAPE.orderBy,
                take: PLANT_SHAPE.take,
              },
            },
          },
          core: async () => [],
          fields: PLANT_FIELDS as never,
          enums: new Map(),
          modelIndex: new Map(),
        }),
      ],
    })
    const validate = (
      tools[0]?.config.inputSchema as unknown as {
        '~standard': { validate: (x: unknown) => { issues?: unknown[] } }
      }
    )['~standard'].validate
    const result = validate({ where: { isDeleted: { equals: false } } })
    expect(result.issues !== undefined, 'forced key must be rejected').toBe(
      true,
    )
  }, 30_000)
})

// ---------------------------------------------------------------------------
// COMPOUND UNIQUE SELECTOR parity — findUnique where and list cursor against
// the real prisma-guard 1.33 runtime with a compound unique constraint.
// Guard client built with createGuard (exactly what the generated client does)
// from the article-labs prisma-guard 1.33.0 install.
// ---------------------------------------------------------------------------

const GUARD_RUNTIME_MJS = resolve(
  __dirname,
  '../../../../../article-labs/guard/node_modules/prisma-guard/dist/runtime/index.js',
)

type RuntimeGuard = {
  query: (
    model: never,
    method: never,
    shape: never,
  ) => { parse: (body: unknown, opts?: unknown) => unknown }
}

function guardForce(): { force: (v: unknown) => unknown } {
  // same marker contract as the prisma-guard force() wrapper (verified:
  // Symbol.for('prisma-guard.forced') === true on runtime-forced values)
  return {
    force: (v: unknown) => ({
      [Symbol.for('prisma-guard.forced')]: true,
      value: v,
    }),
  }
}

async function loadCompoundGuard(): Promise<RuntimeGuard> {
  const mod = (await import(
    /* @vite-ignore */ pathToFileURL(GUARD_RUNTIME_MJS).href
  )) as {
    createGuard: (opts: Record<string, unknown>) => RuntimeGuard
    force: (v: unknown) => unknown
  }
  const field = (isId: boolean) => ({
    kind: 'scalar',
    type: 'String',
    isList: false,
    isRequired: true,
    isId,
    isUnique: false,
  })
  return mod.createGuard({
    typeMap: {
      Enrollment: {
        id: field(true),
        studentId: field(false),
        courseId: field(false),
      },
    },
    uniqueMap: {
      Enrollment: [
        { selector: 'id', fields: ['id'] },
        { selector: 'studentId_courseId', fields: ['studentId', 'courseId'] },
      ],
    },
    scopeMap: { backoffice: { '*': true } },
    guardConfig: {},
    enumMap: {},
    zodChains: {},
    zodDefaults: {},
  })
}

const ENROLLMENT_META: SchemaModelMeta = {
  name: 'Enrollment',
  fields: [
    {
      name: 'id',
      kind: 'scalar',
      type: 'String',
      isList: false,
      isRequired: true,
      isId: true,
      isUnique: false,
    },
    {
      name: 'studentId',
      kind: 'scalar',
      type: 'String',
      isList: false,
      isRequired: true,
      isId: false,
      isUnique: false,
    },
    {
      name: 'courseId',
      kind: 'scalar',
      type: 'String',
      isList: false,
      isRequired: true,
      isId: false,
      isUnique: false,
    },
  ] as never,
  enums: new Map(),
  uniqueFields: ['id'],
  compoundUniques: [
    { selector: 'studentId_courseId', fields: ['studentId', 'courseId'] },
  ],
  modelIndex: new Map(),
}

const SEL = { studentId: 's1', courseId: 'c1' }

interface CompoundFixture {
  label: string
  // plain shape, or built with the runtime's force() for forced configs
  shape:
    | Record<string, unknown>
    | ((m: { force: (v: unknown) => unknown }) => Record<string, unknown>)
  body: Record<string, unknown>
  bothAccept: boolean
}

const COMPOUND_FIXTURES: CompoundFixture[] = [
  {
    label: 'findUnique selector input under selector shape',
    shape: {
      where: { studentId_courseId: { studentId: true, courseId: true } },
    },
    body: { where: { studentId_courseId: SEL } },
    bothAccept: true,
  },
  {
    label: 'findUnique partial selector input rejected by both',
    shape: {
      where: { studentId_courseId: { studentId: true, courseId: true } },
    },
    body: { where: { studentId_courseId: { studentId: 's1' } } },
    bothAccept: false,
  },
  {
    label: 'findUnique flat id input rejected when only selector configured',
    shape: {
      where: { studentId_courseId: { studentId: true, courseId: true } },
    },
    body: { where: { id: 'x' } },
    bothAccept: false,
  },
  {
    label: 'findUnique flat alternative under mixed shape',
    shape: {
      where: {
        id: true,
        studentId_courseId: { studentId: true, courseId: true },
      },
    },
    body: { where: { id: 'x' } },
    bothAccept: true,
  },
  {
    label: 'findUnique selector alternative under mixed shape',
    shape: {
      where: {
        id: true,
        studentId_courseId: { studentId: true, courseId: true },
      },
    },
    body: { where: { studentId_courseId: SEL } },
    bothAccept: true,
  },
  {
    label:
      'findUnique field-wise compound declaration is guard-invalid — guard rejects, schema advertises nothing but the empty body',
    shape: { where: { studentId: true, courseId: true } },
    body: { where: { studentId: 's1' } },
    bothAccept: false,
  },
  {
    label:
      'findUnique forced inner selector field is merged by guard and omittable in the schema',
    shape: (m) => ({
      where: {
        studentId_courseId: { studentId: true, courseId: m.force('c1') },
      },
    }),
    body: { where: { studentId_courseId: { studentId: 's1' } } },
    bothAccept: true,
  },
  {
    label: 'findUnique where:true is guard-invalid — both reject',
    shape: { where: true },
    body: { where: { id: 'x' } },
    bothAccept: false,
  },
  {
    label:
      'findUnique fully-forced selector — client sends no where, both accept',
    shape: {
      where: { studentId_courseId: { studentId: 's1', courseId: 'c1' } },
    },
    body: {},
    bothAccept: true,
  },
  {
    label:
      'findUnique with client-controlled selector but no where rejected by both',
    shape: {
      where: {
        id: true,
        studentId_courseId: { studentId: true, courseId: true },
      },
    },
    body: {},
    bothAccept: false,
  },
  {
    label: 'cursor compound selector input under selector cursor shape',
    shape: {
      take: { max: 5 },
      cursor: { studentId_courseId: { studentId: true, courseId: true } },
    },
    body: { take: 2, cursor: { studentId_courseId: SEL } },
    bothAccept: true,
  },
  {
    label: 'cursor partial compound selector rejected by both',
    shape: {
      take: { max: 5 },
      cursor: { studentId_courseId: { studentId: true, courseId: true } },
    },
    body: { take: 2, cursor: { studentId_courseId: { studentId: 's1' } } },
    bothAccept: false,
  },
  {
    label: 'cursor selector rejected when only flat id configured',
    shape: { take: { max: 5 }, cursor: { id: true } },
    body: { take: 2, cursor: { studentId_courseId: SEL } },
    bothAccept: false,
  },
]

describe('compound unique selector parity (prisma-guard 1.33 runtime)', () => {
  for (const fixture of COMPOUND_FIXTURES) {
    const accept = fixture.bothAccept
    it(`${fixture.label}: guard and MCP ${accept ? 'accept' : 'reject'}`, async () => {
      const guard = await loadCompoundGuard()
      const shape =
        typeof fixture.shape === 'function'
          ? fixture.shape(guardForce())
          : fixture.shape
      const method = 'cursor' in shape ? 'findMany' : 'findUnique'
      // guard side
      let guardOk = true
      let guardErr = ''
      try {
        guard
          .query('Enrollment' as never, method as never, shape as never)
          .parse(fixture.body, { caller: 'backoffice' })
      } catch (error) {
        guardOk = false
        guardErr = (error as Error).message
      }
      expect(
        guardOk,
        `guard ${guardOk ? 'accepted' : 'rejected'}: ${guardErr}`,
      ).toBe(accept)

      // MCP side: findUnique where via uniqueSelectorWhereSchema, list cursor
      // via buildModelAwareArgsSchema (cursor lives on findMany)
      const schema =
        method === 'findMany'
          ? buildModelAwareArgsSchema('findMany', ENROLLMENT_META, shape)
          : buildModelAwareArgsSchema('findUnique', ENROLLMENT_META, shape)
      const wrapped = fromJsonSchema(schema as never) as {
        '~standard': { validate: (x: unknown) => { issues?: unknown[] } }
      }
      const result = wrapped['~standard'].validate(fixture.body)
      const mcpRejected =
        result.issues !== undefined && result.issues.length > 0
      expect(
        mcpRejected,
        `MCP ${mcpRejected ? 'rejected' : 'accepted'}: ${JSON.stringify(result.issues)}`,
      ).toBe(!accept)
    }, 30_000)
  }

  it('forced inner selector field: schema advertises only the client-controlled fields', async () => {
    const forced = { [Symbol.for('prisma-guard.forced')]: true, value: 'c1' }
    const schema = buildModelAwareArgsSchema('findUnique', ENROLLMENT_META, {
      where: { studentId_courseId: { studentId: true, courseId: forced } },
    })
    expect(schema.required).toEqual(['where'])
    const where = schema.properties?.where as {
      properties?: Record<string, unknown>
    }
    const selector = where.properties?.studentId_courseId as {
      properties?: Record<string, unknown>
      required?: string[]
    }
    expect(Object.keys(selector.properties ?? {})).toEqual(['studentId'])
    expect(selector.required).toEqual(['studentId'])
  })
})

// ---------------------------------------------------------------------------
// FILTER / ORDER / PROJECTION parity — the remaining guard-1.33 config and
// input forms, each probed against the real runtime through createGuard.
// ---------------------------------------------------------------------------

type RuntimeMaps = {
  createGuard: (opts: Record<string, unknown>) => RuntimeGuard
}

const GUARD_RUNTIME = resolve(
  __dirname,
  '../../../../../article-labs/guard/node_modules/prisma-guard/dist/runtime/index.js',
)

function scalarField(type: string, extra: Record<string, unknown> = {}) {
  return {
    kind: 'scalar',
    type,
    isList: false,
    isRequired: true,
    ...extra,
  }
}

function relField(type: string, isList: boolean) {
  return {
    kind: 'object',
    type,
    isList,
    isRequired: true,
    isRelation: true,
  }
}

const REL_MAPS = {
  Plant: {
    id: scalarField('String', { isId: true }),
    name: scalarField('String'),
    priceCents: scalarField('Int'),
    isDeleted: scalarField('Boolean'),
    tags: { ...scalarField('String'), isList: true },
    orderItems: relField('OrderItem', true),
    nursery: relField('Nursery', false),
  },
  OrderItem: {
    id: scalarField('String', { isId: true }),
    quantity: scalarField('Int'),
    plant: relField('Plant', false),
  },
  Nursery: {
    id: scalarField('String', { isId: true }),
    name: scalarField('String'),
    plants: relField('Plant', true),
  },
  Customer: {
    id: scalarField('String', { isId: true }),
    email: scalarField('String', { isUnique: true }),
  },
  Tag: {
    id: scalarField('String', { isId: true }),
    color: {
      kind: 'enum',
      type: 'Color',
      isList: false,
      isRequired: true,
      isEnum: true,
    },
    nums: scalarField('Int'),
    opt: { kind: 'scalar', type: 'String', isList: false, isRequired: false },
    optn: { kind: 'scalar', type: 'Int', isList: false, isRequired: false },
    ocolor: {
      kind: 'enum',
      type: 'Color',
      isList: false,
      isRequired: false,
      isEnum: true,
    },
    colors: {
      kind: 'enum',
      type: 'Color',
      isList: true,
      isRequired: true,
      isEnum: true,
    },
    strs: { kind: 'scalar', type: 'String', isList: true, isRequired: true },
    ostrs: {
      kind: 'scalar',
      type: 'String',
      isList: true,
      isRequired: false,
    },
    blobs: { kind: 'scalar', type: 'Bytes', isList: true, isRequired: true },
    jarr: { kind: 'scalar', type: 'Json', isList: true, isRequired: true },
    ojarr: { kind: 'scalar', type: 'Json', isList: true, isRequired: false },
    meta: { kind: 'scalar', type: 'Json', isList: false, isRequired: true },
    dec: { kind: 'scalar', type: 'Decimal', isList: false, isRequired: true },
    big: { kind: 'scalar', type: 'BigInt', isList: false, isRequired: true },
  },
} as const

function metasFromMaps(
  maps: Record<string, Record<string, unknown>>,
  uniqueMap: Record<
    string,
    ReadonlyArray<{ selector: string; fields: readonly string[] }>
  >,
  enums: ReadonlyMap<string, readonly string[]> = new Map(),
): Map<string, SchemaModelMeta> {
  const index = new Map<string, SchemaModelMeta>()
  for (const [name, fields] of Object.entries(maps)) {
    index.set(name, {
      name,
      fields: Object.entries(fields).map(([fname, meta]) => ({
        name: fname,
        ...(meta as Record<string, unknown>),
      })) as never,
      enums,
      uniqueFields: Object.entries(fields)
        .filter(
          ([, m]) =>
            (m as { isId?: boolean; isUnique?: boolean }).isId ||
            (m as { isUnique?: boolean }).isUnique,
        )
        .map(([fname]) => fname),
      compoundUniques: (uniqueMap[name] ?? []).map((c) => ({
        selector: c.selector,
        fields: [...c.fields],
      })),
      modelIndex: index,
    })
  }
  return index
}

async function loadRelGuard() {
  const mod = (await import(
    /* @vite-ignore */ pathToFileURL(GUARD_RUNTIME).href
  )) as unknown as RuntimeMaps
  const uniqueMap = {
    Plant: [{ selector: 'id', fields: ['id'] }],
    OrderItem: [{ selector: 'id', fields: ['id'] }],
    Nursery: [{ selector: 'id', fields: ['id'] }],
    Customer: [
      { selector: 'id', fields: ['id'] },
      { selector: 'email', fields: ['email'] },
    ],
    Named: [{ selector: 'id', fields: ['id'] }],
    Tag: [{ selector: 'id', fields: ['id'] }],
  }
  const enumMap = { Color: ['RED', 'GREEN'] }
  const namedMap = {
    ...uniqueMap,
    Plant: [
      { selector: 'id', fields: ['id'] },
      { selector: 'NamePrice', fields: ['name', 'priceCents'] },
    ],
  }
  return {
    guard: mod.createGuard({
      typeMap: REL_MAPS,
      uniqueMap,
      scopeMap: { backoffice: { '*': true } },
      guardConfig: {},
      enumMap,
      zodChains: {},
      zodDefaults: {},
    }),
    named: mod.createGuard({
      typeMap: REL_MAPS,
      uniqueMap: namedMap,
      scopeMap: { backoffice: { '*': true } },
      guardConfig: {},
      enumMap,
      zodChains: {},
      zodDefaults: {},
    }),
    metaIndex: metasFromMaps(
      REL_MAPS as unknown as Record<string, Record<string, unknown>>,
      uniqueMap,
      new Map(Object.entries(enumMap)),
    ),
    namedIndex: metasFromMaps(
      REL_MAPS as unknown as Record<string, Record<string, unknown>>,
      namedMap,
      new Map(Object.entries(enumMap)),
    ),
  }
}

interface RelFixture {
  label: string
  model: string
  method: string
  shape: Record<string, unknown>
  body: Record<string, unknown>
  bothAccept: boolean
  named?: boolean
}

const REL_FIXTURES: RelFixture[] = [
  {
    label: 'two flat selectors sent together',
    model: 'Customer',
    method: 'findUnique',
    shape: { where: { id: true, email: true } },
    body: { where: { id: 'x', email: 'y' } },
    bothAccept: true,
  },
  {
    label: 'client-controlled selectors with no where rejected',
    model: 'Customer',
    method: 'findUnique',
    shape: { where: { id: true, email: true } },
    body: {},
    bothAccept: false,
  },
  {
    label: 'named compound constraint selector',
    model: 'Plant',
    method: 'findUnique',
    shape: { where: { NamePrice: { name: true, priceCents: true } } },
    body: { where: { NamePrice: { name: 'a', priceCents: 1 } } },
    bothAccept: true,
    named: true,
  },
  {
    label: 'forced-only relation condition accepts empty condition',
    model: 'Plant',
    method: 'findMany',
    shape: {
      where: { orderItems: { some: { quantity: { equals: 5 } } } },
      take: { max: 5 },
    },
    body: { where: { orderItems: { some: {} } }, take: 2 },
    bothAccept: true,
  },
  {
    label: 'forced-only relation accepts empty where',
    model: 'Plant',
    method: 'findMany',
    shape: {
      where: { orderItems: { some: { quantity: { equals: 5 } } } },
      take: { max: 5 },
    },
    body: { where: {}, take: 2 },
    bothAccept: true,
  },
  {
    label: 'combinator AND array input',
    model: 'Plant',
    method: 'findMany',
    shape: {
      where: { AND: { name: { contains: true } } },
      take: { max: 5 },
    },
    body: { where: { AND: [{ name: { contains: 'x' } }] }, take: 2 },
    bothAccept: true,
  },
  {
    label: 'combinator AND empty array rejected by both',
    model: 'Plant',
    method: 'findMany',
    shape: {
      where: { AND: { name: { contains: true } } },
      take: { max: 5 },
    },
    body: { where: { AND: [] }, take: 2 },
    bothAccept: false,
  },
  {
    label: 'combinator NOT object input',
    model: 'Plant',
    method: 'findMany',
    shape: {
      where: { NOT: { name: { contains: true } } },
      take: { max: 5 },
    },
    body: { where: { NOT: { name: { contains: 'x' } } }, take: 2 },
    bothAccept: true,
  },
  {
    label: 'string operator with mode',
    model: 'Plant',
    method: 'findMany',
    shape: { where: { name: { contains: true } }, take: { max: 5 } },
    body: {
      where: { name: { contains: 'x', mode: 'insensitive' } },
      take: 2,
    },
    bothAccept: true,
  },
  {
    label: 'mode on non-string operator rejected by both',
    model: 'Plant',
    method: 'findMany',
    shape: { where: { priceCents: { gte: true } }, take: { max: 5 } },
    body: { where: { priceCents: { gte: 1, mode: 'insensitive' } }, take: 2 },
    bothAccept: false,
  },
  {
    label: 'nested filter under not',
    model: 'Plant',
    method: 'findMany',
    shape: { where: { name: { not: true } }, take: { max: 5 } },
    body: { where: { name: { not: { contains: 'x' } } }, take: 2 },
    bothAccept: true,
  },
  {
    label: 'nested cursor in projection',
    model: 'Plant',
    method: 'findMany',
    shape: {
      select: { orderItems: { cursor: { id: true }, take: { max: 3 } } },
      take: { max: 5 },
    },
    body: {
      select: { orderItems: { cursor: { id: 'a' }, take: 2 } },
      take: 2,
    },
    bothAccept: true,
  },
  {
    label: 'select _count literal true',
    model: 'Plant',
    method: 'findMany',
    shape: { select: { _count: true }, take: { max: 5 } },
    body: { select: { _count: true }, take: 2 },
    bothAccept: true,
  },
  {
    label: 'select _count select-form',
    model: 'Plant',
    method: 'findMany',
    shape: {
      select: { _count: { select: { orderItems: true } } },
      take: { max: 5 },
    },
    body: { select: { _count: { select: { orderItems: true } } }, take: 2 },
    bothAccept: true,
  },
  {
    label: 'select _count empty select rejected by both',
    model: 'Plant',
    method: 'findMany',
    shape: {
      select: { _count: { select: { orderItems: true } } },
      take: { max: 5 },
    },
    body: { select: { _count: { select: {} } }, take: 2 },
    bothAccept: false,
  },
  {
    label: 'include _count literal true',
    model: 'Plant',
    method: 'findMany',
    shape: { include: { _count: true }, take: { max: 5 } },
    body: { include: { _count: true }, take: 2 },
    bothAccept: true,
  },
  {
    label: 'orderBy to-many _count',
    model: 'Plant',
    method: 'findMany',
    shape: { orderBy: { orderItems: { _count: true } }, take: { max: 5 } },
    body: { orderBy: { orderItems: { _count: 'desc' } }, take: 2 },
    bothAccept: true,
  },
  {
    label: 'orderBy to-one nested field',
    model: 'Plant',
    method: 'findMany',
    shape: { orderBy: { nursery: { name: true } }, take: { max: 5 } },
    body: { orderBy: { nursery: { name: 'asc' } }, take: 2 },
    bothAccept: true,
  },
  {
    label: 'scalar list has/hasSome operators',
    model: 'Plant',
    method: 'findMany',
    shape: { where: { tags: { has: true, hasSome: true } }, take: { max: 5 } },
    body: { where: { tags: { has: 'x' } }, take: 2 },
    bothAccept: true,
  },
  {
    label: 'scalar list in operator rejected by both',
    model: 'Plant',
    method: 'findMany',
    shape: { where: { tags: { in: true } }, take: { max: 5 } },
    body: { where: { tags: { in: [['x']] } }, take: 2 },
    bothAccept: false,
  },
  {
    label: 'scalar list equals accepts a bare array',
    model: 'Plant',
    method: 'findMany',
    shape: { where: { tags: { equals: true } }, take: { max: 5 } },
    body: { where: { tags: ['x'] }, take: 2 },
    bothAccept: true,
  },
  {
    label: 'mode literal config: client-sent mode rejected by both',
    model: 'Plant',
    method: 'findMany',
    shape: {
      where: { name: { contains: true, mode: 'insensitive' } },
      take: { max: 5 },
    },
    body: { where: { name: { contains: 'x', mode: 'insensitive' } }, take: 2 },
    bothAccept: false,
  },
  {
    label: 'mode literal config: omitted mode accepted by both',
    model: 'Plant',
    method: 'findMany',
    shape: {
      where: { name: { contains: true, mode: 'insensitive' } },
      take: { max: 5 },
    },
    body: { where: { name: { contains: 'x' } }, take: 2 },
    bothAccept: true,
  },
  {
    label: 'AND member empty object rejected by both (client config)',
    model: 'Plant',
    method: 'findMany',
    shape: { where: { AND: { name: { contains: true } } }, take: { max: 5 } },
    body: { where: { AND: [{ name: { contains: 'x' } }, {}] }, take: 2 },
    bothAccept: false,
  },
  {
    label: 'AND member empty object accepted by both (forced config)',
    model: 'Plant',
    method: 'findMany',
    shape: {
      where: { AND: { isDeleted: { equals: false } } },
      take: { max: 5 },
    },
    body: { where: { AND: [{}] }, take: 2 },
    bothAccept: true,
  },
  {
    label: 'to-one is null forced, sent and omitted',
    model: 'Plant',
    method: 'findMany',
    shape: { where: { nursery: { is: null } }, take: { max: 5 } },
    body: { where: { nursery: { is: null } }, take: 2 },
    bothAccept: true,
  },
  {
    label: 'empty is body rejected by both (client config)',
    model: 'Plant',
    method: 'findMany',
    shape: {
      where: { nursery: { is: { name: { contains: true } } } },
      take: { max: 5 },
    },
    body: { where: { nursery: { is: {} } }, take: 2 },
    bothAccept: false,
  },
  {
    label: 'hasSome with an empty array accepted by both',
    model: 'Plant',
    method: 'findMany',
    shape: { where: { tags: { hasSome: true } }, take: { max: 5 } },
    body: { where: { tags: { hasSome: [] } }, take: 2 },
    bothAccept: true,
  },
  {
    label: 'filtered count with literal true input accepted by both',
    model: 'Plant',
    method: 'findMany',
    shape: {
      select: {
        _count: {
          select: { orderItems: { where: { quantity: { gte: true } } } },
        },
      },
      take: { max: 5 },
    },
    body: { select: { _count: { select: { orderItems: true } } }, take: 2 },
    bothAccept: true,
  },
  {
    label: 'filtered count with {where:{}} input accepted by both',
    model: 'Plant',
    method: 'findMany',
    shape: {
      select: {
        _count: {
          select: { orderItems: { where: { quantity: { gte: true } } } },
        },
      },
      take: { max: 5 },
    },
    body: {
      select: { _count: { select: { orderItems: { where: {} } } } },
      take: 2,
    },
    bothAccept: true,
  },
  {
    label: 'nested select inside a list relation entry accepted by both',
    model: 'Plant',
    method: 'findMany',
    shape: {
      select: { orderItems: { select: { id: true } } },
      take: { max: 5 },
    },
    body: { select: { orderItems: { select: { id: true } } }, take: 2 },
    bothAccept: true,
  },
  {
    label: 'nested skip:true and object take accepted by both',
    model: 'Plant',
    method: 'findMany',
    shape: {
      select: { orderItems: { skip: true, take: { max: 2 } } },
      take: { max: 5 },
    },
    body: { select: { orderItems: { skip: 1, take: 1 } }, take: 2 },
    bothAccept: true,
  },
  {
    label: 'to-one nested select projection accepted by both',
    model: 'Plant',
    method: 'findMany',
    shape: {
      select: { nursery: { select: { name: true } } },
      take: { max: 5 },
    },
    body: { select: { nursery: { select: { name: true } } }, take: 2 },
    bothAccept: true,
  },
  {
    label: 'enum in with valid member (round-7 real-runtime correction)',
    model: 'Tag',
    method: 'findMany',
    shape: { where: { color: { in: true } }, take: { max: 5 } },
    body: { where: { color: { in: ['RED'] } }, take: 2 },
    bothAccept: true,
  },
  {
    label: 'enum in with invalid member rejected by both',
    model: 'Tag',
    method: 'findMany',
    shape: { where: { color: { in: true } }, take: { max: 5 } },
    body: { where: { color: { in: ['NOPE'] } }, take: 2 },
    bothAccept: false,
  },
  {
    label: 'enum notIn with valid member',
    model: 'Tag',
    method: 'findMany',
    shape: { where: { color: { notIn: true } }, take: { max: 5 } },
    body: { where: { color: { notIn: ['GREEN'] } }, take: 2 },
    bothAccept: true,
  },
  {
    label: 'enum in scalar input rejected by both',
    model: 'Tag',
    method: 'findMany',
    shape: { where: { color: { in: true } }, take: { max: 5 } },
    body: { where: { color: { in: 'RED' } }, take: 2 },
    bothAccept: false,
  },
  {
    label: 'Int in coerced numeric string accepted by both',
    model: 'Tag',
    method: 'findMany',
    shape: { where: { nums: { in: true } }, take: { max: 5 } },
    body: { where: { nums: { in: [1, '2'] } }, take: 2 },
    bothAccept: true,
  },
  {
    label: 'Int in non-numeric string rejected by both',
    model: 'Tag',
    method: 'findMany',
    shape: { where: { nums: { in: true } }, take: { max: 5 } },
    body: { where: { nums: { in: [1, 'x'] } }, take: 2 },
    bothAccept: false,
  },
  {
    label: 'Int in float member rejected by both',
    model: 'Tag',
    method: 'findMany',
    shape: { where: { nums: { in: true } }, take: { max: 5 } },
    body: { where: { nums: { in: [1.5] } }, take: 2 },
    bothAccept: false,
  },
  {
    label: 'nested not coerced numeric string accepted by both (forced)',
    model: 'Tag',
    method: 'findMany',
    shape: { where: { nums: { not: { gte: '2' } } }, take: { max: 5 } },
    body: { take: 2 },
    bothAccept: true,
  },
  {
    label: 'enum nested not in accepted by both (forced)',
    model: 'Tag',
    method: 'findMany',
    shape: { where: { color: { not: { in: ['RED'] } } }, take: { max: 5 } },
    body: { take: 2 },
    bothAccept: true,
  },
  {
    label: 'optional equals null accepted by both',
    model: 'Tag',
    method: 'findMany',
    shape: { where: { opt: { equals: true } }, take: { max: 5 } },
    body: { where: { opt: { equals: null } }, take: 2 },
    bothAccept: true,
  },
  {
    label: 'optional contains null rejected by both',
    model: 'Tag',
    method: 'findMany',
    shape: { where: { opt: { contains: true } }, take: { max: 5 } },
    body: { where: { opt: { contains: null } }, take: 2 },
    bothAccept: false,
  },
  {
    label: 'optional not null accepted by both',
    model: 'Tag',
    method: 'findMany',
    shape: { where: { opt: { not: true } }, take: { max: 5 } },
    body: { where: { opt: { not: null } }, take: 2 },
    bothAccept: true,
  },
  {
    label: 'optional in null item accepted by both',
    model: 'Tag',
    method: 'findMany',
    shape: { where: { opt: { in: true } }, take: { max: 5 } },
    body: { where: { opt: { in: [null, 'a'] } }, take: 2 },
    bothAccept: true,
  },
  {
    label: 'required in null item rejected by both',
    model: 'Tag',
    method: 'findMany',
    shape: { where: { name: { in: true } }, take: { max: 5 } },
    body: { where: { name: { in: [null] } }, take: 2 },
    bothAccept: false,
  },
  {
    label: 'String contains coerced number accepted by both',
    model: 'Tag',
    method: 'findMany',
    shape: { where: { id: { contains: true } }, take: { max: 5 } },
    body: { where: { id: { contains: 5 } }, take: 2 },
    bothAccept: true,
  },
  {
    label: 'optional Int equals coerced string accepted by both',
    model: 'Tag',
    method: 'findMany',
    shape: { where: { optn: { equals: true } }, take: { max: 5 } },
    body: { where: { optn: { equals: '5' } }, take: 2 },
    bothAccept: true,
  },
  {
    label: 'nested not equals null on optional accepted by both (forced)',
    model: 'Tag',
    method: 'findMany',
    shape: { where: { opt: { not: { equals: null } } }, take: { max: 5 } },
    body: { take: 2 },
    bothAccept: true,
  },
  {
    label: 'optional enum in [null] accepted by both',
    model: 'Tag',
    method: 'findMany',
    shape: { where: { ocolor: { in: true } }, take: { max: 5 } },
    body: { where: { ocolor: { in: [null] } }, take: 2 },
    bothAccept: true,
  },
  {
    label: 'required enum in [null] rejected by both',
    model: 'Tag',
    method: 'findMany',
    shape: { where: { color: { in: true } }, take: { max: 5 } },
    body: { where: { color: { in: [null] } }, take: 2 },
    bothAccept: false,
  },
  {
    label: 'required Json array_contains null accepted by both',
    model: 'Tag',
    method: 'findMany',
    shape: { where: { meta: { array_contains: true } }, take: { max: 5 } },
    body: { where: { meta: { array_contains: null } }, take: 2 },
    bothAccept: true,
  },
  {
    label: 'Json string_contains null rejected by both',
    model: 'Tag',
    method: 'findMany',
    shape: { where: { meta: { string_contains: true } }, take: { max: 5 } },
    body: { where: { meta: { string_contains: null } }, take: 2 },
    bothAccept: false,
  },
  {
    label: 'scalar-list equals items are not coerced (rejected by both)',
    model: 'Tag',
    method: 'findMany',
    shape: { where: { strs: { equals: true } }, take: { max: 5 } },
    body: { where: { strs: { equals: ['a', 5] } }, take: 2 },
    bothAccept: false,
  },
  {
    label: 'enum-list has member accepted by both',
    model: 'Tag',
    method: 'findMany',
    shape: { where: { colors: { has: true } }, take: { max: 5 } },
    body: { where: { colors: { has: 'RED' } }, take: 2 },
    bothAccept: true,
  },
  {
    label: 'enum-list has non-member rejected by both',
    model: 'Tag',
    method: 'findMany',
    shape: { where: { colors: { has: true } }, take: { max: 5 } },
    body: { where: { colors: { has: 'NOPE' } }, take: 2 },
    bothAccept: false,
  },
  {
    label: 'Decimal number input accepted by both',
    model: 'Tag',
    method: 'findMany',
    shape: { where: { dec: { equals: true } }, take: { max: 5 } },
    body: { where: { dec: { equals: 1.5 } }, take: 2 },
    bothAccept: true,
  },
  {
    label: 'Decimal garbage string rejected by both',
    model: 'Tag',
    method: 'findMany',
    shape: { where: { dec: { equals: true } }, take: { max: 5 } },
    body: { where: { dec: { equals: 'x' } }, take: 2 },
    bothAccept: false,
  },
  {
    label: 'BigInt beyond safe integer rejected by both',
    model: 'Tag',
    method: 'findMany',
    shape: { where: { big: { equals: true } }, take: { max: 5 } },
    body: { where: { big: { equals: 9007199254740993 } }, take: 2 },
    bothAccept: false,
  },
  {
    label: 'BigInt big numeric string accepted by both',
    model: 'Tag',
    method: 'findMany',
    shape: { where: { big: { equals: true } }, take: { max: 5 } },
    body: { where: { big: { equals: '9007199254740993' } }, take: 2 },
    bothAccept: true,
  },
  {
    label: 'Bytes[] has accepts a string by both',
    model: 'Tag',
    method: 'findMany',
    shape: { where: { blobs: { has: true } }, take: { max: 5 } },
    body: { where: { blobs: { has: 'aGk=' } }, take: 2 },
    bothAccept: true,
  },
  {
    label: 'Bytes[] equals accepts an array by both',
    model: 'Tag',
    method: 'findMany',
    shape: { where: { blobs: { equals: true } }, take: { max: 5 } },
    body: { where: { blobs: { equals: ['aGk='] } }, take: 2 },
    bothAccept: true,
  },
  {
    label: 'optional list equals [null] rejected by both (items never null)',
    model: 'Tag',
    method: 'findMany',
    shape: { where: { ostrs: { equals: true } }, take: { max: 5 } },
    body: { where: { ostrs: { equals: [null] } }, take: 2 },
    bothAccept: false,
  },
  {
    label: 'optional list equals whole-null accepted by both',
    model: 'Tag',
    method: 'findMany',
    shape: { where: { ostrs: { equals: true } }, take: { max: 5 } },
    body: { where: { ostrs: { equals: null } }, take: 2 },
    bothAccept: true,
  },
  {
    label: 'optional enum[] equals members accepted by both',
    model: 'Tag',
    method: 'findMany',
    shape: { where: { colors: { equals: true } }, take: { max: 5 } },
    body: { where: { colors: { equals: ['RED'] } }, take: 2 },
    bothAccept: true,
  },
  {
    label: 'enum[] hasSome members accepted by both',
    model: 'Tag',
    method: 'findMany',
    shape: { where: { colors: { hasSome: true } }, take: { max: 5 } },
    body: { where: { colors: { hasSome: ['RED', 'GREEN'] } }, take: 2 },
    bothAccept: true,
  },
  {
    label: 'deep relation chain filter',
    model: 'Plant',
    method: 'findMany',
    shape: {
      where: {
        nursery: { is: { plants: { some: { name: { contains: true } } } } },
      },
      take: { max: 5 },
    },
    body: {
      where: {
        nursery: { is: { plants: { some: { name: { contains: 'x' } } } } },
      },
      take: 2,
    },
    bothAccept: true,
  },
]

// ---------------------------------------------------------------------------
// FORCED-config parity: the shape's own literal values are validated by
// guard at query() compile time; registration must agree — filterWhere-
// ConfigProblem accepts exactly the configs guard compiles.
// ---------------------------------------------------------------------------

interface ForcedFixture {
  label: string
  model: string
  where: Record<string, unknown>
  guardCompiles: boolean
}

const FORCED_FIXTURES: ForcedFixture[] = [
  {
    label: 'enum[] forced equals members',
    model: 'Tag',
    where: { colors: { equals: ['RED'] } },
    guardCompiles: true,
  },
  {
    label: 'enum[] forced equals non-member',
    model: 'Tag',
    where: { colors: { equals: ['NOPE'] } },
    guardCompiles: false,
  },
  {
    label: 'enum[] forced hasSome members',
    model: 'Tag',
    where: { colors: { hasSome: ['RED', 'GREEN'] } },
    guardCompiles: true,
  },
  {
    label: 'enum[] forced hasSome non-member',
    model: 'Tag',
    where: { colors: { hasSome: ['RED', 'NOPE'] } },
    guardCompiles: false,
  },
  {
    label: 'enum[] forced isEmpty',
    model: 'Tag',
    where: { colors: { isEmpty: true } },
    guardCompiles: true,
  },
  {
    label: 'enum[] forced has member',
    model: 'Tag',
    where: { colors: { has: 'GREEN' } },
    guardCompiles: true,
  },
  {
    label: 'required Json[] forced equals null (whole) rejected',
    model: 'Tag',
    where: { jarr: { equals: null } },
    guardCompiles: false,
  },
  {
    label: 'optional Json[] forced equals null (whole) accepted',
    model: 'Tag',
    where: { ojarr: { equals: null } },
    guardCompiles: true,
  },
  {
    label: 'Json[] forced equals array',
    model: 'Tag',
    where: { jarr: { equals: [{ a: 1 }] } },
    guardCompiles: true,
  },
  {
    label: 'Bytes[] forced has string',
    model: 'Tag',
    where: { blobs: { has: 'aGk=' } },
    guardCompiles: true,
  },
  {
    label: 'optional String[] forced equals whole null',
    model: 'Tag',
    where: { ostrs: { equals: null } },
    guardCompiles: true,
  },
  {
    label: 'optional String[] forced equals [null] rejected',
    model: 'Tag',
    where: { ostrs: { equals: [null] } },
    guardCompiles: false,
  },
]

describe('forced-config parity (prisma-guard 1.33 runtime)', () => {
  for (const fixture of FORCED_FIXTURES) {
    const compiles = fixture.guardCompiles
    it(`${fixture.label}: guard and validator ${compiles ? 'accept' : 'reject'}`, async () => {
      const h = await loadRelGuard()
      const meta = h.metaIndex.get(fixture.model)
      expect(meta).toBeDefined()

      // guard side: query() compiles the shape config
      let guardOk = true
      let guardErr = ''
      try {
        h.guard
          .query(
            fixture.model as never,
            'findMany' as never,
            {
              where: fixture.where,
              take: { max: 5 },
            } as never,
          )
          .parse({ take: 2 }, { caller: 'backoffice' })
      } catch (error) {
        guardOk = false
        guardErr = (error as Error).message
      }
      expect(
        guardOk,
        `guard ${guardOk ? 'accepted' : 'rejected'}: ${guardErr}`,
      ).toBe(compiles)

      // validator side: registration must agree
      const problem = filterWhereConfigProblem(
        meta as SchemaModelMeta,
        fixture.where,
      )
      expect(problem === null, `validator said: ${problem}`).toBe(compiles)
    }, 30_000)
  }
})

function cursorOnly(meta: SchemaModelMeta, cursor: unknown): string | null {
  return argsShapeConfigProblem(meta, 'findMany', { cursor })
}

describe('guard-shape validator parity (prisma-guard 1.33 runtime)', () => {
  it('compound selector configs must configure every constraint field', async () => {
    const h = await loadRelGuard()
    // guard rejects the incomplete config outright
    let guardOk = true
    try {
      h.named
        .query(
          'Plant' as never,
          'findUnique' as never,
          {
            where: { name_priceCents: { name: true } },
          } as never,
        )
        .parse(
          { where: { name_priceCents: { name: 'a' } } },
          { caller: 'backoffice' },
        )
    } catch {
      guardOk = false
    }
    expect(guardOk).toBe(false)
    // registration refuses the same config
    const meta = h.namedIndex.get('Plant')
    expect(meta).toBeDefined()
    expect(
      findUniqueWhereConfigProblem(meta as SchemaModelMeta, {
        NamePrice: { name: true },
      }),
    ).toMatch(/missing field "priceCents"/)
    expect(
      findUniqueWhereConfigProblem(meta as SchemaModelMeta, {
        NamePrice: { name: true, priceCents: true },
      }),
    ).toBeNull()
  })

  it('forced values are type-checked like guard checks them', () => {
    const intField: SchemaFieldMeta = {
      name: 'priceCents',
      kind: 'scalar',
      type: 'Int',
      isList: false,
      isRequired: true,
    }
    const meta: SchemaModelMeta = {
      name: 'Plant',
      fields: [intField],
      enums: new Map(),
      uniqueFields: [],
      compoundUniques: [],
      modelIndex: new Map(),
    }
    expect(forcedValueMatchesField(meta, intField, 5)).toBe(true)
    expect(forcedValueMatchesField(meta, intField, '5')).toBe(false)
    expect(
      forcedValueMatchesField(meta, intField, {
        [Symbol.for('prisma-guard.forced')]: true,
        value: 'x',
      }),
    ).toBe(false)
    expect(
      filterWhereConfigProblem(meta, { priceCents: { equals: 'x' } }),
    ).toMatch(/does not match the (field type|operator)/)
  })

  it('unknown and incompatible operators are refused', () => {
    const meta: SchemaModelMeta = {
      name: 'Plant',
      fields: [
        {
          name: 'name',
          kind: 'scalar',
          type: 'String',
          isList: false,
          isRequired: true,
        },
        {
          name: 'priceCents',
          kind: 'scalar',
          type: 'Int',
          isList: false,
          isRequired: true,
        },
        {
          name: 'tags',
          kind: 'scalar',
          type: 'String',
          isList: true,
          isRequired: true,
        },
      ] as never,
      enums: new Map(),
      uniqueFields: [],
      compoundUniques: [],
      modelIndex: new Map(),
    }
    expect(filterWhereConfigProblem(meta, { name: { bogus: true } })).toMatch(
      /not supported/,
    )
    expect(
      filterWhereConfigProblem(meta, { priceCents: { contains: true } }),
    ).toMatch(/not supported/)
    expect(filterWhereConfigProblem(meta, { tags: { in: true } })).toMatch(
      /not supported/,
    )
    expect(filterWhereConfigProblem(meta, { name: {} })).toMatch(
      /at least one operator/,
    )
    expect(
      filterWhereConfigProblem(meta, { name: { mode: 'insensitive' } }),
    ).toMatch(/only "mode"/)
    expect(
      filterWhereConfigProblem(meta, {
        name: { contains: true, mode: 'bogus' },
      }),
    ).toMatch(/mode/)
    expect(
      filterWhereConfigProblem(meta, { name: { contains: true } }),
    ).toBeNull()
    expect(filterWhereConfigProblem(meta, { tags: { has: true } })).toBeNull()
  })

  it('negating relation operators refuse forced values', async () => {
    const h = await loadRelGuard()
    // guard rejects forced under none and isNot ("mixes client-controlled
    // and forced"), even when the config is forced-only
    for (const cfg of [
      { orderItems: { none: { quantity: { equals: 5 } } } },
      { nursery: { isNot: { name: { equals: 'x' } } } },
    ]) {
      let guardOk = true
      try {
        h.guard
          .query(
            'Plant' as never,
            'findMany' as never,
            { where: cfg, take: { max: 5 } } as never,
          )
          .parse({ take: 2 }, { caller: 'backoffice' })
      } catch {
        guardOk = false
      }
      expect(guardOk).toBe(false)
      expect(
        filterWhereConfigProblem(
          h.metaIndex.get('Plant') as SchemaModelMeta,
          cfg,
        ),
      ).toMatch(/cannot carry forced values/)
    }
    // is: null stays legal (forced null)
    expect(
      filterWhereConfigProblem(h.metaIndex.get('Plant') as SchemaModelMeta, {
        nursery: { is: null },
      }),
    ).toBeNull()
  })

  it('round-6 semantics: count keys/_all, unique null, operator surface, exclusivity', () => {
    const meta: SchemaModelMeta = {
      name: 'Doc',
      fields: [
        {
          name: 'id',
          kind: 'scalar',
          type: 'String',
          isList: false,
          isRequired: true,
          isId: true,
          isUnique: true,
        },
        {
          name: 'name',
          kind: 'scalar',
          type: 'String',
          isList: false,
          isRequired: true,
        },
        {
          name: 'opt',
          kind: 'scalar',
          type: 'String',
          isList: false,
          isRequired: false,
        },
        {
          name: 'meta',
          kind: 'scalar',
          type: 'Json',
          isList: false,
          isRequired: true,
        },
        {
          name: 'color',
          kind: 'enum',
          type: 'Color',
          isList: false,
          isRequired: true,
        },
        {
          name: 'nums',
          kind: 'scalar',
          type: 'Int',
          isList: false,
          isRequired: true,
        },
        {
          name: 'items',
          kind: 'object',
          type: 'Item',
          isList: true,
          isRequired: true,
        },
      ] as never,
      enums: new Map([['Color', ['RED', 'GREEN']]]),
      uniqueFields: ['id'],
      compoundUniques: [],
      modelIndex: new Map([
        [
          'Item',
          {
            name: 'Item',
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
                name: 'plant',
                kind: 'object',
                type: 'Doc',
                isList: false,
                isRequired: true,
              },
            ] as never,
            enums: new Map(),
            uniqueFields: ['id'],
            compoundUniques: [],
            modelIndex: new Map(),
          },
        ],
      ]),
    }

    // count: cursor+skip are guard-supported shape keys; _all is a legal
    // count-select key alongside scalars
    expect(
      argsShapeConfigProblem(meta, 'count', {
        where: { name: { contains: true } },
        cursor: { id: true },
        skip: true,
      }),
    ).toBeNull()
    expect(
      argsShapeConfigProblem(meta, 'count', { select: { _all: true } }),
    ).toBeNull()
    expect(
      argsShapeConfigProblem(meta, 'count', {
        select: { _all: true, name: true },
      }),
    ).toBeNull()
    expect(
      argsShapeConfigProblem(meta, 'count', { select: { _all: 1 } }),
    ).toMatch(/_all.*must be true/)
    expect(
      argsShapeConfigProblem(meta, 'count', { select: { items: true } }),
    ).toMatch(/must be a scalar/)

    // unique-selector forced null is guard-rejected
    expect(findUniqueWhereConfigProblem(meta, { id: null })).toMatch(
      /does not match the field type/,
    )
    // ...but Json and OPTIONAL fields accept null in filter operators
    expect(
      filterWhereConfigProblem(meta, { meta: { equals: null } }),
    ).toBeNull()
    expect(filterWhereConfigProblem(meta, { opt: { equals: null } })).toBeNull()
    expect(filterWhereConfigProblem(meta, { name: { equals: null } })).toMatch(
      /operator/,
    )

    // operator surface: String search, Json array_* and strict path,
    // enum equals/not only
    expect(
      filterWhereConfigProblem(meta, { name: { search: true } }),
    ).toBeNull()
    expect(
      filterWhereConfigProblem(meta, { meta: { array_starts_with: true } }),
    ).toBeNull()
    expect(
      filterWhereConfigProblem(meta, { meta: { array_ends_with: 42 } }),
    ).toBeNull()
    expect(
      filterWhereConfigProblem(meta, { meta: { array_contains: 'x' } }),
    ).toBeNull()
    expect(filterWhereConfigProblem(meta, { meta: { path: [] } })).toMatch(
      /operator/,
    )
    expect(
      filterWhereConfigProblem(meta, { meta: { path: ['a', 1] } }),
    ).toMatch(/operator/)
    // enum in/notIn ARE supported (round-7 correction: the round-6 probe
    // omitted isEnum, producing a false rejection)
    expect(filterWhereConfigProblem(meta, { color: { in: true } })).toBeNull()
    expect(
      filterWhereConfigProblem(meta, { color: { notIn: true } }),
    ).toBeNull()
    expect(filterWhereConfigProblem(meta, { color: { gte: true } })).toMatch(
      /not supported/,
    )
    expect(filterWhereConfigProblem(meta, { color: { not: true } })).toBeNull()

    // forced nested `not` with plain literal object is legal
    expect(
      filterWhereConfigProblem(meta, { name: { not: { contains: 'x' } } }),
    ).toBeNull()
    expect(
      filterWhereConfigProblem(meta, {
        name: {
          not: {
            contains: { [Symbol.for('prisma-guard.forced')]: true, value: 'x' },
          },
        },
      }),
    ).toMatch(/operator/)

    // nested `not` config validation mirrors guard exactly
    expect(
      filterWhereConfigProblem(meta, { nums: { not: { bogus: 'x' } } }),
    ).toMatch(/operator/)
    expect(
      filterWhereConfigProblem(meta, { nums: { not: { gte: 'x' } } }),
    ).toMatch(/operator/)
    expect(
      filterWhereConfigProblem(meta, { nums: { not: { not: 1 } } }),
    ).toMatch(/operator/)
    expect(
      filterWhereConfigProblem(meta, { nums: { not: { gte: '2' } } }),
    ).toBeNull()
    // enum in/notIn member validation
    expect(filterWhereConfigProblem(meta, { color: { in: ['NOPE'] } })).toMatch(
      /operator/,
    )
    expect(
      filterWhereConfigProblem(meta, { color: { in: ['RED'] } }),
    ).toBeNull()
    expect(filterWhereConfigProblem(meta, { nums: { in: [1, 'x'] } })).toMatch(
      /operator/,
    )
    expect(
      filterWhereConfigProblem(meta, { nums: { in: [1, '2'] } }),
    ).toBeNull()

    // nested select/include exclusivity and exact _count keys
    expect(
      argsShapeConfigProblem(meta, 'findMany', {
        select: { items: { select: { id: true }, include: { plant: true } } },
      }),
    ).toMatch(/cannot define both/)
    expect(
      argsShapeConfigProblem(meta, 'findMany', {
        select: { _count: { select: { items: true }, take: 2 } },
      }),
    ).toMatch(/only the "select" key/)

    // emitted schemas carry the same surface
    const schema = buildModelAwareArgsSchema('findMany', meta, {
      where: {
        name: { search: true },
        meta: { path: true, array_contains: true },
        color: { equals: true, in: true, notIn: true },
      },
      take: { max: 5 },
    })
    const where = schema.properties?.where as {
      properties?: Record<string, { properties?: Record<string, unknown> }>
    }
    const nameOps = where.properties?.name?.properties
    expect(nameOps && 'search' in nameOps).toBe(true)
    const metaOps = where.properties?.meta?.properties
    expect(metaOps && 'array_contains' in metaOps).toBe(true)
    expect(
      metaOps &&
        JSON.stringify((metaOps as { path?: { minItems?: number } }).path),
    ).toContain('"minItems":1')
    // equals:true wraps as anyOf [base, operator-object]
    const colorNode = where.properties?.color as {
      anyOf?: Array<{ properties?: Record<string, unknown> }>
    }
    const colorOps = colorNode?.anyOf?.[1]?.properties
    expect(colorOps && 'in' in colorOps).toBe(true)
    expect(colorOps && 'notIn' in colorOps).toBe(true)
    expect(colorOps && 'gte' in colorOps).toBe(false)
    expect(colorOps && 'equals' in colorOps).toBe(true)
  })

  it('round-9 semantics: null continuation, enum-list base, Decimal/BigInt forms', () => {
    const meta: SchemaModelMeta = {
      name: 'Tag',
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
          name: 'opt',
          kind: 'scalar',
          type: 'String',
          isList: false,
          isRequired: false,
        },
        {
          name: 'colors',
          kind: 'enum',
          type: 'Color',
          isList: true,
          isRequired: true,
        },
        {
          name: 'dec',
          kind: 'scalar',
          type: 'Decimal',
          isList: false,
          isRequired: true,
        },
        {
          name: 'big',
          kind: 'scalar',
          type: 'BigInt',
          isList: false,
          isRequired: true,
        },
      ] as never,
      enums: new Map([['Color', ['RED', 'GREEN']]]),
      uniqueFields: ['id'],
      compoundUniques: [],
      modelIndex: new Map(),
    }

    // a valid nested equals:null does not short-circuit past later
    // invalid operators
    expect(
      filterWhereConfigProblem(meta, {
        opt: { not: { equals: null, bogus: 1 } },
      }),
    ).toMatch(/operator/)
    expect(
      filterWhereConfigProblem(meta, {
        opt: { not: { equals: null, contains: 'x' } },
      }),
    ).toBeNull()

    // enum-list base is an ARRAY of enum items, not one enum scalar
    const schema = buildModelAwareArgsSchema('findMany', meta, {
      where: { colors: { has: true, equals: true } },
      take: { max: 5 },
    })
    // equals:true wraps as anyOf [bare array, operator-object]
    const colorsNode = (
      schema.properties?.where as {
        properties?: Record<string, unknown>
      }
    ).properties?.colors as {
      anyOf?: Array<{
        properties?: Record<
          string,
          { items?: { enum?: string[] }; enum?: string[] }
        >
      }>
    }
    const opObj = colorsNode?.anyOf?.[1]?.properties
    const hasNode = opObj?.has as { enum?: string[] }
    expect(hasNode?.enum).toEqual(['RED', 'GREEN'])
    const equalsNode = opObj?.equals as { items?: { enum?: string[] } }
    expect(equalsNode?.items?.enum).toEqual(['RED', 'GREEN'])
    // mode never rides along on enum fields
    expect(opObj && 'mode' in opObj).toBe(false)

    // Decimal / BigInt JSON-representable forms
    expect(filterWhereConfigProblem(meta, { dec: { equals: 1.5 } })).toBeNull()
    expect(
      filterWhereConfigProblem(meta, { dec: { equals: '1.5' } }),
    ).toBeNull()
    expect(filterWhereConfigProblem(meta, { dec: { equals: 'x' } })).toMatch(
      /operator/,
    )
    expect(filterWhereConfigProblem(meta, { big: { equals: 1 } })).toBeNull()
    expect(
      filterWhereConfigProblem(meta, { big: { equals: 9007199254740993 } }),
    ).toMatch(/operator/)
    expect(
      filterWhereConfigProblem(meta, { big: { equals: '9007199254740993' } }),
    ).toBeNull()
    expect(filterWhereConfigProblem(meta, { big: { equals: 1.5 } })).toMatch(
      /operator/,
    )
  })

  it('round-5 semantics: nested projection forms, take forms, per-op keys, operator values', () => {
    const orderItemMeta: SchemaModelMeta = {
      name: 'OrderItem',
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
          name: 'quantity',
          kind: 'scalar',
          type: 'Int',
          isList: false,
          isRequired: true,
        },
      ] as never,
      enums: new Map(),
      uniqueFields: ['id'],
      compoundUniques: [],
      modelIndex: new Map(),
    }
    const meta: SchemaModelMeta = {
      name: 'Plant',
      fields: [
        {
          name: 'id',
          kind: 'scalar',
          type: 'String',
          isList: false,
          isRequired: true,
          isId: true,
          isUnique: true,
        },
        {
          name: 'name',
          kind: 'scalar',
          type: 'String',
          isList: false,
          isRequired: true,
        },
        {
          name: 'tags',
          kind: 'scalar',
          type: 'String',
          isList: true,
          isRequired: true,
        },
        {
          name: 'meta',
          kind: 'scalar',
          type: 'Json',
          isList: false,
          isRequired: true,
        },
        {
          name: 'orderItems',
          kind: 'object',
          type: 'OrderItem',
          isList: true,
          isRequired: true,
        },
        {
          name: 'nursery',
          kind: 'object',
          type: 'Nursery',
          isList: false,
          isRequired: true,
        },
      ] as never,
      enums: new Map(),
      uniqueFields: ['id'],
      compoundUniques: [{ selector: 'name_tags', fields: ['name', 'tags'] }],
      modelIndex: new Map([
        ['OrderItem', orderItemMeta],
        [
          'Nursery',
          {
            name: 'Nursery',
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
                name: 'name',
                kind: 'scalar',
                type: 'String',
                isList: false,
                isRequired: true,
              },
            ] as never,
            enums: new Map(),
            uniqueFields: ['id'],
            compoundUniques: [],
            modelIndex: new Map(),
          },
        ],
      ]),
    }

    // nested list args: where/orderBy/take(number|object)/skip(true)/select/include
    expect(
      argsShapeConfigProblem(meta, 'findMany', {
        select: {
          orderItems: {
            where: { quantity: { gte: true } },
            orderBy: { quantity: true },
            take: { max: 3, default: 1 },
            skip: true,
            select: { id: true },
            include: undefined,
          },
        },
      }),
    ).toBeNull()
    expect(
      argsShapeConfigProblem(meta, 'findMany', {
        select: { orderItems: { skip: 2 } },
      }),
    ).toMatch(/nested skip .* must be true/)
    expect(
      argsShapeConfigProblem(meta, 'findMany', {
        select: { orderItems: { distinct: ['id'] } },
      }),
    ).toMatch(/not allowed/)
    // to-one projections: select/include only, non-empty
    expect(
      argsShapeConfigProblem(meta, 'findMany', {
        select: { nursery: { select: { name: true } } },
      }),
    ).toBeNull()
    expect(
      argsShapeConfigProblem(meta, 'findMany', {
        select: { nursery: { where: { name: { equals: true } } } },
      }),
    ).toMatch(/accepts only select\/include/)

    // take forms
    expect(argsShapeConfigProblem(meta, 'findMany', { take: -5 })).toMatch(
      /positive/,
    )
    expect(argsShapeConfigProblem(meta, 'findMany', { take: 2.5 })).toMatch(
      /positive/,
    )
    expect(
      argsShapeConfigProblem(meta, 'findMany', { take: { max: 0 } }),
    ).toMatch(/positive/)
    expect(
      argsShapeConfigProblem(meta, 'findMany', {
        take: { max: 5, default: 10 },
      }),
    ).toMatch(/default/)
    expect(
      argsShapeConfigProblem(meta, 'findMany', {
        take: { max: 5, default: 2 },
      }),
    ).toBeNull()

    // per-operation shape keys
    expect(
      argsShapeConfigProblem(meta, 'findMany', {
        where: { name: { contains: true } },
        bogus: 1,
      }),
    ).toMatch(/not a valid shape config key/)
    expect(
      argsShapeConfigProblem(meta, 'findUnique', { select: { name: true } }),
    ).toMatch(/must define "where"/)
    expect(
      argsShapeConfigProblem(meta, 'findUnique', {
        where: { id: true },
        take: 5,
      }),
    ).toMatch(/not a valid shape config key/)
    expect(
      argsShapeConfigProblem(meta, 'count', { include: { orderItems: true } }),
    ).toMatch(/not a valid shape config key/)
    expect(
      argsShapeConfigProblem(meta, 'findFirst', { distinct: ['name'] }),
    ).toBeNull()

    // compound cursor: exact key set, literal true only
    expect(
      cursorOnly(meta, { name_tags: { name: true, tags: true, id: true } }),
    ).toMatch(/exactly/)
    expect(
      cursorOnly(meta, {
        name_tags: {
          name: true,
          tags: { [Symbol.for('prisma-guard.forced')]: true, value: true },
        },
      }),
    ).toMatch(/literal true/)

    // operator-level forced values
    expect(
      filterWhereConfigProblem(meta, { name: { in: ['a', 'b'] } }),
    ).toBeNull()
    expect(filterWhereConfigProblem(meta, { name: { in: 'a' } })).toMatch(
      /operator/,
    )
    expect(filterWhereConfigProblem(meta, { tags: { has: 'x' } })).toBeNull()
    expect(filterWhereConfigProblem(meta, { tags: { has: ['x'] } })).toMatch(
      /operator/,
    )
    expect(
      filterWhereConfigProblem(meta, { tags: { hasSome: ['x'] } }),
    ).toBeNull()
    expect(
      filterWhereConfigProblem(meta, { tags: { isEmpty: true } }),
    ).toBeNull()
    expect(
      filterWhereConfigProblem(meta, { tags: { isEmpty: 'yes' } }),
    ).toMatch(/operator/)
    expect(filterWhereConfigProblem(meta, { name: { equals: null } })).toMatch(
      /operator/,
    )
    // Json operators
    expect(
      filterWhereConfigProblem(meta, { meta: { string_contains: true } }),
    ).toBeNull()
    expect(
      filterWhereConfigProblem(meta, { meta: { string_contains: 'x' } }),
    ).toBeNull()
    expect(
      filterWhereConfigProblem(meta, { meta: { contains: true } }),
    ).toMatch(/not supported/)
    // deep orderBy validates the whole tree
    expect(
      argsShapeConfigProblem(meta, 'findMany', {
        orderBy: { nursery: { name: true, nope: true } },
      }),
    ).toMatch(/unknown field "nope"/)
  })

  it('args validator refuses invalid cursor, orderBy, distinct and _count configs', () => {
    const meta: SchemaModelMeta = {
      name: 'Plant',
      fields: [
        {
          name: 'id',
          kind: 'scalar',
          type: 'String',
          isList: false,
          isRequired: true,
          isId: true,
          isUnique: true,
        },
        {
          name: 'name',
          kind: 'scalar',
          type: 'String',
          isList: false,
          isRequired: true,
        },
        {
          name: 'tags',
          kind: 'scalar',
          type: 'String',
          isList: true,
          isRequired: true,
        },
        {
          name: 'orderItems',
          kind: 'object',
          type: 'OrderItem',
          isList: true,
          isRequired: true,
        },
        {
          name: 'nursery',
          kind: 'object',
          type: 'Nursery',
          isList: false,
          isRequired: true,
        },
      ] as never,
      enums: new Map(),
      uniqueFields: ['id'],
      compoundUniques: [],
      modelIndex: new Map([
        [
          'Nursery',
          {
            name: 'Nursery',
            fields: [
              {
                name: 'id',
                kind: 'scalar',
                type: 'String',
                isList: false,
                isRequired: true,
                isId: true,
              },
            ] as never,
            enums: new Map(),
            uniqueFields: ['id'],
            compoundUniques: [],
            modelIndex: new Map(),
          },
        ],
        [
          'OrderItem',
          {
            name: 'OrderItem',
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
                name: 'quantity',
                kind: 'scalar',
                type: 'Int',
                isList: false,
                isRequired: true,
              },
            ] as never,
            enums: new Map(),
            uniqueFields: ['id'],
            compoundUniques: [],
            modelIndex: new Map(),
          },
        ],
      ]),
    }
    expect(
      argsShapeConfigProblem(meta, 'findMany', { cursor: { name: true } }),
    ).toMatch(/not a unique field/)
    expect(
      argsShapeConfigProblem(meta, 'findMany', { cursor: { id: 'lit' } }),
    ).toMatch(/must be true/)
    expect(
      argsShapeConfigProblem(meta, 'findMany', { orderBy: { name: 'asc' } }),
    ).toMatch(/must be true/)
    expect(
      argsShapeConfigProblem(meta, 'findMany', { orderBy: { tags: true } }),
    ).toMatch(/cannot be used in orderBy/)
    expect(
      argsShapeConfigProblem(meta, 'findMany', {
        orderBy: { orderItems: { name: true } },
      }),
    ).toMatch(/only supports _count/)
    expect(
      argsShapeConfigProblem(meta, 'findMany', { distinct: 'name' }),
    ).toMatch(/non-empty array/)
    expect(
      argsShapeConfigProblem(meta, 'findMany', { distinct: ['nope'] }),
    ).toMatch(/unknown field/)
    expect(
      argsShapeConfigProblem(meta, 'findMany', {
        select: { _count: { select: { nursery: true } } },
      }),
    ).toMatch(/to-one/)
    expect(argsShapeConfigProblem(meta, 'findMany', { skip: 2 })).toMatch(
      /skip/,
    )
    expect(argsShapeConfigProblem(meta, 'findMany', { skip: true })).toBeNull()
    expect(
      argsShapeConfigProblem(meta, 'findMany', {
        select: {
          _count: {
            select: { orderItems: { where: { quantity: { gte: true } } } },
          },
        },
      }),
    ).toBeNull()
  })
})

describe('filter/orderBy/projection parity (prisma-guard 1.33 runtime)', () => {
  it('guard runtime and metadata load', async () => {
    const h = await loadRelGuard()
    expect(h.guard).toBeDefined()
    expect(h.named).toBeDefined()
    expect(h.metaIndex.get('Plant')).toBeDefined()
  })

  for (const fixture of REL_FIXTURES) {
    const accept = fixture.bothAccept
    it(`${fixture.label}: guard and MCP ${accept ? 'accept' : 'reject'}`, async () => {
      const h = await loadRelGuard()
      const guard = fixture.named ? h.named : h.guard
      const metaIndex = fixture.named ? h.namedIndex : h.metaIndex
      const meta = metaIndex.get(fixture.model)
      expect(meta).toBeDefined()

      let guardOk = true
      let guardErr = ''
      try {
        guard
          .query(
            fixture.model as never,
            fixture.method as never,
            fixture.shape as never,
          )
          .parse(fixture.body, { caller: 'backoffice' })
      } catch (error) {
        guardOk = false
        guardErr = (error as Error).message
      }
      expect(
        guardOk,
        `guard ${guardOk ? 'accepted' : 'rejected'}: ${guardErr}`,
      ).toBe(accept)

      const schema = buildModelAwareArgsSchema(
        fixture.method,
        meta as SchemaModelMeta,
        fixture.shape,
      )
      const wrapped = fromJsonSchema(schema as never) as {
        '~standard': { validate: (x: unknown) => { issues?: unknown[] } }
      }
      const result = wrapped['~standard'].validate(fixture.body)
      const mcpRejected =
        result.issues !== undefined && result.issues.length > 0
      expect(
        mcpRejected,
        `MCP ${mcpRejected ? 'rejected' : 'accepted'}: ${JSON.stringify(result.issues)}`,
      ).toBe(!accept)
    }, 30_000)
  }
})

function sharedOpts(): Record<string, unknown> {
  return {
    prisma: {},
    resolveCaller: () => 'backoffice',
    authorize: () => undefined,
    defaultLimit: 5,
    maxLimit: 100,
    maxResultBytes: 1_000_000,
    authInfo: fakeAuthInfo(),
  }
}
