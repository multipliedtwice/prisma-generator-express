import type { Prisma } from '../../client'
import type { PrismaClient } from '../../client'

import { Request, Response, NextFunction } from 'express'
import { RequestHandler, ParamsDictionary } from 'express-serve-static-core'
import { ParsedQs } from 'qs'
import { ZodTypeAny } from 'zod'
import { ValidatorConfig } from '../routeConfig'

interface AggregateRequest extends Request {
  prisma: PrismaClient
  query: Partial<Prisma.OrderItemAggregateArgs> & ParsedQs
  outputValidation?: ZodTypeAny
  omitOutputValidation?: boolean
  locals?: {
    outputValidator?: ValidatorConfig
  }
}

export type AggregateMiddleware = RequestHandler<
  ParamsDictionary,
  any,
  Partial<Prisma.OrderItemAggregateArgs>,
  Record<string, any>
>

export async function orderItemAggregate(
  req: AggregateRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const outputValidator =
      res.locals.outputValidator?.schema || req.outputValidation

    if (!outputValidator && !req.omitOutputValidation) {
      throw new Error(
        'Output validation schema or omission flag must be provided.',
      )
    }

    const result = await req.prisma.orderItem.aggregate(
      req.query as Prisma.OrderItemAggregateArgs,
    )

    if (!req.omitOutputValidation && outputValidator) {
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
    return next(error)
  }
}
