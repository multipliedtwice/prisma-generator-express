# Prisma Generator Express

[![npm version](https://img.shields.io/npm/v/prisma-generator-express.svg)](https://www.npmjs.com/package/prisma-generator-express)
[![npm](https://img.shields.io/npm/dt/prisma-generator-express.svg)](https://www.npmjs.com/package/prisma-generator-express)
[![npm](https://img.shields.io/npm/types/prisma-generator-express)](https://www.npmjs.com/package/prisma-generator-express)
[![HitCount](https://hits.dwyl.com/multipliedtwice/prisma-generator-express.svg?style=flat)](http://hits.dwyl.com/multipliedtwice/prisma-generator-express)
[![npm](https://img.shields.io/npm/l/prisma-generator-express.svg)](LICENSE)

This tool helps you quickly create API endpoints in your Express app using your Prisma models.

When you run `npx prisma generate`, it automatically creates two things:

- Service functions that you can import into your Express routes. By default these functions handle CRUD operations and output validation. This behavior can be controlled.
- Router generator function that lets you select which routes to add to the application and which middlewares to apply.

## Table of Contents

- [Installation](#installation)
- [Basic Usage](#basic-usage)
- [Router Generator Usage](#router-generator-usage)
- [Request Object Properties](#request-object-properties)
- [Roadmap](#roadmap)

# Installation

Using npm:

```bash
 npm install prisma-generator-express
```

Using yarn:

```bash
 yarn add prisma-generator-express
```

# Basic usage

- Include this generator in your schema.prisma file:

```prisma
generator express {
  provider = "prisma-generator-express"
}
```

- Generate your middleware functions by running:

```bash
  npx prisma generate
```

- Attach Prisma instance

```ts
import { PrismaClient } from '@prisma/client'
import express from 'express'

const prisma = new PrismaClient()
const app = express()

app.use(express.json()) // for parsing application/json

// Attach Prisma to every request
app.use((req, res, next) => {
  req.prisma = prisma
  next()
})
```

- Here’s how you can use a generated function in your Express app:

```ts
import { UserFindUnique } from './generated/UserFindUnique' // Adjust the path as necessary
import { FindUniqueUserSchema } from './prisma-zod-generator/schemas/FindUniqueUser.schema' // Adjust the path as necessary
import { FindUniqueUserSchemaOutput } from './prisma-zod-generator/schemas/FindUniqueUserOutput.schema' // Adjust the path as necessary

// move this to /helpers
export function validateQuery(schema: ZodSchema) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      req.query = schema.parse(req.query)
      next()
    } catch (error) {
      res.status(400).json({
        error: 'Input Validation failed',
        details: error.errors,
      })
    }
  }
}

app.get(
  '/user/:id',
  validateQuery(FindUniqueUserSchema),
  async (req, res, next) => {
    // Attach generated Zod schema for output validation
    req.outputValidation = FindUniqueUserOutput

    // Use the generated middleware to handle the request
    await UserFindUnique(req, res, next)
  },
)
```

The `UserFindUnique` function will fetch the user details from the database, validate the output with Zod, and handle the API response.

# Router generator usage

The library will create functions to generate routers per each model in schema. Each route can accept middleware that will be injected right before generated handler is invoked. You can use it to modify/remove/validate request payload. The output validation can be also attached to `req` object on this step.

```ts
import express, { json } from 'express'
import type { Response, Request, NextFunction, RequestHandler } from 'express'

import { orderItemRouter } from '../prisma/generated/express/orderItem'
import RouteConfig from '../prisma/generated/express/RouteConfig'
import { PrismaClient } from '../prisma/generated/client'

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
```

## Request Object Properties

The following properties can be attached to the `req` object to control the behavior of generated middleware:

| Property               | Type         | Description                                                                                                                                                                        |
| ---------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prisma`               | PrismaClient | An instance of PrismaClient that allows the middleware to interact with your database.                                                                                             |
| `passToNext`           | boolean      | Optional, if `true` - the result of a Prisma request will be passed to a next middleware as `if (req.locals) req.locals.data`                                                      |
| `query`                | Object       | A structured object that conforms to Prisma's API for the selected method.                                                                                                         |
| `outputValidation`     | ZodTypeAny   | (Optional) A Zod schema used to validate the data returned from the Prisma query before sending it to the client. This helps ensure the response adheres to expected data formats. |
| `omitOutputValidation` | Boolean      | (Optional) A flag that, if set to `true`, disables output validation even if a Zod schema is provided.                                                                             |

## Router Schema

| Function     | Method   | URL          |
| ------------ | -------- | ------------ |
| `findUnique` | `GET`    | `/:id`       |
| `findFirst`  | `GET`    | `/first`     |
| `findMany`   | `GET`    | `/`          |
| `create`     | `POST`   | `/`          |
| `createMany` | `POST`   | `/many`      |
| `update`     | `PUT`    | `/`          |
| `updateMany` | `PUT`    | `/many`      |
| `upsert`     | `PATCH`  | `/`          |
| `delete`     | `DELETE` | `/`          |
| `deleteMany` | `DELETE` | `/many`      |
| `aggregate`  | `GET`    | `/aggregate` |
| `count`      | `GET`    | `/count`     |
| `groupBy`    | `GET`    | `/groupby`   |
