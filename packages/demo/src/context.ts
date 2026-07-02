/**
 * Fake-JWT request context using AsyncLocalStorage.
 *
 * A real app would decode a JWT / look up a session here. The token→context
 * map exists so the demo can prove tenant isolation without a real IdP.
 * The store is read by prisma.ts (guard extension) and by hooks that need
 * the current shop/user/role.
 */
import { AsyncLocalStorage } from 'node:async_hooks'
import type { Request, Response, NextFunction, RequestHandler } from 'express'

export type Role = 'OWNER' | 'ADMIN' | 'MEMBER'

export type RequestContext = {
  userId: string
  shopId: string
  role: Role
}

const store = new AsyncLocalStorage<RequestContext>()

const TOKENS: Record<string, RequestContext> = {
  'owner-acme':   { userId: 'u-owner-acme',   shopId: 'shop-acme',   role: 'OWNER' },
  'admin-acme':   { userId: 'u-admin-acme',   shopId: 'shop-acme',   role: 'ADMIN' },
  'member-acme':  { userId: 'u-member-acme',  shopId: 'shop-acme',   role: 'MEMBER' },
  'owner-globex': { userId: 'u-owner-globex', shopId: 'shop-globex', role: 'OWNER' },
}

/** Throws if called outside a request — guard extension and hooks depend on this. */
export function getContext(): RequestContext {
  const ctx = store.getStore()
  if (!ctx) throw new Error('Request context missing')
  return ctx
}

function isPublicPath(path: string): boolean {
  if (path === '/docs' || path.startsWith('/docs/')) return true
  if (path.endsWith('/docs')) return true
  if (path.endsWith('/openapi.json')) return true
  if (path.endsWith('/openapi.yaml')) return true
  return false
}

/**
 * Reads x-auth-token, populates ALS. Docs / OpenAPI / playground paths
 * bypass auth so the demo remains browsable without a token.
 */
export const contextMiddleware: RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (isPublicPath(req.path)) {
    next()
    return
  }

  const token = req.get('x-auth-token')
  if (!token) {
    res.status(401).json({ message: 'Missing x-auth-token header' })
    return
  }

  const ctx = TOKENS[token]
  if (!ctx) {
    res.status(401).json({ message: 'Unknown token' })
    return
  }

  store.run(ctx, () => next())
}