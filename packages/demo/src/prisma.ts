/**
 * Extended PrismaClient factory.
 *
 * The guard extension callback runs per query and reads the current request
 * context from ALS. The `Shop` key is consumed by prisma-guard's @scope-root
 * to auto-inject shopId filters on every generated route. The other keys
 * are exposed to callable shapes as `(ctx) => ({...})`.
 */
import { PrismaClient } from '../prisma/generated/client'
import { guard } from '../prisma/generated/guard/client'
import { getContext } from './context'

export function createPrismaClient() {
  return new PrismaClient().$extends(
    guard.extension(() => {
      const ctx = getContext()
      return {
        Shop: ctx.shopId,
        userId: ctx.userId,
        shopId: ctx.shopId,
        role: ctx.role,
      }
    }),
  )
}

export type PrismaLike = ReturnType<typeof createPrismaClient>