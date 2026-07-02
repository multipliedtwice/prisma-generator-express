/**
 * Shop route config.
 *
 * Selective ops (no create/delete). restrictToCurrentShop is applied
 * defensively — it is not verified whether @scope-root Shop scopes
 * the Shop model itself. The hook guarantees a token cannot enumerate
 * other shops regardless of guard behavior.
 */
import type { ShopRouteConfig } from '../../../prisma/generated/express/Shop/ShopRouter'
import { restrictToCurrentShop } from '../../hooks'

export const shopConfig: ShopRouteConfig = {
  queryBuilder: { enabled: true },
  findMany: {
    before: [restrictToCurrentShop],
    shape: {
      default: {
        where: { name: { contains: true } },
        select: { id: true, name: true, slug: true, createdAt: true },
        take: { max: 50, default: 20 },
      },
    },
  },
  findUnique: {
    before: [restrictToCurrentShop],
    shape: {
      default: {
        where: { id: { equals: true } },
        select: {
          id: true, name: true, slug: true, createdAt: true,
          _count: { select: { users: true, customers: true, products: true, orders: true } },
        },
      },
    },
  },
  update: {
    before: [restrictToCurrentShop],
    shape: {
      default: {
        data: { name: true },
        where: { id: { equals: true } },
        select: { id: true, name: true },
      },
    },
  },
}