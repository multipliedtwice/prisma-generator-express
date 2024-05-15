import type { Prisma } from '../../client'
import type { PrismaClient } from '../../client'

import { Request, Response, NextFunction } from 'express'
import { RequestHandler, ParamsDictionary } from 'express-serve-static-core'
import { ZodTypeAny } from 'zod'

interface AggregateRequest extends Request {
  prisma: PrismaClient
  body: Prisma.UserAggregateArgs
  outputValidation?: ZodTypeAny
  omitOutputValidation?: boolean
}

export type AggregateMiddleware = RequestHandler<
  ParamsDictionary,
  any,
  Prisma.UserAggregateArgs,
  Record<string, any>
>

export async function UserAggregate(
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

    const result = await req.prisma.user.aggregate(req.body)

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
    console.error('Error in handling aggregation request:', error)
    res.status(500).json({ error: error.message })
    next(error)
  }
}
