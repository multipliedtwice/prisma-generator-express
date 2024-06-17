import type { Prisma, INVOICE_RECORDS } from '../../client'
import type { PrismaClient } from '../../client'

import { Request, Response, NextFunction } from 'express'
import { RequestHandler, ParamsDictionary } from 'express-serve-static-core'
import { ParsedQs } from 'qs'
import { ZodTypeAny } from 'zod'

export interface FindManyRequest extends Request {
  prisma: PrismaClient
  query: Prisma.INVOICE_RECORDSFindManyArgs & ParsedQs
  outputValidation?: ZodTypeAny
  passToNext?: boolean
  locals?: {
    data?: INVOICE_RECORDS[]
    outputValidator?: ZodTypeAny
  }
}
export type FindManyMiddleware = RequestHandler<
  ParamsDictionary,
  any,
  any,
  Prisma.INVOICE_RECORDSFindManyArgs & ParsedQs,
  Record<string, any>
>

export async function INVOICE_RECORDSFindMany(
  req: FindManyRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const outputValidator = req.locals?.outputValidator || req.outputValidation

    const data = await req.prisma.iNVOICE_RECORDS.findMany(
      req.query as Prisma.INVOICE_RECORDSFindManyArgs,
    )
    if (req.passToNext) {
      if (req.locals) req.locals.data = data
      next()
    } else if (outputValidator) {
      const validationResult = outputValidator.safeParse(data)
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
      return res.status(200).json(data)
    }
  } catch (error: unknown) {
    next(error)
  }
}
