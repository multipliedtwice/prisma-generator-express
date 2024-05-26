import type { Prisma } from '../../client'
import type { PrismaClient } from '../../client'

import { Request, Response, NextFunction } from 'express'
import { RequestHandler, ParamsDictionary } from 'express-serve-static-core'
import { ZodTypeAny } from 'zod'

interface CreateRequest extends Request {
  prisma: PrismaClient
  body: Prisma.PRODUCT_CATALOGCreateArgs
  outputValidation?: ZodTypeAny
  omitOutputValidation?: boolean
}

export type CreateMiddleware = RequestHandler<
  ParamsDictionary,
  any,
  Prisma.PRODUCT_CATALOGCreateArgs,
  Record<string, any>
>

export async function PRODUCT_CATALOGCreate(
  req: CreateRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.outputValidation && !req.omitOutputValidation) {
      throw new Error(
        'Output validation schema or omission flag must be provided.',
      )
    }

    const data = await req.prisma.pRODUCT_CATALOG.create(req.body)
    if (!req.omitOutputValidation && req.outputValidation) {
      const validationResult = req.outputValidation.safeParse(data)
      if (validationResult.success) {
        return res.status(201).json(validationResult.data)
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
        'Output validation schema must be provided unless explicitly omitted.',
      )
    } else {
      return res.status(201).json(data)
    }
  } catch (error: unknown) {
    return next(error)
  }
}
