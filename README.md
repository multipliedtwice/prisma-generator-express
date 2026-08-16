<p align="center">
  <img src="docs/assets/favicon.svg" width="88" height="88" alt="Prisma Generator Express logo">
</p>

<h1 align="center">Prisma Generator Express</h1>

<p align="center"><strong>Prisma generator that creates Express, Fastify, or Hono CRUD API routes with OpenAPI documentation from your Prisma schema.</strong></p>

<p align="center">
  <a href="https://www.npmjs.com/package/prisma-generator-express"><img src="https://badge.fury.io/js/prisma-generator-express.svg" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/prisma-generator-express"><img src="https://img.shields.io/npm/dt/prisma-generator-express.svg" alt="npm downloads"></a>
  <a href="https://codecov.io/gh/multipliedtwice/prisma-generator-express"><img src="https://img.shields.io/codecov/c/github/multipliedtwice/prisma-generator-express/master.svg" alt="Coverage"></a>
  <a href="LICENSE"><img src="https://img.shields.io/npm/l/prisma-generator-express.svg" alt="License"></a>
</p>

<p align="center">
  <a href="https://multipliedtwice.github.io/prisma-generator-express/">Field Guide</a> ·
  <a href="https://www.npmjs.com/package/prisma-generator-express">npm</a> ·
  <a href="article-labs/guard/">Guard Evidence</a> ·
  <a href="article-labs/http/">HTTP/PostgreSQL Evidence</a> ·
  <a href="#documentation-endpoints">API Documentation</a>
</p>

Running `npx prisma generate` produces:

- Handler functions for all Prisma operations (findMany, create, update, delete, etc.)
- Schema-level `findManyPaginated` execution mode selection (`Promise.all` or interactive transaction)
- Per-route and per-endpoint pagination config, including optional materialized-view count sources
- Router generator with operation-wide and per-variant before/after hooks
- POST read endpoints for all read operations (for complex queries exceeding URL length limits)
- Express-only progressive read streaming over Server-Sent Events (SSE), using manual stages or auto-include splitting for supported relation reads, including unguarded deep `findMany` / `findManyPaginated` auto-include paths and guarded single-record auto-include paths
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
- [Write strategy](#write-strategy)
- [findManyPaginated execution mode](#findmanypaginated-execution-mode)
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
- [updateEach (Express, Fastify, Hono, internal batch)](#updateeach-express-fastify-hono-internal-batch)
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
| `createManyAndReturn` | 5.14.0                 | PostgreSQL, CockroachDB, SQLite only |
| `updateManyAndReturn` | 6.2.0                  | PostgreSQL, CockroachDB, SQLite only |

### Framework support

| Framework | Target value | Generated output |
| --------- | ------------ | ---------------- |
| Express   | `"express"`  | `express.Router()` factory function per model |
| Fastify   | `"fastify"`  | Fastify plugin function per model |
| Hono      | `"hono"`     | `Hono` instance factory function per model |

The Hono target v1 is tested on Node.js runtimes only. See [Cloudflare Workers and edge runtimes](#cloudflare-workers-and-edge-runtimes).

Progressive Endpoint Composition over Server-Sent Events is currently supported by the Express target only. Express supports both manual staged streaming and auto-include streaming for supported relation reads. Unguarded auto-include supports single-record reads and deep `findMany` / `findManyPaginated` reads within the configured planner limits. Guarded auto-include supports selected single-record read shapes while keeping every root and relation-stage query inside prisma-guard. Fastify and Hono continue to support normal JSON read and write routes.

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

## Write strategy

`writeStrategy` is a schema-wide generator option. It controls only non-returning bulk data writes that have Prisma returning counterparts: `createMany` and `updateMany`. It does not affect `deleteMany`.

```prisma
generator express {
  provider      = "prisma-generator-express"
  writeStrategy = "regular"
}
```

Valid values:

| Value | Behavior |
| ----- | -------- |
| `regular` | Default. `createMany` and `updateMany` call the normal Prisma methods and return `{ count }`. |
| `throwOnNonReturning` | Disables the generated `createMany` and `updateMany` endpoints (`POST /{modelname}/many` and `PUT /{modelname}/many`). Direct calls return `501`. Use `createManyAndReturn` and `updateManyAndReturn` endpoints instead. |
| `forceReturn` | `createMany` silently invokes `createManyAndReturn`, and `updateMany` silently invokes `updateManyAndReturn`. These endpoints return arrays of records instead of `{ count }` and support `select`, `include`, and `omit`. |

`forceReturn` still follows Prisma provider support. If the current provider does not support `createManyAndReturn` or `updateManyAndReturn`, the generated endpoint returns `501 Not Implemented` at runtime.

Example:

```prisma
generator express {
  provider      = "prisma-generator-express"
  target        = "express"
  writeStrategy = "forceReturn"
}
```

## findManyPaginated execution mode

`findManyPaginatedMode` is a schema-wide generator option. It controls how generated `findManyPaginated` handlers execute the root `findMany` query and the total-count query.

```prisma
generator express {
  provider              = "prisma-generator-express"
  findManyPaginatedMode = "promiseAll"
}
```

Valid values:

| Value | Behavior |
| ----- | -------- |
| `promiseAll` | Default. Generates `Promise.all([findMany, count])`. This is faster and works on clients without interactive transaction support, but the returned `data` and `total` are not atomic under concurrent writes. |
| `transaction` | Generates an interactive transaction around `findMany` and `count`. This keeps `data` and `total` consistent inside the transaction, but returns `500` if the Prisma client does not expose `$transaction`. There is no implicit fallback. |

This option affects normal JSON `findManyPaginated` responses and Express SSE auto-include `findManyPaginated` responses.

Use `transaction` when atomic page metadata matters more than latency. Use `promiseAll` when throughput and broad runtime compatibility matter more than strict consistency between `data` and `total`.

Example:

```prisma
generator express {
  provider              = "prisma-generator-express"
  target                = "express"
  findManyPaginatedMode = "transaction"
}
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

Hono route hooks are generated pre/post handler hooks, not native Hono middleware chains. A hook continues by returning `void`. It short-circuits by returning a `Response`, and errors by throwing, including `HTTPException`.

```ts
import type { HonoBeforeHook } from './generated/routeConfig.target'

const auth: HonoBeforeHook = async (c) => {
  const token = c.req.header('authorization')
  if (!token) return c.json({ message: 'Unauthorized' }, 401)
}

const userConfig = {
  findMany: {
    before: [auth],
  },
}
```

`before` hooks run before the generated handler. `after` hooks run after the generated handler. Do not use `await next()` in generated Hono route hooks. Use normal `app.use()` middleware outside the generated router when you need native Hono downstream/after-`next()` behavior.

### HTTPException normalization

Throwing Hono's `HTTPException` from a hook short-circuits to a JSON error response. The router's `app.onError` catches the exception, preserves the status code, and **normalizes the response body** to `{ "message": err.message }`.

```ts
import { HTTPException } from 'hono/http-exception'
import type { HonoBeforeHook } from './generated/routeConfig.target'

const auth: HonoBeforeHook = async (c) => {
  const token = c.req.header('authorization')
  if (!token) {
    throw new HTTPException(401, { message: 'Unauthorized' })
  }
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

The Query Builder playground is Node-only and **not auto-started** by the Hono target. The generated `?ui=playground` route can render the playground iframe, but the Hono router never starts the Query Builder server, even when query builder config is present. Start `prisma-query-builder-ui` manually in a separate process and point the config to that server when needed.

### Query string differences

Hono's `c.req.query()` returns a flat `Record<string, string>` — duplicate query keys collapse to the last value. For example, `?take=10&take=20` becomes `{ take: '20' }`. This differs from Express, which parses `?a=1&a=2` into `{ a: ['1', '2'] }`.

The `encodeQueryParams` client utility does not emit duplicate keys, so this only matters for hand-built query strings. All complex Prisma arguments are JSON-encoded into single query values.

### Key differences between targets

| Aspect | Express | Fastify | Hono |
| ------ | ------- | ------- | ---- |
| Generated function | `ModelRouter(config)` returns `express.Router` | `ModelRoutes(fastify, config)` registers on instance | `ModelRouter(config)` returns `Hono` instance |
| Mounting | `app.use('/', ModelRouter(config))` | `fastify.register(async (i) => { await ModelRoutes(i, config) })` | `app.route('/', ModelRouter(config))` |
| Hook types | `RequestHandler[]` | `FastifyHookHandler[]` | `HonoBeforeHook[]` / `HonoAfterHook[]` |
| Hook signature | `(req, res, next)` | `(request, reply)` | `(c) => Response \| void` |
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
    before: [async (c) => {
      const token = c.req.header('authorization')
      if (!token) return c.json({ message: 'Unauthorized' }, 401)
    }],
  },
  create: {
    before: [async (c) => { /* auth + validation */ }],
  },
  findUnique: {},
}

app.route('/', UserRouter(userConfig))
```

Hono route hooks return `void` to continue. Return a `Response` (e.g. `c.json({...}, 403)`) or throw `HTTPException` to short-circuit — subsequent hooks and the handler will not run.

### Hook execution contract

Operation-level hooks run for every successfully routed variant. Variant hooks run only for the selected declared variant key.

```text
operation before-hooks
variant before-hooks
generated handler
variant after-hooks
operation after-hooks
```

A terminal response or an error stops the remaining hooks in that phase. Operation after-hooks are not cleanup or `finally` handlers and are not guaranteed to run. Caller-routing failures are surfaced after operation before-hooks and before variant before-hooks, preserving operation-wide logging and authentication timing.

Only operations listed in the config (or all when `enableAll: true`) are registered. Operations not listed produce no routes.

## Guard shapes (prisma-guard integration)

prisma-generator-express integrates with [prisma-guard](https://github.com/multipliedtwice/prisma-guard) to enforce input validation, query shape restrictions, and tenant isolation on generated routes. Configure either `shape` for the existing guard API or `variants` to co-locate named shapes with per-variant hooks. The handler passes the extracted guard shape map to `prisma.model.guard(shape, caller).method(args)` instead of calling Prisma directly.

Guard routing works identically across Express, Fastify, and Hono. The only target-specific differences are hook types and the type of the `resolveVariant` callback parameter (`Request` for Express, `FastifyRequest` for Fastify, `Context` for Hono).

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

Each operation accepts either the existing `shape` property or the new `variants` property:

- `shape` accepts one direct shape, one context-dependent shape function, or a named shape map.
- `variants` is a named map whose entries contain one shape plus optional per-variant hooks.
- `shape` and `variants` cannot both be defined on the same operation.
- Both may be absent when the operation only needs operation-wide hooks or pagination.

At router construction, the generated router validates and normalizes the descriptor. Variant descriptors are removed before anything reaches prisma-guard, dropped-guard projection logic, progressive planning, or OpenAPI extraction.

For each request, the generated router:

1. Resolves the raw caller from `config.guard.resolveVariant(request)`, then from the configured header (default `x-api-variant`), falling back to `undefined`.
2. Resolves the declared guard variant key using the same exact/default/parameterized precedence as prisma-guard.
3. Applies dropped-guard projection defaults immediately for successful routing when guard is globally dropped, preserving what operation before-hooks observe.
4. Runs operation before-hooks.
5. Converts a stored routing failure into HTTP 400 before any variant hook or generated handler runs.
6. Runs hooks for the matched declared key, calls the generated handler, then runs after-hooks in reverse scope order.

The normalized guard shape is stored on request context (`res.locals.guardShape`, `request.guardShape`, or `c.get('guardShape')`). The declared matched key is stored separately from the raw caller. For example, caller `customer/123` matching `customer/:id` stores `customer/:id` as the variant key.

When neither `shape` nor `variants` is configured, the generated handler calls Prisma directly with no guard enforcement.

### Default shape per operation

For one normal shape, use a direct shape object:

```ts
const userConfig = {
  findMany: {
    shape: {
      where: { email: { contains: true }, role: { equals: true } },
      orderBy: { createdAt: true },
      take: { max: 100, default: 25 },
      skip: true,
    },
  },
}
```

A context-dependent shape function is also valid:

```ts
const userConfig = {
  findMany: {
    shape: (ctx) => ({
      where: {
        companyId: { equals: ctx.companyId },
        name: { contains: true },
      },
      take: { max: 50 },
    }),
  },
}
```

Use a named shape map when only shape routing differs and no per-variant route hooks are needed:

```ts
const userConfig = {
  findMany: {
    shape: {
      admin: {
        where: { email: { contains: true }, role: { equals: true } },
        take: { max: 100 },
      },
      default: {
        where: { name: { contains: true } },
        take: { max: 20, default: 10 },
      },
    },
  },
}
```

`default` is selected when the caller is missing, blank, or unmatched. Without `default`, the request returns 400. Use `variants` instead when hooks must differ by the matched shape.

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

### Variant-specific hooks

Use `variants` to keep each named shape beside the hooks that belong to it:

```ts
const orderConfig = {
  create: {
    before: [authenticate],
    after: [auditOrderCreation],

    variants: {
      customer: {
        shape: customerCreateShape,
        before: [bindCustomer],
        after: [sendCustomerConfirmation],
      },

      seller: {
        shape: sellerCreateShape,
        before: [bindSeller],
      },

      default: {
        shape: internalCreateShape,
      },
    },
  },

  guard: {
    resolveVariant: (req) => req.user?.role,
  },
}
```

The execution order for `customer` is:

```text
authenticate
bindCustomer
generated create handler
sendCustomerConfirmation
auditOrderCreation
```

Important rules:

- Operation-level `before` and `after` hooks run for every successfully resolved variant.
- Variant hooks run only for the selected declared key.
- `variants[key].shape` is one direct operation shape or one context-dependent shape function. It cannot contain another named map.
- `shape` and `variants` are mutually exclusive on one operation, but both may be absent.
- `default` is allowed as a variant key and receives its own hooks when fallback selects it.
- Reserved guard shape keys such as `where`, `data`, `include`, and `select` cannot be variant names.
- OpenAPI generation extracts only the shapes; hook descriptors are never exposed as guard configuration.

`updateEach` does not support `variants`; it keeps operation-wide hooks only.

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
    variants: {
      '/admin/projects/:id': {
        shape: {
          data: { title: true, status: true, priority: true },
          where: { id: true },
        },
        before: [requireAdmin],
      },
      '/editor/projects/:id': {
        shape: {
          data: { title: true },
          where: { id: true },
        },
        before: [requireEditor],
      },
    },
  },
  guard: {
    variantHeader: 'x-caller',
  },
}
```

The client sends the concrete caller:

```ts
fetch('/project', {
  method: 'PUT',
  headers: {
    'x-caller': '/admin/projects/abc123',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    where: { id: 'abc123' },
    data: { title: 'Updated', status: 'active' },
  }),
})
```

Exact non-blank keys are checked first. Parameter segments match one path segment and are not extracted. Blank and whitespace-only callers do not exact-match or pattern-match; they use `default` or return 400.

The router stores the declared matched key, not the concrete caller. In this example:

```text
raw caller:       /admin/projects/abc123
matched key:      /admin/projects/:id
selected hooks:   variants['/admin/projects/:id']
```

Express progressive configuration should also use the declared matched key:

```ts
update: {
  variants: {
    '/admin/projects/:id': { shape: adminShape },
  },
  progressive: {
    '/admin/projects/:id': {
      enabled: true,
      mode: 'autoInclude',
    },
  },
}
```

For backward compatibility, a concrete raw-caller progressive key may be used only when no declared-key entry exists. That fallback emits a deduplicated deprecation warning identifying the declared key to use. Declared-key configuration always takes precedence.

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

The client can include `include` or `select` in the request body. If the shape does not define projection, the client cannot request one. Non-returning batch methods (`createMany`, `updateMany`, `deleteMany`) do not support projection. When `writeStrategy = "forceReturn"`, the generated `createMany` and `updateMany` endpoints invoke returning methods and can use `select`, `include`, and `omit` like `createManyAndReturn` and `updateManyAndReturn`.

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

Generated caller routing preserves the same 400 messages for existing named `shape` maps. Missing, unknown, ambiguous, and reserved-key routing failures are stored during shape preparation, operation before-hooks run, and the failure is then surfaced before variant hooks and the handler.

The new `variants` descriptor is validated when the router is constructed. Invalid configuration such as an empty variants map, a missing entry shape, a reserved variant name, or defining both `shape` and `variants` throws immediately instead of registering the route.

All request errors return `{ "message": "..." }` in the response body.

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

Write operations that return records (`create`, `update`, `delete`, `upsert`, `createManyAndReturn`, `updateManyAndReturn`) support `select`, `include`, and `omit` in the request body to control the response shape. When `writeStrategy = "forceReturn"`, the generated `createMany` and `updateMany` endpoints are rewritten to returning methods and also support `select`, `include`, and `omit`.

For Express, mount `express.json()` before the router so request bodies are parsed. For Hono, malformed JSON bodies and non-object bodies are rejected with 400 (`{ "message": "Request body must be a JSON object" }`) before reaching the handler.

### Bulk operations

`createMany`, `createManyAndReturn`, `updateMany`, and `updateManyAndReturn` accept scalar-only data inputs. Nested relation writes are not supported in bulk operations.

By default, `createMany` and `updateMany` return `{ count }`, while `createManyAndReturn` and `updateManyAndReturn` return arrays of records. With `writeStrategy = "forceReturn"`, the generated `createMany` and `updateMany` endpoints return arrays of records because they invoke the returning Prisma methods internally.

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
| `orderBy` | `string \| object` | Deterministic default sort column |
| `allowedOrderBy` | `string[]` | Optional allowlist for client-provided `orderBy` query fields |
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

Clients may provide an `orderBy` query parameter. If `allowedOrderBy` is set, client-provided `orderBy` must be one of those fields. If `allowedOrderBy` is omitted, any valid SQL identifier is accepted and quoted.

When `skip > 0`, the view must define `orderBy` or receive a valid client `orderBy`. This prevents unstable offset pagination.

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

Only registered view names can be queried. Database identifiers such as `schema`, `relation`, `orderBy.field`, and `allowedOrderBy` entries must match this pattern:

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

Auto-include mode is generated relation loading. The router keeps the normal GET endpoint, runs the root query first, then loads supported included relations as separate follow-up queries. For single-record reads, relation paths are streamed as field patches. For `findMany` and `findManyPaginated`, root rows are streamed first, direct root relation stages are streamed as index-aligned relation batches, and deeper nested relation stages are streamed as locator-based nested relation batches. The terminal `result` event still contains the fully assembled payload.

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

Auto-include progressive SSE supports these Express GET read operations when no guard shape is attached:

- `findUnique`
- `findUniqueOrThrow`
- `findFirst`
- `findFirstOrThrow`
- `findMany`
- `findManyPaginated`

Unguarded `findMany` and `findManyPaginated` support deep relation loading by flattening parent rows at each relation path, with fallback cases listed in [Auto-include behavior and limits](#auto-include-behavior-and-limits).

When a prisma-guard shape is attached, auto-include supports these single-record read operations:

- `findUnique`
- `findUniqueOrThrow`
- `findFirst`
- `findFirstOrThrow`

Guarded `findMany` and `findManyPaginated` continue to use the configured fallback behavior. Normal guarded JSON reads are not affected.

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

Nested relation batch event for a depth-2-or-deeper relation in `findMany` / `findManyPaginated` auto-include:

```json
{
  "type": "nestedRelationBatch",
  "relationPath": "companies.users",
  "depth": 2,
  "attachments": [
    { "locator": [0, "companies", 0], "value": [{ "id": "user-1" }] }
  ]
}
```

Each `attachments[].locator` is walked from `rootArray.data` to the parent object. The leaf field to assign is the last segment of `relationPath`. For example, `relationPath: "companies.users"` and `locator: [0, "companies", 0]` means `rootArray.data[0].companies[0].users = value`.

Final result event:

```json
{ "type": "result", "data": { "id": "user-id", "profile": {}, "savedJobAds": [] } }
```

Error event:

```json
{ "type": "error", "message": "Could not load progressive response" }
```

For single-record progressive responses, the final `result.data` is the accumulated object built from all applied patches, unless a manual stage returns a stop result.

For `findMany` auto-include responses, `rootArray.data` is the source of truth for root row identity and order. Each depth-1 `relationBatch.values` array is index-aligned with `rootArray.data`, so `values[i]` belongs to `rootArray.data[i]`. Each depth-2-or-deeper `nestedRelationBatch.attachments` array carries locator/value pairs that can be applied to the accumulated root rows immediately. The terminal `result.data` is the fully merged array and can be used as a final reconcile.

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

For `findMany`, auto-include sends the root rows first, then sends one relation batch event for each supported direct root relation stage. Depth-2-or-deeper stages send `nestedRelationBatch` events with locators pointing to the parent object inside the accumulated root rows:

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

Deep `findMany` and `findManyPaginated` requests use the same planner. Nested stages are loaded by flattening the parent rows at each path, then emitted as locator-based attachment batches:

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
{
  "type": "nestedRelationBatch",
  "relationPath": "companies.users",
  "depth": 2,
  "attachments": [
    { "locator": [0, "companies", 0], "value": [{ "id": "user-1" }] }
  ]
}
```

```json
{
  "type": "nestedRelationBatch",
  "relationPath": "companies.users.profile",
  "depth": 3,
  "attachments": [
    { "locator": [0, "companies", 0, "users", 0], "value": { "id": "profile-1", "displayName": "Alice" } }
  ]
}
```

```json
{ "type": "result", "data": { "data": [{ "id": "org-1", "companies": [{ "id": "company-1", "users": [{ "id": "user-1", "profile": { "id": "profile-1", "displayName": "Alice" } }] }] }, { "id": "org-2", "companies": [] }], "total": 120, "hasMore": true } }
```



### Guarded auto-include mode

Auto-include also works with prisma-guard on supported single-record Express reads.

When a route operation has both `progressive: { mode: 'autoInclude' }` and a guard `shape`, the router resolves the shape through prisma-guard before planning the stream. The request should not send `select`, `include`, or `omit`; the guard shape's default read projection is used as the response contract.

```ts
import { force } from 'prisma-guard'

const userConfig = {
  guard: {
    variantHeader: 'x-api-variant',
  },

  findFirst: {
    shape: {
      me: (ctx) => ({
        where: {
          id: { equals: force(ctx.userId) },
        },
        select: {
          id: true,
          email: true,
          profile: {
            select: {
              id: true,
              displayName: true,
            },
          },
          companies: {
            where: {
              company: {
                is: {
                  deletedAt: { equals: null },
                },
              },
            },
            select: {
              company: {
                select: {
                  id: true,
                  name: true,
                },
              },
              role: {
                select: {
                  role: true,
                },
              },
            },
          },
        },
      }),
    },
    progressive: {
      me: {
        enabled: true,
        mode: 'autoInclude',
        fallback: 'error',
      },
    },
  },
}

app.use('/', UserRouter(userConfig))
```

Client request:

```http
GET /user/first
Accept: text/event-stream
x-api-variant: me
```

The guarded auto-include planner resolves the matched shape, applies the shape's default projection, strips direct relation branches from the root query, and loads those direct relations as follow-up guarded stage queries. The root query and every stage query execute through `prisma.model.guard(slicedShape, caller).method(args)`. Relation stages are never executed as raw Prisma delegate calls.

Direct relation stages stream as normal `field` events:

```json
{ "type": "field", "key": "id", "value": "user-id" }
```

```json
{ "type": "field", "key": "profile", "value": { "id": "profile-id", "displayName": "Alice" } }
```

```json
{ "type": "field", "key": "companies", "value": [{ "company": { "id": "company-id", "name": "Acme" }, "role": { "role": "admin" } }] }
```

The final `result` event contains the assembled object.

For guarded auto-include, `fallback: 'error'` is recommended during development so unsupported shapes are visible immediately. In production, `fallback: 'singleResult'` can be used to return one final SSE result through the normal guarded handler when the planner cannot split the shape.

### Auto-include behavior and limits

Auto-include is designed for supported Prisma `include` and relation `select` trees on reads.

When `findManyPaginatedMode = "transaction"`, the root `findMany` and the total count run inside one interactive transaction, so `data` and `total` are mutually consistent. Relation stages, however, load **after** the transaction commits and are not part of it — relation batches can reflect writes committed between the root transaction and the stage queries.

Supported unguarded root operations:

- `findUnique`
- `findUniqueOrThrow`
- `findFirst`
- `findFirstOrThrow`
- `findMany`
- `findManyPaginated`

Supported guarded root operations:

- `findUnique`
- `findUniqueOrThrow`
- `findFirst`
- `findFirstOrThrow`

Supported unguarded single-record relation shapes:

- direct to-one relation includes/selects
- direct to-many relation includes/selects
- to-many relation args such as `where`, `orderBy`, `take`, `skip`, `cursor`, and `distinct`
- nested relation loading through to-one parents

Unguarded single-record auto-include falls back when a nested stage crosses a to-many parent. Direct to-many loading is still supported, but nested loading under that array is not handled by the single-record progressive runtime.

Supported unguarded `findMany` and `findManyPaginated` relation shapes:

- direct and nested to-one relation includes/selects
- direct and nested to-many relation includes/selects
- relation-level `where` and `orderBy`
- single-column link fields only
- nested depth up to the configured planner limit

For unguarded `findMany` and `findManyPaginated`, each stage loads children with a batched query over the flattened parent rows at that stage's `parentPath`. Direct root stages stream `relationBatch` events. Depth-2-or-deeper stages stream `nestedRelationBatch` events with locator/value attachments, then also appear in the terminal `result` event.

`findMany` and `findManyPaginated` auto-include apply configured pagination limits to the root query before loading relation batches. If the client omits `take`, `pagination.defaultLimit` is applied when configured. If the client sends a large `take`, `pagination.maxLimit` is enforced before the root query runs.

Supported guarded single-record relation shapes:

- direct to-one relation `select` branches
- direct to-many relation `select` branches
- relation-level `where`, `orderBy`, `take`, `skip`, `cursor`, and `distinct` on direct to-many stages
- nested `select` trees inside a direct relation stage, loaded as part of that guarded stage query

Guarded auto-include plans from the guard shape's default projection. Client-provided `select`, `include`, or `omit` is rejected for guarded auto-include and follows the configured fallback behavior. Normal guarded JSON reads still support client projection validation according to prisma-guard rules.

Guarded auto-include falls back when a shape uses an unsupported streaming form, including:

- client-provided `select`, `include`, or `omit`
- shape-level `include` or `omit` in the auto-include plan
- `_count` anywhere in the planned projection
- implicit many-to-many relations
- composite relation link fields
- root relation filters in `where`, `orderBy`, or `cursor`
- relation references in a staged relation's `orderBy` or `cursor`
- link-field collisions in a staged relation `where`
- planner limits for maximum stage count
- guarded `findMany` or `findManyPaginated` auto-include

Unguarded auto-include falls back when a request uses an unsupported streaming form, including:

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

For SSE requests, routing and before-hooks run in the same order as JSON requests:

```text
operation before-hooks
variant before-hooks
progressive SSE middleware
```

If the progressive middleware starts or completes an SSE response, it does not continue to the normal generated handler. Consequently, variant after-hooks and operation after-hooks do not run for that request. They are not cleanup handlers.

Additional behavior:

- manual progressive stages receive `req.prisma` directly
- manual progressive stages do not automatically use guard shapes
- auto-include mode does not run when an operation has a guard shape; it falls back to single-result SSE or emits an SSE error depending on `fallback`
- variants without progressive config use the single-result SSE fallback through the normal generated core read handler, so guard shape behavior matches the JSON endpoint

Progressive lookup uses the declared matched variant key. A caller such as `/user/123` matched by `/user/:id` should configure `progressive['/user/:id']`. If only a legacy concrete raw-caller key exists, the router may use it as a compatibility fallback and emits a deduplicated deprecation warning.

Manual stage authors are responsible for using the resolved context and enforcing ownership or tenant constraints in their stage queries.

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

const lastSegment = (path: string) => {
  const parts = path.split('.')
  return parts[parts.length - 1] ?? path
}

const walk = (source: Array<Record<string, unknown>>, locator: Array<number | string>) => {
  let cursor: unknown = source[locator[0] as number]
  for (let i = 1; i < locator.length; i++) {
    if (cursor == null) return null
    cursor = (cursor as Record<string | number, unknown>)[locator[i]]
  }
  return cursor
}

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
      const field = lastSegment(event.relationPath)
      rows = rows.map((row, index) => ({
        ...row,
        [field]: event.values[index],
      }))
    }

    if (event.type === 'nestedRelationBatch') {
      const field = lastSegment(event.relationPath)
      for (const attachment of event.attachments) {
        const parent = walk(rows, attachment.locator)
        if (parent && typeof parent === 'object' && !Array.isArray(parent)) {
          const record = parent as Record<string, unknown>
          record[field] = attachment.value
        }
      }
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

For deep `findMany` / `findManyPaginated` auto-include, apply `nestedRelationBatch` events for progressive rendering and still treat the final `result` event as the authoritative nested payload for reconciliation. Direct root relation stages emit `relationBatch`; depth-2-or-deeper relation stages emit `nestedRelationBatch`.

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

## updateEach (Express, Fastify, Hono, internal batch)

`updateEach` applies many independent per-row updates in one request. Each item is passed to Prisma `update`.

```http
POST /{modelname}/each
```

Request body is a JSON array of Prisma `update` args. Each item should contain `{ where, data }`:

```json
[
  { "where": { "id": "a" }, "data": { "status": "done" } },
  { "where": { "id": "b" }, "data": { "status": "failed" } }
]
```

By default each row runs independently and the response is a per-row result array:

```json
[
  { "status": "ok", "data": { "id": "a", "status": "done" } },
  { "status": "error", "error": "Record not found" }
]
```

Send header `x-batch-atomic: true` to run all rows inside a single interactive transaction instead. In atomic mode any failing row rolls back the whole batch and the request errors; the endpoint requires a Prisma client with transaction support.

Batch size is capped to protect the database connection pool:

| Mode | Maximum items | Execution |
| ---- | ------------- | --------- |
| Non-atomic | 1000 | Bounded worker pool |
| Atomic | 100 | Sequential updates inside one transaction |

Requests above the limit return 400.

### Enabling

`updateEach` is **opt-in only** on Express, Fastify, and Hono. It is **not** enabled by `enableAll: true`. Add it explicitly:

```ts
app.use('/', UserRouter({
  updateEach: {
    before: [requireInternalAuth],
  },
}))
```

Only operation-wide `before` and `after` hooks are configurable. It has no `shape`, `variants`, pagination, or progressive config. In development, enabling `updateEach` without a `before` hook may print a warning because this route bypasses guard shapes and should be protected explicitly.

When enabled, `updateEach` is included in generated OpenAPI output as `POST /{modelname}/each`. It remains excluded from `enableAll: true`.

### Guard and security

`updateEach` does **not** apply prisma-guard shapes on any target, by design. It is intended as a trusted internal batch path, for example worker-to-backend bulk updates, not a public endpoint. Because it bypasses guard, it can write any field the underlying `update` allows.

Raw caller resolution still runs before hooks on all three targets, so a `before` hook can read the caller for its own authorization logic. No variant key is selected and no variant hook gate runs for `updateEach`. This is separate from guard shapes and does not enable guard enforcement.

Protect it yourself with route middleware (`before`) enforcing authentication or network-level restrictions. A guard `variantHeader` such as `x-api-variant` is **not** a security boundary — it only selects a caller value for hooks to read and is trivially spoofable. Do not expose `/each` to untrusted callers.

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

`findManyPaginated` returns `{ data, total, hasMore }`. Execution is controlled by the schema-wide `findManyPaginatedMode` generator option. The default is `"promiseAll"`, which runs `findMany` and `count` concurrently with `Promise.all`. This is faster but not atomic under concurrent writes. `"transaction"` runs both queries inside an interactive transaction and returns `500` if transaction support is missing.

The `hasMore` field is reliable for forward offset pagination (`skip` + positive `take`) only. When `take` is `0`, `hasMore` is `false`. When using cursor-based pagination or negative `take` (backward pagination), `hasMore` may be inaccurate.

When `distinct` is used with `findManyPaginated`, the total count is determined by executing a distinct query up to the configured limit (default: 100,000 rows). If the number of distinct values exceeds this limit, the total falls back to an approximate non-distinct count. When a guard shape is configured together with `distinct`, the total falls back to a guarded non-distinct count so the internal count query does not need to reuse the public read projection.

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

`pagination.defaultLimit` is applied when the client omits `take`. It is not applied when a guard shape controls pagination. `pagination.maxLimit` caps `take` by absolute value even when a guard shape is present. `pagination.distinctCountLimit` overrides the default 100,000 row threshold for distinct count estimation. All settings apply to `findMany` and `findManyPaginated`.

### Materialized count source

`findManyPaginated` can read `total` from a materialized view instead of calling Prisma `count`. This is useful for large static or periodically refreshed datasets where a precomputed count is cheaper than a live count.

Configure it globally for the router:

```ts
UserRouter({
  findManyPaginated: {},
  pagination: {
    countSource: {
      type: 'materializedView',
      schema: 'public',
      relation: 'mv_user_count',
      column: 'total',
    },
  },
})
```

Or override it per endpoint:

```ts
UserRouter({
  pagination: {
    defaultLimit: 20,
    maxLimit: 100,
  },
  findManyPaginated: {
    pagination: {
      countSource: {
        type: 'materializedView',
        schema: 'public',
        relation: 'mv_active_user_count',
        column: 'total',
      },
    },
  },
})
```

The materialized-view count source is used only when the request has no dynamic `where`, no `distinct`, and no guard shape. If any of those are present, the handler falls back to the normal delegate count so `total` stays consistent with the filtered data.

The materialized count query uses PostgreSQL-style `$N` placeholders and `LIMIT 1`, so it is intended for PostgreSQL and CockroachDB-style clients. The optional `countSource.where` supports flat equality and `null` only. Operators, arrays, and nested objects are rejected at router construction.

Example with a static filter on the count view:

```ts
UserRouter({
  findManyPaginated: {
    pagination: {
      countSource: {
        type: 'materializedView',
        relation: 'mv_user_count_by_status',
        column: 'total',
        where: { status: 'active' },
      },
    },
  },
})
```

## Error handling

All errors are returned as JSON with a `message` field:

```json
{ "message": "Unique constraint violation" }
```

Each generated router installs error handling (Express middleware, Fastify `setErrorHandler`, or Hono `app.onError`) that normalizes errors. Prisma error codes are mapped to appropriate HTTP status codes. Guard errors are mapped as follows: `ShapeError` and `CallerError` → 400, `PolicyError` → 403. In production, unmapped/internal 500-level errors return a generic `Internal server error` message. Client-error details such as validation or conflict messages may still be included.

For the Hono target, thrown `HTTPException` instances are caught by `app.onError` and converted to `{ "message": err.message }` with the exception's status code. Custom response bodies attached to `HTTPException` are not preserved — see [HTTPException normalization](#httpexception-normalization).

| Status | Description                                |
| ------ | ------------------------------------------ |
| 400    | Invalid parameters, body, or query         |
| 403    | Guard policy rejected                      |
| 404    | Record not found                           |
| 409    | Unique constraint or transaction conflict  |
| 500    | Internal server error, including transaction mode without transaction support |
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
  findMany: { before: [async (c) => { /* auth */ }] },
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

The `?ui=playground` endpoint requires `prisma-query-builder-ui`. For Express and Fastify, the builder is auto-started in development. For Hono, the router never starts the builder; start it manually in a separate process (see [Query Builder](#query-builder)).

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

The schema-wide `writeStrategy` option can change the behavior of `POST /{modelname}/many` and `PUT /{modelname}/many`. It does not change `DELETE /{modelname}/many`.

The schema-wide `findManyPaginatedMode` option changes the generated implementation behind `GET` and `POST /{modelname}/paginated`, but not the public response shape.

For the Express target, GET read endpoints can also stream SSE events when the request sends `Accept: text/event-stream`. SSE uses the same GET paths shown above; no additional routes are generated. See [Progressive Endpoint Composition](#progressive-endpoint-composition-express-sse).

## Skipping models

Add `/// generator off` to a model's documentation to skip generation. The marker must be on its own documentation line:

```prisma
/// generator off
model InternalLog {
  id Int @id
}
```

## Configuration

### Generator options

Generator options are configured in `schema.prisma` and apply schema-wide.

```prisma
generator express {
  provider              = "prisma-generator-express"
  target                = "express"
  writeStrategy         = "regular"
  findManyPaginatedMode = "promiseAll"
  dropGuard             = false
}
```

| Option | Values | Default | Description |
| ------ | ------ | ------- | ----------- |
| `target` | `"express"`, `"fastify"`, `"hono"` | `"express"` | Selects the generated router target. |
| `writeStrategy` | `"regular"`, `"throwOnNonReturning"`, `"forceReturn"` | `"regular"` | Controls only `createMany` and `updateMany`. See [Write strategy](#write-strategy). |
| `findManyPaginatedMode` | `"promiseAll"`, `"transaction"` | `"promiseAll"` | Controls whether generated `findManyPaginated` handlers run data and count with `Promise.all` or inside an interactive transaction. See [findManyPaginated execution mode](#findmanypaginated-execution-mode). |
| `dropGuard` | `true`, `false` | `false` | When `true`, generated routers never pass guard shapes to Prisma. Runtime `E2E=true` also disables guard in emitted routers, even when generator `dropGuard` is `false`. Route-level and operation-level `dropGuard` config fields do not exist. |

> Route-level and operation-level `dropGuard` config fields were removed because they were never read at runtime. Use generator `dropGuard = true` or `E2E === 'true'`.

### Express

```ts
type PaginationCountSource =
  | { type?: 'delegate' }
  | {
      type: 'materializedView'
      relation: string
      schema?: string
      column?: string
      where?: Record<string, unknown>
    }

interface PaginationConfig {
  defaultLimit?: number
  maxLimit?: number
  distinctCountLimit?: number
  countSource?: PaginationCountSource
}

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

  pagination?: PaginationConfig

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
  updateEach?: UpdateEachConfig
}

type ShapeOrFn<TShape, TCtx> = TShape | ((ctx: TCtx) => TShape)

type VariantEntry<TShape, TCtx, TBefore, TAfter = TBefore> = {
  shape: ShapeOrFn<TShape, TCtx>
  before?: TBefore[]
  after?: TAfter[]
}

type OperationConfig<
  TShape = Record<string, any>,
  TCtx = unknown,
> = {
  before?: RequestHandler[]
  after?: RequestHandler[]
  pagination?: Partial<PaginationConfig>
} & (
  | {
      shape?: ShapeOrFn<TShape, TCtx> | Record<string, ShapeOrFn<TShape, TCtx>>
      variants?: never
    }
  | {
      shape?: never
      variants: Record<
        string,
        VariantEntry<TShape, TCtx, RequestHandler>
      >
    }
)

type ReadOperationConfig<
  TCtx = unknown,
  TShape = Record<string, any>,
> = OperationConfig<TShape, TCtx> & {
  progressive?: Record<string, ProgressiveVariantConfig>
  progressiveStages?: Record<string, ProgressiveStage<TCtx>>
}

interface UpdateEachConfig {
  before?: RequestHandler[]
  after?: RequestHandler[]
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
type OperationConfig<TShape = Record<string, any>> = {
  before?: FastifyHookHandler[]
  after?: FastifyHookHandler[]
  pagination?: Partial<PaginationConfig>
} & (
  | { shape?: TShape | ((ctx: unknown) => TShape) | Record<string, TShape | ((ctx: unknown) => TShape)>; variants?: never }
  | { shape?: never; variants: Record<string, { shape: TShape | ((ctx: unknown) => TShape); before?: FastifyHookHandler[]; after?: FastifyHookHandler[] }> }
)

type FastifyHookHandler = (
  request: FastifyRequest,
  reply: FastifyReply,
) => Promise<void> | void
```

The `guard.resolveVariant` callback receives `FastifyRequest` instead of `Request`.

### Hono

The Hono config is identical except for hook and resolver types:

```ts
type OperationConfig<TShape = Record<string, any>> = {
  before?: HonoBeforeHook[]
  after?: HonoAfterHook[]
  pagination?: Partial<PaginationConfig>
} & (
  | { shape?: TShape | ((ctx: unknown) => TShape) | Record<string, TShape | ((ctx: unknown) => TShape)>; variants?: never }
  | { shape?: never; variants: Record<string, { shape: TShape | ((ctx: unknown) => TShape); before?: HonoBeforeHook[]; after?: HonoAfterHook[] }> }
)

type HonoBeforeHook<Env extends { Variables: any } = any> = (
  c: Context<Env>,
) => Promise<Response | void> | Response | void

type HonoAfterHook<Env extends { Variables: any } = any> = (
  c: Context<Env>,
) => Promise<Response | void> | Response | void
```

The `guard.resolveVariant` callback receives Hono's `Context`. Hono route hooks return `void` to continue, return a `Response` to short-circuit, or throw `HTTPException` to error. They do not receive `next`. Use normal Hono `app.use()` middleware outside the generated router when native middleware `next()` semantics are required.

The Hono router does not auto-start the Query Builder. Set `queryBuilder: false` to make the playground route return 404, or run `prisma-query-builder-ui` manually for development.

### Shared route options

These options are passed to the generated router at runtime. They are separate from schema-wide generator options such as `target`, `writeStrategy`, and `findManyPaginatedMode`.

`customUrlPrefix` is normalized to ensure a leading slash and strip trailing slashes.

`specBasePath` controls the base path used in OpenAPI spec paths and docs examples, independent of `customUrlPrefix`.

`disablePostReads` removes all POST read endpoints when set to `true`. POST read endpoints are enabled by default. This is a global setting — there is no per-operation toggle.

`resolveContext` is Express-only and is required for enabled progressive SSE variants. It is called before progressive stages run and its return value is passed to each stage as `ctx`.

`pagination` can be set at the router level and overridden per operation with `operation.pagination`. Endpoint-level pagination config is shallow-merged over router-level pagination config. `countSource` is only used by `findManyPaginated`.

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

## Global guard drop for E2E SQLite

Generated routers can globally skip Prisma guard in E2E mode.

This is used when the production Prisma schema and SQLite E2E schema intentionally differ. Example: production stores `normalized_skills` as `String[]`, while SQLite stores it as `Json?`. Guard shapes generated from the SQLite schema would reject scalar-list filters such as:

```ts
{
  normalized_skills: {
    hasSome: ['typescript', 'react']
  }
}
```

In E2E, the generated router should skip guard and let the E2E Prisma extension rewrite supported scalar-list filters before the SQL extension runs.

### Behavior

Generated routers use this effective guard-drop flag:

```ts
const DROP_GUARD = GENERATOR_DROP_GUARD || process.env.E2E === 'true'
```

When `DROP_GUARD` is true, the generated router calls Prisma directly instead of calling `delegate.guard(...)`. Before doing so, it still applies forced values and default projection behavior using vendored, dependency-free generated runtime helpers.

Caller routing is not dropped. Active and dropped modes use the same exact/default/parameterized resolver and the same declared matched key. Missing, unknown, ambiguous, and reserved-key routing failures return 400 after operation before-hooks in both modes.

Generated dropped/E2E router output has no runtime import from `prisma-guard`, the configured guard runtime import path, or a generated guard bridge. Type-only imports of generated guard shape declarations are allowed because they are erased at build time.

### Production safety

Production must keep:

```env
E2E=false
```

or leave `E2E` unset.

Do not set generator config `dropGuard = true` for normal production generation unless guard should be disabled everywhere.

Recommended setup:

```prisma
generator express {
  provider = "prisma-generator-express"
  target   = "express"
}
```

Then generated routers drop guard only when runtime env has:

```env
E2E=true
```

### E2E scalar-list support

E2E SQLite scalar-list support is intentionally narrow.

Supported:

```ts
{
  normalized_skills: {
    hasSome: ['typescript', 'react']
  }
}
```

The E2E Prisma extension pre-resolves matching row IDs using SQLite `json_each`, then rewrites the query to:

```ts
{
  id: {
    in: [...]
  }
}
```

This happens before the SQL extension compiles the Prisma query.

### Extension chain

E2E Prisma client chain:

```ts
basePrisma
  .$extends(normalizedSkillsExtension())
  .$extends(guardExtension)
  .$extends(e2eListOpsExtension())
  .$extends(speed)
```

Guard extension remains in the chain, but generated routers do not pass guard shapes when `E2E=true`.

### Supported E2E scalar-list scope

Supported:

```text
hasSome only
allowlisted JSON-backed scalar-list fields only
top-level where
AND / OR / NOT recursion
findMany / findFirst / count / aggregate / groupBy / updateMany / deleteMany
```

Out of scope:

```text
has
hasEvery
isEmpty
equals
nested relation where
include/select nested where
_count.where
findUnique
update
delete
upsert
null values inside hasSome input
```

Unsupported cases should fail loudly instead of being partially rewritten.

### Why not regenerate guard from SQLite schema

Do not depend on SQLite-generated guard output for this path.

The SQLite schema is a derived test schema. It may intentionally erase Postgres-only field information such as scalar-list types. Guard correctness belongs to the production schema, not the SQLite test schema.

Global E2E guard drop keeps this path simple:

```text
production keeps guard
E2E skips guard
E2E list-op extension handles hasSome
SQL extension receives normal id filters
```

### Required implementation notes

Generated router code computes:

```ts
const DROP_GUARD = GENERATOR_DROP_GUARD || process.env.E2E === 'true'
```

The router always resolves caller routing first. On a successful match:

- active mode stores the normalized guard shape for `delegate.guard(...)`
- dropped mode applies the same matched shape locally before operation before-hooks

On a routing failure, the router stores the failure, runs operation before-hooks, then returns HTTP 400 before variant hooks or the handler. This ordering is identical across Express, Fastify, and Hono.

The dropped runtime must remain self-contained. Generated code must not require `prisma-guard` to be installed or resolvable when `dropGuard=true` or `E2E=true`.

## Environment variables

| Variable          | Default | Description                         |
| ----------------- | ------- | ----------------------------------- |
| `DISABLE_OPENAPI` | `false` | Disable OpenAPI endpoints           |
| `NODE_ENV`        | -       | Set to `production` to disable docs |
| `DEBUG`           | `false` | Enable prisma-sql debug logging     |

## License

MIT
