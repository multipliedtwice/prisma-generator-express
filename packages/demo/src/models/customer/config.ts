/**
 * Customer route config.
 *
 * Single default shape — no per-role differentiation. findUnique
 * pulls last 10 orders inline via nested select, showing relation
 * traversal with no hand-written handler.
 */
import type { CustomerRouteConfig } from '../../../prisma/generated/express/Customer/CustomerRouter'

export const customerConfig: CustomerRouteConfig = {
  enableAll: true,
  queryBuilder: { enabled: true },
  findMany: {
    shape: {
      default: {
        where: { email: { contains: true }, fullName: { contains: true } },
        select: {
          id: true, email: true, fullName: true, createdAt: true,
          _count: { select: { orders: true } },
        },
        orderBy: { createdAt: true },
        take: { max: 100, default: 25 },
      },
    },
  },
  findUnique: {
    shape: {
      default: {
        where: { id: { equals: true } },
        select: {
          id: true, email: true, fullName: true, createdAt: true,
          orders: {
            select: { id: true, status: true, totalCents: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
        },
      },
    },
  },
  create: {
    shape: {
      default: {
        data: { email: true, fullName: true },
        select: { id: true, email: true, fullName: true },
      },
    },
  },
  update: {
    shape: {
      default: {
        data: { fullName: true },
        where: { id: { equals: true } },
        select: { id: true, email: true, fullName: true },
      },
    },
  },
}