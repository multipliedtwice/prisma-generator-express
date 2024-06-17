import type { Prisma } from '../../client'
import type { PrismaClient } from '../../client'

import { Request, Response, NextFunction } from 'express'
import { RequestHandler, ParamsDictionary } from 'express-serve-static-core'
import { ParsedQs } from 'qs'
import { ZodTypeAny } from 'zod'

interface CountRequest extends Request {
  prisma: PrismaClient
  query: Partial<Prisma.INVOICE_RECORDSCountArgs> & ParsedQs
  outputValidation?: ZodTypeAny
  locals?: {
    outputValidator?: ZodTypeAny
  }
}

export type CountMiddleware = RequestHandler<
  ParamsDictionary,
  any,
  {},
  ParsedQs
>

export async function INVOICE_RECORDSCount(
  req: CountRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const outputValidator = req.locals?.outputValidator || req.outputValidation

    const result = await req.prisma.iNVOICE_RECORDS.count(
      req.query as Prisma.INVOICE_RECORDSCountArgs,
    )

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
