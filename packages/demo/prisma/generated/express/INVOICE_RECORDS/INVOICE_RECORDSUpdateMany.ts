import type { Prisma } from '../../client'
import type { PrismaClient } from '../../client'

import { Request, Response, NextFunction } from 'express'
import { RequestHandler, ParamsDictionary } from 'express-serve-static-core'
import { ZodTypeAny } from 'zod'

interface UpdateManyRequest extends Request {
  prisma: PrismaClient
  body: Prisma.INVOICE_RECORDSUpdateManyArgs
  outputValidation?: ZodTypeAny
  omitOutputValidation?: boolean
}

export type UpdateManyMiddleware = RequestHandler<
  ParamsDictionary,
  any,
  Prisma.INVOICE_RECORDSUpdateManyArgs,
  Record<string, any>
>

export async function INVOICE_RECORDSUpdateMany(
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

    const data = await req.prisma.iNVOICE_RECORDS.updateMany(req.body)

    if (!req.omitOutputValidation && req.outputValidation) {
      const validationResult = req.outputValidation.safeParse(data)
      if (validationResult.success) {
        return res.status(200).json({ count: validationResult.data.count })
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
      return res.status(200).json({ count: data.count })
    }
  } catch (error: unknown) {
    return next(error)
  }
}
