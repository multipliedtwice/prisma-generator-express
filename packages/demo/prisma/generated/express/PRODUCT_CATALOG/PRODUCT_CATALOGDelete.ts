import type { Prisma } from '../../client'
import type { PrismaClient } from '../../client'

import { Request, Response, NextFunction } from 'express'
import { RequestHandler, ParamsDictionary } from 'express-serve-static-core'
import { ZodTypeAny } from 'zod'

interface DeleteRequest extends Request {
  prisma: PrismaClient
  body: Prisma.PRODUCT_CATALOGDeleteArgs
  outputValidation?: ZodTypeAny
  omitOutputValidation?: boolean
}

export type DeleteMiddleware = RequestHandler<
  ParamsDictionary,
  any,
  Prisma.PRODUCT_CATALOGDeleteArgs,
  Record<string, any>
>

export async function PRODUCT_CATALOGDelete(
  req: DeleteRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.outputValidation && !req.omitOutputValidation) {
      throw new Error(
        'Output validation schema or omission flag must be provided.',
      )
    }

    const data = await req.prisma.pRODUCT_CATALOG.delete(req.body)

    if (!req.omitOutputValidation && req.outputValidation) {
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
        'Output validation schema must be provided unless explicitly omitted.',
      )
    } else {
      return res.status(200).json(data)
    }
  } catch (error: unknown) {
    return next(error)
  }
}
