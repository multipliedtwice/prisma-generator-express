import type { Prisma } from '../../client'
import type { PrismaClient } from '../../client'

import { Request, Response, NextFunction } from 'express'
import { RequestHandler, ParamsDictionary } from 'express-serve-static-core'
import { ZodTypeAny } from 'zod'

interface DeleteManyRequest extends Request {
  prisma: PrismaClient
  body: Prisma.PRODUCT_CATALOGDeleteManyArgs
  outputValidation?: ZodTypeAny
  locals?: {
    outputValidator?: ZodTypeAny
  }
}

export type DeleteManyMiddleware = RequestHandler<
  ParamsDictionary,
  any,
  Prisma.PRODUCT_CATALOGDeleteManyArgs,
  Record<string, any>
>

export async function PRODUCT_CATALOGDeleteMany(
  req: DeleteManyRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const outputValidator = req.locals?.outputValidator || req.outputValidation

    const result = await req.prisma.pRODUCT_CATALOG.deleteMany(req.body)

    if (outputValidator) {
      const validationResult = outputValidator.safeParse(result)
      if (validationResult.success) {
        return res.status(200).json(validationResult.data)
      } else {
        return res
          .status(400)
          .json({
            error: 'Invalid data format',
            details: validationResult.error,
          })
      }
    } else {
      return res.status(200).json(result)
    }
  } catch (error: unknown) {
    next(error)
  }
}
