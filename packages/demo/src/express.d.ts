import type postgres from 'postgres'
import type { PrismaLike } from './prisma'

declare module 'express-serve-static-core' {
  interface Request {
    prisma: PrismaLike
    postgres?: ReturnType<typeof postgres>
  }
}