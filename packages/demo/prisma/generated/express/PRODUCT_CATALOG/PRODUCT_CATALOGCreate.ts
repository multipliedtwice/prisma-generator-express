import type { Prisma } from '../../client'
import type { PrismaClient } from '../../client'

import { Request, Response, NextFunction } from 'express'
import { RequestHandler, ParamsDictionary } from 'express-serve-static-core'
import { ZodType } from 'zod'

interface CreateRequest extends Request {
  prisma: PrismaClient
  body: Prisma.PRODUCT_CATALOGCreateArgs
  outputValidation?: ZodType
  locals?: {
    outputValidator?: ZodType
  }
}

export type CreateMiddleware = RequestHandler<
  ParamsDictionary,
  any,
  Prisma.PRODUCT_CATALOGCreateArgs,
  Record<string, any>
>

export async function PRODUCT_CATALOGCreate(
  req: CreateRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const outputValidator = req.locals?.outputValidator || req.outputValidation

    const data = await req.prisma.pRODUCT_CATALOG.create(req.body)

    if (outputValidator) {
      const validationResult = outputValidator.safeParse(data)
      if (validationResult.success) {
        return res.status(201).json(validationResult.data)
      } else {
        return res
          .status(400)
          .json({
            error: 'Invalid data format',
            details: validationResult.error,
          })
      }
    } else {
      return res.status(201).json(data)
    }
  } catch (error: unknown) {
    next(error)
  }
}
