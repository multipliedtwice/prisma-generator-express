# Prisma Generator Express

[![npm version](https://badge.fury.io/js/prisma-generator-express.svg)](https://badge.fury.io/js/prisma-generator-express)
[![npm](https://img.shields.io/npm/dt/prisma-generator-express.svg)](https://www.npmjs.com/package/prisma-generator-express)
[![HitCount](https://hits.dwyl.com/multipliedtwice/prisma-generator-express.svg?style=flat)](http://hits.dwyl.com/multipliedtwice/prisma-generator-express)
[![Coverage Status](https://codecov.io/github/multipliedtwice/prisma-generator-express/graph/badge.svg?token=TTJ30HVKB8)](https://codecov.io/github/multipliedtwice/prisma-generator-express)
[![npm](https://img.shields.io/npm/l/prisma-generator-express.svg)](LICENSE)

This tool helps you quickly create API endpoints in your Express app using your Prisma models.

When you run `npx prisma generate`, it automatically creates two things:

- Service functions that you can import into your Express routes. By default, these functions handle CRUD operations and output validation. This behavior can be controlled.
- Router generator function that lets you select which routes to add to the application and which middlewares to apply.

## Table of Contents

- [Installation](#installation)
- [Basic Usage](#basic-usage)
- [Router Generator Usage](#router-generator-usage)
- [Request Object Properties](#request-object-properties)
- [Router Schema](#router-schema)

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
import { UserFindUnique } from './generated/api/UserFindUnique' // Adjust the path as necessary
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

import { PrismaClient } from '../prisma/generated/client'
import { UserAccountRouter } from '../prisma/generated/express/UserAccount'
import { RouteConfig } from '~prisma/generated/express/routeConfig'
import { UserAccountFindFirstSchema } from '../prisma/generated/prisma-zod-generator/schemas'

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
  // req.omitOutputValidation = true (output validation is not required if you use `select` instead of `include`)
  next()
}

/**
 * Run context-related operations or modify `req` properties to control the behavior of the route
 */
const beforeFindFirst: RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  req.passToNext = true
  next()
}

/**
 * if `req.passToNext` is true, then the result of generated middleware
 * will be available in req.locals?.data for modifications
 */
const afterFindFirst: RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  console.log('req.locals?.data :>> ', req.locals?.data)
  next()
}

/**
 * For generated route the middleware order will be as follows:
 * 1. Query parser (kicks in for GET requests)
 * 2. Custom middlewares: config.{method}.before[]
 * 3. Input validator middleware (Optional): config.{method}.input
 * 4. Generated middleware
 * 5. Output validator middleware: config.{method}.input
 * 6. Custom middlewares: config.{method}.after[] (not available if req.passToNext is falsy)
 */
const userAccounRouterConfig: RouteConfig<RequestHandler> = {
  FindFirst: {
    before: [beforeFindFirst],
    after: [afterFindFirst],
    input: {
      schema: UserAccountFindFirstSchema, // make sure you set `isGenerateSelect = true` in prisma-zod-generator
      allow: [
        'select.id',
        'select.full_name',
        'select.emailAddress',
        'select.orders[].ProductName',
        'select.orders[].quantity',
        'where.id',
        'where.createdAt',
      ],
    },
  },
  addModelPrefix: true,
  enableAll: true,
  customUrlPrefix: '/v1',
}

app.use(addPrisma)
app.use(UserAccountRouter(userAccounRouterConfig))

app.listen(3000, () => {
  console.log('Server is running on http://localhost:3000')
})
```

## Request Object Properties

The following properties can be attached to the `req` object to control the behavior of generated middleware:

| Property               | Type         | Description                                                                                                                                                                        |
| ---------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prisma`               | PrismaClient | An instance of PrismaClient that allows the middleware to interact with your database.                                                                                             |
| `passToNext`           | boolean      | Optional, if `true` - the result of a Prisma request will be passed to the next middleware as `if (req.locals) req.locals.data`                                                      |
| `outputValidation`     | ZodTypeAny   | (Optional) A Zod schema used to validate the data returned from the Prisma query before sending it to the client. |
| `omitOutputValidation` | Boolean      | (Optional) A flag that, if set to `true`, disables output validation even if a Zod schema is provided.                                                                             |

## Router Schema

| Function     | Method   | URL          |
| ------------ | -------- | ------------ |
| `findUnique` | `GET`    | `/:id`       |
| `findFirst`  | `GET`    | `/first`     |
| `FindFirst`  | `GET`    | `/`          |
| `aggregate`  | `GET`    | `/aggregate` |
| `count`      | `GET`    | `/count`     |
| `groupBy`    | `GET`    | `/groupby`   |
| `create`     | `POST`   | `/`          |
| `createMany` | `POST`   | `/many`      |
| `update`     | `PUT`    | `/`          |
| `updateMany` | `PUT`    | `/many`      |
| `upsert`     | `PATCH`  | `/`          |
| `delete`     | `DELETE` | `/`          |
| `deleteMany` | `DELETE` | `/many`      |


## Helper functions

### createValidatorMiddleware(validatorOptions: ValidatorOptions)

Simple wrapper that internally uses `allow` or `forbid` logic for filtering incoming queries and data payloads

```ts
interface ValidatorOptions {
  schema: ZodSchema<any>
  allowedPaths?: string[] // Fobids all except allowed. For example [`where.user.id`, `select.id`], all other provided inputs will throw an error
  forbiddenPaths?: string[] // Similar, but allows all, except forbidden
  target?: 'body' | 'query'
}
```

### encodeQueryParams(params: Params)

It can be used on the frontend to encode Prisma-compatible queries. Alternatively `qs` can be used, but it probably won't work with `OR: [{ blah: false }, { blah: null }]` or some other edge cases.

```ts
type RecursiveUrlParams = {
  [key: string]: RecursiveUrlParams | string | boolean | unknown
}
type Params = Record<string, RecursiveUrlParams | string>
```

### parseQueryParams(params: QueryParams)

```ts
type QueryParams = string | ParsedQs | string[] | ParsedQs[] | undefined
```

Recursively converts strings "true", "false", "null", and "number" into correct formats.

### allow<T extends z.ZodTypeAny>( schema: T, allowedPaths: string[] ): ZodEffects<T, any, any>

Accepts schema and `['array.of.allowed.paths']`. Throws an error if provided something that doesn't fit allowed schema.

### forbid<T extends z.ZodTypeAny>( schema: T, forbiddenPaths: string[] ): ZodEffects<T, any, any>

Same as `allow` but works in opposite way.

---

## Rememo.io [Free Kanban & Chat](https://rememo.io)

<img src="https://github.com/multipliedtwice/prisma-generator-express/blob/feat/internal-validation/rememo-192.png?raw=true" alt="Free Kanban & Corporate Chat">
