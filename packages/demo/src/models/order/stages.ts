/**
 * Manual progressive SSE stages for Order.findMany dashboard variant.
 *
 * These stages are fixed server-side and do NOT respect client-supplied
 * Prisma args (where, take, orderBy). The dashboard variant always
 * loads the shop's 20 most recent orders. Auto-include SSE is not
 * available here because the generator disables auto-include when a
 * guard shape is present on the operation.
 *
 * Stage flow:
 *   1. orderIdentity        — load root orders, patch `orders` array
 *   2. orderLineSummary     — load lines per order, patch each
 *                             `orders.N.lines`
 *   3. productInfo          — resolve customer + product refs, patch
 *                             `orders.N.customer` and
 *                             `orders.N.lines.M.product`
 */
import type { ProgressiveStage } from '../../../prisma/generated/express/routeConfig.target'
import type { PrismaLike } from '../../prisma'
import type { RequestContext } from '../../context'

type OrderRow = {
  id: string
  status: string
  totalCents: string
  customerId: string
  createdAt: Date
  lines: unknown[]
  customer: { id: string; fullName: string } | null
}

type LineRow = {
  id: string
  quantity: number
  unitPriceCents: string
  productId: string
  product?: { id: string; name: string } | null
}

export const orderIdentity: ProgressiveStage<RequestContext, PrismaLike> = async ({
  ctx,
  prisma,
}) => {
  const orders = await prisma.order.findMany({
    where: { shopId: ctx.shopId },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: {
      id: true,
      status: true,
      totalCents: true,
      customerId: true,
      createdAt: true,
    },
  })

  return {
    key: 'orders',
    value: orders.map((o) => ({
      id: o.id,
      status: o.status,
      totalCents: o.totalCents.toString(),
      customerId: o.customerId,
      createdAt: o.createdAt,
      lines: [] as unknown[],
      customer: null,
    })),
  }
}

export const orderLineSummary: ProgressiveStage<RequestContext, PrismaLike> = async ({
  prisma,
  accumulated,
}) => {
  const orders = accumulated.orders as OrderRow[] | undefined
  if (!orders || orders.length === 0) return

  const lines = await prisma.orderLine.findMany({
    where: { orderId: { in: orders.map((o) => o.id) } },
    select: {
      id: true,
      orderId: true,
      quantity: true,
      unitPriceCents: true,
      productId: true,
    },
  })

  const byOrder = new Map<string, LineRow[]>()
  for (const line of lines) {
    const bucket = byOrder.get(line.orderId) ?? []
    bucket.push({
      id: line.id,
      quantity: line.quantity,
      unitPriceCents: line.unitPriceCents.toString(),
      productId: line.productId,
    })
    byOrder.set(line.orderId, bucket)
  }

  return orders.map((o, i) => ({
    key: 'orders.' + i + '.lines',
    value: byOrder.get(o.id) ?? [],
  }))
}

export const productInfo: ProgressiveStage<RequestContext, PrismaLike> = async ({
  ctx,
  prisma,
  accumulated,
}) => {
  const orders = accumulated.orders as OrderRow[] | undefined
  if (!orders || orders.length === 0) return

  const customerIds = Array.from(new Set(orders.map((o) => o.customerId)))
  const productIds = Array.from(
    new Set(
      orders.flatMap((o) =>
        (o.lines as LineRow[]).map((l) => l.productId),
      ),
    ),
  )

  const [customers, products] = await Promise.all([
    prisma.customer.findMany({
      where: { id: { in: customerIds }, shopId: ctx.shopId },
      select: { id: true, fullName: true },
    }),
    prisma.product.findMany({
      where: { id: { in: productIds }, shopId: ctx.shopId },
      select: { id: true, name: true },
    }),
  ])

  const customerById = new Map(customers.map((c) => [c.id, c]))
  const productById = new Map(products.map((p) => [p.id, p]))

  const patches: Array<{ key: string; value: unknown }> = []

  orders.forEach((o, i) => {
    patches.push({
      key: 'orders.' + i + '.customer',
      value: customerById.get(o.customerId) ?? null,
    })
    ;(o.lines as LineRow[]).forEach((line, j) => {
      patches.push({
        key: 'orders.' + i + '.lines.' + j + '.product',
        value: productById.get(line.productId) ?? null,
      })
    })
  })

  return patches
}