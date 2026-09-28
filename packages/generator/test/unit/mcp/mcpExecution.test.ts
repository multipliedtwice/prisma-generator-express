import { describe, it, expect } from 'vitest'
import type { McpServer } from '@modelcontextprotocol/server'
import {
  createMcpReadTool,
  registerMcpTools,
  McpAuthorizationError,
  type McpSharedOptions,
} from '../../../src/copy/mcpRuntime'
import type { OperationContext } from '../../../src/copy/operationRuntime'
import { fakeServer, fakeAuthInfo } from './mcpTestHarness'

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
]

function sharedWith(
  overrides: Partial<McpSharedOptions> = {},
): McpSharedOptions {
  return {
    prisma: {},
    resolveCaller: () => 'tenant-a',
    authorize: () => undefined,
    defaultLimit: 5,
    maxLimit: 50,
    maxResultBytes: 1_000_000,
    authInfo: fakeAuthInfo(),
    ...overrides,
  }
}

function registerOne(
  config: Record<string, unknown>,
  core: (ctx: OperationContext) => Promise<unknown>,
  shared: McpSharedOptions = sharedWith(),
  operation:
    | 'findMany'
    | 'findUnique'
    | 'findFirst'
    | 'count'
    | 'findManyPaginated' = 'findMany',
) {
  const { server, tools } = fakeServer()
  registerMcpTools(server as McpServer, {
    ...shared,
    tools: [
      createMcpReadTool({
        model: 'User',
        operation,
        config,
        core,
        fields,
        enums: new Map(),
        modelIndex: new Map(),
      }),
    ],
  })
  return { tools, shared }
}

const CALL_CTX = { http: { authInfo: fakeAuthInfo() } }

describe('MCP execution — exact order', () => {
  it('an invalid take is rejected before execution, after authorize', async () => {
    const order: string[] = []
    const { tools } = registerOne(
      { findMany: { shape: { take: { max: 50 } } } },
      async () => {
        order.push('core')
        return []
      },
      sharedWith({
        authorize: () => {
          order.push('authorize')
        },
      }),
    )
    const tool = tools[0]
    if (!tool) throw new Error('tool not registered')

    // the wrapped schema rejects non-integer take in the SDK layer BEFORE the
    // handler; bypassed here (fake server), the handler's own normalization
    // rejects it as a 400 — authorize may have run (it precedes take
    // normalization by mandate), the core may not
    const result = await tool.handler({ take: 2.5 }, CALL_CTX)
    expect(order).toEqual(['authorize'])
    expect(result.isError).toBe(true)
    expect(JSON.parse(result.content[0]?.text ?? '{}').status).toBe(400)
  })

  it('authorize runs after variant settle and before context/shape/DB work', async () => {
    const order: string[] = []
    const { tools } = registerOne(
      {
        findMany: {
          variants: {
            'tenant-a': {
              shape: () => ({ where: { site_id: { equals: 'a' } }, take: 50 }),
            },
          },
        },
      },
      async () => {
        order.push('core')
        return []
      },
      sharedWith({
        resolveContext: () => {
          order.push('resolveContext')
          return { tenant: 'a' }
        },
        authorize: () => {
          order.push('authorize')
        },
      }),
    )
    const tool = tools[0]
    if (!tool) throw new Error('tool not registered')
    await tool.handler({}, CALL_CTX)
    expect(order).toEqual(['authorize', 'resolveContext', 'core'])
  })

  it('a denied call performs zero context, shape and database work', async () => {
    let contextCalls = 0
    let shapeCalls = 0
    let coreCalls = 0
    const { tools } = registerOne(
      {
        findMany: {
          shape: () => {
            shapeCalls++
            return { where: { site_id: { equals: 'a' } }, take: 50 }
          },
        },
      },
      async () => {
        coreCalls++
        return []
      },
      sharedWith({
        resolveContext: () => {
          contextCalls++
          return {}
        },
        authorize: () => {
          throw new McpAuthorizationError('denied for tenant-a')
        },
      }),
    )
    const tool = tools[0]
    if (!tool) throw new Error('tool not registered')
    const result = await tool.handler({}, CALL_CTX)
    expect(result.isError).toBe(true)
    expect(JSON.parse(result.content[0]?.text ?? '{}').message).toBe(
      'denied for tenant-a',
    )
    expect(contextCalls).toBe(0)
    expect(shapeCalls).toBe(0)
    expect(coreCalls).toBe(0)
  })

  it('a successful void authorization proceeds to execution', async () => {
    let authorized = false
    const { tools } = registerOne(
      { findMany: { shape: { take: 50 } } },
      async () => ['ok'],
      sharedWith({
        authorize: () => {
          authorized = true
        },
      }),
    )
    const tool = tools[0]
    if (!tool) throw new Error('tool not registered')
    const result = await tool.handler({}, CALL_CTX)
    expect(authorized).toBe(true)
    expect(result.isError).toBeUndefined()
    expect(JSON.parse(result.content[0]?.text ?? '""')).toEqual(['ok'])
  })

  it('a typed denial becomes isError with the denial message', async () => {
    const { tools } = registerOne(
      { findMany: { shape: { take: 50 } } },
      async () => [],
      sharedWith({
        authorize: () => {
          throw new McpAuthorizationError('no access to User')
        },
      }),
    )
    const result = await tools[0]?.handler({}, CALL_CTX)
    expect(result?.isError).toBe(true)
    expect(JSON.parse(result.content?.[0]?.text ?? '{}')).toEqual({
      message: 'no access to User',
    })
  })

  it('an unexpected authorize error becomes a classified internal error, never allow', async () => {
    let coreCalls = 0
    const { tools } = registerOne(
      { findMany: { shape: { take: 50 } } },
      async () => {
        coreCalls++
        return []
      },
      sharedWith({
        authorize: () => {
          throw new Error('boom')
        },
      }),
    )
    const result = await tools[0]?.handler({}, CALL_CTX)
    expect(result?.isError).toBe(true)
    expect(JSON.parse(result.content?.[0]?.text ?? '{}').status).toBe(500)
    expect(coreCalls).toBe(0)
  })

  it('an unroutable call-time caller is a classified 400', async () => {
    // registration resolves fine; the CALL-TIME reroute does not (policy
    // changed between registration and call) — fail closed with a 400
    let callTime = false
    const { tools } = registerOne(
      {
        findMany: { variants: { 'tenant-a': { shape: { take: 50 } } } },
      },
      async () => [],
      sharedWith({
        resolveCaller: () => (callTime ? 'no-such-variant' : 'tenant-a'),
      }),
    )
    expect(tools).toHaveLength(1)
    callTime = true
    const result = await tools[0]?.handler({}, CALL_CTX)
    expect(result?.isError).toBe(true)
    expect(JSON.parse(result.content?.[0]?.text ?? '{}').status).toBe(400)
  })
})

describe('MCP execution — memoized context reaches overrides', () => {
  it('resolveContext runs exactly once per call even with override + dynamic shape', async () => {
    let contextCalls = 0
    const coreCalls: unknown[] = []
    const { tools } = registerOne(
      {
        findMany: {
          shape: () => ({ where: { site_id: { equals: 'a' } }, take: 50 }),
        },
      },
      async (ctx) => {
        coreCalls.push(ctx)
        return []
      },
      sharedWith({
        resolveContext: () => {
          contextCalls++
          return { tenant: 'tenant-a' }
        },
      }),
    )
    const tool = tools[0]
    if (!tool) throw new Error('tool not registered')
    await tool.handler({}, CALL_CTX)
    expect(contextCalls).toBe(1)
    // the core saw the memoized resolver
    const ctx = coreCalls[0] as OperationContext
    expect(typeof ctx.resolveOperationContext).toBe('function')
  })
})

describe('MCP execution — row limits (verified guard semantics: take >= 1)', () => {
  const takeAt = async (
    shared: Partial<McpSharedOptions>,
    args: Record<string, unknown>,
    shape: unknown = { take: { max: 500 } },
  ) => {
    const seen: unknown[] = []
    const { tools } = registerOne(
      { findMany: { shape } },
      async (ctx) => {
        seen.push(ctx.parsedQuery)
        return []
      },
      sharedWith(shared),
    )
    const result = await tools[0]?.handler(args, CALL_CTX)
    return { seen, result }
  }

  it('omitted take becomes defaultLimit', async () => {
    const { seen, result } = await takeAt({ defaultLimit: 7 }, {})
    expect(seen[0]).toMatchObject({ take: 7 })
    expect(result?.isError).toBeUndefined()
  })

  it('an oversized positive take clamps to maxLimit', async () => {
    const { seen } = await takeAt({ maxLimit: 40 }, { take: 999 })
    expect(seen[0]).toMatchObject({ take: 40 })
  })

  it('a negative take is a 400 (prisma-guard rejects it; no clamp promise)', async () => {
    const { seen, result } = await takeAt({ maxLimit: 40 }, { take: -999 })
    expect(seen).toEqual([])
    expect(result?.isError).toBe(true)
    expect(JSON.parse(result?.content?.[0]?.text ?? '{}').status).toBe(400)
  })

  it('a non-integer take yields 400', async () => {
    const { result } = await takeAt({}, { take: 2.5 })
    expect(result?.isError).toBe(true)
    expect(JSON.parse(result?.content?.[0]?.text ?? '{}').status).toBe(400)
  })

  it('the resolved shape bound wins: shape max 10, shared max 100, request 50 -> core sees 10', async () => {
    // the effective bound is min(maxLimit, resolved shape take.max); with a
    // DYNAMIC shape the schema cannot advertise the maximum, so this proves
    // the runtime clamp honours the resolved bound, not just shared.maxLimit
    const { seen, result } = await takeAt(
      { maxLimit: 100, defaultLimit: 5 },
      { take: 50 },
      // DYNAMIC shape: the schema cannot advertise the maximum, so only the
      // runtime clamp against the resolved bound can bound the query
      () => ({ where: { site_id: { equals: 'a' } }, take: { max: 10 } }),
    )
    expect(seen[0]).toMatchObject({ take: 10 })
    expect(result?.isError).toBeUndefined()
  })

  it('a guard-stricter take.max wins: the delegate receives the clamped-by-guard shape', async () => {
    // static-shape variant: take above the advertised schema maximum is
    // rejected by the SDK layer before the handler; bypassed here, the
    // runtime clamp lands on min(maxLimit, shape.max)
    const seen: unknown[] = []
    const { tools } = registerOne(
      { findMany: { shape: { take: { max: 500 } } } },
      async (ctx) => {
        seen.push(ctx.parsedQuery)
        return []
      },
      sharedWith({ maxLimit: 50 }),
    )
    await tools[0]?.handler({ take: 30 }, CALL_CTX)
    expect(seen[0]).toMatchObject({ take: 30 })
  })

  it('the injected default never exceeds the guard take.max (dynamic shape, runtime check)', async () => {
    let coreCalls = 0
    const { server, tools } = fakeServer()
    registerMcpTools(server as McpServer, {
      ...sharedWith({ defaultLimit: 20 }),
      tools: [
        createMcpReadTool({
          model: 'User',
          operation: 'findMany',
          config: {
            findMany: {
              shape: () => ({ where: { site_id: { equals: 'a' } }, take: { max: 10 } }),
            },
          },
          core: async () => {
            coreCalls++
            return []
          },
          fields,
          enums: new Map(),
          modelIndex: new Map(),
        }),
      ],
    })
    const result = await tools[0]?.handler({}, CALL_CTX)
    expect(result?.isError).toBe(true)
    expect(JSON.parse(result?.content?.[0]?.text ?? '{}').status).toBe(500)
    expect(coreCalls).toBe(0)
  })

  it('a dynamic shape without take is a classified 500 with no DB call', async () => {
    let coreCalls = 0
    const { server, tools } = fakeServer()
    registerMcpTools(server as McpServer, {
      ...sharedWith(),
      tools: [
        createMcpReadTool({
          model: 'User',
          operation: 'findMany',
          config: { findMany: { shape: () => ({ where: { site_id: { equals: 'a' } } }) } },
          core: async () => {
            coreCalls++
            return []
          },
          fields,
          enums: new Map(),
          modelIndex: new Map(),
        }),
      ],
    })
    const result = await tools[0]?.handler({}, CALL_CTX)
    expect(result?.isError).toBe(true)
    expect(JSON.parse(result?.content?.[0]?.text ?? '{}').status).toBe(500)
    expect(coreCalls).toBe(0)
  })
})

describe('MCP execution — result-size cap', () => {
  it('the narrowing guidance survives NODE_ENV=production', async () => {
    const prevEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    try {
      const rows = bigRows(2)
      const json = JSON.stringify(rows)
      const cap = new TextEncoder().encode(json).byteLength - 1
      const { tools } = registerOne(
        { findMany: { shape: { take: { max: 500 } } } },
        async () => rows,
        sharedWith({ maxResultBytes: cap }),
      )
      const result = await tools[0]?.handler({}, CALL_CTX)
      expect(result?.isError).toBe(true)
      expect(JSON.parse(result?.content?.[0]?.text ?? '{}').message).toMatch(
        /narrow the query/i,
      )
    } finally {
      if (prevEnv === undefined) delete process.env.NODE_ENV
      else process.env.NODE_ENV = prevEnv
    }
  })

  const bigRows = (rows: number) =>
    Array.from({ length: rows }, (_, i) => ({ id: i, pad: 'x'.repeat(100) }))

  it('a payload exactly at the cap passes', async () => {
    const rows = bigRows(2)
    const json = JSON.stringify(rows)
    const cap = new TextEncoder().encode(json).byteLength
    const { tools } = registerOne(
      { findMany: { shape: { take: { max: 500 } } } },
      async () => rows,
      sharedWith({ maxResultBytes: cap }),
    )
    const result = await tools[0]?.handler({}, CALL_CTX)
    expect(result?.isError).toBeUndefined()
  })

  it('a payload one byte over the cap returns an error instructing a narrower query', async () => {
    const rows = bigRows(2)
    const json = JSON.stringify(rows)
    const cap = new TextEncoder().encode(json).byteLength - 1
    const { tools } = registerOne(
      { findMany: { shape: { take: { max: 500 } } } },
      async () => rows,
      sharedWith({ maxResultBytes: cap }),
    )
    const result = await tools[0]?.handler({}, CALL_CTX)
    expect(result?.isError).toBe(true)
    expect(JSON.parse(result?.content?.[0]?.text ?? '{}').message).toMatch(
      /narrow the query/i,
    )
  })

  it('a multibyte UTF-8 payload is measured in bytes, not string length', async () => {
    // 'é' is 1 UTF-16 code unit but 2 UTF-8 bytes
    const rows = [{ pad: 'é'.repeat(100) }]
    const json = JSON.stringify(rows)
    const bytes = new TextEncoder().encode(json).byteLength
    expect(bytes).toBeGreaterThan(json.length)

    const atBytes = registerOne(
      { findMany: { shape: { take: { max: 500 } } } },
      async () => rows,
      sharedWith({ maxResultBytes: bytes }),
    )
    expect(
      (await atBytes.tools[0]?.handler({}, CALL_CTX))?.isError,
    ).toBeUndefined()

    const oneUnder = registerOne(
      { findMany: { shape: { take: { max: 500 } } } },
      async () => rows,
      sharedWith({ maxResultBytes: bytes - 1 }),
    )
    const result = await oneUnder.tools[0]?.handler({}, CALL_CTX)
    expect(result?.isError).toBe(true)
  })
})

describe('MCP execution — caller comes only from verified AuthInfo', () => {
  it('tool arguments can never influence the caller or variant', async () => {
    const seenVariants: Array<string | undefined> = []
    const { tools } = registerOne(
      {
        findMany: {
          variants: {
            'tenant-a': { shape: { where: { site_id: { equals: 'a' } }, take: 50 } },
            'tenant-b': { shape: { where: { site_id: { equals: 'b' } }, take: 50 } },
          },
        },
      },
      async (ctx) => {
        seenVariants.push(ctx.guardVariantKey)
        return []
      },
      sharedWith({
        authInfo: fakeAuthInfo(),
        resolveCaller: (authInfo) =>
          authInfo?.clientId === 'client-1' ? 'tenant-a' : 'tenant-b',
      }),
    )
    const tool = tools[0]
    if (!tool) throw new Error('tool not registered')
    // caller/variant arguments are ignored entirely
    await tool.handler(
      { caller: 'tenant-b', variant: 'tenant-b', take: 5 },
      CALL_CTX,
    )
    expect(seenVariants).toEqual(['tenant-a'])
  })
})

describe('MCP execution — REST parity of the execution context', () => {
  it('the core receives guard shape, caller, variant, pagination and override like REST', async () => {
    const seen: OperationContext[] = []
    const { server, tools } = fakeServer()
    registerMcpTools(server as McpServer, {
      ...sharedWith(),
      resolveCaller: () => 'tenant-a',
      tools: [
        createMcpReadTool({
          model: 'User',
          operation: 'findMany',
          config: {
            pagination: { distinctCountLimit: 42 },
            findMany: {
              shape: { where: { site_id: { equals: 'a' } }, take: { max: 500 } },
              override: async (input: { core: () => Promise<unknown> }) =>
                input.core(),
            },
          },
          core: async (ctx) => {
            seen.push(ctx)
            return []
          },
          fields,
          enums: new Map(),
          modelIndex: new Map(),
        }),
      ],
    })
    await tools[0]?.handler({ take: 10 }, CALL_CTX)
    const ctx = seen[0]
    expect(ctx.guardShape).toMatchObject({
      where: { site_id: { equals: 'a' } },
      take: { max: 500 },
    })
    expect(ctx.guardCaller).toBe('tenant-a')
    // a top-level shape is single-routing: no variant key, exactly like REST
    expect(ctx.guardVariantKey).toBeUndefined()
    expect(ctx.paginationConfig).toMatchObject({ distinctCountLimit: 42 })
    expect(typeof ctx.operationOverride).toBe('function')
  })
})
