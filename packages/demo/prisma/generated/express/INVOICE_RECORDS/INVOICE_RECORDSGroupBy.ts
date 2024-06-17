import type { Prisma } from '../../client'
import type { PrismaClient } from '../../client'

import { Request, Response, NextFunction } from 'express'
import { RequestHandler, ParamsDictionary } from 'express-serve-static-core'
import { ParsedQs } from 'qs'
import { ZodTypeAny } from 'zod'

interface GroupByRequest extends Request {
  prisma: PrismaClient
  query: Partial<Prisma.INVOICE_RECORDSGroupByArgs> & ParsedQs
  outputValidation?: ZodTypeAny
  locals?: {
    outputValidator?: ZodTypeAny
  }
}

export type GroupByMiddleware = RequestHandler<
  ParamsDictionary,
  any,
  {},
  ParsedQs
>

export async function INVOICE_RECORDSGroupBy(
  req: GroupByRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const outputValidator = req.locals?.outputValidator || req.outputValidation

    // @ts-ignore
    const result = await req.prisma.iNVOICE_RECORDS.groupBy(req.query)

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
