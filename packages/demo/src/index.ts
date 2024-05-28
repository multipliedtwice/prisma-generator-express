import express, { json } from 'express'
import type { Response, Request, NextFunction, RequestHandler } from 'express'

import { orderItemRouter } from '../prisma/generated/express/orderItem'
import { PrismaClient } from '../prisma/generated/client'
import { RouteConfig } from '../prisma/generated/express/routeConfig'

const app = express()

const prisma = new PrismaClient()

/**
 * Middleware to attach Prisma client instance to the request object.
 * This ensures that Prisma client is available in all subsequent middleware and route handlers.
 */
const addPrisma: RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  req.prisma = prisma
  req.omitOutputValidation = true
  next()
}

/**
 * Before middleware to set a custom property on the request object.
 * Demonstrates how to add custom properties to the request object to be used in later middleware or route handlers.
 */
const beforeFindMany: RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  ;(req as any).passToNext = true
  next()
}

/**
 * After middleware placeholder for any post-processing after the main route handler.
 * This example just calls next() but can be extended to perform actions like logging or response modification.
 */
const afterFindMany: RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  console.log('req.locals?.data :>> ', req.locals?.data)
  next()
}

const someRouterConfig: RouteConfig<RequestHandler> = {
  findMany: {
    before: [beforeFindMany],
    after: [afterFindMany],
  },
  addModelPrefix: true,
  enableAll: true,
}

app.use(addPrisma, orderItemRouter(someRouterConfig))

app.listen(3000, () => {
  console.log('Server is running on http://localhost:3000')
})
