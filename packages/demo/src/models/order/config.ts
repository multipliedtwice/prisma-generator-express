/**
 * Order route config.
 *
 * dashboard variant uses manual progressive SSE. resolveContext is
 * required so stages can read the current shop from ALS.
 *
 * BigInt (totalCents) is serialized as string by the generator's
 * response transformer.
 */
import type { OrderRouteConfig } from '../../../prisma/generated/express/Order/OrderRouter'
import type { PrismaLike } from '../../prisma'
import type { RequestContext } from '../../context'
import { getContext } from '../../context'
import { orderIdentity, orderLineSummary, productInfo } from './stages'

const orderListSelect = {
  id: true,
  status: true,
  totalCents: true,
  createdAt: true,
} as const

export const orderConfig: OrderRouteConfig<RequestContext, PrismaLike> = {
  enableAll: true,
  queryBuilder: { enabled: true },
  guard: { variantHeader: 'x-api-variant' },
  resolveContext: (_req) => getContext(),
  findMany: {
    shape: {
      owner: {
        where: {
          status: { equals: true },
          customerId: { equals: true },
          createdAt: { gte: true, lte: true },
        },
        select: {
          ...orderListSelect,
          customer: { select: { id: true, fullName: true } },
          _count: { select: { lines: true } },
        },
        orderBy: { createdAt: true },
        take: { max: 100, default: 25 },
      },
      admin: {
        where: { status: { equals: true }, customerId: { equals: true } },
        select: {
          ...orderListSelect,
          customer: { select: { id: true, fullName: true } },
        },
        orderBy: { createdAt: true },
        take: { max: 100, default: 25 },
      },
      member: {
        where: { status: { equals: true } },
        select: orderListSelect,
        take: { max: 25, default: 10 },
      },
      dashboard: {
        where: { status: { equals: true }, createdAt: { gte: true } },
        select: orderListSelect,
        orderBy: { createdAt: true },
        take: { max: 50, default: 20 },
      },
    },
    progressive: {
      dashboard: {
        enabled: true,
        stages: ['orderIdentity', 'orderLineSummary', 'productInfo'],
      },
    },
    progressiveStages: {
      orderIdentity,
      orderLineSummary,
      productInfo,
    },
  },
  findUnique: {
    shape: {
      owner: {
        where: { id: { equals: true } },
        select: {
          ...orderListSelect,
          customer: { select: { id: true, fullName: true, email: true } },
          lines: {
            select: {
              id: true, quantity: true, unitPriceCents: true,
              product: { select: { id: true, name: true, category: true, price: true } },
            },
          },
        },
      },
      admin: {
        where: { id: { equals: true } },
        select: {
          ...orderListSelect,
          customer: { select: { id: true, fullName: true } },
          lines: { select: { id: true, quantity: true, product: { select: { name: true } } } },
        },
      },
      member: {
        where: { id: { equals: true } },
        select: orderListSelect,
      },
    },
  },
  create: {
    shape: {
      owner: {
        data: { customerId: true, status: true, totalCents: true },
        select: orderListSelect,
      },
      admin: {
        data: { customerId: true, status: 'PENDING', totalCents: true },
        select: orderListSelect,
      },
    },
  },
  update: {
    shape: {
      owner: {
        data: { status: true, totalCents: true },
        where: { id: { equals: true } },
        select: { id: true, status: true, totalCents: true },
      },
      admin: {
        data: { status: true },
        where: { id: { equals: true } },
        select: { id: true, status: true },
      },
    },
  },
}