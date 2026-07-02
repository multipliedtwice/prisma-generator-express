/**
 * Shared cross-model hooks.
 *
 * restrictMemberToSelf forces where.id = current userId for MEMBER role.
 * Used on both findMany and findUnique on User.
 *
 * requireOwnerRole gates any guard-bypassing route (currently
 * User.updateEach). Explicit 403 for non-owners.
 *
 * restrictToCurrentShop is a defensive filter for Shop routes. It exists
 * because it is not fully verified whether @scope-root Shop scopes the
 * Shop model itself, only models linked to it. This hook ensures a shop
 * token can never enumerate other shops.
 */
import type { Request, Response, NextFunction, RequestHandler } from 'express'
import { getContext } from './context'

type LocalsBag = { parsedQuery?: Record<string, unknown> }

function mergeWhere(
  existing: unknown,
  extra: Record<string, unknown>,
): Record<string, unknown> {
  if (!existing || typeof existing !== 'object' || Array.isArray(existing)) {
    return extra
  }
  return { AND: [existing as Record<string, unknown>, extra] }
}

export const restrictMemberToSelf: RequestHandler = (
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  const ctx = getContext()
  if (ctx.role !== 'MEMBER') {
    next()
    return
  }
  const locals = res.locals as LocalsBag
  const query = (locals.parsedQuery ??= {})
  query.where = mergeWhere(query.where, { id: ctx.userId })
  next()
}

export const requireOwnerRole: RequestHandler = (
  _req: Request,
  _res: Response,
  next: NextFunction,
) => {
  const ctx = getContext()
  if (ctx.role !== 'OWNER') {
    const err = new Error('Owner role required')
    ;(err as Error & { status?: number }).status = 403
    next(err)
    return
  }
  next()
}

export const restrictToCurrentShop: RequestHandler = (
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  const ctx = getContext()
  const locals = res.locals as LocalsBag
  const query = (locals.parsedQuery ??= {})
  query.where = mergeWhere(query.where, { id: ctx.shopId })
  next()
}