import { describe, it, expect, afterAll } from 'vitest'
import express from 'express'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { Client } from '@modelcontextprotocol/client'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/client'
import {
  McpServer,
  createMcpHandler,
  type AuthInfo,
} from '@modelcontextprotocol/server'
import { toNodeHandler } from '@modelcontextprotocol/node'
import { Hono } from 'hono'
import {
  McpAuthorizationError,
  registerMcpTools,
  createMcpReadTool,
} from '../../../src/copy/mcpRuntime'
import type { OperationContext } from '../../../src/copy/operationRuntime'
import { fakeAuthInfo } from './mcpTestHarness'

/**
 * A REAL Streamable HTTP round trip through one /mcp endpoint, in the same
 * process as the REST backend, driven by the official SDK v2 client.
 */

const authInfo: AuthInfo = fakeAuthInfo()

function guardedCore(rows: Array<Record<string, unknown>>) {
  const guardCalls: Array<{ shape: unknown; caller: string | undefined }> = []
  const findManyCalls: unknown[] = []
  const delegate: Record<string, unknown> = {
    findMany: async (query: unknown) => {
      findManyCalls.push(query)
      return rows
    },
    guard: (shape: unknown, caller: string | undefined) => {
      guardCalls.push({ shape, caller })
      return delegate
    },
  }
  // what a prisma-guard extended client hands back: guard(shape, caller).op(args)
  const core = async (ctx: OperationContext) =>
    (
      (
        delegate.guard as (
          s: unknown,
          c: string | undefined,
        ) => Record<string, unknown>
      )(ctx.guardShape, ctx.guardCaller).findMany as (
        q: unknown,
      ) => Promise<unknown>
    )(ctx.parsedQuery)
  return { core, guardCalls, findManyCalls, delegate }
}

const TICKET_FIELDS = [
  {
    name: 'id',
    kind: 'scalar',
    type: 'String',
    isList: false,
    isRequired: true,
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
    isRequired: true,
  },
]

const servers: Server[] = []
afterAll(async () => {
  await Promise.all(
    servers.map(
      (s) =>
        new Promise<void>((resolve) => {
          s.close(() => resolve())
        }),
    ),
  )
})

async function listen(app: express.Express): Promise<number> {
  const server = createServer(app)
  servers.push(server)
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  return (server.address() as AddressInfo).port
}

function mcpExpressApp(
  buildOptions: () => Omit<Parameters<typeof registerMcpTools>[1], 'authInfo'>,
  withAuth: boolean,
): express.Express {
  const handler = createMcpHandler((ctx) => {
    const server = new McpServer({ name: 'test-api', version: '1.0.0' })
    // the per-request factory's verified principal — required, fail closed
    registerMcpTools(server, { ...buildOptions(), authInfo: ctx.authInfo! })
    return server
  })
  const node = toNodeHandler(handler)
  const app = express()
  app.use(express.json())
  if (withAuth) {
    app.use((req, _res, next) => {
      ;(req as unknown as { auth: AuthInfo }).auth = authInfo
      next()
    })
  }
  app.all('/mcp', (req, res) => void node(req, res, req.body))
  return app
}

describe('MCP Streamable HTTP integration (Express, same process)', () => {
  it('lists and calls tools through /mcp with a verified principal', async () => {
    const { core, guardCalls, findManyCalls, delegate } = guardedCore([
      { id: 'u1', site_id: 'tenant-a', name: 'Ann' },
    ])
    const authorizeCalls: unknown[] = []

    const app = mcpExpressApp(
      () => ({
        prisma: { user: delegate },
        resolveCaller: (info: AuthInfo) =>
          info?.clientId === 'client-1' ? 'tenant-a' : undefined,
        authorize: (input: unknown) => {
          authorizeCalls.push(input)
        },
        defaultLimit: 5,
        maxLimit: 50,
        maxResultBytes: 1_000_000,
        tools: [
          createMcpReadTool({
            model: 'User',
            operation: 'findMany',
            config: {
              findMany: {
                variants: {
                  'tenant-a': {
                    shape: {
                      where: { siteId: { equals: 'tenant-a' } },
                      take: { max: 50 },
                    },
                  },
                },
              },
            },
            core,
            fields: TICKET_FIELDS,
            enums: new Map(),
            modelIndex: new Map(),
          }),
        ],
      }),
      true,
    )
    const port = await listen(app)

    const client = new Client({ name: 'test-client', version: '1.0.0' })
    const transport = new StreamableHTTPClientTransport(
      new URL(`http://127.0.0.1:${port}/mcp`),
    )
    await client.connect(transport)
    try {
      const listed = await client.listTools()
      expect(listed.tools.map((t) => t.name)).toEqual(['user_find_many'])
      expect(listed.tools[0]?.annotations).toEqual({
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      })

      const called = await client.callTool({
        name: 'user_find_many',
        arguments: { take: 10 },
      })
      expect(called.isError).toBeFalsy()
      const block = (
        called.content as Array<{ type: string; text?: string }>
      )[0]
      expect(block?.type).toBe('text')
      expect(JSON.parse(block?.text ?? '[]')).toEqual([
        { id: 'u1', site_id: 'tenant-a', name: 'Ann' },
      ])

      expect(authorizeCalls).toHaveLength(1)
      expect(authorizeCalls[0]).toMatchObject({
        model: 'User',
        operation: 'findMany',
        variant: 'tenant-a',
      })
      expect(guardCalls).toHaveLength(1)
      expect(guardCalls[0]?.caller).toBe('tenant-a')
      expect(findManyCalls[0]).toMatchObject({ take: 10 })
    } finally {
      await client.close()
    }
  }, 30_000)

  it('an unauthenticated request fails closed before any tool runs', async () => {
    const { core, delegate } = guardedCore([])
    const app = mcpExpressApp(
      () => ({
        prisma: { user: delegate },
        resolveCaller: () => 'tenant-a',
        authorize: () => undefined,
        defaultLimit: 5,
        maxLimit: 50,
        maxResultBytes: 1_000_000,
        tools: [
          createMcpReadTool({
            model: 'User',
            operation: 'findMany',
            config: {
              findMany: { variants: { 'tenant-a': { shape: { take: 50 } } } },
            },
            core,
            fields: TICKET_FIELDS,
            enums: new Map(),
            modelIndex: new Map(),
          }),
        ],
      }),
      false, // NO auth middleware
    )
    const port = await listen(app)
    const res = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    })
    // registration refuses without a verified principal: no tool list
    expect(res.ok).toBe(false)
    const text = await res.text()
    expect(text).not.toContain('user_find_many')
  }, 30_000)

  it('denied calls surface as isError over the wire', async () => {
    const { core, delegate } = guardedCore([])
    const app = mcpExpressApp(
      () => ({
        prisma: { user: delegate },
        resolveCaller: (_info: AuthInfo) => 'tenant-a',
        authorize: () => {
          throw new McpAuthorizationError('denied over the wire')
        },
        defaultLimit: 5,
        maxLimit: 50,
        maxResultBytes: 1_000_000,
        tools: [
          createMcpReadTool({
            model: 'User',
            operation: 'findMany',
            config: {
              findMany: { variants: { 'tenant-a': { shape: { take: 50 } } } },
            },
            core,
            fields: TICKET_FIELDS,
            enums: new Map(),
            modelIndex: new Map(),
          }),
        ],
      }),
      true,
    )
    const port = await listen(app)

    const client = new Client({ name: 'test-client', version: '1.0.0' })
    const transport = new StreamableHTTPClientTransport(
      new URL(`http://127.0.0.1:${port}/mcp`),
    )
    await client.connect(transport)
    try {
      const result = await client.callTool({
        name: 'user_find_many',
        arguments: {},
      })
      expect(result.isError).toBe(true)
    } finally {
      await client.close()
    }
  }, 30_000)
})

describe('MCP Streamable HTTP integration (Hono handler)', () => {
  it('serves tools/list through the web-standard fetch face', async () => {
    const { core, delegate } = guardedCore([])
    const handler = createMcpHandler((ctx) => {
      const server = new McpServer({ name: 'test-api', version: '1.0.0' })
      registerMcpTools(server, {
        prisma: { user: delegate },
        resolveCaller: (_info) => 'tenant-a',
        authorize: () => undefined,
        defaultLimit: 5,
        maxLimit: 50,
        maxResultBytes: 1_000_000,
        authInfo: ctx.authInfo,
        tools: [
          createMcpReadTool({
            model: 'User',
            operation: 'findMany',
            config: {
              findMany: { variants: { 'tenant-a': { shape: { take: 50 } } } },
            },
            core,
            fields: TICKET_FIELDS,
            enums: new Map(),
            modelIndex: new Map(),
          }),
        ],
      })
      return server
    })

    const app = new Hono<{ Variables: { authInfo: AuthInfo } }>()
    app.use('/mcp', async (c, next) => {
      c.set('authInfo', authInfo)
      await next()
    })
    app.all('/mcp', async (c) =>
      handler.fetch(c.req.raw, {
        parsedBody: await c.req.json().catch(() => undefined),
        authInfo: c.get('authInfo'),
      }),
    )

    const res = await app.request('/mcp', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    })
    expect(res.status).toBe(200)
    const text = await res.text()
    expect(text).toContain('user_find_many')
  }, 30_000)
})
