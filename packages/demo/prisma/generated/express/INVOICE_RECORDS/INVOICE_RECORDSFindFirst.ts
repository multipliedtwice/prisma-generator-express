import type { Prisma, INVOICE_RECORDS } from '../../client'
import type { PrismaClient } from '../../client'

import { Request, Response, NextFunction } from 'express'
import { RequestHandler, ParamsDictionary } from 'express-serve-static-core'
import { ParsedQs } from 'qs'
import { ZodTypeAny } from 'zod'

export interface FindFirstRequest extends Request {
  prisma: PrismaClient
  query: Prisma.INVOICE_RECORDSFindFirstArgs & ParsedQs
  outputValidation?: ZodTypeAny
  passToNext?: boolean
  locals?: {
    data?: INVOICE_RECORDS | null
    outputValidator?: ZodTypeAny
  }
}
export type FindFirstMiddleware = RequestHandler<
  ParamsDictionary,
  any,
  any,
  Prisma.INVOICE_RECORDSFindFirstArgs & ParsedQs,
  Record<string, any>
>

export async function INVOICE_RECORDSFindFirst(
  req: FindFirstRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const outputValidator = req.locals?.outputValidator || req.outputValidation

    const data = await req.prisma.iNVOICE_RECORDS.findFirst(
      req.query as Prisma.INVOICE_RECORDSFindFirstArgs,
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
