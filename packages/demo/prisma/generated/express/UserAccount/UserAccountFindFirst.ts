import type { Prisma, UserAccount } from '../../client'
import type { PrismaClient } from '../../client'

import { Request, Response, NextFunction } from 'express'
import { RequestHandler, ParamsDictionary } from 'express-serve-static-core'
import { ParsedQs } from 'qs'
import { ZodTypeAny } from 'zod'

export interface FindFirstRequest extends Request {
  prisma: PrismaClient
  query: Prisma.UserAccountFindFirstArgs & ParsedQs
  outputValidation?: ZodTypeAny
  omitOutputValidation?: boolean
  passToNext?: boolean
  locals?: {
    data?: UserAccount | null
    outputValidator?: ZodTypeAny
  }
}
export type FindFirstMiddleware = RequestHandler<
  ParamsDictionary,
  any,
  any,
  Prisma.UserAccountFindFirstArgs & ParsedQs,
  Record<string, any>
>

export async function UserAccountFindFirst(
  req: FindFirstRequest,
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

    const data = await req.prisma.userAccount.findFirst(
      req.query as Prisma.UserAccountFindFirstArgs,
    )
    if (req.passToNext) {
      if (req.locals) req.locals.data = data
      next()
    } else if (!req.omitOutputValidation && outputValidator) {
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