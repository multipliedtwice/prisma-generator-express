import type { McpServer, AuthInfo } from '@modelcontextprotocol/server'
import type { McpToolContribution } from '../../../src/copy/mcpRuntime'

/** Minimal structural registrar; the real server is exercised in the
 * integration test — here only registration shape matters. */
export type RecordedTool = {
  name: string
  config: {
    description?: string
    annotations?: Record<string, unknown>
    inputSchema?: unknown
  }
  handler: (
    args: Record<string, unknown>,
    ctx?: { http?: { authInfo?: AuthInfo } },
  ) => Promise<{
    content: Array<{ type: 'text'; text: string }>
    isError?: boolean
  }>
}

export function fakeServer(): { server: McpServer; tools: RecordedTool[] } {
  const tools: RecordedTool[] = []
  const server = {
    registerTool(
      name: string,
      config: RecordedTool['config'],
      handler: RecordedTool['handler'],
    ) {
      tools.push({ name, config, handler })
    },
    // one deliberate structural cast: this object only ever feeds tests that
    // read `tools` back, never SDK internals
  } as unknown as McpServer
  return { server, tools }
}

export function fakeAuthInfo(overrides: Partial<AuthInfo> = {}): AuthInfo {
  return {
    token: 'verified-token',
    clientId: 'client-1',
    scopes: ['mcp'],
    expiresAt: Date.now() + 60_000,
    ...overrides,
  } as AuthInfo
}

export function recordingCore(ops: { calls: unknown[] } = { calls: [] }): {
  core: (ctx: unknown) => Promise<unknown>
  calls: unknown[]
} {
  return {
    core: async (ctx: unknown) => {
      ops.calls.push(ctx)
      return [{ id: 'row-1', site_id: 'tenant-a' }]
    },
    calls: ops.calls,
  }
}

import type { SchemaModelMeta } from '../../../src/copy/operationSchemas'
import type { SchemaFieldMeta } from '../../../src/copy/operationSchemas'

/**
 * Full model metadata for schema building: relation recursion now walks
 * SchemaModelMeta values (compound uniques ride along), so every fixture
 * modelIndex must store complete metas, not bare field arrays.
 */
export function modelMeta(
  name: string,
  fields: readonly SchemaFieldMeta[],
  overrides: Partial<Omit<SchemaModelMeta, 'name' | 'fields'>> = {},
): SchemaModelMeta {
  return {
    name,
    fields,
    enums: new Map(),
    uniqueFields: fields.filter((f) => f.isId || f.isUnique).map((f) => f.name),
    compoundUniques: [],
    modelIndex: new Map(),
    ...overrides,
  }
}
