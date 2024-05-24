import type { Prisma } from '../../client'
import type { PrismaClient } from '../../client'

import { Request, Response, NextFunction } from 'express'
import { RequestHandler, ParamsDictionary } from 'express-serve-static-core'
import { ZodTypeAny } from 'zod'

interface UpdateManyRequest extends Request {
  prisma: PrismaClient
  body: Prisma.orderItemUpdateManyArgs
  outputValidation?: ZodTypeAny
  omitOutputValidation?: boolean
}

export type UpdateManyMiddleware = RequestHandler<
  ParamsDictionary,
  any,
  Prisma.orderItemUpdateManyArgs,
  Record<string, any>
>

export async function orderItemUpdateMany(
  req: UpdateManyRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.outputValidation && !req.omitOutputValidation) {
      throw new Error(
        'Output validation schema or omission flag must be provided.',
      )
    }

    const data = await req.prisma.orderItem.updateMany(req.body)

    if (!req.omitOutputValidation && req.outputValidation) {
      const validationResult = req.outputValidation.safeParse(data)
      if (validationResult.success) {
        res.status(200).json({ count: validationResult.data.count })
      } else {
        res
          .status(400)
          .json({
            error: 'Invalid data format',
            details: validationResult.error,
          })
      }
    } else if (!req.omitOutputValidation) {
      throw new Error(
        'Output validation schema must be provided unless explicitly omitted.',
      )
    } else {
      res.status(200).json({ count: data.count })
    }
  } catch (error: unknown) {
    console.error('Error in handling updateMany request:', error)
    if (error instanceof Error) {
      res.status(500).json({ error: error.message })
    } else {
      res.status(500).json({ error: 'Unknown error occurred' })
    }
    next(error)
  }
}
