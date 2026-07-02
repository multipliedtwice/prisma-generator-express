/**
 * Demonstration of the prefetch/attach middleware pattern.
 *
 * The only place in the demo where custom application logic is layered
 * on top of a generated route. It shows what real integration code
 * looks like when a shape can't express the required enrichment.
 *
 * Pattern:
 *   1. before: one aggregate query, stash result in res.locals
 *   2. generated handler: normal Prisma query for the route
 *   3. after: walk res.locals.data and merge the pre-fetched result in
 *
 * The field is named maxOrderIdByProduct intentionally: the aggregate
 * is _max(orderId), which is the highest orderId string per product,
 * not a real "last sold" timestamp. A real implementation would join
 * on order.createdAt.
 */
import type { Request, Response, NextFunction, RequestHandler } from 'express'
import { getContext } from '../../context'

type ProductRow = { id: string; maxOrderIdByProduct?: string | null }

export const prefetchMaxOrderId: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const shopId = getContext().shopId
    const rows = await req.prisma.orderLine.groupBy({
      by: ['productId'],
      where: { product: { shopId } },
      _max: { orderId: true },
    })
    const map = new Map<string, string | null>()
    for (const r of rows) {
      map.set(r.productId, r._max.orderId ?? null)
    }
    res.locals.maxOrderIdByProduct = map
    next()
  } catch (err) {
    next(err)
  }
}

export const attachMaxOrderId: RequestHandler = (
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  const data = res.locals.data
  const map = res.locals.maxOrderIdByProduct as
    | Map<string, string | null>
    | undefined

  if (!map) {
    next()
    return
  }

  const rows: unknown[] | undefined = Array.isArray(data)
    ? (data as unknown[])
    : (data as { data?: unknown[] } | undefined)?.data

  if (!Array.isArray(rows)) {
    next()
    return
  }

  for (const row of rows) {
    if (row && typeof row === 'object' && 'id' in row) {
      ;(row as ProductRow).maxOrderIdByProduct =
        map.get((row as ProductRow).id) ?? null
    }
  }

  next()
}