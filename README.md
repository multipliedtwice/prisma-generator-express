# Prisma Generator Express

[![npm version](https://badge.fury.io/js/prisma-generator-express.svg)](https://badge.fury.io/js/prisma-generator-express)
[![npm](https://img.shields.io/npm/dt/prisma-generator-express.svg)](https://www.npmjs.com/package/prisma-generator-express)
[![HitCount](https://hits.dwyl.com/multipliedtwice/prisma-generator-express.svg?style=flat)](http://hits.dwyl.com/multipliedtwice/prisma-generator-express)
[![npm](https://img.shields.io/npm/l/prisma-generator-express.svg)](LICENSE)

This tool helps you quickly create API endpoints in your Express app using your Prisma models. When you run `npx prisma generate`, it automatically creates functions that you can import into your Express routes. These functions handle interactions with your database and optionally validate the responses using Zod schemas before sending them back to the client. This ensures the data being sent matches what your application expects, improving the reliability and security of your API.

## Table of Contents

- [Installation](#installation)
- [Usage](#usage)
- [Customizations](#customizations)
- [Request Object Properties](#request-object-properties)

# Installation

Using npm:

```bash
 npm install prisma-generator-express
```

Using yarn:

```bash
 yarn add prisma-generator-express
```

# Usage

- Include this generator in your schema.prisma file:

```prisma
generator zod {
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
import { UserFindUnique } from './generated/UserFindUnique'

app.get('/user/:id', async (req, res, next) => {
  // Attach generated Zod schema for output validation
  req.outputValidation = someZodSchemaForUser

  // Use the generated middleware to handle the request
  await UserFindUnique(req, res, next)
})
```

The `UserFindUnique` function will fetch the user details from the database, validate the output with Zod, and handle the API response.

## Request Object Properties

The following properties can be attached to the request object in the generated middleware:

| Property               | Type         | Description                                                                                                                                                                                                           |
| ---------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prisma`               | PrismaClient | An instance of PrismaClient that allows the middleware to interact with your database.                                                                                                                                |
| `query`                | Object       | A structured object that conforms to Prisma's `WhereUniqueInput` type for the specific model, combined with ParsedQs for compatibility with Express query parsing.                                                    |
| `outputValidation`     | ZodTypeAny   | (Optional) A Zod schema used to validate the data returned from the Prisma query before sending it to the client. This helps ensure the response adheres to expected data formats.                                    |
| `omitOutputValidation` | Boolean      | (Optional) A flag that, if set to true, disables output validation even if a Zod schema is provided. Useful for development or testing environments where you might want to bypass validation for speed or debugging. |
