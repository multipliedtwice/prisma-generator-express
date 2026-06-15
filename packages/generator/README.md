# Prisma Generator Express

[![npm version](https://badge.fury.io/js/prisma-generator-express.svg)](https://badge.fury.io/js/prisma-generator-express)
[![npm](https://img.shields.io/npm/dt/prisma-generator-express.svg)](https://www.npmjs.com/package/prisma-generator-express)
[![Coverage](https://img.shields.io/codecov/c/github/multipliedtwice/prisma-generator-express/main.svg)](https://codecov.io/gh/multipliedtwice/prisma-generator-express)
[![npm](https://img.shields.io/npm/l/prisma-generator-express.svg)](LICENSE)

Prisma generator that creates Express, Fastify, or Hono CRUD API routes with OpenAPI documentation from your Prisma schema.

Running `npx prisma generate` produces:

- Handler functions for all Prisma operations (findMany, create, update, delete, etc.)
- Router generator with middleware support (before/after hooks per operation)
- POST read endpoints for all read operations (for complex queries exceeding URL length limits)
- Express-only progressive read streaming over Server-Sent Events (SSE), using manual stages or auto-include splitting for supported relation reads, including deep `findMany` / `findManyPaginated` auto-include paths
- Express-only standalone materialized view router for read-only access to registered PostgreSQL materialized views
- OpenAPI 3.1 spec (JSON and YAML endpoints registered automatically per router)
- Documentation helpers for contract view and Scalar UI (require manual mounting)
- Client-side query parameter encoder
- Guard/variant shape enforcement via prisma-guard integration

Supports **Express**, **Fastify**, and **Hono** targets via the `target` configuration option.

## Table of contents

- [Compatibility](#compatibility)
- [Installation](#installation)
- [Setup](#setup)
- [Path casing in generated endpoints](#path-casing-in-generated-endpoints)
- [Usage (Express)](#usage-express)
- [Usage (Fastify)](#usage-fastify)
- [Usage (Hono)](#usage-hono)
- [Selective routes with middleware](#selective-routes-with-middleware)
- [Guard shapes (prisma-guard integration)](#guard-shapes-prisma-guard-integration)
- [Request body format](#request-body-format)
- [Query encoding (client side)](#query-encoding-client-side)
- [POST read endpoints](#post-read-endpoints)
- [Materialized views router (Express)](#materialized-views-router-express)
- [Progressive Endpoint Composition (Express SSE)](#progressive-endpoint-composition-express-sse)
- [Response shaping: select, include, omit](#response-shaping-select-include-omit)
- [BigInt and Decimal handling](#bigint-and-decimal-handling)
- [Pagination](#pagination)
- [Error handling](#error-handling)
- [Security](#security)
- [Documentation endpoints](#documentation-endpoints)
- [prisma-sql integration](#prisma-sql-integration)
- [Query parameter parsing](#query-parameter-parsing)
- [Router schema](#router-schema)
- [Skipping models](#skipping-models)
- [Configuration](#configuration)
- [Environment variables](#environment-variables)
- [License](#license)

## Compatibility

### Prisma version

Minimum supported Prisma version: **6.0.0**

Some operations require newer versions:

| Operation             | Minimum Prisma version | Notes                                |
| --------------------- | ---------------------- | ------------------------------------ |
| `omit` parameter      | 6.2.0                  | Returns 400 on versions 6.0.x–6.1.x |
| `updateManyAndReturn` | 6.2.0                  | PostgreSQL, CockroachDB, SQLite only |

### Framework support

| Framework | Target value | Generated output |
| --------- | ------------ | ---------------- |
| Express   | `"express"`  | `express.Router()` factory function per model |
| Fastify   | `"fastify"`  | Fastify plugin function per model |
| Hono      | `"hono"`     | `Hono` instance factory function per model |

The Hono target v1 is tested on Node.js runtimes only. See [Cloudflare Workers and edge runtimes](#cloudflare-workers-and-edge-runtimes).

Progressive Endpoint Composition over Server-Sent Events is currently supported by the Express target only. Express supports both manual staged streaming and auto-include streaming for supported relation reads, including single-record reads and deep `findMany` / `findManyPaginated` reads within the configured planner limits. Fastify and Hono continue to support normal JSON read and write routes.

### Database provider support

Most operations work across all Prisma-supported providers. Exceptions:

| Feature               | PostgreSQL | CockroachDB | MySQL | SQLite | SQL Server | MongoDB |
| --------------------- | ---------- | ----------- | ----- | ------ | ---------- | ------- |
| `createManyAndReturn` | ✓          | ✓           | ✗     | ✓      | ✗          | ✗       |
| `updateManyAndReturn` | ✓          | ✓           | ✗     | ✓      | ✗          | ✗       |
| `skipDuplicates`      | ✓          | ✓           | ✓     | ✗      | ✗          | ✗       |

Operations not supported by your database provider return `501 Not Implemented` at runtime. The generator emits handlers for all operations regardless of provider — use selective route configuration to expose only supported operations.

## Installation

```bash
npm install -D prisma-generator-express
```

Peer dependencies for Express:

```bash
npm install @prisma/client express
```

Peer dependencies for Fastify:

```bash
npm install @prisma/client fastify
```

Peer dependencies for Hono:

```bash
npm install @prisma/client hono
```

Optional peer dependencies:

```bash
npm install prisma-sql         # SQL optimization
npm install prisma-guard zod   # Guard shape enforcement
npm install prisma-query-builder-ui  # Visual query playground (Express/Fastify only — not auto-started for Hono)
```

## Setup

Add the generator to your `schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

generator express {
  provider = "prisma-generator-express"
}
```

To target Fastify or Hono, set the `target` config:

```prisma
generator express {
  provider = "prisma-generator-express"
  target   = "fastify"
}
```

```prisma
generator express {
  provider = "prisma-generator-express"
  target   = "hono"
}
```

Valid `target` values are `"express"` (default), `"fastify"`, and `"hono"`.

The generator detects the Prisma client generator automatically. All standard provider values are supported: `prisma-client-js`, `@prisma/client`, and `prisma-client`.

Generate:

```bash
npx prisma generate
```

## Path casing in generated endpoints

Model names are converted to **flat lowercase** in URL paths. There is no kebab-case or snake_case conversion — the model name is lowercased character by character.

| Model name        | URL path             |
| ----------------- | -------------------- |
| `User`            | `/user`              |
| `BlogPost`        | `/blogpost`          |
| `OrderItem`       | `/orderitem`         |
| `INVOICE_RECORDS` | `/invoice_records`   |
| `apiKey`          | `/apikey`            |

Underscores in model names are preserved. Camel-case word boundaries are not preserved.

Throughout this README, `{modelname}` (lowercase) represents the converted path segment. For example, the path `/{modelname}/first` refers to `/user/first` for a `User` model, or `/blogpost/first` for a `BlogPost` model.

The generated directory structure preserves the original model casing — e.g. `generated/BlogPost/BlogPostRouter.ts` — but the runtime URL is `/blogpost`.

To remove the model prefix entirely, set `addModelPrefix: false` in the route config. To replace it with a custom prefix, use `customUrlPrefix`.

## Usage (Express)

```ts
import express from 'express'
import { PrismaClient } from '@prisma/client'
import { UserRouter } from './generated/User/UserRouter'

const prisma = new PrismaClient()
const app = express()

app.use(express.json())

app.use((req, res, next) => {
  req.prisma = prisma
  next()
})

const userConfig = {
  enableAll: true,
}

app.use('/', UserRouter(userConfig))

app.listen(3000, () => {
  console.log('Server is running on http://localhost:3000')
})
```

`express.json()` is required because write endpoints (`create`, `update`, `delete`, `upsert`) and POST read endpoints accept JSON request bodies.

## Usage (Fastify)

When `target = "fastify"`, each model produces a Fastify plugin function instead of an Express router.

```ts
import Fastify from 'fastify'
import { PrismaClient } from '@prisma/client'
import { UserRoutes } from './generated/User/UserRouter'

const prisma = new PrismaClient()
const fastify = Fastify()

fastify.decorateRequest('prisma', null)

fastify.addHook('onRequest', async (request) => {
  request.prisma = prisma
})

const userConfig = {
  enableAll: true,
}

fastify.register(async (instance) => {
  await UserRoutes(instance, userConfig)
})

fastify.listen({ port: 3000 }, () => {
  console.log('Server is running on http://localhost:3000')
})
```

The generated function signature is `async function ModelRoutes(fastify: FastifyInstance, config?: RouteConfig)`. It registers routes directly on the provided Fastify instance.

## Usage (Hono)

When `target = "hono"`, each model produces a function that returns a Hono instance.

```ts
import { Hono } from 'hono'
import { PrismaClient } from '@prisma/client'
import { UserRouter } from './generated/User/UserRouter'

type Env = {
  Variables: {
    prisma: PrismaClient
  }
}

const prisma = new PrismaClient()
const app = new Hono<Env>()

app.use('*', async (c, next) => {
  c.set('prisma', prisma)
  await next()
})

const userConfig = {
  enableAll: true,
}

app.route('/', UserRouter(userConfig))

export default app
```

The generated function signature is `UserRouter(config?: RouteConfig): Hono`. Mount with `app.route(prefix, UserRouter(config))`.

PrismaClient is injected via `c.set('prisma', prismaInstance)` in middleware that runs before the router. Declare `prisma` (and any optional connectors like `postgres` / `sqlite`) in your Hono app's `Variables` type so TypeScript can verify the injection. The same pattern applies to optional `postgres` / `sqlite` connectors for [prisma-sql integration](#prisma-sql-integration).

### Hooks (Hono)

Hono hooks are native Hono middleware functions:

```ts
import type { HonoHookHandler } from './generated/routeConfig.target'

const auth: HonoHookHandler = async (c, next) => {
  const token = c.req.header('authorization')
  if (!token) return c.json({ message: 'Unauthorized' }, 401)
  await next()
}

const userConfig = {
  findMany: {
    before: [auth],
  },
}
```

Call `await next()` to continue the chain. Return a `Response` to short-circuit — subsequent hooks, the main handler, and the response middleware will not run.

### HTTPException normalization

Throwing Hono's `HTTPException` from a hook short-circuits to a JSON error response. The router's `app.onError` catches the exception, preserves the status code, and **normalizes the response body** to `{ "message": err.message }`.

```ts
import { HTTPException } from 'hono/http-exception'

const auth: HonoHookHandler = async (c, next) => {
  const token = c.req.header('authorization')
  if (!token) {
    throw new HTTPException(401, { message: 'Unauthorized' })
  }
  await next()
}
```

Custom response bodies attached to `HTTPException` are **not preserved** — the router always returns `{ message: err.message }` with the exception's status code. If you need a custom response body, return a `Response` directly from the hook instead of throwing.

This normalization ensures all errors from generated routes share a single shape, so clients only need to handle one error format.

### Cloudflare Workers and edge runtimes

The Hono target v1 is tested on Node.js runtimes only. The route layer may be portable to edge runtimes (Cloudflare Workers, Deno Deploy, Vercel Edge), but **production edge support is not guaranteed**. Prisma Client edge usage requires compatible Prisma setup, driver adapters, or Prisma Accelerate / Prisma Postgres depending on the database. `prisma-guard` edge compatibility is unverified.

On Cloudflare Workers, you must construct an edge-compatible Prisma client yourself and expose it through your runtime environment. Cloudflare does not provide a built-in Prisma binding — the exact setup depends on your database and Prisma adapter (Prisma Accelerate, `@prisma/adapter-d1`, etc.).

A minimal pattern, assuming you've already wired up an edge-compatible client behind a `PRISMA` binding:

```ts
type Env = {
  Bindings: {
    PRISMA: any
  }
  Variables: {
    prisma: any
  }
}

const app = new Hono<Env>()

app.use('*', async (c, next) => {
  c.set('prisma', c.env.PRISMA)
  await next()
})

app.route('/', UserRouter({ enableAll: true }))

export default app
```

Both `Bindings` (what the runtime injects) and `Variables` (what your middleware sets via `c.set`) need to be declared on the app's `Env` type.

### Query Builder

The Query Builder playground is Node-only and **not auto-started** by the Hono target. The generated `?ui=playground` route can render the playground iframe, but the Hono router does not start the Query Builder server. Start `prisma-query-builder-ui` manually in a separate process and point the config to that server when needed.

### Query string differences

Hono's `c.req.query()` returns a flat `Record<string, string>` — duplicate query keys collapse to the last value. For example, `?take=10&take=20` becomes `{ take: '20' }`. This differs from Express, which parses `?a=1&a=2` into `{ a: ['1', '2'] }`.

The `encodeQueryParams` client utility does not emit duplicate keys, so this only matters for hand-built query strings. All complex Prisma arguments are JSON-encoded into single query values.

### Key differences between targets

| Aspect | Express | Fastify | Hono |
| ------ | ------- | ------- | ---- |
| Generated function | `ModelRouter(config)` returns `express.Router` | `ModelRoutes(fastify, config)` registers on instance | `ModelRouter(config)` returns `Hono` instance |
| Mounting | `app.use('/', ModelRouter(config))` | `fastify.register(async (i) => { await ModelRoutes(i, config) })` | `app.route('/', ModelRouter(config))` |
| Hook types | `RequestHandler[]` | `FastifyHookHandler[]` | `HonoHookHandler[]` (native middleware) |
| Hook signature | `(req, res, next)` | `(request, reply)` | `(c, next)` |
| Guard resolveVariant | `express.Request` | `FastifyRequest` | Hono `Context` |
| PrismaClient injection | `req.prisma = prisma` | `request.prisma = prisma` | `c.set('prisma', prisma)` |
| Error handling | Express error middleware | `setErrorHandler` | `app.onError` |
| Query Builder auto-start | Yes (Node only) | Yes (Node only) | No (manual start) |

## Selective routes with middleware

### Express

```ts
const userConfig = {
  findMany: {
    before: [authMiddleware],
  },
  create: {
    before: [authMiddleware, validateBody],
  },
  findUnique: {},
}

app.use('/', UserRouter(userConfig))
```

### Fastify

```ts
const userConfig = {
  findMany: {
    before: [async (request, reply) => { /* auth check */ }],
  },
  create: {
    before: [async (request, reply) => { /* auth + validation */ }],
  },
  findUnique: {},
}

fastify.register(async (instance) => {
  await UserRoutes(instance, userConfig)
})
```

Fastify hooks receive `(request: FastifyRequest, reply: FastifyReply)`. If a hook sends a reply (via `reply.send()`), subsequent hooks and the handler are skipped.

### Hono

```ts
const userConfig = {
  findMany: {
    before: [async (c, next) => { /* auth check */ await next() }],
  },
  create: {
    before: [async (c, next) => { /* auth + validation */ await next() }],
  },
  findUnique: {},
}

app.route('/', UserRouter(userConfig))
```

Hono hooks are native middleware functions. Call `await next()` to continue the chain. Return a `Response` (e.g. `c.json({...}, 403)`) or throw `HTTPException` to short-circuit — subsequent hooks and the handler will not run.

Only operations listed in the config (or all when `enableAll: true`) are registered. Operations not listed produce no routes.

## Guard shapes (prisma-guard integration)

prisma-generator-express integrates with [prisma-guard](https://github.com/multipliedtwice/prisma-guard) to enforce input validation, query shape restrictions, and tenant isolation on generated routes. When a `shape` is configured on an operation, the handler calls `prisma.model.guard(shape, caller).method(args)` instead of `prisma.model.method(args)`.

Guard shapes work identically across all three targets. The only difference is the type of the `resolveVariant` callback parameter (`Request` for Express, `FastifyRequest` for Fastify, `Context` for Hono).

### Guard setup

Install prisma-guard and add its generator to your schema:

```bash
npm install prisma-guard zod
```

```prisma
generator client {
  provider = "prisma-client-js"
}

generator guard {
  provider = "prisma-guard"
  output   = "generated/guard"
}

generator express {
  provider = "prisma-generator-express"
}
```

Run `npx prisma generate` to emit both the routes and the guard artifacts.

Extend PrismaClient with the guard extension and attach it to requests:

```ts
import express from 'express'
import { PrismaClient } from '@prisma/client'
import { guard } from './generated/guard/client'
import { UserRouter } from './generated/User/UserRouter'

const prisma = new PrismaClient().$extends(
  guard.extension(() => ({
    // scope context, caller, or any other values
  }))
)

const app = express()

app.use(express.json())

app.use((req, res, next) => {
  req.prisma = prisma
  next()
})

app.use('/', UserRouter({
  findMany: {
    shape: {
      default: {
        where: { name: { contains: true } },
        take: { max: 50, default: 20 },
      },
    },
  },
}))

app.listen(3000)
```

For Fastify and Hono, attach the extended client the same way — via `request.prisma = prisma` (Fastify) or `c.set('prisma', prisma)` (Hono).

If prisma-guard is not installed or the client is not extended with the guard extension, requests to guarded routes return 500 with the message: `Guard shapes require prisma-guard extension on PrismaClient. Install: npm install prisma-guard, then extend your client with guardExtension().`

### How guard integration works

Each operation config accepts an optional `shape` property. When present, the generated handler:

1. Stores the shape on the request context via middleware (Express: `res.locals.guardShape = shape`, Fastify: `request.guardShape = shape`, Hono: `c.set('guardShape', shape)`)
2. Resolves the caller from `config.guard.resolveVariant(req)`, then from the configured header (default `x-api-variant`), falling back to `undefined`
3. Calls `prisma.model.guard(shape, caller).method(args)` instead of `prisma.model.method(args)`

The downstream handler reads these values (`res.locals.guardShape`, `request.guardShape`, `c.get('guardShape')`) when constructing the Prisma call.

When `shape` is absent, the handler calls Prisma directly with no guard enforcement.

Generated route config types treat `shape` as a named shape map. Use `default` for the normal single-shape case, and add other keys only when you need caller-based variants. The runtime still passes the map to `prisma-guard`; the `default` variant is selected when no caller is provided or no variant matches.

### Default shape per operation

In generated route configs, `shape` is always a named shape map. Use the `default` key when an operation has one normal shape and no caller-specific variants.

`default` is used when no caller is provided or when the caller does not match a named variant. If you do not want fallback behavior, omit `default` and define only explicit variants.

```ts
const userConfig = {
  findMany: {
    shape: {
      default: {
        where: { email: { contains: true }, role: { equals: true } },
        orderBy: { createdAt: true },
        take: { max: 100, default: 25 },
        skip: true,
      },
    },
  },
  create: {
    shape: {
      default: {
        data: { email: true, name: true, role: 'user' },
      },
    },
  },
  update: {
    shape: {
      default: {
        data: { name: true },
        where: { id: { equals: true } },
      },
    },
  },
  delete: {
    shape: {
      default: {
        where: { id: { equals: true } },
      },
    },
  },
}

app.use('/', UserRouter(userConfig))
```

In this example:

- `findMany` allows filtering by `email` (contains) and `role` (equals), sorting by `createdAt`, pagination via `take`/`skip`. All other where fields, orderBy fields, and include/select are rejected.
- `create` accepts `email` and `name` from the client. `role` is forced to `'user'` regardless of what the client sends.
- `update` only allows changing `name`, and requires a unique `id` in `where`.
- `delete` requires a unique `id` in `where`.

### Shape value types in data

Each field in a `data` shape accepts one of four value types:

```ts
import { force } from 'prisma-guard'

const config = {
  create: {
    shape: {
      default: {
        data: {
          email: true,                          // client-controlled, @zod chains apply
          name: true,                           // client-controlled
          role: 'member',                       // forced to 'member', client cannot override
          isActive: force(true),                // forced to boolean true (force() needed to distinguish from client-controlled)
          bio: (base) => base.max(500),         // client-controlled with inline validation override
        },
      },
    },
  },
}
```

- `true` — client provides the value; `@zod` schema directives from the Prisma schema apply
- literal value — server forces this value; client input is ignored
- `force(value)` — same as literal, but required when the forced value is literally `true` (since bare `true` means client-controlled)
- `(base) => schema` — client provides the value; the function receives the base Zod type and returns a refined schema, bypassing `@zod` chains

### Named shapes (variant-based routing)

Different API consumers often need different shapes for the same operation. Named shapes use a caller value to route to the correct shape.

```ts
const userConfig = {
  findMany: {
    shape: {
      admin: {
        where: { email: { contains: true }, role: { equals: true }, isActive: { equals: true } },
        include: { posts: true, profile: true },
        take: { max: 200 },
      },
      public: {
        where: { name: { contains: true } },
        select: { id: true, name: true },
        take: { max: 20, default: 10 },
      },
    },
  },
  create: {
    shape: {
      admin: {
        data: { email: true, name: true, role: true, isActive: true },
      },
      editor: {
        data: { email: true, name: true, role: 'member' },
      },
    },
  },
  guard: {
    variantHeader: 'x-api-variant',
  },
}

app.use('/', UserRouter(userConfig))
```

The client sends the variant in the configured header:

```ts
// Admin frontend
fetch('/user', {
  headers: { 'x-api-variant': 'admin' },
})

// Public frontend
fetch('/user', {
  headers: { 'x-api-variant': 'public' },
})
```

If the caller is missing or doesn't match any key, the request is rejected with 400 (`CallerError`).

### Custom caller resolution

Use `resolveVariant` for caller logic beyond a simple header. The callback parameter type depends on the target.

```ts
// Express
const userConfig = {
  findMany: {
    shape: {
      admin: { /* ... */ },
      public: { /* ... */ },
    },
  },
  guard: {
    resolveVariant: (req) => {
      if (req.user?.role === 'admin') return 'admin'
      return 'public'
    },
  },
}
```

```ts
// Fastify
const userConfig = {
  findMany: {
    shape: {
      admin: { /* ... */ },
      public: { /* ... */ },
    },
  },
  guard: {
    resolveVariant: (request) => {
      if (request.user?.role === 'admin') return 'admin'
      return 'public'
    },
  },
}
```

```ts
// Hono
const userConfig = {
  findMany: {
    shape: {
      admin: { /* ... */ },
      public: { /* ... */ },
    },
  },
  guard: {
    resolveVariant: (c) => {
      const user = c.get('user')
      if (user?.role === 'admin') return 'admin'
      return 'public'
    },
  },
}
```

When using `c.get('user')` or other custom context values in TypeScript, add them to the `Variables` type of your Hono app so the call is typed correctly. For example: `Hono<{ Variables: { prisma: PrismaClient; user?: { role: string } } }>`.

`resolveVariant` takes priority over the header. If both are configured, the header is checked only when `resolveVariant` returns `undefined`.

### Parameterized caller patterns

Caller keys support parameterized path patterns:

```ts
const projectConfig = {
  update: {
    shape: {
      '/admin/projects/:id': {
        data: { title: true, status: true, priority: true },
        where: { id: { equals: true } },
      },
      '/editor/projects/:id': {
        data: { title: true },
        where: { id: { equals: true } },
      },
    },
  },
  guard: {
    variantHeader: 'x-caller',
  },
}
```

The client sends the full path:

```ts
fetch('/project', {
  method: 'PUT',
  headers: {
    'x-caller': '/admin/projects/abc123',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    where: { id: { equals: 'abc123' } },
    data: { title: 'Updated', status: 'active' },
  }),
})
```

Exact matches are checked first. Parameters (`:id`) are routing-only and are not extracted.

### Forced where conditions

Literal values in `where` shapes are forced server-side and cannot be overridden by the client:

```ts
import { force } from 'prisma-guard'

const projectConfig = {
  findMany: {
    shape: {
      default: {
        where: {
          status: { equals: 'published' },         // always filter to published
          isDeleted: { equals: false },             // always exclude deleted
          isActive: { equals: force(true) },        // force() needed for boolean true
          title: { contains: true },                // client-controlled
        },
        take: { max: 50 },
      },
    },
  },
}
```

A request with `{ where: { title: { contains: 'demo' } } }` produces:

```sql
WHERE status = 'published'
AND isDeleted = false
AND isActive = true
AND title LIKE '%demo%'
```

The client cannot bypass the forced conditions.

### Logical combinators (AND, OR, NOT)

Where shapes support `AND`, `OR`, and `NOT`. The combinator value defines which fields are allowed inside it:

```ts
const config = {
  findMany: {
    shape: {
      default: {
        where: {
          OR: {
            title: { contains: true },
            description: { contains: true },
          },
          status: { equals: 'published' },       // forced, always applied
        },
        take: { max: 50 },
      },
    },
  },
}
```

Client sends:

```json
{
  "where": {
    "OR": [
      { "title": { "contains": "demo" } },
      { "description": { "contains": "demo" } }
    ]
  }
}
```

The forced `status = 'published'` is always merged as an AND condition. Forced values inside combinators are lifted to the top-level query, regardless of the combinator type.

### Relation filters in where

Where shapes support relation-level filters. To-many relations use `some`, `every`, `none`. To-one relations use `is`, `isNot`.

```ts
const userConfig = {
  findMany: {
    shape: {
      default: {
        where: {
          posts: {
            some: {
              title: { contains: true },
              published: { equals: true },          // forced inside the relation
            },
          },
        },
        take: { max: 50 },
      },
    },
  },
}
```

The client can filter by `title` inside the relation, but `published = true` is always enforced.

### Select and include in shapes

Shapes can restrict which response fields and relations the client may request:

```ts
const userConfig = {
  findMany: {
    shape: {
      default: {
        where: { role: { equals: true } },
        select: {
          id: true,
          email: true,
          name: true,
          posts: {
            select: { id: true, title: true },
          },
          _count: {
            select: { posts: true },
          },
        },
        take: { max: 50 },
      },
    },
  },
}
```

The client can only select from the whitelisted fields and relations. Attempting to select unlisted fields (e.g. `passwordHash`) is rejected.

`select` and `include` are mutually exclusive at the same level in both the shape and the client request.

For read operations, the shape's `select` or `include` serves two roles: it whitelists what the client is allowed to request, and it provides the default projection when the client omits `select`/`include` from the request. If the client sends a request without `select` or `include`, the shape's projection is automatically applied — the client does not need to duplicate the field list. If the client does send `select` or `include`, it is validated against the shape as a whitelist.

This means a single shape declaration like the example above defines both the security boundary (which fields are allowed) and the default API response shape (which fields are returned when the client doesn't specify).

### Nested include with forced where and pagination

Nested includes on to-many relations support `where`, `orderBy`, `cursor`, `take`, and `skip`:

```ts
import { force } from 'prisma-guard'

const userConfig = {
  findMany: {
    shape: {
      default: {
        include: {
          posts: {
            where: { isDeleted: { equals: false } },     // forced: never return deleted posts
            orderBy: { createdAt: true },
            take: { max: 20, default: 10 },
            skip: true,
          },
          profile: true,                                  // simple include, no constraints
          _count: {
            select: {
              posts: {
                where: { isDeleted: { equals: false } },  // count only non-deleted
              },
            },
          },
        },
        take: { max: 50 },
      },
    },
  },
}
```

### Mutation return projection

Write operations that return records (`create`, `update`, `upsert`, `delete`, `createManyAndReturn`, `updateManyAndReturn`) support `select` and `include` in the shape:

```ts
const userConfig = {
  create: {
    shape: {
      default: {
        data: { email: true, name: true },
        include: {
          profile: true,
        },
      },
    },
  },
  update: {
    shape: {
      default: {
        data: { name: true },
        where: { id: { equals: true } },
        select: {
          id: true,
          name: true,
          updatedAt: true,
        },
      },
    },
  },
}
```

The client can include `include` or `select` in the request body. If the shape does not define projection, the client cannot request one. Batch methods (`createMany`, `updateMany`, `deleteMany`) do not support projection.

For mutations, projection shapes only validate and constrain client-requested projections by default — if the client omits `select`/`include`, Prisma returns the full record. This differs from read operations, where the shape's projection is automatically applied as default. Enable `enforceProjection` in the prisma-guard generator config to always apply mutation projection shapes.

### Upsert

Upsert uses `create` and `update` shape keys instead of `data`:

```ts
import { force } from 'prisma-guard'

const projectConfig = {
  upsert: {
    shape: {
      default: {
        where: { id: { equals: true } },
        create: {
          title: true,
          status: 'draft',
          isActive: force(true),
        },
        update: {
          title: true,
        },
        select: { id: true, title: true, status: true },
      },
    },
  },
}
```

All three (`where`, `create`, `update`) are required. Using `data` instead of `create`/`update` is rejected.

### Bulk mutation safety

`updateMany`, `updateManyAndReturn`, and `deleteMany` require `where` in the shape:

```ts
const userConfig = {
  deleteMany: {
    shape: {
      default: {
        where: { isActive: { equals: true }, role: { equals: true } },
      },
    },
  },
  updateMany: {
    shape: {
      default: {
        data: { isActive: true },
        where: { role: { equals: true } },
      },
    },
  },
}
```

A shape without `where` on these methods is rejected. Empty resolved where at runtime is also rejected.

### Tenant isolation with guard shapes

When the guard extension is configured with scope context, tenant filters are injected automatically into all top-level operations on scoped models. Guard shapes and scope work together:

```prisma
/// @scope-root
model Tenant {
  id       String    @id @default(cuid())
  name     String
  projects Project[]
}

model Project {
  id       String @id @default(cuid())
  title    String
  tenantId String
  tenant   Tenant @relation(fields: [tenantId], references: [id])
}
```

```ts
import { AsyncLocalStorage } from 'node:async_hooks'
import { guard } from './generated/guard/client'

const store = new AsyncLocalStorage<{ tenantId: string }>()

const prisma = new PrismaClient().$extends(
  guard.extension(() => ({
    Tenant: store.getStore()?.tenantId,
  }))
)

app.use(express.json())

app.use((req, res, next) => {
  const tenantId = req.headers['x-tenant-id'] as string
  store.run({ tenantId }, () => {
    req.prisma = prisma
    next()
  })
})

app.use('/', ProjectRouter({
  findMany: {
    shape: {
      default: {
        where: { title: { contains: true } },
        take: { max: 50 },
      },
    },
  },
  create: {
    shape: {
      default: {
        data: { title: true },
      },
    },
  },
}))
```

The scope extension handles tenant isolation at the query level:

- Reads: `AND tenantId = ?` is injected into where
- Creates: `tenantId` is injected into data (the scope FK does not need to be in the data shape)
- Updates/deletes: `tenantId` condition is merged into where, scope FK is stripped from data
- Upsert: scope condition in where, FK injected into create data, FK stripped from update data

The data shape for `create` above only lists `title`. The `tenantId` field is injected by the scope extension automatically — the create completeness check accounts for scope foreign keys.

### Supported shape keys

For reads: `where`, `include`, `select`, `orderBy`, `cursor`, `take`, `skip`, `distinct`, `_count`, `_avg`, `_sum`, `_min`, `_max`, `by`, `having`

For writes: `data`, `where`, `select`, `include` (select/include only on methods that return records)

For upsert: `where`, `create`, `update`, `select`, `include`

### Guard error handling

Guard errors are mapped to HTTP status codes by the generated error handler:

| Error type    | HTTP status | When                                                              |
| ------------- | ----------- | ----------------------------------------------------------------- |
| `ShapeError`  | 400         | Invalid shape config, unknown fields, body validation, type errors |
| `CallerError` | 400         | Missing/unknown/ambiguous caller, caller in body                  |
| `PolicyError` | 403         | Scope denied, missing tenant context, rejected findUnique         |

All errors return `{ "message": "..." }` in the response body.

### Complete guard example

```ts
import express from 'express'
import { AsyncLocalStorage } from 'node:async_hooks'
import { PrismaClient } from '@prisma/client'
import { guard } from './generated/guard/client'
import { force } from 'prisma-guard'
import { UserRouter } from './generated/User/UserRouter'
import { ProjectRouter } from './generated/Project/ProjectRouter'

const store = new AsyncLocalStorage<{ tenantId: string; role: string }>()

const prisma = new PrismaClient().$extends(
  guard.extension(() => ({
    Tenant: store.getStore()?.tenantId,
  }))
)

const app = express()

app.use(express.json())

app.use((req, res, next) => {
  const tenantId = req.headers['x-tenant-id'] as string
  const role = req.headers['x-role'] as string || 'viewer'
  store.run({ tenantId, role }, () => {
    req.prisma = prisma
    next()
  })
})

app.use('/', ProjectRouter({
  findMany: {
    shape: {
      admin: {
        where: { title: { contains: true }, status: { equals: true } },
        include: { members: true },
        orderBy: { createdAt: true },
        take: { max: 200 },
        skip: true,
      },
      viewer: {
        where: {
          title: { contains: true },
          status: { equals: 'published' },
          isDeleted: { equals: false },
        },
        select: { id: true, title: true, createdAt: true },
        take: { max: 50, default: 20 },
      },
    },
  },
  create: {
    shape: {
      admin: {
        data: { title: true, status: true, priority: true },
        include: { members: true },
      },
      viewer: {
        data: { title: true, status: 'draft', priority: 1 },
      },
    },
  },
  update: {
    shape: {
      admin: {
        data: { title: true, status: true, priority: true },
        where: { id: { equals: true } },
      },
      viewer: {
        data: { title: true },
        where: { id: { equals: true } },
      },
    },
  },
  delete: {
    shape: {
      admin: {
        where: { id: { equals: true } },
      },
    },
  },
  guard: {
    resolveVariant: (req) => {
      const ctx = store.getStore()
      return ctx?.role === 'admin' ? 'admin' : 'viewer'
    },
  },
}))

app.listen(3000)
```

In this setup:

- Admins can filter by any allowed field, include relations, and take up to 200 rows
- Viewers can only see published, non-deleted projects with a restricted field set — the `select` shape automatically applies as the default projection, so viewer clients don't need to send `select` in the request
- Create: admins set any allowed field; viewers always create drafts with priority 1
- Delete: only admins can delete; viewers hitting the delete endpoint get a `CallerError` because there is no `viewer` shape for delete
- Tenant isolation is automatic — every query is scoped to the tenant from `x-tenant-id`

## Request body format

All write operations accept the full Prisma args object as the JSON request body. The body must be a JSON object — sending `null`, arrays, or other non-object values returns 400.

```ts
// Create
{ "data": { "name": "Alice", "email": "alice@example.com" }, "select": { "id": true } }

// Update
{ "where": { "id": 1 }, "data": { "name": "Bob" } }

// Delete
{ "where": { "id": 1 } }

// Upsert
{ "where": { "id": 1 }, "create": { "name": "Alice" }, "update": { "name": "Bob" } }
```

Write operations that return records (create, update, delete, upsert, createManyAndReturn, updateManyAndReturn) support `select`, `include`, and `omit` in the request body to control the response shape.

For Express, mount `express.json()` before the router so request bodies are parsed. For Hono, malformed JSON bodies are rejected with 400 (`{ "message": "Invalid JSON in request body" }`) before reaching the handler.

### Bulk operations

`createMany`, `createManyAndReturn`, `updateMany`, and `updateManyAndReturn` accept scalar-only data inputs. Nested relation writes are not supported in bulk operations.

### Batch operation safety

`deleteMany`, `updateMany`, and `updateManyAndReturn` require a `where` field in the request body. Requests without `where` are rejected with 400 to prevent accidental mass operations. Sending `{ "where": {} }` is valid and matches all records — this protection catches accidental omission, not intentional broad operations.

## Query encoding (client side)

```ts
import { encodeQueryParams } from './generated/client/encodeQueryParams'

const params = encodeQueryParams({
  where: { status: 'active', role: { in: ['admin', 'editor'] } },
  select: { id: true, email: true },
  take: 20,
})

const response = await fetch(`/user?${params}`)
```

Complex values (`where`, `select`, `include`, `omit`, `orderBy`) are JSON-stringified. Primitives (`take`, `skip`) are sent directly. The encoder handles BigInt serialization automatically.

## POST read endpoints

All read operations are available via POST in addition to GET. POST read endpoints accept the same arguments as their GET counterparts, but as a JSON request body instead of query parameters. This is useful when complex filters, deeply nested `where` clauses, or large `select`/`include` objects exceed URL length limits (typically 2048–8192 characters depending on server, proxy, and CDN configuration).

POST read endpoints are enabled by default. Disable them with `disablePostReads: true` in the route config.

### Path mapping

Most read operations use the same path for both GET and POST. The only exception is `findMany`, which uses a `/read` suffix to avoid conflicting with `POST /` (create).

`{modelname}` in the paths below is the lowercased model name. See [Path casing in generated endpoints](#path-casing-in-generated-endpoints).

| Operation         | GET path                     | POST path                    |
| ----------------- | ---------------------------- | ---------------------------- |
| findMany          | `/{modelname}/`              | `/{modelname}/read`          |
| findFirst         | `/{modelname}/first`         | `/{modelname}/first`         |
| findFirstOrThrow  | `/{modelname}/first/strict`  | `/{modelname}/first/strict`  |
| findUnique        | `/{modelname}/unique`        | `/{modelname}/unique`        |
| findUniqueOrThrow | `/{modelname}/unique/strict` | `/{modelname}/unique/strict` |
| findManyPaginated | `/{modelname}/paginated`     | `/{modelname}/paginated`     |
| count             | `/{modelname}/count`         | `/{modelname}/count`         |
| aggregate         | `/{modelname}/aggregate`     | `/{modelname}/aggregate`     |
| groupBy           | `/{modelname}/groupby`       | `/{modelname}/groupby`       |

### Usage

With GET and `encodeQueryParams`:

```ts
import { encodeQueryParams } from './generated/client/encodeQueryParams'

const params = encodeQueryParams({
  where: { status: 'active', role: { in: ['admin', 'editor'] } },
  select: { id: true, email: true },
  take: 20,
})

const response = await fetch(`/user?${params}`)
```

With POST — same args, no encoding needed:

```ts
const response = await fetch('/user/read', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    where: { status: 'active', role: { in: ['admin', 'editor'] } },
    select: { id: true, email: true },
    take: 20,
  }),
})
```

### Differences from GET

POST read bodies use native JSON types directly — numbers are numbers, booleans are booleans, objects are objects. There is no JSON-string encoding of nested values as with GET query parameters, and no string-to-type coercion is applied. The `encodeQueryParams` utility is not needed for POST reads.

### Guard shapes

POST read endpoints use the same guard shapes, hooks, and middleware as their GET counterparts. The same `before`/`after` hooks run for both GET and POST on the same operation.

### Disabling

```ts
app.use('/', UserRouter({
  enableAll: true,
  disablePostReads: true,
}))
```

## Materialized views router (Express)

The Express target includes a standalone helper for read-only access to PostgreSQL materialized views.

Materialized views are not Prisma models and do not have Prisma delegates, so they are not generated as normal per-model routers. Instead, mount one standalone router and provide an explicit registry of allowed views.

This feature is **Express-only**.

### Usage

```ts
import express from 'express'
import { PrismaClient } from '@prisma/client'
import { materializedViewsRouter } from './generated/materializedRouter'

const prisma = new PrismaClient()
const app = express()

app.use('/api', materializedViewsRouter({
  prisma,
  basePath: '/materialized',
  views: {
    jobAdStats: {
      relation: 'mv_jobad_stats',
      orderBy: {
        field: 'updatedAt',
        direction: 'desc',
      },
    },
    companyStats: {
      relation: 'mv_company_stats',
    },
  },
}))

app.listen(3000)
```

This registers:

```http
GET /api/materialized/jobAdStats?take=50&skip=0
GET /api/materialized/companyStats?take=50
```

### View registry

Each key in `views` is the public API name. The `relation` value is the actual database relation name.

```ts
views: {
  jobAdStats: {
    relation: 'mv_jobad_stats',
    schema: 'public',
    defaultLimit: 50,
    maxLimit: 500,
    orderBy: {
      field: 'updatedAt',
      direction: 'desc',
      nulls: 'last',
    },
  },
}
```

Supported view options:

| Option | Type | Description |
| ------ | ---- | ----------- |
| `relation` | `string` | Database materialized view name |
| `schema` | `string` | Optional schema name |
| `defaultLimit` | `number` | Default page size for this view |
| `maxLimit` | `number` | Maximum page size for this view |
| `orderBy` | `string \| object` | Deterministic sort column |
| `authorize` | `function` | Optional per-view authorization hook |

`orderBy` can be a string:

```ts
orderBy: 'updatedAt'
```

Or an object:

```ts
orderBy: {
  field: 'updatedAt',
  direction: 'desc',
  nulls: 'last',
}
```

### Router options

```ts
materializedViewsRouter({
  prisma,
  basePath: '/materialized',
  defaultLimit: 50,
  maxLimit: 1000,
  before: [authMiddleware],
  after: [auditMiddleware],
  views: {
    jobAdStats: { relation: 'mv_jobad_stats' },
  },
})
```

Supported router options:

| Option | Type | Description |
| ------ | ---- | ----------- |
| `prisma` | Prisma client-like object | Must expose `$queryRawUnsafe` |
| `views` | `Record<string, ViewDef>` | Registry of allowed materialized views |
| `basePath` | `string` | Path inside this router, default `''` |
| `defaultLimit` | `number` | Global default page size, default `50` |
| `maxLimit` | `number` | Global max page size, default `1000` |
| `before` | `RequestHandler[]` | Express middleware before the query |
| `after` | `RequestHandler[]` | Express middleware after the query |

### Authorization

Use `before` for shared middleware and `authorize` for per-view checks.

```ts
const forbidden = (message: string) => Object.assign(new Error(message), { status: 403 })

app.use('/api', materializedViewsRouter({
  prisma,
  basePath: '/materialized',
  before: [requireAuth],
  views: {
    publicStats: {
      relation: 'mv_public_stats',
    },
    adminStats: {
      relation: 'mv_admin_stats',
      authorize: (req) => {
        if (req.user?.role !== 'admin') {
          throw forbidden('Forbidden')
        }
      },
    },
  },
}))
```

If a view is not in the registry, the router returns:

```json
{ "message": "unknown view" }
```

### Pagination

The router supports `take` and `skip` query parameters:

```http
GET /materialized/jobAdStats?take=100&skip=200
```

`take` is clamped to the configured max limit. `skip` is clamped to zero or greater.

When `skip > 0`, the view must define `orderBy`. This prevents unstable offset pagination.

```ts
views: {
  jobAdStats: {
    relation: 'mv_jobad_stats',
    orderBy: {
      field: 'updatedAt',
      direction: 'desc',
    },
  },
}
```

### Identifier safety

Only registered view names can be queried. Database identifiers such as `schema`, `relation`, and `orderBy.field` must match this pattern:

```txt
^[A-Za-z_][A-Za-z0-9_]*$
```

Identifiers are double-quoted before being used in SQL.

This means camel-case database columns must exist as quoted identifiers. For example, `orderBy: 'updatedAt'` queries `"updatedAt"`. If the materialized view was created without a quoted alias, PostgreSQL stores the column as `updatedat`.

### Response serialization

Responses use the same serialization behavior as generated routers:

- `BigInt` values become strings
- `Decimal` values become strings
- `Buffer` and `Uint8Array` values become base64 strings
- `DateTime` values become ISO 8601 strings

### Limitations

The materialized views router is intentionally small and read-only.

It does not support:

- Prisma `where`
- Prisma `select`
- Prisma `include`
- Prisma guard shapes
- OpenAPI generation
- Fastify or Hono targets
- refreshing materialized views

Use it for explicit read-only endpoints over known materialized views. For normal Prisma models, use the generated model routers.

## Progressive Endpoint Composition (Express SSE)

Progressive Endpoint Composition lets an Express read endpoint stream partial response fields over Server-Sent Events while still ending with a final result event.

This is useful for page-level endpoints where different UI sections need different slices of data. For example, a dashboard can render profile basics first, then saved jobs, applications, invitations, and activity as each part finishes.

This feature is **Express-only** in v1.

### Mental model

Progressive SSE has two modes:

| Mode | Config | Best for |
| ---- | ------ | -------- |
| Manual stages | `{ stages: [...] }` or `{ mode: 'manual', stages: [...] }` | Custom page-level composition where each stage runs its own query and returns patches |
| Auto include | `{ mode: 'autoInclude' }` | Reads where the client already sends a Prisma `include` or relation `select` tree and you want relation fields streamed progressively |

Manual mode is explicit staged data loading. You define stages yourself and each stage decides what query to run and which field path to patch.

Auto-include mode is generated relation loading. The router keeps the normal GET endpoint, runs the root query first, then loads supported included relations as separate follow-up queries. For single-record reads, relation paths are streamed as field patches. For `findMany` and `findManyPaginated`, root rows are streamed first, direct root relation stages are streamed as index-aligned relation batches, and deeper nested relation stages are merged into the final result.

### Request format

Use the same generated GET read endpoint and request SSE with the `Accept` header:

```http
GET /user/first
Accept: text/event-stream
x-api-variant: /talent/dashboard
```

No new endpoint is generated. The variant is resolved the same way as guard variants: `guard.resolveVariant(req)` first, then the configured header, defaulting to `x-api-variant`.

If a GET read request accepts `text/event-stream` but the matched variant has no progressive config, the router runs the normal read query and returns a single SSE `result` event.

POST read endpoints remain JSON-only.

### Supported operations

Manual progressive SSE can be configured on Express GET read operations only:

- `findMany`
- `findUnique`
- `findUniqueOrThrow`
- `findFirst`
- `findFirstOrThrow`
- `findManyPaginated`
- `count`
- `aggregate`
- `groupBy`

Auto-include progressive SSE supports these Express GET read operations:

- `findUnique`
- `findUniqueOrThrow`
- `findFirst`
- `findFirstOrThrow`
- `findMany`
- `findManyPaginated`

`findMany` and `findManyPaginated` support deep relation loading by flattening parent rows at each relation path, with fallback cases listed in [Auto-include behavior and limits](#auto-include-behavior-and-limits).

If auto-include is configured on an unsupported operation, the router either falls back to single-result SSE or sends an SSE error depending on `fallback`.

Write operations do not support progressive SSE.

### Event protocol

Each event is sent as a normal SSE `data:` line containing JSON.

Progress event:

```json
{ "type": "progress", "stage": "profileBasics", "completed": 1, "total": 4 }
```

Field event:

```json
{ "type": "field", "key": "profile", "value": { "id": "profile-id" } }
```

Nested field event:

```json
{ "type": "field", "key": "profile.appliedTo", "value": [] }
```

Root array event for `findMany` / `findManyPaginated` auto-include:

```json
{ "type": "rootArray", "data": [{ "id": "user-1" }, { "id": "user-2" }] }
```

Relation batch event for a direct root relation in `findMany` / `findManyPaginated` auto-include:

```json
{ "type": "relationBatch", "relationPath": "profile", "values": [{ "id": "profile-1" }, null] }
```

Final result event:

```json
{ "type": "result", "data": { "id": "user-id", "profile": {}, "savedJobAds": [] } }
```

Error event:

```json
{ "type": "error", "message": "Could not load progressive response" }
```

For single-record progressive responses, the final `result.data` is the accumulated object built from all applied patches, unless a manual stage returns a stop result.

For `findMany` auto-include responses, `rootArray.data` is the source of truth for root row identity and order. Each depth-1 `relationBatch.values` array is index-aligned with `rootArray.data`, so `values[i]` belongs to `rootArray.data[i]`. Deeper nested stages emit progress events but do not emit relation batches, because their flattened parent indexes are not root-row indexes. The terminal `result.data` is the fully merged array.

For `findManyPaginated` auto-include responses, `pageMeta` is sent before `rootArray`. The terminal `result.data` has the normal paginated shape: `{ data, total, hasMore }`.

### Manual staged mode

Manual mode is selected when a progressive variant has a `stages` array. `mode: 'manual'` is optional.

Progressive config lives on an Express read operation. It is keyed by the resolved variant.

```ts
import type { ProgressiveStage } from './generated/routeConfig.target'

const dashboardIdentity: ProgressiveStage<{ userId: string }> = async ({
  ctx,
  prisma,
}) => {
  const user = await prisma.user.findFirst({
    select: { id: true },
    where: { id: ctx.userId },
  })

  if (!user) {
    return {
      stop: true,
      data: null,
    }
  }

  return {
    key: 'id',
    value: user.id,
  }
}

const dashboardProfileBasics: ProgressiveStage<{ userId: string }> = async ({
  ctx,
  prisma,
}) => {
  const user = await prisma.user.findFirst({
    select: {
      profile: {
        select: {
          id: true,
          profileName: true,
          profilePicture: true,
          jobTitle: true,
          location: true,
          skills: true,
          isAvailableForHire: true,
        },
      },
    },
    where: { id: ctx.userId },
  })

  return {
    key: 'profile',
    value: user?.profile
      ? {
          ...user.profile,
          appliedTo: [],
          invitationsFor: [],
        }
      : null,
  }
}

const dashboardApplications: ProgressiveStage<{ userId: string }> = async ({
  ctx,
  prisma,
  accumulated,
}) => {
  if (accumulated.profile == null) return

  const profile = await prisma.talentProfile.findFirst({
    select: {
      appliedTo: {
        orderBy: { createdAt: 'desc' },
        take: 50,
        where: { deletedAt: null },
        select: {
          id: true,
          createdAt: true,
          viewedAt: true,
        },
      },
    },
    where: { userId: ctx.userId },
  })

  return {
    key: 'profile.appliedTo',
    value: profile?.appliedTo ?? [],
  }
}

const userConfig = {
  resolveContext: (req) => ({
    userId: req.user.id,
  }),

  guard: {
    variantHeader: 'x-api-variant',
  },

  findFirst: {
    shape: {
      '/talent/dashboard': dashboardShape,
      me: meShape,
    },
    progressive: {
      '/talent/dashboard': {
        enabled: true,
        stages: [
          'dashboardIdentity',
          'dashboardProfileBasics',
          'dashboardApplications',
        ],
      },
    },
    progressiveStages: {
      dashboardIdentity,
      dashboardProfileBasics,
      dashboardApplications,
    },
  },
}

app.use('/', UserRouter(userConfig))
```

`resolveContext` is required for a manual progressive variant with `progressive.enabled !== false`. It is not required for ordinary JSON requests, auto-include mode, or single-result SSE fallback.

### Stage function API

```ts
type ProgressiveStageContext<TContext = unknown, TPrisma = any> = {
  ctx: TContext
  req: Request
  res: Response
  prisma: TPrisma
  variant: string
  accumulated: Record<string, unknown>
  signal: AbortSignal
}

type ProgressivePatch = {
  key: string
  value: unknown
}

type ProgressiveStopResult<T = unknown> = {
  stop: true
  data: T
}

type ProgressiveStageResult<T = unknown> =
  | void
  | ProgressivePatch
  | ProgressivePatch[]
  | ProgressiveStopResult<T>

type ProgressiveStage<TContext = unknown, TPrisma = any, T = unknown> = (
  context: ProgressiveStageContext<TContext, TPrisma>,
) => Promise<ProgressiveStageResult<T>>
```

A stage may return:

- `void` — no patch for this stage
- one `{ key, value }` patch
- an array of patches
- `{ stop: true, data }` to immediately send a final `result` event and stop executing later stages

### Patch path behavior

Patch keys use dot paths, for example `profile.appliedTo`.

Nested patches require the parent object to already exist in `accumulated`. If a stage tries to patch through `null`, `undefined`, an array, a primitive, or a non-plain object, the patch is dropped and no `field` event is sent.

This means parent objects should be initialized by earlier stages:

```ts
return {
  key: 'profile',
  value: {
    ...profileBasics,
    appliedTo: [],
    invitationsFor: [],
  },
}
```

Patch path segments `__proto__`, `constructor`, `prototype`, and empty path segments are rejected.

### Auto-include mode

Auto-include mode is selected with `mode: 'autoInclude'`.

```ts
const userConfig = {
  guard: {
    variantHeader: 'x-api-variant',
  },

  findUnique: {
    progressive: {
      detail: {
        enabled: true,
        mode: 'autoInclude',
        fallback: 'singleResult',
      },
    },
  },
}

app.use('/', UserRouter(userConfig))
```

Client request:

```ts
import { encodeQueryParams } from './generated/client/encodeQueryParams'

const params = encodeQueryParams({
  where: { id: 'user-id' },
  include: {
    profile: {
      select: {
        id: true,
        displayName: true,
      },
    },
    posts: {
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        title: true,
      },
    },
  },
})

const response = await fetch(`/user/unique?${params}`, {
  headers: {
    Accept: 'text/event-stream',
    'x-api-variant': 'detail',
  },
})
```

On single-record reads, auto-include sends root scalar fields first, then sends relation field events as separate relation queries finish:

```json
{ "type": "field", "key": "id", "value": "user-id" }
```

```json
{ "type": "field", "key": "profile", "value": { "id": "profile-id", "displayName": "Alice" } }
```

```json
{ "type": "field", "key": "posts", "value": [{ "id": "post-id", "title": "Hello" }] }
```

The final `result` event contains the assembled object.

For `findMany`, auto-include sends the root rows first, then sends one relation batch event for each supported direct root relation stage. Nested relation stages emit progress and are included in the final result:

```ts
const listConfig = {
  guard: {
    variantHeader: 'x-api-variant',
  },

  findMany: {
    progressive: {
      list: {
        enabled: true,
        mode: 'autoInclude',
        fallback: 'singleResult',
      },
    },
  },
}

const params = encodeQueryParams({
  where: { isActive: true },
  take: 50,
  include: {
    profile: {
      select: {
        id: true,
        displayName: true,
      },
    },
  },
})

const response = await fetch(`/user?${params}`, {
  headers: {
    Accept: 'text/event-stream',
    'x-api-variant': 'list',
  },
})
```

Example shallow `findMany` auto-include event sequence:

```json
{ "type": "rootArray", "data": [{ "id": "user-1" }, { "id": "user-2" }] }
```

```json
{ "type": "relationBatch", "relationPath": "profile", "values": [{ "id": "profile-1", "displayName": "Alice" }, null] }
```

```json
{ "type": "result", "data": [{ "id": "user-1", "profile": { "id": "profile-1", "displayName": "Alice" } }, { "id": "user-2", "profile": null }] }
```

Deep `findMany` and `findManyPaginated` requests use the same planner. Nested stages are loaded by flattening the parent rows at each path:

```ts
const params = encodeQueryParams({
  take: 20,
  include: {
    companies: {
      include: {
        users: {
          include: {
            profile: {
              select: {
                id: true,
                displayName: true,
              },
            },
          },
        },
      },
    },
  },
})

const response = await fetch(`/organization/paginated?${params}`, {
  headers: {
    Accept: 'text/event-stream',
    'x-api-variant': 'list',
  },
})
```

Example deep event sequence:

```json
{ "type": "pageMeta", "total": 120, "hasMore": true }
```

```json
{ "type": "rootArray", "data": [{ "id": "org-1" }, { "id": "org-2" }] }
```

```json
{ "type": "relationBatch", "relationPath": "companies", "values": [[{ "id": "company-1" }], []] }
```

```json
{ "type": "progress", "stage": "companies.users", "completed": 2, "total": 3 }
```

```json
{ "type": "progress", "stage": "companies.users.profile", "completed": 3, "total": 3 }
```

```json
{ "type": "result", "data": { "data": [{ "id": "org-1", "companies": [{ "id": "company-1", "users": [{ "id": "user-1", "profile": { "id": "profile-1", "displayName": "Alice" } }] }] }, { "id": "org-2", "companies": [] }], "total": 120, "hasMore": true } }
```


### Auto-include behavior and limits

Auto-include is designed for supported Prisma `include` and relation `select` trees on reads.

Supported root operations:

- `findUnique`
- `findUniqueOrThrow`
- `findFirst`
- `findFirstOrThrow`
- `findMany`
- `findManyPaginated`

Supported single-record relation shapes:

- direct to-one relation includes/selects
- direct to-many relation includes/selects
- to-many relation args such as `where`, `orderBy`, `take`, `skip`, `cursor`, and `distinct`
- nested relation loading through to-one parents

Single-record auto-include falls back when a nested stage crosses a to-many parent. Direct to-many loading is still supported, but nested loading under that array is not handled by the single-record progressive runtime.

Supported `findMany` and `findManyPaginated` relation shapes:

- direct and nested to-one relation includes/selects
- direct and nested to-many relation includes/selects
- relation-level `where` and `orderBy`
- single-column link fields only
- nested depth up to the configured planner limit

For `findMany` and `findManyPaginated`, each stage loads children with a batched query over the flattened parent rows at that stage's `parentPath`. Direct root stages can stream `relationBatch` events. Deeper stages are merged into the server-side result and visible in the terminal `result` event.

`findMany` and `findManyPaginated` auto-include apply configured pagination limits to the root query before loading relation batches. If the client omits `take`, `pagination.defaultLimit` is applied when configured. If the client sends a large `take`, `pagination.maxLimit` is enforced before the root query runs.

Current MVP fallback cases include:

- `_count` in `select` or `include`
- implicit many-to-many relations
- `select` and `include` at the same level
- `select` and `omit` at the same level
- relation filters/order/cursor in the root query
- relation filters/order/cursor inside staged relation queries when unsupported
- omitted required link fields needed to stitch parent and child records
- planner limits for maximum depth or stage count
- single-record nested relation loading through a to-many parent
- `findMany` / `findManyPaginated` relation stages with composite link fields
- `findMany` / `findManyPaginated` to-many relation stages using `take`, `skip`, `cursor`, or `distinct`
- `createManyAndReturn` and `updateManyAndReturn`

When fallback happens:

- `fallback: 'singleResult'` runs the normal Prisma read and returns one SSE `result` event
- `fallback: 'error'` sends an SSE `error` event instead

If `fallback` is omitted, the default behavior is equivalent to `'singleResult'`.

`findMany` and `findManyPaginated` auto-include use a batched relation loading strategy. They do not preserve Prisma's per-parent semantics for to-many `take`, `skip`, `cursor`, or `distinct`, so those cases fall back instead of returning silently different data.

Auto-include does not require `resolveContext` or `progressiveStages`.

### Hooks and guard behavior

For SSE requests:

- `before` hooks run before streaming starts
- `after` hooks do not run, because the SSE middleware handles the response and does not continue to the normal handler
- manual progressive stages receive `req.prisma` directly
- manual progressive stages do not automatically use guard shapes
- auto-include mode does not run when an operation has a guard `shape`; it falls back to single-result SSE or emits an SSE error depending on `fallback`

Manual stage authors are responsible for using the resolved context and enforcing ownership or tenant constraints in their stage queries.

For variants without progressive config, the single-result SSE fallback uses the normal generated core read handler, so guard shape behavior matches the JSON endpoint.

### Client-side usage

Use `fetch` with streaming. Native browser `EventSource` cannot send custom headers like `x-api-variant`.

Minimal example:

```ts
const response = await fetch('/user/first', {
  headers: {
    Accept: 'text/event-stream',
    'x-api-variant': '/talent/dashboard',
  },
})

if (!response.body) {
  throw new Error('ReadableStream is not available')
}

const reader = response.body.getReader()
const decoder = new TextDecoder()
let buffer = ''
let rows: Array<Record<string, unknown>> = []
let fields: Record<string, unknown> = {}
let data: unknown = undefined

while (true) {
  const { value, done } = await reader.read()
  if (done) break

  buffer += decoder.decode(value, { stream: true })
  const parts = buffer.split('\n\n')
  buffer = parts.pop() ?? ''

  for (const part of parts) {
    const line = part
      .split('\n')
      .find((entry) => entry.startsWith('data: '))

    if (!line) continue

    const event = JSON.parse(line.slice('data: '.length))

    if (event.type === 'rootArray') {
      rows = event.data
    }

    if (event.type === 'field') {
      fields[event.key] = event.value
    }

    if (event.type === 'relationBatch') {
      rows = rows.map((row, index) => ({
        ...row,
        [event.relationPath]: event.values[index],
      }))
    }

    if (event.type === 'result') {
      data = event.data
    }
  }
}
```

For React Query, include the variant and mode in the query key:

```ts
['user', 'first', { variant: '/talent/dashboard', mode: 'sse' }]
```

Do not reuse the same query key as the JSON endpoint because the same URL can return different shapes depending on `x-api-variant`.

For deep `findMany` / `findManyPaginated` auto-include, consume the final `result` event as the authoritative nested payload. Only direct root relation stages emit `relationBatch` events.

### Runtime notes

The SSE response sets:

```http
Content-Type: text/event-stream
Cache-Control: no-cache, no-transform
Connection: keep-alive
X-Accel-Buffering: no
```

The server sends keepalive comments periodically:

```txt
: keepalive
```

If compression middleware is used, configure it to skip `text/event-stream`, or ensure `res.flush()` is available so events are flushed promptly.

## Response shaping: select, include, omit

Read and single-record write operations support three response shaping parameters:

- **`select`** — choose which fields to include. Set scalar fields to `true`, use nested objects for relations.
- **`include`** — include relations in addition to all scalar fields. Use nested `include`/`select` for deep loading.
- **`omit`** — exclude specific scalar fields from the response.

`select` and `include` cannot be used together at the same level. `select` and `omit` cannot be used together at the same level. `omit` can be combined with `include`.

The `omit` parameter requires Prisma 6.2.0+. On versions 6.0.x–6.1.x, requests using `omit` return 400.

When using guard shapes, the shape's `select` or `include` defines both the whitelist and the default projection for read operations. See [Select and include in shapes](#select-and-include-in-shapes).

## BigInt and Decimal handling

BigInt and Decimal values are serialized as strings in JSON responses. Buffer and Uint8Array values are serialized as base64 strings. The OpenAPI spec documents BigInt and Decimal fields as `type: string`.

On the client side, `encodeQueryParams` handles BigInt serialization automatically.

## Pagination

`findManyPaginated` returns `{ data, total, hasMore }`. When the runtime supports interactive transactions, the count and query execute in a transaction for consistency. On runtimes without interactive transaction support, the queries run independently with eventual consistency on the `total` count.

The `hasMore` field is reliable for forward offset pagination (`skip` + `take`) only. When using cursor-based pagination or negative `take` (backward pagination), `hasMore` may be inaccurate.

When `distinct` is used with `findManyPaginated`, the total count is determined by executing a distinct query up to the configured limit (default: 100,000 rows). If the number of distinct values exceeds this limit, the total falls back to an approximate non-distinct count. When guard shapes are active, the distinct counting query respects the guard's where restrictions.

Configure default and maximum page sizes and the distinct count limit:

```ts
UserRouter({
  findManyPaginated: {},
  pagination: {
    defaultLimit: 20,
    maxLimit: 100,
    distinctCountLimit: 50000,
  },
})
```

`pagination.defaultLimit` is applied when the client omits `take`. `pagination.maxLimit` caps `take` by absolute value. `pagination.distinctCountLimit` overrides the default 100,000 row threshold for distinct count estimation. All settings apply to `findMany` and `findManyPaginated`.

## Error handling

All errors are returned as JSON with a `message` field:

```json
{ "message": "Unique constraint violation" }
```

Each generated router installs error handling (Express middleware, Fastify `setErrorHandler`, or Hono `app.onError`) that normalizes errors. Prisma error codes are mapped to appropriate HTTP status codes. Guard errors are mapped as follows: `ShapeError` and `CallerError` → 400, `PolicyError` → 403.

For the Hono target, thrown `HTTPException` instances are caught by `app.onError` and converted to `{ "message": err.message }` with the exception's status code. Custom response bodies attached to `HTTPException` are not preserved — see [HTTPException normalization](#httpexception-normalization).

| Status | Description                                |
| ------ | ------------------------------------------ |
| 400    | Invalid parameters, body, or query         |
| 403    | Guard policy rejected                      |
| 404    | Record not found                           |
| 409    | Unique constraint or transaction conflict  |
| 500    | Internal server error                      |
| 501    | Feature not supported by database provider |
| 503    | Database connection pool timeout           |

## Security

All incoming JSON bodies and query parameters are sanitized to reject `__proto__`, `constructor`, and `prototype` keys, preventing prototype pollution attacks.

## Documentation endpoints

### Automatic (registered by each router)

Each router automatically registers OpenAPI spec endpoints when not in production:

| Endpoint                        | Description           |
| ------------------------------- | --------------------- |
| `/{modelname}/openapi.json`     | OpenAPI 3.1 JSON spec |
| `/{modelname}/openapi.yaml`     | OpenAPI 3.1 YAML spec |

Actual paths depend on `customUrlPrefix` and `addModelPrefix` configuration. `{modelname}` is the lowercased model name (see [Path casing](#path-casing-in-generated-endpoints)).

The OpenAPI spec includes POST read endpoints when they are enabled (default). Each POST read operation appears with its own `operationId` and request body schema documenting the native JSON argument types.

### Manual (generated helpers, require mounting)

The generator produces helper functions that you mount yourself. Pass the same config object used for the router to keep docs and runtime in sync.

#### Express

```ts
import {
  generateCombinedDocs,
  registerModelDocs,
} from './generated/combinedDocs'

const userConfig = {
  findMany: { before: [authMiddleware] },
  create: {},
  findUnique: {},
}

const postConfig = {
  enableAll: true,
}

app.use(express.json())

app.use('/', UserRouter(userConfig))
app.use('/', PostRouter(postConfig))

registerModelDocs(app, '/docs', {
  User: userConfig,
  Post: postConfig,
})

app.get(
  '/docs',
  generateCombinedDocs({
    title: 'My API',
    modelConfigs: {
      User: userConfig,
      Post: postConfig,
    },
  }),
)
```

#### Fastify

```ts
import {
  generateCombinedDocs,
  registerModelDocs,
} from './generated/combinedDocs'

const userConfig = {
  findMany: { before: [async (request, reply) => { /* auth */ }] },
  create: {},
  findUnique: {},
}

const postConfig = {
  enableAll: true,
}

fastify.register(async (instance) => {
  await UserRoutes(instance, userConfig)
})

fastify.register(async (instance) => {
  await PostRoutes(instance, postConfig)
})

registerModelDocs(fastify, '/docs', {
  User: userConfig,
  Post: postConfig,
})

fastify.get('/docs', generateCombinedDocs({
  title: 'My API',
  modelConfigs: {
    User: userConfig,
    Post: postConfig,
  },
}))
```

#### Hono

```ts
import { Hono } from 'hono'
import { PrismaClient } from '@prisma/client'
import {
  generateCombinedDocs,
  registerModelDocs,
} from './generated/combinedDocs'
import { UserRouter } from './generated/User/UserRouter'
import { PostRouter } from './generated/Post/PostRouter'

type Env = {
  Variables: {
    prisma: PrismaClient
  }
}

const prisma = new PrismaClient()

const userConfig = {
  findMany: { before: [async (c, next) => { /* auth */ await next() }] },
  create: {},
  findUnique: {},
}

const postConfig = {
  enableAll: true,
}

const app = new Hono<Env>()

app.use('*', async (c, next) => {
  c.set('prisma', prisma)
  await next()
})

app.route('/', UserRouter(userConfig))
app.route('/', PostRouter(postConfig))

registerModelDocs(app, '/docs', {
  User: userConfig,
  Post: postConfig,
})

app.get('/docs', generateCombinedDocs({
  title: 'My API',
  modelConfigs: {
    User: userConfig,
    Post: postConfig,
  },
}))
```

| Endpoint                          | Description             |
| --------------------------------- | ----------------------- |
| `/docs`                           | Combined index page     |
| `/docs/{modelname}`               | Contract view (default) |
| `/docs/{modelname}?ui=scalar`     | Scalar interactive UI   |
| `/docs/{modelname}?ui=json`       | Raw JSON                |
| `/docs/{modelname}?ui=yaml`       | Raw YAML                |
| `/docs/{modelname}?ui=playground` | Query playground        |

The `?ui=playground` endpoint requires `prisma-query-builder-ui`. For Express and Fastify, the builder is auto-started in development. For Hono, the builder must be started manually in a separate process (see [Query Builder](#query-builder)).

Disable in production via `NODE_ENV=production` or `DISABLE_OPENAPI=true`. Override with `disableOpenApi: false` in config to force-enable.

### Spec paths and mount prefixes

Use `specBasePath` to set the base path for OpenAPI spec and docs independently of route registration:

```ts
const userConfig = {
  enableAll: true,
  specBasePath: '/api',
}

app.use('/api', UserRouter(userConfig))
```

When `specBasePath` is not set, `customUrlPrefix` is used for both runtime routes and spec paths.

## prisma-sql integration

When `prisma-sql` is installed, the generated handlers automatically attempt to use its `speedExtension` for optimized SQL execution. The extension activates only when a database connector is provided on the request context.

Set the connector in your middleware to activate the extension:

```ts
import { PrismaClient } from '@prisma/client'
import postgres from 'postgres'
import { Hono } from 'hono'

const prisma = new PrismaClient()
const sql = postgres(process.env.DATABASE_URL!)

// Express
app.use(express.json())
app.use((req, res, next) => {
  req.prisma = prisma
  req.postgres = sql
  next()
})

// Fastify
fastify.addHook('onRequest', async (request) => {
  request.prisma = prisma
  request.postgres = sql
})

// Hono
type Env = {
  Variables: {
    prisma: PrismaClient
    postgres: ReturnType<typeof postgres>
  }
}

const app = new Hono<Env>()

app.use('*', async (c, next) => {
  c.set('prisma', prisma)
  c.set('postgres', sql)
  await next()
})
```

Without a connector on the request context, the handlers use the standard PrismaClient. Set `DEBUG=true` in the environment to enable prisma-sql debug logging.

For SQLite, use `c.set('sqlite', sqliteConnector)` (Hono) or the equivalent on Express/Fastify, and add `sqlite` to the `Variables` type.

## Query parameter parsing

GET query values are parsed server-side. Strings starting with `{`, `[`, or `"` are JSON-parsed. The strings `true`, `false`, `null` are converted to their JS equivalents. Numeric conversion applies only to `take` and `skip`, and only when the value is a valid integer (e.g., `"10"` is parsed, `"10.5"` and `""` are not). Use `encodeQueryParams` on the client side to avoid encoding issues.

POST read endpoints bypass this parsing entirely — the JSON body is used as-is with native types.

On the Hono target, duplicate query keys collapse to the last value (`?a=1&a=2` → `a=2`). `encodeQueryParams` does not emit duplicate keys, so this only matters for hand-built query strings.

## Router schema

`{modelname}` in the paths below is the lowercased model name. For a `User` model, `/{modelname}/first` becomes `/user/first`. For `BlogPost`, it becomes `/blogpost/first`. See [Path casing in generated endpoints](#path-casing-in-generated-endpoints).

| Operation           | Method | Path                         | Notes                              |
| ------------------- | ------ | ---------------------------- | ---------------------------------- |
| findMany            | GET    | `/{modelname}/`              |                                    |
| findMany            | POST   | `/{modelname}/read`          | POST read alternative              |
| findFirst           | GET    | `/{modelname}/first`         |                                    |
| findFirst           | POST   | `/{modelname}/first`         | POST read alternative              |
| findFirstOrThrow    | GET    | `/{modelname}/first/strict`  |                                    |
| findFirstOrThrow    | POST   | `/{modelname}/first/strict`  | POST read alternative              |
| findUnique          | GET    | `/{modelname}/unique`        |                                    |
| findUnique          | POST   | `/{modelname}/unique`        | POST read alternative              |
| findUniqueOrThrow   | GET    | `/{modelname}/unique/strict` |                                    |
| findUniqueOrThrow   | POST   | `/{modelname}/unique/strict` | POST read alternative              |
| findManyPaginated   | GET    | `/{modelname}/paginated`     |                                    |
| findManyPaginated   | POST   | `/{modelname}/paginated`     | POST read alternative              |
| count               | GET    | `/{modelname}/count`         |                                    |
| count               | POST   | `/{modelname}/count`         | POST read alternative              |
| aggregate           | GET    | `/{modelname}/aggregate`     |                                    |
| aggregate           | POST   | `/{modelname}/aggregate`     | POST read alternative              |
| groupBy             | GET    | `/{modelname}/groupby`       |                                    |
| groupBy             | POST   | `/{modelname}/groupby`       | POST read alternative              |
| create              | POST   | `/{modelname}/`              |                                    |
| createMany          | POST   | `/{modelname}/many`          |                                    |
| createManyAndReturn | POST   | `/{modelname}/many/return`   |                                    |
| update              | PUT    | `/{modelname}/`              |                                    |
| updateMany          | PUT    | `/{modelname}/many`          |                                    |
| updateManyAndReturn | PUT    | `/{modelname}/many/return`   |                                    |
| upsert              | PATCH  | `/{modelname}/`              |                                    |
| delete              | DELETE | `/{modelname}/`              |                                    |
| deleteMany          | DELETE | `/{modelname}/many`          |                                    |

Paths shown are relative suffixes. Actual paths include the model prefix (e.g., `/user/first`) unless `addModelPrefix: false`, and any `customUrlPrefix`.

POST read endpoints are enabled by default. Set `disablePostReads: true` to remove them.

For the Express target, GET read endpoints can also stream SSE events when the request sends `Accept: text/event-stream`. SSE uses the same GET paths shown above; no additional routes are generated. See [Progressive Endpoint Composition](#progressive-endpoint-composition-express-sse).

## Skipping models

Add `/// generator off` to a model's documentation to skip generation:

```prisma
/// generator off
model InternalLog {
  id Int @id
}
```

## Configuration

### Express

```ts
interface RouteConfig<TCtx = unknown> {
  enableAll?: boolean
  addModelPrefix?: boolean           // default: true
  customUrlPrefix?: string
  specBasePath?: string
  disableOpenApi?: boolean
  disablePostReads?: boolean         // default: false
  scalarCdnUrl?: string

  openApiTitle?: string
  openApiDescription?: string
  openApiVersion?: string
  openApiServers?: OpenApiServerConfig[]
  openApiSecuritySchemes?: Record<string, OpenApiSecuritySchemeConfig>
  openApiSecurity?: Record<string, string[]>[]

  guard?: {
    resolveVariant?: (req: Request) => string | undefined
    variantHeader?: string           // default: 'x-api-variant'
  }

  resolveContext?: (req: Request) => TCtx | Promise<TCtx>

  queryBuilder?: QueryBuilderConfig | false

  pagination?: {
    defaultLimit?: number
    maxLimit?: number
    distinctCountLimit?: number      // default: 100000
  }

  // read operation config
  findMany?: ReadOperationConfig<TCtx>
  findUnique?: ReadOperationConfig<TCtx>
  findUniqueOrThrow?: ReadOperationConfig<TCtx>
  findFirst?: ReadOperationConfig<TCtx>
  findFirstOrThrow?: ReadOperationConfig<TCtx>
  findManyPaginated?: ReadOperationConfig<TCtx>
  aggregate?: ReadOperationConfig<TCtx>
  count?: ReadOperationConfig<TCtx>
  groupBy?: ReadOperationConfig<TCtx>

  // write operation config
  create?: OperationConfig
  createMany?: OperationConfig
  createManyAndReturn?: OperationConfig
  update?: OperationConfig
  updateMany?: OperationConfig
  updateManyAndReturn?: OperationConfig
  upsert?: OperationConfig
  delete?: OperationConfig
  deleteMany?: OperationConfig
}

interface OperationConfig {
  before?: RequestHandler[]
  after?: RequestHandler[]
  shape?: Record<string, any>
}

interface ReadOperationConfig<TCtx = unknown> extends OperationConfig {
  progressive?: Record<string, ProgressiveVariantConfig>
  progressiveStages?: Record<string, ProgressiveStage<TCtx>>
}

type ManualProgressiveVariantConfig = {
  enabled?: boolean
  mode?: 'manual'
  stages: string[]
}

type AutoIncludeProgressiveVariantConfig = {
  enabled?: boolean
  mode: 'autoInclude'
  fallback?: 'singleResult' | 'error'
}

type ProgressiveVariantConfig =
  | ManualProgressiveVariantConfig
  | AutoIncludeProgressiveVariantConfig

type ProgressiveStageContext<TContext = unknown, TPrisma = any> = {
  ctx: TContext
  req: Request
  res: Response
  prisma: TPrisma
  variant: string
  accumulated: Record<string, unknown>
  signal: AbortSignal
}

type ProgressivePatch = {
  key: string
  value: unknown
}

type ProgressiveStopResult<T = unknown> = {
  stop: true
  data: T
}

type ProgressiveStageResult<T = unknown> =
  | void
  | ProgressivePatch
  | ProgressivePatch[]
  | ProgressiveStopResult<T>

type ProgressiveStage<TContext = unknown, TPrisma = any, T = unknown> = (
  context: ProgressiveStageContext<TContext, TPrisma>,
) => Promise<ProgressiveStageResult<T>>

interface QueryBuilderConfig {
  enabled?: boolean
  port?: number
  host?: string
  schemaPath?: string
  databaseUrl?: string
}
```

### Fastify

The Fastify config is identical except for hook and resolver types:

```ts
interface OperationConfig {
  before?: FastifyHookHandler[]
  after?: FastifyHookHandler[]
  shape?: Record<string, any>
}

type FastifyHookHandler = (
  request: FastifyRequest,
  reply: FastifyReply,
) => Promise<void> | void
```

The `guard.resolveVariant` callback receives `FastifyRequest` instead of `Request`.

### Hono

The Hono config is identical except for hook and resolver types:

```ts
interface OperationConfig {
  before?: HonoHookHandler[]
  after?: HonoHookHandler[]
  shape?: Record<string, any>
}

type HonoHookHandler<Env extends { Variables: any } = any> = (
  c: Context<Env>,
  next: Next,
) => Promise<Response | void> | Response | void
```

The `guard.resolveVariant` callback receives Hono's `Context`. Hooks are native Hono middleware — call `await next()` to continue the chain, return a `Response` (or throw `HTTPException`) to short-circuit.

The Hono router does not auto-start the Query Builder. Set `queryBuilder: false` to make the playground route return 404, or run `prisma-query-builder-ui` manually for development.

### Shared options

`customUrlPrefix` is normalized to ensure a leading slash and strip trailing slashes.

`specBasePath` controls the base path used in OpenAPI spec paths and docs examples, independent of `customUrlPrefix`.

`disablePostReads` removes all POST read endpoints when set to `true`. POST read endpoints are enabled by default. This is a global setting — there is no per-operation toggle.

`resolveContext` is Express-only and is required for enabled progressive SSE variants. It is called before progressive stages run and its return value is passed to each stage as `ctx`.

`openApiServers` sets the `servers` array in the OpenAPI spec:

```ts
UserRouter({
  enableAll: true,
  openApiServers: [
    { url: 'https://api.example.com/v1', description: 'Production' },
  ],
})
```

`openApiSecuritySchemes` and `openApiSecurity` set the security configuration in the OpenAPI spec:

```ts
UserRouter({
  enableAll: true,
  openApiSecuritySchemes: {
    bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
  },
  openApiSecurity: [{ bearerAuth: [] }],
})
```

## Environment variables

| Variable          | Default | Description                         |
| ----------------- | ------- | ----------------------------------- |
| `DISABLE_OPENAPI` | `false` | Disable OpenAPI endpoints           |
| `NODE_ENV`        | -       | Set to `production` to disable docs |
| `DEBUG`           | `false` | Enable prisma-sql debug logging     |

## License

MIT