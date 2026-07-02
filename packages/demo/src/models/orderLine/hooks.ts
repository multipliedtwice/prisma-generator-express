/**
 * OrderLine hooks.
 *
 * enforceShopThroughOrder: OrderLine has no direct shopId. This hook
 * enforces tenancy via the parent Order relation.
 *
 * requireDetailSse: OrderLine.findMany intentionally has no guard shape
 * so auto-include SSE can run. To keep the endpoint from being a wide
 * unguarded JSON read, this gate rejects any request that isn't the
 * SSE detail flow.
 */
import type { Request, Response, NextFunction, RequestHandler } from 'express'
import { getContext } from '../../context'

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

export const enforceShopThroughOrder: RequestHandler = (
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  const ctx = getContext()
  const locals = res.locals as LocalsBag
  const query = (locals.parsedQuery ??= {})
  query.where = mergeWhere(query.where, { order: { shopId: ctx.shopId } })
  next()
}

export const requireDetailSse: RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const variant = req.get('x-api-variant')
  const accept = req.get('accept') || ''

  if (variant !== 'detail' || !accept.includes('text/event-stream')) {
    res.status(400).json({
      message:
        'OrderLine.findMany is only exposed for the detail SSE demo. ' +
        'Send Accept: text/event-stream and x-api-variant: detail.',
    })
    return
  }

  next()
}