import type { Prisma } from '../prisma/generated/types'

import { Request, Response, NextFunction } from 'express'
import { ParsedQs } from 'qs'
import { PrismaClient } from '@prisma/client'
import { ZodTypeAny } from 'zod'

interface PrismaRequest extends Request {
  prisma: PrismaClient
  query: Prisma.UserWhereUniqueInput & ParsedQs
  outputValidation?: ZodTypeAny
  omitOutputValidation?: boolean
}

export async function UserFindUnique(
  req: PrismaRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    if (
      req.outputValidation === undefined &&
      req.omitOutputValidation === undefined
    ) {
      throw new Error(
        'Output validation schema or omission flag must be provided.',
      )
    }

    const data = await req.prisma.user.findUnique(req.query)
    if (!req.omitOutputValidation && req.outputValidation) {
      const validationResult = req.outputValidation.safeParse(data)
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
    } else if (!req.omitOutputValidation) {
      throw new Error(
        'Output validation schema must be provided unless explicitly omitted. Attach omitOutputValidation = true to request to suppress this error.',
      )
    } else {
      res.status(200).json(data)
    }
  } catch (error) {
    console.error('Error in handling request:', error)
    res.status(500).json({ error: error.message })
    next(error)
  }
}
