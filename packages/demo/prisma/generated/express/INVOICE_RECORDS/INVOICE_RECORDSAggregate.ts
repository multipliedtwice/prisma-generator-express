import type { Prisma } from '../../client'
import type { PrismaClient } from '../../client'

import { Request, Response, NextFunction } from 'express'
import { RequestHandler, ParamsDictionary } from 'express-serve-static-core'
import { ParsedQs } from 'qs'
import { ZodTypeAny } from 'zod'

interface AggregateRequest extends Request {
  prisma: PrismaClient
  query: Partial<Prisma.INVOICE_RECORDSAggregateArgs> & ParsedQs
  outputValidation?: ZodTypeAny
  omitOutputValidation?: boolean
}

export type AggregateMiddleware = RequestHandler<
  ParamsDictionary,
  any,
  Partial<Prisma.INVOICE_RECORDSAggregateArgs>,
  Record<string, any>
>

export async function INVOICE_RECORDSAggregate(
  req: AggregateRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.outputValidation && !req.omitOutputValidation) {
      throw new Error(
        'Output validation schema or omission flag must be provided.',
      )
    }

    const result = await req.prisma.iNVOICE_RECORDS.aggregate(
      req.query as Prisma.INVOICE_RECORDSAggregateArgs,
    )

    if (!req.omitOutputValidation && req.outputValidation) {
      const validationResult = req.outputValidation.safeParse(result)
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
    return next(error)
  }
}
