import type { Prisma, orderItem } from '../../client'
import type { PrismaClient } from '../../client'

import { Request, Response, NextFunction } from 'express'
import { RequestHandler, ParamsDictionary } from 'express-serve-static-core'
import { ParsedQs } from 'qs'
import { ZodTypeAny } from 'zod'

export interface FindFirstRequest extends Request {
  prisma: PrismaClient
  query: Prisma.orderItemFindFirstArgs & ParsedQs
  outputValidation?: ZodTypeAny
  omitOutputValidation?: boolean
  passToNext?: boolean
  locals?: {
    data?: orderItem | null
  }
}
export type FindFirstMiddleware = RequestHandler<
  ParamsDictionary,
  any,
  any,
  Prisma.orderItemFindFirstArgs & ParsedQs,
  Record<string, any>
>

export async function orderItemFindFirst(
  req: FindFirstRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.outputValidation && !req.omitOutputValidation) {
      throw new Error(
        'Output validation schema or omission flag must be provided.',
      )
    }

    const data = await req.prisma.orderItem.findFirst(
      req.query as Prisma.orderItemFindFirstArgs,
    )
    if (req.passToNext) {
      if (req.locals) req.locals.data = data
      next()
    } else if (!req.omitOutputValidation && req.outputValidation) {
      const validationResult = req.outputValidation.safeParse(data)
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
    } else if (!req.omitOutputValidation) {
      throw new Error(
        'Output validation schema must be provided unless explicitly omitted. Attach omitOutputValidation = true to request to suppress this error.',
      )
    } else {
      return res.status(200).json(data)
    }
  } catch (error: unknown) {
    return next(error)
  }
}
