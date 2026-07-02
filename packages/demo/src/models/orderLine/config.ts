/**
 * OrderLine route config.
 *
 * findMany has no guard shape by design — the generator disables
 * auto-include SSE when a shape is set. The endpoint is gated to the
 * detail SSE flow only via requireDetailSse; tenancy is enforced by
 * enforceShopThroughOrder.
 *
 * findUnique keeps guard shapes because it does not stream.
 */
import type { OrderLineRouteConfig } from '../../../prisma/generated/express/OrderLine/OrderLineRouter'
import { enforceShopThroughOrder, requireDetailSse } from './hooks'

export const orderLineConfig: OrderLineRouteConfig = {
  enableAll: true,
  queryBuilder: { enabled: true },
  guard: { variantHeader: 'x-api-variant' },
  findMany: {
    before: [requireDetailSse, enforceShopThroughOrder],
    progressive: {
      detail: {
        enabled: true,
        mode: 'autoInclude',
        fallback: 'singleResult',
      },
    },
  },
  findUnique: {
    shape: {
      owner: {
        where: { id: { equals: true } },
        select: {
          id: true, orderId: true, productId: true, quantity: true, unitPriceCents: true,
          order: { select: { id: true, status: true } },
          product: { select: { id: true, name: true } },
        },
      },
      admin: {
        where: { id: { equals: true } },
        select: { id: true, orderId: true, productId: true, quantity: true },
      },
      member: {
        where: { id: { equals: true } },
        select: { id: true, orderId: true, productId: true, quantity: true },
      },
    },
  },
}