import type { Prisma } from '../../client'
import type { PrismaClient } from '../../client'

import { Request, Response, NextFunction } from 'express'
import { RequestHandler, ParamsDictionary } from 'express-serve-static-core'
import { ZodTypeAny } from 'zod'

interface UpsertRequest extends Request {
  prisma: PrismaClient
  body: Prisma.PRODUCT_CATALOGUpsertArgs
  outputValidation?: ZodTypeAny
  omitOutputValidation?: boolean
}

export type UpsertMiddleware = RequestHandler<
  ParamsDictionary,
  any,
  Prisma.PRODUCT_CATALOGUpsertArgs,
  Record<string, any>
>

export async function PRODUCT_CATALOGUpsert(
  req: UpsertRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.outputValidation && !req.omitOutputValidation) {
      throw new Error(
        'Output validation schema or omission flag must be provided.',
      )
    }

    const data = await req.prisma.pRODUCT_CATALOG.upsert(req.body)

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
        'Output validation schema must be provided unless explicitly omitted.',
      )
    } else {
      res.status(200).json(data)
    }
  } catch (error) {
    console.error('Error in handling upsert request:', error)
    res.status(500).json({ error: error.message })
    next(error)
  }
}
