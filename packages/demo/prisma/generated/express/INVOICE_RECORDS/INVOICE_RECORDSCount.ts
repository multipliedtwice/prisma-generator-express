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
  omitOutputValidation?: boolean
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
    if (!req.outputValidation && !req.omitOutputValidation) {
      throw new Error(
        'Output validation schema or omission flag must be provided.',
      )
    }

    const result = await req.prisma.iNVOICE_RECORDS.count(
      req.query as Prisma.INVOICE_RECORDSCountArgs,
    )

    if (!req.omitOutputValidation && req.outputValidation) {
      const validationResult = req.outputValidation.safeParse(result)
      if (validationResult.success) {
        res.status(200).json(validationResult.data)
      } else {
        res
          .status(400)
          .json({
            error: 'Invalid data format',
            details: validationResult.error,
          })
      }
    } else {
      res.status(200).json(result)
    }
  } catch (error) {
    console.error('Error in handling count request:', error)
    res.status(500).json({ error: error.message })
    next(error)
  }
}
