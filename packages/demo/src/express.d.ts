import { PrismaClient } from '@prisma/client'
import { Request } from 'express'

declare module 'express-serve-static-core' {
  interface Request {
    prisma: PrismaClient
    omitOutputValidation?: boolean
    passToNext?: boolean
    locals?: {
      data?: any
    }
  }
}
