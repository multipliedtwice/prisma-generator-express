import type { Prisma } from '../../client'
import type { PrismaClient } from '../../client'

import { Request, Response, NextFunction } from 'express'
import { RequestHandler, ParamsDictionary } from 'express-serve-static-core'
import { ZodTypeAny } from 'zod'

interface CreateRequest extends Request {
  prisma: PrismaClient
  body: Prisma.INVOICE_RECORDSCreateArgs
  outputValidation?: ZodTypeAny
  locals?: {
    outputValidator?: ZodTypeAny
  }
}

export type CreateMiddleware = RequestHandler<
  ParamsDictionary,
  any,
  Prisma.INVOICE_RECORDSCreateArgs,
  Record<string, any>
>

export async function INVOICE_RECORDSCreate(
  req: CreateRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const outputValidator = req.locals?.outputValidator || req.outputValidation

    const data = await req.prisma.iNVOICE_RECORDS.create(req.body)

    if (outputValidator) {
      const validationResult = outputValidator.safeParse(data)
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
    } else {
      return res.status(201).json(data)
    }
  } catch (error: unknown) {
    next(error)
  }
}
