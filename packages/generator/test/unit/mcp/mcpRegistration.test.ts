import { describe, it, expect, afterEach } from 'vitest'
import {
  createMcpReadTool,
  registerMcpTools,
  McpAuthorizationError,
  type McpSharedOptions,
} from '../../../src/copy/mcpRuntime'
import { fakeServer, fakeAuthInfo, modelMeta } from './mcpTestHarness'

const fields = [
  {
    name: 'id',
    kind: 'scalar',
    type: 'String',
    isList: false,
    isRequired: true,
  },
  {
    name: 'site_id',
    kind: 'scalar',
    type: 'String',
    isList: false,
    isRequired: true,
  },
  {
    name: 'posts',
    kind: 'object',
    type: 'Post',
    isList: true,
    isRequired: true,
  },
]

const baseShared = {
  prisma: {},
  resolveCaller: () => 'tenant-a',
  authorize: () => undefined,
  defaultLimit: 5,
  maxLimit: 100,
  maxResultBytes: 1_000_000,
  authInfo: fakeAuthInfo(),
} satisfies McpSharedOptions

function tool(
  operation: 'findMany' | 'findManyPaginated',
  config: Record<string, unknown>,
) {
  return createMcpReadTool({
    model: 'User',
    operation,
    config,
    core: async () => [],
    fields,
    enums: new Map(),
    modelIndex: new Map(),
  })
}

describe('MCP registration — explicit allowlist only', () => {
  it('registers exactly the contributed tools', () => {
    const { server, tools } = fakeServer()
    registerMcpTools(server, {
      ...baseShared,
      tools: [
        tool('findMany', {
          findMany: {
            shape: { where: { site_id: { equals: 'tenant-a' } }, take: 50 },
          },
        }),
        createMcpReadTool({
          model: 'User',
          operation: 'count',
          config: {
            count: { shape: { where: { site_id: { equals: 'tenant-a' } } } },
          },
          core: async () => 0,
          fields,
          enums: new Map(),
          modelIndex: new Map(),
        }),
      ],
    })
    expect(tools.map((t) => t.name).sort()).toEqual([
      'user_count',
      'user_find_many',
    ])
  })

  it('tool names are snake case for the model segment too', () => {
    const { server, tools } = fakeServer()
    registerMcpTools(server, {
      ...baseShared,
      tools: [
        createMcpReadTool({
          model: 'OrderItem',
          operation: 'findManyPaginated',
          config: { findManyPaginated: { shape: { take: 10 } } },
          core: async () => ({ data: [], total: 0, hasMore: false }),
          fields,
          enums: new Map(),
          modelIndex: new Map(),
        }),
      ],
    })
    expect(tools[0]?.name).toBe('order_item_find_many_paginated')
  })

  it('enableAll on the REST config never exposes MCP tools', () => {
    const { server, tools } = fakeServer()
    registerMcpTools(server, {
      ...baseShared,
      tools: [], // nothing contributed -> nothing registered, regardless of REST enableAll
    })
    expect(tools).toHaveLength(0)

    // and a contributed tool with enableAll still requires ITS config guard
    expect(() =>
      createMcpReadTool({
        model: 'User',
        operation: 'findMany',
        config: { enableAll: true },
        core: async () => [],
        fields,
        enums: new Map(),
        modelIndex: new Map(),
      }),
    ).toThrow(/no guard configured/)
  })

  it('annotations come from explicit operation metadata', () => {
    const { server, tools } = fakeServer()
    registerMcpTools(server, {
      ...baseShared,
      tools: [tool('findMany', { findMany: { shape: { take: 50 } } })],
    })
    expect(tools[0]?.config.annotations).toEqual({
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    })
  })

  it('tool schemas are model-aware, closed, and enforced pre-handler', async () => {
    const { server, tools } = fakeServer()
    registerMcpTools(server, {
      ...baseShared,
      tools: [
        tool('findMany', {
          findMany: {
            shape: {
              where: { site_id: { equals: true } },
              select: { id: true, site_id: true },
              take: 50,
            },
          },
        }),
      ],
    })
    const validate = (
      tools[0]?.config.inputSchema as {
        '~standard': { validate: (v: unknown) => { issues?: unknown[] } }
      }
    )['~standard'].validate

    // only guard-declared top-level keys are advertised: email is a real
    // model field but the shape does not involve it
    expect(validate({ where: {} }).issues).toBeUndefined()
    expect(validate({ email: 'x' }).issues).toBeDefined()
    expect(validate({ take: 5 }).issues).toBeUndefined()
    expect(validate({ take: 0 }).issues).toBeDefined()

    // where enumerates the shape's declared filter keys only
    expect(validate({ where: { site_id: 'tenant-a' } }).issues).toBeUndefined()
    expect(validate({ where: { posts: {} } }).issues).toBeDefined()

    // select enumerates the shape's projected fields only
    expect(validate({ select: { id: true } }).issues).toBeUndefined()
    expect(validate({ select: { email: true } }).issues).toBeDefined()
  })
})

describe('MCP registration — cyclic relations terminate', () => {
  it('a bidirectional User <-> Post model graph builds schemas without hanging', () => {
    const userFields = [
      {
        name: 'id',
        kind: 'scalar',
        type: 'String',
        isList: false,
        isRequired: true,
      },
      {
        name: 'email',
        kind: 'scalar',
        type: 'String',
        isList: false,
        isRequired: true,
      },
      {
        name: 'posts',
        kind: 'object',
        type: 'Post',
        isList: true,
        isRequired: true,
      },
    ]
    const postFields = [
      {
        name: 'id',
        kind: 'scalar',
        type: 'String',
        isList: false,
        isRequired: true,
      },
      {
        name: 'author',
        kind: 'object',
        type: 'User',
        isList: false,
        isRequired: true,
      },
    ]
    const postMeta = modelMeta('Post', postFields)
    const userMeta = modelMeta('User', userFields)
    const modelIndex = new Map(
      Object.entries({
        Post: postMeta,
        User: userMeta,
      }),
    )
    postMeta.modelIndex = modelIndex
    userMeta.modelIndex = modelIndex
    const { server, tools } = fakeServer()
    registerMcpTools(server, {
      ...baseShared,
      tools: [
        createMcpReadTool({
          model: 'User',
          operation: 'findMany',
          config: {
            findMany: {
              shape: {
                where: {
                  posts: {
                    some: { author: { is: { email: { equals: true } } } },
                  },
                },
                include: { posts: { take: 3 } },
                take: 50,
              },
            },
          },
          core: async () => [],
          fields: userFields,
          enums: new Map(),
          modelIndex,
        }),
      ],
    })
    expect(tools).toHaveLength(1)
    const validate = (
      tools[0]?.config.inputSchema as {
        '~standard': { validate: (v: unknown) => { issues?: unknown[] } }
      }
    )['~standard'].validate

    // cyclic where (posts.some with the same relation cycle) terminates
    expect(
      validate({
        where: { posts: { some: { author: { is: { email: 'a' } } } } },
      }).issues,
    ).toBeUndefined()
    // include mirrors EXACTLY the nested shape: `{ posts: { take: 3 } }`
    // admits take within the bound and NOTHING else — parity with
    // prisma-guard, which exposes only the declared keys
    expect(validate({ include: { posts: { take: 2 } } }).issues).toBeUndefined()
    expect(validate({ include: { posts: { take: 3 } } }).issues).toBeUndefined()
    expect(validate({ include: { posts: { take: 4 } } }).issues).toBeDefined()
    expect(validate({ include: { posts: { where: {} } } }).issues).toBeDefined()
    expect(validate({ include: { posts: { skip: 1 } } }).issues).toBeDefined()
    expect(
      validate({ include: { posts: { select: {} } } }).issues,
    ).toBeDefined()
    // take: N carries a default in prisma-guard, so an empty object is legal
    expect(validate({ include: { posts: {} } }).issues).toBeUndefined()
    // undeclared nested arguments are not advertised (configured: take only)
    expect(validate({ include: { posts: { where: {} } } }).issues).toBeDefined()
    expect(
      validate({ include: { posts: { where: { id: 'p1' } } } }).issues,
    ).toBeDefined()
    expect(validate({ include: { posts: { skip: 1 } } }).issues).toBeDefined()
    expect(
      validate({ include: { posts: { cursor: { id: 'p1' } } } }).issues,
    ).toBeDefined()
    expect(validate({ include: { posts: true } }).issues).toBeUndefined()
    // false is not `true` — prisma-guard literal(true)
    expect(validate({ include: { posts: false } }).issues).toBeDefined()
    // undeclared relation keys and scalar includes are rejected
    expect(validate({ include: { author: true } }).issues).toBeDefined()
    expect(validate({ include: { email: true } }).issues).toBeDefined()
    expect(validate({ include: { posts: { nope: 1 } } }).issues).toBeDefined()
  })

  it('to-one relations accept only is/isNot and literal true', () => {
    const userFieldsAll = [
      {
        name: 'id',
        kind: 'scalar',
        type: 'String',
        isList: false,
        isRequired: true,
      },
      {
        name: 'profile',
        kind: 'object',
        type: 'Profile',
        isList: false,
        isRequired: true,
      },
    ]
    const profileFields = [
      {
        name: 'bio',
        kind: 'scalar',
        type: 'String',
        isList: false,
        isRequired: true,
      },
    ]
    const modelIndex = new Map([
      ['Profile', modelMeta('Profile', profileFields)],
    ])
    const { server, tools } = fakeServer()
    registerMcpTools(server, {
      ...baseShared,
      tools: [
        createMcpReadTool({
          model: 'User',
          operation: 'findMany',
          config: {
            findMany: {
              shape: {
                where: {
                  profile: {
                    is: { bio: { equals: true } },
                    isNot: { bio: { equals: true } },
                  },
                },
                take: 50,
              },
            },
          },
          core: async () => [],
          fields: userFieldsAll,
          enums: new Map(),
          modelIndex,
        }),
      ],
    })
    const v = (
      tools[0]?.config.inputSchema as {
        '~standard': { validate: (x: unknown) => { issues?: unknown[] } }
      }
    )['~standard'].validate
    // is / isNot are the only to-one operators
    expect(
      v({ where: { profile: { is: { bio: 'x' } } } }).issues,
    ).toBeUndefined()
    expect(
      v({ where: { profile: { isNot: { bio: 'x' } } } }).issues,
    ).toBeUndefined()
    // a DIRECT related where object is rejected — guard 1.33 rejects it
    expect(v({ where: { profile: { bio: 'x' } } }).issues).toBeDefined()
  })

  it('projection booleans are the literal true', () => {
    const { server, tools } = fakeServer()
    registerMcpTools(server, {
      ...baseShared,
      tools: [
        createMcpReadTool({
          model: 'User',
          operation: 'findMany',
          config: {
            findMany: {
              shape: {
                where: { email: { equals: true } },
                select: { email: true },
                take: { max: 50 },
              },
            },
          },
          core: async () => [],
          fields: [
            {
              name: 'id',
              kind: 'scalar',
              type: 'String',
              isList: false,
              isRequired: true,
            },
            {
              name: 'email',
              kind: 'scalar',
              type: 'String',
              isList: false,
              isRequired: true,
            },
          ],
          enums: new Map(),
          modelIndex: new Map(),
        }),
      ],
    })
    const v = (
      tools[0]?.config.inputSchema as {
        '~standard': { validate: (x: unknown) => { issues?: unknown[] } }
      }
    )['~standard'].validate
    expect(v({ select: { email: true } }).issues).toBeUndefined()
    expect(v({ select: { email: false } }).issues).toBeDefined()
  })

  it('select-mode list relations expose the configured list arguments too', () => {
    const userFieldsAll = [
      {
        name: 'id',
        kind: 'scalar',
        type: 'String',
        isList: false,
        isRequired: true,
      },
      {
        name: 'email',
        kind: 'scalar',
        type: 'String',
        isList: false,
        isRequired: true,
      },
      {
        name: 'posts',
        kind: 'object',
        type: 'Post',
        isList: true,
        isRequired: true,
      },
    ]
    const postFields = [
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
        name: 'title',
        kind: 'scalar',
        type: 'String',
        isList: false,
        isRequired: true,
      },
    ]
    const modelIndex = new Map([['Post', modelMeta('Post', postFields)]])
    const { server, tools } = fakeServer()
    registerMcpTools(server, {
      ...baseShared,
      tools: [
        createMcpReadTool({
          model: 'User',
          operation: 'findMany',
          config: {
            findMany: {
              shape: {
                where: { posts: { some: { id: { equals: true } } } },
                select: {
                  id: true,
                  posts: {
                    where: { title: { contains: true } },
                    orderBy: { title: true },
                    take: 5,
                    cursor: { id: true },
                  },
                },
                take: 50,
              },
            },
          },
          core: async () => [],
          fields: userFieldsAll,
          enums: new Map(),
          modelIndex,
        }),
      ],
    })
    const v = (
      tools[0]?.config.inputSchema as {
        '~standard': { validate: (x: unknown) => { issues?: unknown[] } }
      }
    )['~standard'].validate
    // SELECT mode: configured list arguments are advertised, narrowed
    expect(
      v({ select: { posts: { where: { title: { contains: 'x' } } } } }).issues,
    ).toBeUndefined()
    expect(v({ select: { posts: { take: 5 } } }).issues).toBeUndefined()
    expect(v({ select: { posts: { take: 6 } } }).issues).toBeDefined()
    expect(
      v({ select: { posts: { orderBy: { title: 'asc' } } } }).issues,
    ).toBeUndefined()
    expect(
      v({ select: { posts: { orderBy: { id: 'asc' } } } }).issues,
    ).toBeDefined()
    expect(
      v({ select: { posts: { cursor: { id: 'c1' } } } }).issues,
    ).toBeUndefined()
    expect(
      v({ select: { posts: { cursor: { email: 'x' } } } }).issues,
    ).toBeDefined()
    // undeclared nested args stay rejected
    expect(v({ select: { posts: { skip: 1 } } }).issues).toBeDefined()
  })

  it('findUnique requires the where object with declared selector keys', () => {
    const { server, tools } = fakeServer()
    registerMcpTools(server, {
      ...baseShared,
      tools: [
        createMcpReadTool({
          model: 'User',
          operation: 'findUnique' as const,
          config: {
            findUnique: { shape: { where: { email: true } } },
          },
          core: async () => [],
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
              name: 'email',
              kind: 'scalar',
              type: 'String',
              isList: false,
              isRequired: true,
              isUnique: true,
            },
          ],
          enums: new Map(),
          modelIndex: new Map(),
        }),
      ],
    })
    const v = (
      tools[0]?.config.inputSchema as {
        '~standard': { validate: (x: unknown) => { issues?: unknown[] } }
      }
    )['~standard'].validate
    // selector lives INSIDE where — root flat keys are unsatisfiable
    expect(v({ where: { email: 'a@b.c' } }).issues).toBeUndefined()
    expect(v({}).issues).toBeDefined()
    expect(v({ email: 'a@b.c' }).issues).toBeDefined()
    expect(v({ where: {} }).issues).toBeDefined()
  })

  it('forced shape values are never advertised as client input', () => {
    const { force } = require('prisma-guard') as {
      force: (v: string) => unknown
    }
    const { server, tools } = fakeServer()
    registerMcpTools(server, {
      ...baseShared,
      tools: [
        createMcpReadTool({
          model: 'User',
          operation: 'findMany',
          config: {
            findMany: {
              shape: {
                where: {
                  site_id: { equals: force('tenant-a') },
                  email: { contains: true },
                },
                take: 50,
              },
            },
          },
          core: async () => [],
          fields: [
            {
              name: 'id',
              kind: 'scalar',
              type: 'String',
              isList: false,
              isRequired: true,
            },
            {
              name: 'site_id',
              kind: 'scalar',
              type: 'String',
              isList: false,
              isRequired: true,
            },
            {
              name: 'email',
              kind: 'scalar',
              type: 'String',
              isList: false,
              isRequired: true,
            },
          ],
          enums: new Map(),
          modelIndex: new Map(),
        }),
      ],
    })
    const v = (
      tools[0]?.config.inputSchema as {
        '~standard': { validate: (x: unknown) => { issues?: unknown[] } }
      }
    )['~standard'].validate
    // email (client-controlled operator) is advertised; the forced site_id
    // equals is server-owned and NOT advertised
    expect(v({ where: { email: { contains: 'x' } } }).issues).toBeUndefined()
    expect(
      v({ where: { site_id: { equals: 'tenant-a' } } }).issues,
    ).toBeDefined()
  })

  it('relation operators mirror exactly the declared operators', () => {
    const userFieldsAll = [
      {
        name: 'id',
        kind: 'scalar',
        type: 'String',
        isList: false,
        isRequired: true,
      },
      {
        name: 'posts',
        kind: 'object',
        type: 'Post',
        isList: true,
        isRequired: true,
      },
    ]
    const postFields = [
      {
        name: 'id',
        kind: 'scalar',
        type: 'String',
        isList: false,
        isRequired: true,
      },
    ]
    const { server, tools } = fakeServer()
    registerMcpTools(server, {
      ...baseShared,
      tools: [
        createMcpReadTool({
          model: 'User',
          operation: 'findMany',
          config: {
            findMany: {
              shape: {
                where: { posts: { some: { id: { equals: true } } } },
                take: 50,
              },
            },
          },
          core: async () => [],
          fields: userFieldsAll,
          enums: new Map(),
          modelIndex: new Map([['Post', modelMeta('Post', postFields)]]),
        }),
      ],
    })
    const v = (
      tools[0]?.config.inputSchema as {
        '~standard': { validate: (x: unknown) => { issues?: unknown[] } }
      }
    )['~standard'].validate
    // exactly the declared relation operators are advertised
    expect(
      v({ where: { posts: { some: { id: 'p1' } } } }).issues,
    ).toBeUndefined()
    // all-client conditions may not be sent empty (guard rejects too)
    expect(v({ where: { posts: { some: {} } } }).issues).toBeDefined()
    // undeclared operators stay rejected
    expect(
      v({ where: { posts: { every: { id: 'p1' } } } }).issues,
    ).toBeDefined()
    expect(v({ where: { posts: { none: { id: 'p1' } } } }).issues).toBeDefined()
  })

  it('guard-invalid relation configs refuse registration', () => {
    const userFieldsAll = [
      {
        name: 'id',
        kind: 'scalar',
        type: 'String',
        isList: false,
        isRequired: true,
      },
      {
        name: 'posts',
        kind: 'object',
        type: 'Post',
        isList: true,
        isRequired: true,
      },
    ]
    const postFields = [
      {
        name: 'id',
        kind: 'scalar',
        type: 'String',
        isList: false,
        isRequired: true,
      },
    ]
    const { server, tools } = fakeServer()
    expect(() =>
      registerMcpTools(server, {
        ...baseShared,
        tools: [
          createMcpReadTool({
            model: 'User',
            operation: 'findMany',
            config: {
              findMany: {
                shape: { where: { posts: { some: {} } }, take: 50 },
              },
            },
            core: async () => [],
            fields: userFieldsAll,
            enums: new Map(),
            modelIndex: new Map([['Post', modelMeta('Post', postFields)]]),
          }),
        ],
      }),
    ).toThrow(/must define at least one operator config/)
  })

  it('count select is a count-field selection: _all plus configured scalars only', () => {
    const { server, tools } = fakeServer()
    registerMcpTools(server, {
      ...baseShared,
      tools: [
        createMcpReadTool({
          model: 'User',
          operation: 'count',
          config: {
            count: {
              shape: {
                where: { site_id: { equals: 'a' } },
                select: { email: true },
              },
            },
          },
          core: async () => 0,
          fields: [
            {
              name: 'id',
              kind: 'scalar',
              type: 'String',
              isList: false,
              isRequired: true,
            },
            {
              name: 'site_id',
              kind: 'scalar',
              type: 'String',
              isList: false,
              isRequired: true,
            },
            {
              name: 'email',
              kind: 'scalar',
              type: 'String',
              isList: false,
              isRequired: true,
            },
            {
              name: 'posts',
              kind: 'object',
              type: 'Post',
              isList: true,
              isRequired: true,
            },
          ],
          enums: new Map(),
          modelIndex: new Map(),
        }),
      ],
    })
    const v = (
      tools[0]?.config.inputSchema as {
        '~standard': { validate: (x: unknown) => { issues?: unknown[] } }
      }
    )['~standard'].validate
    // configured keys only, at least one required — no implicit _all
    expect(v({ select: { email: true } }).issues).toBeUndefined()
    expect(v({ select: {} }).issues).toBeDefined()
    expect(v({ select: { posts: true } }).issues).toBeDefined()
    expect(v({ select: { nope: true } }).issues).toBeDefined()
    expect(v({ select: { _all: true } }).issues).toBeDefined()
  })

  it('a shape declaring nested where narrows where instead of take', () => {
    const userFieldsAll = [
      {
        name: 'id',
        kind: 'scalar',
        type: 'String',
        isList: false,
        isRequired: true,
      },
      {
        name: 'email',
        kind: 'scalar',
        type: 'String',
        isList: false,
        isRequired: true,
      },
      {
        name: 'posts',
        kind: 'object',
        type: 'Post',
        isList: true,
        isRequired: true,
      },
    ]
    const postFields = [
      {
        name: 'id',
        kind: 'scalar',
        type: 'String',
        isList: false,
        isRequired: true,
      },
    ]
    const modelIndex = new Map([['Post', modelMeta('Post', postFields)]])
    const { server, tools } = fakeServer()
    registerMcpTools(server, {
      ...baseShared,
      tools: [
        createMcpReadTool({
          model: 'User',
          operation: 'findMany',
          config: {
            findMany: {
              shape: {
                where: { posts: { some: { id: { equals: true } } } },
                include: {
                  posts: { where: { id: { equals: true } }, take: 50 },
                },
                take: 50,
              },
            },
          },
          core: async () => [],
          fields: userFieldsAll,
          enums: new Map(),
          modelIndex,
        }),
      ],
    })
    const whereValidate = (
      tools[0]?.config.inputSchema as {
        '~standard': { validate: (v: unknown) => { issues?: unknown[] } }
      }
    )['~standard'].validate

    // where mirrors the nested shape's declared filter keys
    expect(
      whereValidate({ include: { posts: { where: { id: 'p1' } } } }).issues,
    ).toBeUndefined()
    expect(
      whereValidate({ include: { posts: { where: { email: 'x' } } } }).issues,
    ).toBeDefined()
    // take is configured (50): within the bound is legal, above is not
    expect(
      whereValidate({ include: { posts: { take: 2 } } }).issues,
    ).toBeUndefined()
    expect(
      whereValidate({ include: { posts: { take: 51 } } }).issues,
    ).toBeDefined()
    // undeclared nested keys stay rejected
    expect(
      whereValidate({ include: { posts: { skip: 1 } } }).issues,
    ).toBeDefined()
  })
})

describe('MCP registration — guard requirements (fail closed)', () => {
  const fields = [
    {
      name: 'id',
      kind: 'scalar',
      type: 'String',
      isList: false,
      isRequired: true,
    },
    {
      name: 'site_id',
      kind: 'scalar',
      type: 'String',
      isList: false,
      isRequired: true,
    },
    {
      name: 'posts',
      kind: 'object',
      type: 'Post',
      isList: true,
      isRequired: true,
    },
  ]

  function tool(
    operation: 'findMany' | 'findManyPaginated',
    config: Record<string, unknown>,
  ) {
    return createMcpReadTool({
      model: 'User',
      operation,
      config,
      core: async () => [],
      fields,
      enums: new Map(),
      modelIndex: new Map(),
    })
  }

  it('an operation without guard shape or variants throws at creation', () => {
    expect(() => tool('findMany', { findMany: {} })).toThrow(
      /no guard configured/,
    )
    expect(() => tool('findMany', {})).toThrow(/no guard configured/)
  })

  it('read-only tools are not exempt', () => {
    expect(() =>
      createMcpReadTool({
        model: 'User',
        operation: 'count',
        config: { count: { shape: undefined } },
        core: async () => 0,
        fields,
        enums: new Map(),
        modelIndex: new Map(),
      }),
    ).toThrow(/no guard configured/)
  })

  it('REST hooks on an exposed operation throw at creation', () => {
    const hook = () => undefined
    expect(() =>
      tool('findMany', { findMany: { shape: { take: 5 }, before: [hook] } }),
    ).toThrow(/REST configuration defines hooks/)
    expect(() =>
      tool('findMany', { findMany: { shape: { take: 5 }, authorize: hook } }),
    ).toThrow(/REST configuration defines hooks/)
    expect(() =>
      tool('findMany', { findMany: { shape: { take: 5 }, after: [hook] } }),
    ).toThrow(/REST configuration defines hooks/)
    expect(() =>
      tool('findMany', {
        findMany: { variants: { a: { shape: { take: 5 }, before: [hook] } } },
      }),
    ).toThrow(/REST configuration defines hooks/)
    expect(() =>
      tool('findMany', {
        findMany: { variants: { a: { shape: { take: 5 }, after: [hook] } } },
      }),
    ).toThrow(/REST configuration defines hooks/)
  })

  it('an unresolvable caller registers zero tools (fail closed)', () => {
    const { server, tools } = fakeServer()
    registerMcpTools(server, {
      ...baseShared,
      resolveCaller: () => 'no-such-variant',
      tools: [
        tool('findMany', {
          findMany: { variants: { a: { shape: { take: 5 } } } },
        }),
      ],
    })
    expect(tools).toHaveLength(0)
  })
})

describe('MCP registration — limit option validation', () => {
  const guarded = () => tool('findMany', { findMany: { shape: { take: 500 } } })
  const { server } = fakeServer()

  const invalid: Array<[string, unknown]> = [
    ['zero', 0],
    ['negative', -5],
    ['fractional', 10.5],
    ['NaN', NaN],
    ['Infinity', Infinity],
    ['string', '20'],
  ]

  for (const field of ['defaultLimit', 'maxLimit', 'maxResultBytes'] as const) {
    for (const [label, value] of invalid) {
      it(`${field} = ${label} throws`, () => {
        expect(() =>
          registerMcpTools(server, {
            ...baseShared,
            [field]: value,
            tools: [guarded()],
          } as never),
        ).toThrow(new RegExp(field))
      })
    }
  }

  it('defaultLimit > maxLimit throws', () => {
    expect(() =>
      registerMcpTools(server, {
        ...baseShared,
        defaultLimit: 200,
        maxLimit: 100,
        tools: [guarded()],
      }),
    ).toThrow(/defaultLimit .* must not exceed maxLimit/)
  })
})

describe('MCP registration — list shapes must declare take', () => {
  it('static shape without take throws at validation', () => {
    const created = tool('findMany', {
      findMany: { shape: { where: { site_id: 'a' } } },
    })
    expect(() =>
      registerMcpTools(fakeServer().server, {
        ...baseShared,
        tools: [created],
      }),
    ).toThrow(/must declare take/)
  })

  it('each static variant must declare take', () => {
    const created = tool('findMany', {
      findMany: {
        variants: {
          a: { shape: { take: 10 } },
          b: { shape: { where: { site_id: 'x' } } },
        },
      },
    })
    expect(() =>
      registerMcpTools(fakeServer().server, {
        ...baseShared,
        resolveCaller: () => 'a',
        tools: [created],
      }),
    ).toThrow(/variant "b".*must declare take/)
  })

  it('shape take.max below defaultLimit throws at validation', () => {
    const created = tool('findMany', {
      findMany: { shape: { take: { max: 10 } } },
    })
    expect(() =>
      registerMcpTools(fakeServer().server, {
        ...baseShared,
        defaultLimit: 20,
        tools: [created],
      }),
    ).toThrow(/below defaultLimit/)
  })
})

describe('MCP registration — dropped-guard environment', () => {
  afterEach(() => {
    delete process.env.PGE_DROP_GUARD
    delete process.env.E2E
  })

  const guarded = () => tool('findMany', { findMany: { shape: { take: 50 } } })

  it('PGE_DROP_GUARD=true registers zero tools and throws', () => {
    process.env.PGE_DROP_GUARD = 'true'
    const { server, tools } = fakeServer()
    expect(() =>
      registerMcpTools(server, { ...baseShared, tools: [guarded()] }),
    ).toThrow(/guard is dropped/)
    expect(tools).toHaveLength(0)
  })

  it('deprecated E2E=true does the same', () => {
    process.env.E2E = 'true'
    const { server, tools } = fakeServer()
    expect(() =>
      registerMcpTools(server, { ...baseShared, tools: [guarded()] }),
    ).toThrow(/guard is dropped/)
    expect(tools).toHaveLength(0)
  })
})

describe('MCP registration — verified principal only', () => {
  it('the registration-time caller derives only from the passed AuthInfo', () => {
    const seen: Array<string | undefined> = []
    const { server, tools } = fakeServer()
    registerMcpTools(server, {
      ...baseShared,
      resolveCaller: (authInfo) => {
        seen.push(authInfo?.clientId)
        return 'tenant-a'
      },
      authInfo: fakeAuthInfo(),
      tools: [
        tool('findMany', {
          findMany: { variants: { 'tenant-a': { shape: { take: 5 } } } },
        }),
      ],
    })
    expect(seen).toEqual(['client-1'])
    expect(tools).toHaveLength(1)
  })

  it('a call without a verified principal in the SDK context is denied before any work', async () => {
    let authorizeCalls = 0
    const { server, tools } = fakeServer()
    registerMcpTools(server, {
      ...baseShared,
      authorize: () => {
        authorizeCalls++
      },
      tools: [tool('findMany', { findMany: { shape: { take: 5 } } })],
    })
    const result = await tools[0]?.handler({ take: 1 })
    expect(result?.isError).toBe(true)
    expect(JSON.parse(result?.content?.[0]?.text ?? '{}').message).toMatch(
      /unauthenticated/,
    )
    expect(authorizeCalls).toBe(0)
  })

  it('a call re-routes from the principal in the SDK context, never from arguments', async () => {
    const callers: Array<string | undefined> = []
    const { server, tools } = fakeServer()
    registerMcpTools(server, {
      ...baseShared,
      resolveCaller: (authInfo) => {
        callers.push(authInfo?.clientId)
        return authInfo?.clientId === 'client-1' ? 'a' : 'b'
      },
      tools: [
        tool('findMany', {
          findMany: {
            variants: {
              a: { shape: { take: 5 } },
              b: { shape: { take: 5 } },
            },
          },
        }),
      ],
    })
    // registration resolved once for the tool set
    expect(callers).toEqual(['client-1'])

    await tools[0]?.handler(
      { variant: 'b', caller: 'b' },
      { http: { authInfo: fakeAuthInfo() } },
    )
    // the call re-routed from ctx.http.authInfo: same verified principal,
    // arguments ignored
    expect(callers).toEqual(['client-1', 'client-1'])
  })
})
