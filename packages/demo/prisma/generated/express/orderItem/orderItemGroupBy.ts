import type { Prisma } from '../../client'
import type { PrismaClient } from '../../client'

import { Request, Response, NextFunction } from 'express'
import { RequestHandler, ParamsDictionary } from 'express-serve-static-core'
import { ParsedQs } from 'qs'
import { ZodTypeAny } from 'zod'

interface GroupByRequest extends Request {
  prisma: PrismaClient
  query: Partial<Prisma.orderItemGroupByArgs> & ParsedQs
  outputValidation?: ZodTypeAny
  omitOutputValidation?: boolean
}

export type GroupByMiddleware = RequestHandler<
  ParamsDictionary,
  any,
  {},
  ParsedQs
>

export async function orderItemGroupBy(
  req: GroupByRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.outputValidation && !req.omitOutputValidation) {
      throw new Error(
        'Output validation schema or omission flag must be provided.',
      )
    }

    // @ts-ignore
    const result = await req.prisma.orderItem.groupBy(req.query)

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
  } catch (error: unknown) {
    console.error('Error in handling groupBy request:', error)
    if (error instanceof Error) {
      res.status(500).json({ error: error.message })
    } else {
      res.status(500).json({ error: 'Unknown error occurred' })
    }
    next(error)
  }
}
