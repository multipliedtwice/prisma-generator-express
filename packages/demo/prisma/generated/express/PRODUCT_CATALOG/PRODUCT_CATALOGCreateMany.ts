import type { Prisma } from '../../client'
import type { PrismaClient } from '../../client'

import { Request, Response, NextFunction } from 'express'
import { RequestHandler, ParamsDictionary } from 'express-serve-static-core'
import { ZodTypeAny } from 'zod'

interface CreateManyRequest extends Request {
  prisma: PrismaClient
  body: Prisma.PRODUCT_CATALOGCreateManyArgs
  outputValidation?: ZodTypeAny
  locals?: {
    outputValidator?: ZodTypeAny
  }
}

export type CreateManyMiddleware = RequestHandler<
  ParamsDictionary,
  any,
  Prisma.PRODUCT_CATALOGCreateManyArgs,
  Record<string, any>
>

export async function PRODUCT_CATALOGCreateMany(
  req: CreateManyRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const outputValidator = req.locals?.outputValidator || req.outputValidation

    const data = await req.prisma.pRODUCT_CATALOG.createMany(req.body)

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
