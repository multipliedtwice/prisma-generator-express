import { describe, it, expect } from 'vitest'
import type { McpServer } from '@modelcontextprotocol/server'
import {
  createMcpWriteTool,
  registerMcpTools,
  McpAuthorizationError,
  type McpSharedOptions,
  type McpWriteOperation,
} from '../../../src/copy/mcpRuntime'
import type { OperationContext } from '../../../src/copy/operationRuntime'
import { fakeServer, fakeAuthInfo } from './mcpTestHarness'

/**
 * Phase 11 write execution semantics: the tool arguments travel the SAME
 * pipeline stage sequence as REST write routes — the sanitized arguments are
 * the request body the operation core reads, the guard shape/caller/variant
 ride along identically, authorize runs before any work, and the result-size
 * cap covers write results too.
 */

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

function registerWrite(
  operation: McpWriteOperation,
  config: Record<string, unknown>,
  core: (ctx: OperationContext) => Promise<unknown>,
  shared: McpSharedOptions = sharedWith(),
) {
  const { server, tools } = fakeServer()
  registerMcpTools(server as McpServer, {
    ...shared,
    tools: [
      createMcpWriteTool({
        model: 'Ticket',
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

describe('MCP write execution — body channel', () => {
  it('the core receives the tool arguments as ctx.body, exactly like REST write routes', async () => {
    const seen: OperationContext[] = []
    const { tools } = registerWrite(
      'create',
      { create: { shape: { data: { title: true, siteId: true } } } },
      async (ctx) => {
        seen.push(ctx)
        return { id: 'new-1' }
      },
    )
    const result = await tools[0].handler(
      { data: { title: 't', siteId: 'tenant-a' } },
      CALL_CTX,
    )
    expect(result.isError).toBeFalsy()
    expect(seen[0].body).toEqual({ data: { title: 't', siteId: 'tenant-a' } })
    expect(JSON.parse(result.content[0].text)).toEqual({ id: 'new-1' })
  })

  it('parsedQuery stays empty for writes (REST write routes carry no query channel)', async () => {
    const seen: OperationContext[] = []
    const { tools } = registerWrite(
      'update',
      { update: { shape: { where: { id: true }, data: { hidden: true } } } },
      async (ctx) => {
        seen.push(ctx)
        return { id: 'x' }
      },
    )
    await tools[0].handler(
      { where: { id: 'x' }, data: { hidden: true } },
      CALL_CTX,
    )
    expect(seen[0].parsedQuery).toEqual({})
  })

  it('prototype-polluting keys are stripped before the core runs', async () => {
    const seen: OperationContext[] = []
    const { tools } = registerWrite(
      'create',
      { create: { shape: { data: { title: true, siteId: true } } } },
      async (ctx) => {
        seen.push(ctx)
        return {}
      },
    )
    // JSON.parse creates REAL own `__proto__` / `constructor` keys (an
    // object literal would not), exactly as a JSON-RPC body would
    const args = JSON.parse(
      '{"data":{"title":"t","siteId":"s","__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}}},"__proto__":{"polluted":true}}',
    ) as Record<string, unknown>
    expect(Object.keys(args.data as object)).toContain('__proto__')
    await tools[0].handler(args, CALL_CTX)
    const body = seen[0].body as Record<string, Record<string, unknown>>
    expect(Object.keys(body)).toEqual(['data'])
    expect(Object.keys(body.data)).toEqual(['title', 'siteId'])
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  })
})

describe('MCP write execution — authorization and ordering', () => {
  it('authorize runs before any database work on writes', async () => {
    const order: string[] = []
    const { tools } = registerWrite(
      'delete',
      { delete: { shape: { where: { id: true } } } },
      async () => {
        order.push('core')
        return { id: 'x' }
      },
      sharedWith({
        authorize: () => {
          order.push('authorize')
          throw new McpAuthorizationError('writes denied for this principal')
        },
      }),
    )
    const result = await tools[0].handler({ where: { id: 'x' } }, CALL_CTX)
    expect(order).toEqual(['authorize'])
    expect(result.isError).toBe(true)
    expect(JSON.parse(result.content[0].text).message).toBe(
      'writes denied for this principal',
    )
  })

  it('a call without a verified principal is denied before any work', async () => {
    let ran = false
    const { tools } = registerWrite(
      'create',
      { create: { shape: { data: { title: true, siteId: true } } } },
      async () => {
        ran = true
        return {}
      },
    )
    const result = await tools[0].handler(
      { data: { title: 't', siteId: 's' } },
      { http: {} },
    )
    expect(result.isError).toBe(true)
    expect(JSON.parse(result.content[0].text).message).toMatch(
      /unauthenticated/,
    )
    expect(ran).toBe(false)
  })

  it('the variant re-routes from the call-time principal, never from arguments', async () => {
    const variantsSeen: Array<string | undefined> = []
    const shared = sharedWith({
      resolveCaller: (info) =>
        info?.clientId === 'tenant-b' ? 'tenant-b' : 'tenant-a',
    })
    const { tools } = registerWrite(
      'update',
      {
        update: {
          variants: {
            'tenant-a': {
              shape: { where: { id: true }, data: { hidden: true } },
            },
            'tenant-b': {
              shape: { where: { id: true }, data: { title: true } },
            },
          },
        },
      },
      async (ctx) => {
        variantsSeen.push(ctx.guardVariantKey)
        return { id: 'x' }
      },
      shared,
    )
    // arguments naming another caller/variant are ignored: routing comes
    // from the verified principal only (tenant-b here)
    await tools[0].handler(
      {
        where: { id: 'x' },
        data: { hidden: true },
        caller: 'tenant-a',
        variant: 'tenant-a',
      },
      { http: { authInfo: fakeAuthInfo({ clientId: 'tenant-b' }) } },
    )
    expect(variantsSeen).toEqual(['tenant-b'])
  })
})

describe('MCP write execution — result handling', () => {
  it('an oversized write result is a SUCCESS with the result omitted — the write is committed, a retry would duplicate it', async () => {
    let coreCalls = 0
    const { tools } = registerWrite(
      'create',
      { create: { shape: { data: { title: true, siteId: true } } } },
      async () => {
        coreCalls++
        return { blob: 'x'.repeat(200) }
      },
      sharedWith({ maxResultBytes: 100 }),
    )
    const result = await tools[0].handler(
      { data: { title: 't', siteId: 's' } },
      CALL_CTX,
    )
    expect(coreCalls).toBe(1)
    expect(result.isError).toBeFalsy()
    const payload = JSON.parse(result.content[0].text) as Record<
      string,
      unknown
    >
    expect(payload).toMatchObject({ committed: true, resultOmitted: true })
    expect(payload.message).toMatch(/was committed/)
    expect(payload.message).toMatch(/Do not retry/)
    // the omission notice carries no record data
    expect(result.content[0].text).not.toContain('xxxx')
  })

  it('a Prisma error thrown by the core is classified like REST (P2002 -> 409), not thrown', async () => {
    const { tools } = registerWrite(
      'create',
      { create: { shape: { data: { title: true, siteId: true } } } },
      async () => {
        const error = new Error('Unique constraint failed')
        ;(error as { code?: string }).code = 'P2002'
        throw error
      },
    )
    const result = await tools[0].handler(
      { data: { title: 't', siteId: 's' } },
      CALL_CTX,
    )
    expect(result.isError).toBe(true)
    expect(JSON.parse(result.content[0].text).status).toBe(409)
  })
})
