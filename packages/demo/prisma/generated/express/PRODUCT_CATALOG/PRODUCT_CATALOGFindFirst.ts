import type { Prisma, PRODUCT_CATALOG } from '../../client'
import type { PrismaClient } from '../../client'

import { Request, Response, NextFunction } from 'express'
import { RequestHandler, ParamsDictionary } from 'express-serve-static-core'
import { ParsedQs } from 'qs'
import { ZodTypeAny } from 'zod'

export interface FindFirstRequest extends Request {
  prisma: PrismaClient
  query: Prisma.PRODUCT_CATALOGFindFirstArgs & ParsedQs
  outputValidation?: ZodTypeAny
  omitOutputValidation?: boolean
  passToNext?: boolean
  locals?: {
    data?: PRODUCT_CATALOG | null
  }
}
export type FindFirstMiddleware = RequestHandler<
  ParamsDictionary,
  any,
  any,
  Prisma.PRODUCT_CATALOGFindFirstArgs & ParsedQs,
  Record<string, any>
>

export async function PRODUCT_CATALOGFindFirst(
  req: FindFirstRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.outputValidation && !req.omitOutputValidation) {
      throw new Error(
        'Output validation schema or omission flag must be provided.',
      )
    }

    const data = await req.prisma.pRODUCT_CATALOG.findFirst(
      req.query as Prisma.PRODUCT_CATALOGFindFirstArgs,
    )
    if (req.passToNext) {
      if (req.locals) req.locals.data = data
      next()
    } else if (!req.omitOutputValidation && req.outputValidation) {
      const validationResult = req.outputValidation.safeParse(data)
      if (validationResult.success) {
        res.status(200).json(validationResult.data)
      } else {
        res.status(400).json({
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
