import type { Prisma } from '../../client'
import type { PrismaClient } from '../../client'

import { Request, Response, NextFunction } from 'express'
import { RequestHandler, ParamsDictionary } from 'express-serve-static-core'
import { ZodTypeAny } from 'zod'

interface UpdateRequest extends Request {
  prisma: PrismaClient
  body: Prisma.UserAccountUpdateArgs
  outputValidation?: ZodTypeAny
  omitOutputValidation?: boolean
  locals?: {
    outputValidator?: ZodTypeAny
  }
}

export type UpdateMiddleware = RequestHandler<
  ParamsDictionary,
  any,
  Prisma.UserAccountUpdateArgs,
  Record<string, any>
>

export async function UserAccountUpdate(
  req: UpdateRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const outputValidator = req.locals?.outputValidator || req.outputValidation

    if (!outputValidator && !req.omitOutputValidation) {
      throw new Error(
        'Output validation schema or omission flag must be provided.',
      )
    }

    const data = await req.prisma.userAccount.update(req.body)

    if (!req.omitOutputValidation && outputValidator) {
      const validationResult = outputValidator.safeParse(data)
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
      return res.status(200).json(data)
    }
  } catch (error: unknown) {
    return next(error)
  }
}