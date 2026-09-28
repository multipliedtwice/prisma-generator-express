import { describe, it, expect } from 'vitest'
import { force } from 'prisma-guard'
import type { McpServer } from '@modelcontextprotocol/server'
import {
  createMcpReadTool,
  createMcpWriteTool,
  registerMcpTools,
  type McpSharedOptions,
  type McpWriteOperation,
} from '../../../src/copy/mcpRuntime'
import type { OperationContext } from '../../../src/copy/operationRuntime'
import { fakeServer, fakeAuthInfo } from './mcpTestHarness'

/**
 * Phase 11 write-tool registration contract: writes exist ONLY as explicitly
 * imported contributions, the emitted input schemas mirror the guard data
 * contract (client-controlled fields only, forced values never advertised,
 * create requiredness from field defaults), and every guard-invalid or
 * unmirrorable data config refuses registration — fail closed at boot.
 */

// mirrors the parity fixture model, with defaults and optionality exercised
const fields = [
  {
    name: 'id',
    kind: 'scalar',
    type: 'String',
    isList: false,
    isRequired: true,
    isId: true,
    isUnique: true,
    hasDefaultValue: true,
  },
  {
    name: 'title',
    kind: 'scalar',
    type: 'String',
    isList: false,
    isRequired: true,
  },
  {
    name: 'siteId',
    kind: 'scalar',
    type: 'String',
    isList: false,
    isRequired: true,
  },
  {
    name: 'hidden',
    kind: 'scalar',
    type: 'Boolean',
    isList: false,
    isRequired: false,
    hasDefaultValue: true,
  },
  {
    name: 'notes',
    kind: 'scalar',
    type: 'String',
    isList: false,
    isRequired: false,
  },
]

const shared = {
  prisma: {},
  resolveCaller: () => 'tenant-a',
  authorize: () => undefined,
  defaultLimit: 5,
  maxLimit: 100,
  maxResultBytes: 1_000_000,
  authInfo: fakeAuthInfo(),
} satisfies McpSharedOptions

function writeTool(
  operation: McpWriteOperation,
  config: Record<string, unknown>,
  core: (ctx: OperationContext) => Promise<unknown> = async () => ({}),
) {
  return createMcpWriteTool({
    model: 'Ticket',
    operation,
    config,
    core,
    fields,
    enums: new Map(),
    modelIndex: new Map(),
  })
}

function register(
  configs: Array<{
    operation: McpWriteOperation
    config: Record<string, unknown>
  }>,
) {
  const { server, tools } = fakeServer()
  registerMcpTools(server, {
    ...shared,
    tools: configs.map((c) => writeTool(c.operation, c.config)),
  })
  return tools
}

/** Registers ONE write tool so validate-time refusals throw here. */
function registerOne(
  operation: McpWriteOperation,
  config: Record<string, unknown>,
) {
  const { server, tools } = fakeServer()
  registerMcpTools(server, { ...shared, tools: [writeTool(operation, config)] })
  return tools
}

function validator(tools: ReturnType<typeof fakeServer>['tools'], index = 0) {
  const schema = tools[index]?.config.inputSchema as {
    '~standard': { validate: (v: unknown) => { issues?: unknown[] } }
  }
  if (!schema) throw new Error('tool not registered')
  return schema['~standard'].validate
}

describe('MCP write registration — explicit allowlist only', () => {
  it('registers exactly the contributed write tools with snake names', () => {
    const tools = register([
      {
        operation: 'create',
        config: {
          create: {
            shape: { data: { title: true, siteId: force('tenant-a') } },
          },
        },
      },
      {
        operation: 'update',
        config: {
          update: { shape: { where: { id: true }, data: { hidden: true } } },
        },
      },
      {
        operation: 'upsert',
        config: {
          upsert: {
            shape: {
              where: { id: true },
              create: { title: true, siteId: force('tenant-a') },
              update: { title: true },
            },
          },
        },
      },
      {
        operation: 'delete',
        config: { delete: { shape: { where: { id: true } } } },
      },
    ])
    expect(tools.map((t) => t.name).sort()).toEqual([
      'ticket_create',
      'ticket_delete',
      'ticket_update',
      'ticket_upsert',
    ])
  })

  it('enableAll never implies write exposure; writes need their own contribution', () => {
    const { server, tools } = fakeServer()
    registerMcpTools(server, { ...shared, tools: [] })
    expect(tools).toHaveLength(0)
    expect(() => writeTool('create', { enableAll: true })).toThrow(
      /no guard configured/,
    )
  })

  it('updateEach is refused explicitly: it bypasses guard shapes', () => {
    expect(() =>
      // @ts-expect-error runtime refusal of an operation outside the write union
      writeTool('updateEach', { updateEach: {} }),
    ).toThrow(/updateEach: refused. updateEach bypasses guard shapes/)
  })

  it('the read factory refuses write operations', () => {
    expect(() =>
      createMcpReadTool({
        model: 'Ticket',
        // @ts-expect-error runtime refusal of a write through the read factory
        operation: 'create',
        config: { create: { shape: { data: { title: true } } } },
        core: async () => ({}),
        fields,
        enums: new Map(),
        modelIndex: new Map(),
      }),
    ).toThrow(
      /findMany, findUnique, findFirst, count and findManyPaginated only/,
    )
  })

  it('dynamic (function) write shapes are refused at creation — no opaque schema', () => {
    expect(() =>
      writeTool('create', {
        create: { shape: () => ({ data: { title: true } }) },
      }),
    ).toThrow(/dynamic \(function\) write shapes are refused/)
    expect(() =>
      writeTool('update', {
        update: {
          variants: {
            'tenant-a': {
              shape: { where: { id: true }, data: { title: true } },
            },
            'tenant-b': {
              shape: () => ({ where: { id: true }, data: { title: true } }),
            },
          },
        },
      }),
    ).toThrow(
      /variant "tenant-b": dynamic \(function\) write shapes are refused/,
    )
  })

  it('a write operation without a guard shape throws at creation', () => {
    expect(() => writeTool('delete', {})).toThrow(/no guard configured/)
  })

  it('REST hooks on an exposed write operation throw at creation', () => {
    expect(() =>
      writeTool('delete', {
        delete: { shape: { where: { id: true } }, before: [() => undefined] },
      }),
    ).toThrow(/defines hooks/)
  })

  it('an unresolvable caller registers zero write tools (fail closed)', () => {
    const { server, tools } = fakeServer()
    registerMcpTools(server, {
      ...shared,
      resolveCaller: () => undefined,
      tools: [
        writeTool('delete', {
          delete: {
            variants: { 'tenant-a': { shape: { where: { id: true } } } },
          },
        }),
      ],
    })
    expect(tools).toHaveLength(0)
  })
})

/** One valid static shape per write operation (tenant forced where it applies). */
const SHAPES: Record<McpWriteOperation, Record<string, unknown>> = {
  create: { data: { title: true, siteId: force('tenant-a') } },
  createMany: { data: { title: true, siteId: force('tenant-a') } },
  createManyAndReturn: {
    data: { title: true, siteId: force('tenant-a') },
    select: { id: true, title: true },
  },
  update: {
    where: { id: true, siteId: force('tenant-a') },
    data: { hidden: true },
  },
  updateMany: {
    where: { siteId: { equals: force('tenant-a') }, title: { contains: true } },
    data: { hidden: true },
  },
  updateManyAndReturn: {
    where: { siteId: { equals: force('tenant-a') } },
    data: { hidden: true },
    select: { id: true },
  },
  upsert: {
    where: { id: true, siteId: force('tenant-a') },
    create: { title: true, siteId: force('tenant-a') },
    update: { title: true },
  },
  delete: { where: { id: true, siteId: force('tenant-a') } },
  deleteMany: {
    where: { siteId: { equals: force('tenant-a') }, title: { contains: true } },
  },
}

const configFor = (operation: McpWriteOperation) => ({
  [operation]: { shape: SHAPES[operation] },
})

describe('MCP write registration — every guarded write op, annotations from explicit metadata', () => {
  const cases: Array<[McpWriteOperation, Record<string, boolean>]> = [
    [
      'create',
      { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    ],
    [
      'createMany',
      { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    ],
    [
      'createManyAndReturn',
      { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    ],
    [
      'update',
      { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    ],
    [
      'updateMany',
      { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    ],
    [
      'updateManyAndReturn',
      { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    ],
    [
      'upsert',
      { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    ],
    [
      'delete',
      { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
    ],
    [
      'deleteMany',
      { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
    ],
  ]
  for (const [operation, expected] of cases) {
    it(`${operation} registers and maps ${JSON.stringify(expected)}`, () => {
      const tools = register([{ operation, config: configFor(operation) }])
      expect(tools[0]?.name).toBe(
        'ticket_' + operation.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase()),
      )
      expect(tools[0]?.config.annotations).toEqual(expected)
    })
  }
})

describe('MCP write registration — bulk operation schemas', () => {
  it('createMany takes a non-empty array of client data plus skipDuplicates', () => {
    const validate = validator(
      register([{ operation: 'createMany', config: configFor('createMany') }]),
    )
    expect(
      validate({ data: [{ title: 'a' }, { title: 'b' }] }).issues,
    ).toBeUndefined()
    expect(
      validate({ data: [{ title: 'a' }], skipDuplicates: true }).issues,
    ).toBeUndefined()
    expect(validate({ data: [] }).issues).toBeDefined()
    expect(validate({ data: { title: 'a' } }).issues).toBeDefined()
    expect(
      validate({ data: [{ title: 'a', siteId: 'evil' }] }).issues,
    ).toBeDefined()
    expect(
      validate({ data: [{ title: 'a' }], select: { id: true } }).issues,
    ).toBeDefined()
  })

  it('createManyAndReturn advertises its configured projection', () => {
    const validate = validator(
      register([
        {
          operation: 'createManyAndReturn',
          config: configFor('createManyAndReturn'),
        },
      ]),
    )
    expect(
      validate({ data: [{ title: 'a' }], select: { id: true } }).issues,
    ).toBeUndefined()
    expect(
      validate({ data: [{ title: 'a' }], select: { notes: true } }).issues,
    ).toBeDefined()
  })

  it('updateMany uses the FILTER where surface; forced tenant lets where be sent empty', () => {
    const validate = validator(
      register([{ operation: 'updateMany', config: configFor('updateMany') }]),
    )
    expect(
      validate({ where: { title: { contains: 'x' } }, data: { hidden: true } })
        .issues,
    ).toBeUndefined()
    expect(
      validate({ where: {}, data: { hidden: true } }).issues,
    ).toBeUndefined()
    // the forced siteId is never client input
    expect(
      validate({ where: { siteId: { equals: 'b' } }, data: { hidden: true } })
        .issues,
    ).toBeDefined()
    expect(
      validate({ where: { title: { contains: 'x' } } }).issues,
    ).toBeDefined()
  })

  it('an all-client bulk where must carry at least one condition', () => {
    const validate = validator(
      register([
        {
          operation: 'deleteMany',
          config: {
            deleteMany: { shape: { where: { title: { contains: true } } } },
          },
        },
      ]),
    )
    expect(
      validate({ where: { title: { contains: 'x' } } }).issues,
    ).toBeUndefined()
    expect(validate({ where: {} }).issues).toBeDefined()
    expect(validate({}).issues).toBeDefined()
  })

  it('bulk ops refuse unique-selector-only configs and missing where', () => {
    expect(() =>
      registerOne('deleteMany', {
        deleteMany: { shape: { where: { id: true } } },
      }),
    ).toThrow(/Ticket.deleteMany \(MCP\)/)
    expect(() =>
      registerOne('updateMany', {
        updateMany: { shape: { data: { hidden: true } } },
      }),
    ).toThrow(/updateMany shape must define "where"/)
    expect(() =>
      registerOne('createMany', {
        createMany: {
          shape: { data: { title: true, siteId: true }, select: { id: true } },
        },
      }),
    ).toThrow(/"select" is not a valid shape config key for createMany/)
  })
})

describe('MCP write registration — tenant-forced extended unique where', () => {
  it('update by id with a forced tenant: id is client input, siteId never is', () => {
    const validate = validator(
      register([{ operation: 'update', config: configFor('update') }]),
    )
    expect(
      validate({ where: { id: 'x' }, data: { hidden: true } }).issues,
    ).toBeUndefined()
    expect(
      validate({
        where: { id: 'x', siteId: 'tenant-b' },
        data: { hidden: true },
      }).issues,
    ).toBeDefined()
    expect(validate({ where: {}, data: { hidden: true } }).issues).toBeDefined()
  })

  it('a client-controlled non-unique filter rides along optionally', () => {
    const validate = validator(
      register([
        {
          operation: 'delete',
          config: { delete: { shape: { where: { id: true, notes: true } } } },
        },
      ]),
    )
    expect(validate({ where: { id: 'x' } }).issues).toBeUndefined()
    expect(validate({ where: { id: 'x', notes: null } }).issues).toBeUndefined()
    expect(validate({ where: { notes: 'n' } }).issues).toBeDefined()
  })

  it('a where of non-unique keys only refuses registration (no covering constraint)', () => {
    expect(() =>
      registerOne('update', {
        update: {
          shape: {
            where: { siteId: force('tenant-a') },
            data: { hidden: true },
          },
        },
      }),
    ).toThrow(/unique where must cover a unique constraint/)
  })
})

describe('MCP write registration — create data schema mirrors the guard contract', () => {
  const config = {
    create: {
      shape: { data: { title: true, siteId: force('tenant-a'), notes: true } },
    },
  }

  it('advertises client fields only; forced values are never client input', () => {
    const tools = register([{ operation: 'create', config }])
    const validate = validator(tools)

    // title required (required, no default); notes optional+nullable;
    // siteId is FORCED server-side and absent from the client surface
    expect(
      validate({ data: { title: 't', notes: null } }).issues,
    ).toBeUndefined()
    expect(validate({ data: { notes: 'n' } }).issues).toBeDefined()
    expect(
      validate({ data: { title: 't', siteId: 'evil' } }).issues,
    ).toBeDefined()
    expect(validate({ data: { title: 't', id: 'x' } }).issues).toBeDefined()
    expect(
      validate({ data: { title: 't', hidden: true } }).issues,
    ).toBeDefined()
    expect(validate({}).issues).toBeDefined() // data itself is required
  })

  it('optional fields accept null, required fields do not', () => {
    const tools = register([{ operation: 'create', config }])
    const validate = validator(tools)
    expect(validate({ data: { title: null } }).issues).toBeDefined()
    expect(
      validate({ data: { title: 't', notes: null } }).issues,
    ).toBeUndefined()
  })

  it('forced data values merge server-side; the tool never sees them', () => {
    // the parity/execution tests prove the merge against the real guard;
    // here the CONTRACT is that the schema cannot carry them at all
    const tools = register([{ operation: 'create', config }])
    const schema = tools[0]?.config.inputSchema as unknown as {
      '~standard': {
        validate: (v: unknown) => { value?: unknown; issues?: unknown[] }
      }
    }
    const result = schema['~standard'].validate({ data: { title: 't' } })
    expect(result.issues).toBeUndefined()
  })
})

describe('MCP write registration — update/upsert/delete where schemas', () => {
  it('update requires where (unique selector) and data', () => {
    const tools = register([
      {
        operation: 'update',
        config: {
          update: { shape: { where: { id: true }, data: { hidden: true } } },
        },
      },
    ])
    const validate = validator(tools)
    expect(
      validate({ where: { id: 'x' }, data: { hidden: true } }).issues,
    ).toBeUndefined()
    expect(validate({ data: { hidden: true } }).issues).toBeDefined()
    expect(validate({ where: { id: 'x' } }).issues).toBeDefined()
    // where narrows to unique selectors — filter operators are not advertised
    expect(validate({ where: { title: 'x' }, data: {} }).issues).toBeDefined()
  })

  it('upsert requires where, create and update', () => {
    const tools = register([
      {
        operation: 'upsert',
        config: {
          upsert: {
            shape: {
              where: { id: true },
              create: { title: true, siteId: force('tenant-a') },
              update: { title: true, notes: true },
            },
          },
        },
      },
    ])
    const validate = validator(tools)
    expect(
      validate({
        where: { id: 'x' },
        create: { title: 't' },
        update: { title: 't2' },
      }).issues,
    ).toBeUndefined()
    expect(
      validate({ where: { id: 'x' }, create: { title: 't' } }).issues,
    ).toBeDefined()
    expect(validate({ where: { id: 'x' } }).issues).toBeDefined()
  })

  it('delete requires where only and advertises nothing else', () => {
    const tools = register([
      {
        operation: 'delete',
        config: { delete: { shape: { where: { id: true } } } },
      },
    ])
    const validate = validator(tools)
    expect(validate({ where: { id: 'x' } }).issues).toBeUndefined()
    expect(validate({}).issues).toBeDefined()
    expect(
      validate({ where: { id: 'x' }, data: { title: 't' } }).issues,
    ).toBeDefined()
  })

  it('a fully forced selector: where is optional in the schema and injected as {} for the core', async () => {
    const bodies: unknown[] = []
    const { server, tools } = fakeServer()
    registerMcpTools(server, {
      ...shared,
      tools: [
        writeTool(
          'update',
          {
            update: {
              shape: {
                where: { id: force('fixed-id') },
                data: { hidden: true },
              },
            },
          },
          async (ctx) => {
            bodies.push(ctx.body)
            return {}
          },
        ),
      ],
    })
    const validate = validator(tools)
    expect(validate({ data: { hidden: true } }).issues).toBeUndefined()
    const result = await tools[0]?.handler(
      { data: { hidden: true } },
      { http: { authInfo: fakeAuthInfo() } },
    )
    expect(result?.isError).toBeFalsy()
    // the core's requireBodyField('where') passes; guard merges the forced id
    expect(bodies).toEqual([{ data: { hidden: true }, where: {} }])
  })
})

describe('MCP write registration — optional BigInt/Decimal accept null', () => {
  const numericFields = [
    ...fields,
    {
      name: 'big',
      kind: 'scalar',
      type: 'BigInt',
      isList: false,
      isRequired: false,
    },
    {
      name: 'dec',
      kind: 'scalar',
      type: 'Decimal',
      isList: false,
      isRequired: false,
    },
    {
      name: 'bigReq',
      kind: 'scalar',
      type: 'BigInt',
      isList: false,
      isRequired: true,
    },
  ]
  it('optional typeless anyOf schemas gain the null alternative; required ones do not', () => {
    const { server, tools } = fakeServer()
    registerMcpTools(server, {
      ...shared,
      tools: [
        createMcpWriteTool({
          model: 'Ticket',
          operation: 'update',
          config: {
            update: {
              shape: {
                where: { id: true },
                data: { big: true, dec: true, bigReq: true },
              },
            },
          },
          core: async () => ({}),
          fields: numericFields,
          enums: new Map(),
          modelIndex: new Map(),
        }),
      ],
    })
    const validate = validator(tools)
    const where = { id: 'x' }
    expect(
      validate({ where, data: { big: null, dec: null } }).issues,
    ).toBeUndefined()
    expect(
      validate({ where, data: { big: '12', dec: '1.5' } }).issues,
    ).toBeUndefined()
    expect(validate({ where, data: { big: 'x' } }).issues).toBeDefined()
    expect(validate({ where, data: { bigReq: null } }).issues).toBeDefined()
  })
})

describe('MCP write registration — fail-closed data configs', () => {
  it('relation fields in data refuse registration', () => {
    const relFields = [
      ...fields,
      {
        name: 'author',
        kind: 'object',
        type: 'User',
        isList: false,
        isRequired: false,
      },
    ]
    const { server, tools } = fakeServer()
    expect(() =>
      registerMcpTools(server, {
        ...shared,
        tools: [
          createMcpWriteTool({
            model: 'Ticket',
            operation: 'create',
            config: {
              create: {
                shape: {
                  data: {
                    title: true,
                    siteId: true,
                    author: { create: { title: true } },
                  },
                },
              },
            },
            core: async () => ({}),
            fields: relFields,
            enums: new Map(),
            modelIndex: new Map(),
          }),
        ],
      }),
    ).toThrow(/relation field "author" cannot be exposed/)
    expect(tools).toHaveLength(0)
  })

  it('inline refine functions in data refuse registration', () => {
    expect(() =>
      registerOne('create', {
        create: { shape: { data: { title: (s: unknown) => s, siteId: true } } },
      }),
    ).toThrow(/inline refine on "title"/)
  })

  it('updatedAt fields refuse registration', () => {
    const stamped = [
      ...fields.filter((f) => f.name !== 'notes'),
      {
        name: 'updatedAt',
        kind: 'scalar',
        type: 'DateTime',
        isList: false,
        isRequired: true,
        isUpdatedAt: true,
      },
    ]
    const { server } = fakeServer()
    expect(() =>
      registerMcpTools(server, {
        ...shared,
        tools: [
          createMcpWriteTool({
            model: 'Ticket',
            operation: 'update',
            config: {
              update: {
                shape: {
                  where: { id: true },
                  data: { updatedAt: true, hidden: true },
                },
              },
            },
            core: async () => ({}),
            fields: stamped,
            enums: new Map(),
            modelIndex: new Map(),
          }),
        ],
      }),
    ).toThrow(/updatedAt field "updatedAt"/)
  })

  it('unknown data fields refuse registration', () => {
    expect(() =>
      registerOne('create', {
        create: { shape: { data: { nope: true, title: true, siteId: true } } },
      }),
    ).toThrow(/unknown field "nope"/)
  })

  it('filter-operator objects in data configs refuse registration', () => {
    expect(() =>
      registerOne('create', {
        create: {
          shape: { data: { title: { contains: true }, siteId: true } },
        },
      }),
    ).toThrow(/"title" in create data accepts true, a literal or force/)
  })

  it('mistyped forced data values refuse registration', () => {
    expect(() =>
      registerOne('create', {
        create: { shape: { data: { title: true, siteId: false } } },
      }),
    ).toThrow(/forced value for "siteId" does not match/)
  })

  it('update where must be a unique selector, not a filter config', () => {
    expect(() =>
      registerOne('update', {
        update: {
          shape: {
            where: { title: { contains: true } },
            data: { hidden: true },
          },
        },
      }),
    ).toThrow(/unique where "title" accepts only true or a forced value/)
    expect(() =>
      registerOne('update', {
        update: {
          shape: { where: { id: { equals: true } }, data: { hidden: true } },
        },
      }),
    ).toThrow(/unique where "id" accepts only true or a forced value/)
    expect(
      writeTool('update', {
        update: { shape: { where: { id: true }, data: { hidden: true } } },
      }).validate(shared),
    ).toBeUndefined()
  })

  it('missing required shape keys refuse registration', () => {
    expect(() =>
      registerOne('create', { create: { shape: { select: { id: true } } } }),
    ).toThrow(/create shape must define "data"/)
    expect(() =>
      registerOne('update', { update: { shape: { data: { hidden: true } } } }),
    ).toThrow(/update shape must define "where"/)
    expect(() =>
      registerOne('delete', { delete: { shape: { select: { id: true } } } }),
    ).toThrow(/delete shape must define "where"/)
    expect(() =>
      registerOne('upsert', {
        upsert: {
          shape: { where: { id: true }, create: { title: true, siteId: true } },
        },
      }),
    ).toThrow(/upsert shape must define "update"/)
  })

  it('delete projections are validated like every other projection', () => {
    expect(() =>
      registerOne('delete', {
        delete: { shape: { where: { id: true }, select: { nope: true } } },
      }),
    ).toThrow(/Ticket.delete \(MCP\)/)
    expect(() =>
      registerOne('delete', {
        delete: { shape: { where: { id: true }, include: { title: true } } },
      }),
    ).toThrow(/Ticket.delete \(MCP\)/)
    expect(
      registerOne('delete', {
        delete: { shape: { where: { id: true }, select: { id: true } } },
      }),
    ).toHaveLength(1)
  })

  it('invalid per-operation shape keys refuse registration', () => {
    expect(() =>
      registerOne('delete', {
        delete: { shape: { where: { id: true }, data: { title: true } } },
      }),
    ).toThrow(/"data" is not a valid shape config key for delete/)
    expect(() =>
      registerOne('create', {
        create: {
          shape: { data: { title: true, siteId: true }, where: { id: true } },
        },
      }),
    ).toThrow(/"where" is not a valid shape config key for create/)
  })

  it('per-variant write shapes are validated: one bad variant registers nothing', () => {
    const { server, tools } = fakeServer()
    expect(() =>
      registerMcpTools(server, {
        ...shared,
        tools: [
          writeTool('create', {
            create: {
              variants: {
                'tenant-a': {
                  shape: { data: { title: true, siteId: force('tenant-a') } },
                },
                'tenant-b': { shape: { data: { nope: true } } },
              },
            },
          }),
        ],
      }),
    ).toThrow(/variant "tenant-b"/)
    expect(tools).toHaveLength(0)
  })
})

describe('MCP write registration — writeStrategy follows the operation core', () => {
  const projected = {
    data: { title: true, siteId: force('tenant-a') },
    select: { id: true, title: true },
  }
  const plain = { data: { title: true, siteId: force('tenant-a') } }
  const bulkUpdateProjected = {
    where: { siteId: { equals: force('tenant-a') } },
    data: { hidden: true },
    select: { id: true },
  }

  function strategyTool(
    operation: McpWriteOperation,
    shape: Record<string, unknown>,
    writeStrategy: 'regular' | 'throwOnNonReturning' | 'forceReturn',
  ) {
    return createMcpWriteTool({
      model: 'Ticket',
      operation,
      config: { [operation]: { shape } },
      core: async () => ({}),
      fields,
      enums: new Map(),
      modelIndex: new Map(),
      writeStrategy,
    })
  }

  function registerStrategy(
    operation: McpWriteOperation,
    shape: Record<string, unknown>,
    writeStrategy: 'regular' | 'throwOnNonReturning' | 'forceReturn',
  ) {
    const { server, tools } = fakeServer()
    registerMcpTools(server, {
      ...shared,
      tools: [strategyTool(operation, shape, writeStrategy)],
    })
    return tools
  }

  it('regular: createMany/updateMany are non-returning — projection configs refuse registration', () => {
    expect(() => registerStrategy('createMany', projected, 'regular')).toThrow(
      /"select" is not a valid shape config key for createMany/,
    )
    expect(() =>
      registerStrategy('updateMany', bulkUpdateProjected, 'regular'),
    ).toThrow(/"select" is not a valid shape config key for updateMany/)
    const validate = validator(registerStrategy('createMany', plain, 'regular'))
    expect(validate({ data: [{ title: 'a' }] }).issues).toBeUndefined()
    expect(
      validate({ data: [{ title: 'a' }], select: { id: true } }).issues,
    ).toBeDefined()
  })

  it('forceReturn: the cores call the returning methods — projection is allowed and advertised', () => {
    const create = validator(
      registerStrategy('createMany', projected, 'forceReturn'),
    )
    expect(
      create({ data: [{ title: 'a' }], select: { id: true } }).issues,
    ).toBeUndefined()
    expect(
      create({ data: [{ title: 'a' }], select: { notes: true } }).issues,
    ).toBeDefined()
    const update = validator(
      registerStrategy('updateMany', bulkUpdateProjected, 'forceReturn'),
    )
    expect(
      update({ where: {}, data: { hidden: true }, select: { id: true } })
        .issues,
    ).toBeUndefined()
    // the tool keeps its name and annotations; only the contract widens
    const tools = registerStrategy('createMany', plain, 'forceReturn')
    expect(tools[0]?.name).toBe('ticket_create_many')
  })

  it('throwOnNonReturning: createMany/updateMany refuse at creation — their cores 501 every call', () => {
    expect(() =>
      strategyTool('createMany', plain, 'throwOnNonReturning'),
    ).toThrow(
      /createMany \(MCP\): disabled by writeStrategy="throwOnNonReturning".*createManyAndReturn/,
    )
    expect(() =>
      strategyTool('updateMany', bulkUpdateProjected, 'throwOnNonReturning'),
    ).toThrow(
      /updateMany \(MCP\): disabled by writeStrategy="throwOnNonReturning"/,
    )
    // the returning variants and every other write op stay available
    expect(
      registerStrategy('createManyAndReturn', projected, 'throwOnNonReturning'),
    ).toHaveLength(1)
    expect(
      registerStrategy(
        'deleteMany',
        { where: { siteId: { equals: force('tenant-a') } } },
        'throwOnNonReturning',
      ),
    ).toHaveLength(1)
  })

  it('the default strategy is regular', () => {
    expect(() =>
      registerMcpTools(fakeServer().server, {
        ...shared,
        tools: [writeTool('createMany', { createMany: { shape: projected } })],
      }),
    ).toThrow(/"select" is not a valid shape config key for createMany/)
  })
})
