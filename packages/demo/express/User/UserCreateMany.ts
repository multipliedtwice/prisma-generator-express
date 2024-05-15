import type { Prisma } from '../../client'
import type { PrismaClient } from '../../client'

import { Request, Response, NextFunction } from 'express'
import { RequestHandler, ParamsDictionary } from 'express-serve-static-core'
import { ZodTypeAny } from 'zod'

interface CreateManyRequest extends Request {
  prisma: PrismaClient
  body: Prisma.UserCreateManyArgs
  outputValidation?: ZodTypeAny
  omitOutputValidation?: boolean
}

export type CreateManyMiddleware = RequestHandler<
  ParamsDictionary,
  any,
  Prisma.UserCreateManyArgs,
  Record<string, any>
>

export async function UserCreateMany(
  req: CreateManyRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.outputValidation && !req.omitOutputValidation) {
      throw new Error(
        'Output validation schema or omission flag must be provided.',
      )
    }

    const data = await req.prisma.user.createMany(req.body)
    if (!req.omitOutputValidation && req.outputValidation) {
      const validationResult = req.outputValidation.safeParse(data)
      if (validationResult.success) {
        res.status(201).json(validationResult.data)
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
      res.status(201).json(data)
    }
  } catch (error) {
    console.error('Error in handling createMany request:', error)
    res.status(500).json({ error: error.message })
    next(error)
  }
}
