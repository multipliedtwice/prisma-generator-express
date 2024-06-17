import { PrismaClient } from '@prisma/client'
import { Request } from 'express'

declare module 'express-serve-static-core' {
  interface Request {
    prisma: PrismaClient
    passToNext?: boolean
    locals?: {
      data?: any
      outputValidator?: ZodTypeAny
    }
  }
}
