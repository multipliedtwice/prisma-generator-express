import type { ImportStyle } from '../utils/resolveImportStyle'

/**
 * App-level MCP registry (emitted when generator option `mcp = true`),
 * following the app-level `combinedDocs` / `queryBuilder` precedent.
 */
export function generateMcpApp({
  serverName,
  serverVersion,
  importStyle,
}: {
  serverName: string
  serverVersion: string
  importStyle: ImportStyle
}): string {
  return `import type { McpServer } from '@modelcontextprotocol/server'
import { registerMcpTools } from './mcpRuntime'
import type { McpSharedOptions, McpToolContribution } from './mcpRuntime'

export const MCP_SERVER_INFO = { name: ${JSON.stringify(serverName)}, version: ${JSON.stringify(serverVersion)} } as const

export type McpRegisterOptions = McpSharedOptions & {
  /** Explicit allowlist: only these model-operation tools are registered. */
  tools: readonly McpToolContribution[]
}

/**
 * Register the allowed MCP tools on a server instance. Call from the
 * per-request server factory so \`authInfo\` is the verified principal for THIS
 * request. Throws before registering anything when required options are
 * missing, limits are invalid, or the guard is dropped in this environment.
 */
export function registerMcpToolsOnServer(
  server: McpServer,
  options: McpRegisterOptions,
): void {
  registerMcpTools(server, options)
}
`
}

/**
 * Target-specific Streamable HTTP mount glue (emitted when `mcp = true`).
 * One \`/mcp\` endpoint in the same process as the REST backend.
 */
export function generateMcpMount({
  target,
  importStyle,
}: {
  target: 'express' | 'fastify' | 'hono'
  importStyle: ImportStyle
}): string {
  if (target === 'express') {
    return `import type { RequestHandler } from 'express'
import type { McpServer, AuthInfo } from '@modelcontextprotocol/server'
import { createMcpHandler } from '@modelcontextprotocol/server'
import { toNodeHandler } from '@modelcontextprotocol/node'

/**
 * Build the /mcp handler for Express. Authentication is YOUR middleware: put a
 * verified AuthInfo on req.auth (e.g. requireBearerAuth from
 * @modelcontextprotocol/express) before this handler runs. Without req.auth
 * the request fails closed — registration refuses to run without a verified
 * principal.
 */
export function createMcpExpressHandler(
  getServer: (authInfo: AuthInfo) => McpServer,
): RequestHandler {
  const handler = createMcpHandler((ctx) => getServer(ctx.authInfo as AuthInfo))
  const node = toNodeHandler(handler)
  return (req, res) => void node(req, res, req.body)
}
`
  }
  if (target === 'fastify') {
    return `import type { FastifyRequest, FastifyReply } from 'fastify'
import type { McpServer, AuthInfo } from '@modelcontextprotocol/server'
import { createMcpHandler } from '@modelcontextprotocol/server'
import { toNodeHandler } from '@modelcontextprotocol/node'

/**
 * Build the /mcp handler for Fastify. Authentication is YOUR hook: attach the
 * verified AuthInfo to request.raw.auth (onRequest) before this handler runs.
 * Without it the request fails closed — registration refuses to run without a
 * verified principal.
 */
export function createMcpFastifyHandler(
  getServer: (authInfo: AuthInfo) => McpServer,
): (request: FastifyRequest, reply: FastifyReply) => Promise<void> {
  const handler = createMcpHandler((ctx) => getServer(ctx.authInfo as AuthInfo))
  const node = toNodeHandler(handler)
  return async (request, reply) => {
    // The Node handler writes the response itself; without hijacking,
    // Fastify would continue its own reply lifecycle after we return.
    reply.hijack()
    await node(request.raw, reply.raw, request.body)
  }
}
`
  }
  return `import type { Context, Next } from 'hono'
import type { McpServer, AuthInfo } from '@modelcontextprotocol/server'
import { createMcpHandler } from '@modelcontextprotocol/server'

/**
 * Build the /mcp handler for Hono (web-standard). Authentication is YOUR
 * middleware: verify the request and set c.set('authInfo', verified) before
 * this handler runs — or use the web-standard requireBearerAuth gate from
 * @modelcontextprotocol/server and pass its AuthInfo to fetch explicitly.
 */
export function createMcpHonoHandler(
  getServer: (authInfo: AuthInfo) => McpServer,
): (c: Context) => Promise<Response> {
  const handler = createMcpHandler((ctx) => getServer(ctx.authInfo as AuthInfo))
  return async (c: Context) => {
    let parsedBody: unknown
    try {
      parsedBody = await c.req.json()
    } catch {
      parsedBody = undefined
    }
    const authInfo = c.get('authInfo') as AuthInfo | undefined
    if (!authInfo) {
      return Response.json(
        { message: 'unauthenticated: a verified principal is required' },
        { status: 401 },
      )
    }
    return handler.fetch(c.req.raw, { parsedBody, authInfo })
  }
}
`
}
