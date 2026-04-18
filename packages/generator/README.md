# Prisma Generator Express

[![npm version](https://badge.fury.io/js/prisma-generator-express.svg)](https://badge.fury.io/js/prisma-generator-express)
[![npm](https://img.shields.io/npm/dt/prisma-generator-express.svg)](https://www.npmjs.com/package/prisma-generator-express)
[![Coverage](https://img.shields.io/codecov/c/github/multipliedtwice/prisma-generator-express/main.svg)](https://codecov.io/gh/multipliedtwice/prisma-generator-express)
[![npm](https://img.shields.io/npm/l/prisma-generator-express.svg)](LICENSE)

Prisma generator that creates Express CRUD API routes with OpenAPI documentation from your Prisma schema.

Running `npx prisma generate` produces:

- Handler functions for all Prisma operations (findMany, create, update, delete, etc.)
- Router generator with middleware support (before/after hooks per operation)
- OpenAPI 3.1 spec (JSON and YAML endpoints registered automatically per router)
- Documentation helpers for contract view and Scalar UI (require manual mounting)
- Client-side query parameter encoder
- Guard/variant shape enforcement via prisma-guard integration

## Table of contents

- [Compatibility](#compatibility)
- [Installation](#installation)
- [Setup](#setup)
- [Usage](#usage)
- [Selective routes with middleware](#selective-routes-with-middleware)
- [Guard shapes (prisma-guard integration)](#guard-shapes-prisma-guard-integration)
- [Request body format](#request-body-format)
- [Query encoding (client side)](#query-encoding-client-side)
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

Peer dependencies:
```bash
npm install @prisma/client express
```

Optional peer dependencies:
```bash
npm install prisma-sql         # SQL optimization
npm install prisma-guard zod   # Guard shape enforcement
npm install prisma-query-builder-ui  # Visual query playground
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

The generator detects the Prisma client generator automatically. All standard provider values are supported: `prisma-client-js`, `@prisma/client`, and `prisma-client`.

Generate:
```bash
npx prisma generate
```

## Usage
```ts
import express from 'express'
import { PrismaClient } from '@prisma/client'
import { UserRouter } from './generated/User/UserRouter'

const prisma = new PrismaClient()
const app = express()

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

## Selective routes with middleware
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

Only operations listed in the config (or all when `enableAll: true`) are registered. Operations not listed produce no routes.

## Guard shapes (prisma-guard integration)

prisma-generator-express integrates with [prisma-guard](https://github.com/multipliedtwice/prisma-guard) to enforce input validation, query shape restrictions, and tenant isolation on generated routes. When a `shape` is configured on an operation, the handler calls `prisma.model.guard(shape, caller).method(args)` instead of `prisma.model.method(args)`.

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

Run `npx prisma generate` to emit both the express routes and the guard artifacts.

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

app.use((req, res, next) => {
  req.prisma = prisma
  next()
})

app.use('/', UserRouter({
  findMany: {
    shape: {
      where: { name: { contains: true } },
      take: { max: 50, default: 20 },
    },
  },
}))

app.listen(3000)
```

If prisma-guard is not installed or the client is not extended with the guard extension, requests to guarded routes return 500 with the message: `Guard shapes require prisma-guard extension on PrismaClient. Install: npm install prisma-guard, then extend your client with guardExtension().`

### How guard integration works

Each operation config accepts an optional `shape` property. When present, the generated handler:

1. Stores the shape on `res.locals.guardShape` via middleware
2. Resolves the caller from `config.guard.resolveVariant(req)`, then from the configured header (default `x-api-variant`), falling back to `undefined`
3. Calls `prisma.model.guard(shape, caller).method(args)` instead of `prisma.model.method(args)`

When `shape` is absent, the handler calls Prisma directly with no guard enforcement.

### Single shape per operation

A single shape object restricts what the client can do on that operation. No caller routing is needed.
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
  create: {
    shape: {
      data: { email: true, name: true, role: 'user' },
    },
  },
  update: {
    shape: {
      data: { name: true },
      where: { id: { equals: true } },
    },
  },
  delete: {
    shape: {
      where: { id: { equals: true } },
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
      data: {
        email: true,                          // client-controlled, @zod chains apply
        name: true,                           // client-controlled
        role: 'member',                       // forced to 'member', client cannot override
        isActive: force(true),                // forced to boolean true (force() needed to distinguish from client-controlled)
        bio: (base) => base.max(500),         // client-controlled with inline validation override
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

Use `resolveVariant` for caller logic beyond a simple header:
```ts
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
      where: {
        status: { equals: 'published' },         // always filter to published
        isDeleted: { equals: false },             // always exclude deleted
        isActive: { equals: force(true) },        // force() needed for boolean true
        title: { contains: true },                // client-controlled
      },
      take: { max: 50 },
    },
  },
}
```

A request with `{ where: { title: { contains: 'demo' } } }` produces:

```
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
}
```

The client can filter by `title` inside the relation, but `published = true` is always enforced.

### Select and include in shapes

Shapes can restrict which response fields and relations the client may request:
```ts
const userConfig = {
  findMany: {
    shape: {
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
}
```

### Mutation return projection

Write operations that return records (`create`, `update`, `upsert`, `delete`, `createManyAndReturn`, `updateManyAndReturn`) support `select` and `include` in the shape:
```ts
const userConfig = {
  create: {
    shape: {
      data: { email: true, name: true },
      include: {
        profile: true,
      },
    },
  },
  update: {
    shape: {
      data: { name: true },
      where: { id: { equals: true } },
      select: {
        id: true,
        name: true,
        updatedAt: true,
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
}
```

All three (`where`, `create`, `update`) are required. Using `data` instead of `create`/`update` is rejected.

### Bulk mutation safety

`updateMany`, `updateManyAndReturn`, and `deleteMany` require `where` in the shape:
```ts
const userConfig = {
  deleteMany: {
    shape: {
      where: { isActive: { equals: true }, role: { equals: true } },
    },
  },
  updateMany: {
    shape: {
      data: { isActive: true },
      where: { role: { equals: true } },
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
      where: { title: { contains: true } },
      take: { max: 50 },
    },
  },
  create: {
    shape: {
      data: { title: true },
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

Guard errors are mapped to HTTP status codes by the generated error-handling middleware:

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

Configure default and maximum page sizes:
```ts
UserRouter({
  findManyPaginated: {},
  pagination: {
    defaultLimit: 20,
    maxLimit: 100,
  },
})
```

`pagination.defaultLimit` is applied when the client omits `take`. `pagination.maxLimit` caps `take` by absolute value. Both settings apply to `findMany` and `findManyPaginated`.

## Error handling

All errors are returned as JSON with a `message` field:
```json
{ "message": "Unique constraint violation" }
```

Each generated router installs an error-handling middleware that normalizes errors. Prisma error codes are mapped to appropriate HTTP status codes. Guard errors are mapped as follows: `ShapeError` and `CallerError` → 400, `PolicyError` → 403.

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

| Endpoint                | Description           |
| ----------------------- | --------------------- |
| `/{model}/openapi.json` | OpenAPI 3.1 JSON spec |
| `/{model}/openapi.yaml` | OpenAPI 3.1 YAML spec |

Actual paths depend on `customUrlPrefix` and `addModelPrefix` configuration.

### Manual (generated helpers, require mounting)

The generator produces helper functions that you mount yourself. Pass the same config object used for the router to keep docs and runtime in sync:
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

| Endpoint                      | Description             |
| ----------------------------- | ----------------------- |
| `/docs`                       | Combined index page     |
| `/docs/{model}`               | Contract view (default) |
| `/docs/{model}?ui=scalar`     | Scalar interactive UI   |
| `/docs/{model}?ui=json`       | Raw JSON                |
| `/docs/{model}?ui=yaml`       | Raw YAML                |
| `/docs/{model}?ui=playground` | Query playground        |

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

When `prisma-sql` is installed, the generated handlers automatically attempt to use its `speedExtension` for optimized SQL execution. The extension activates only when a database connector is provided on the request object.

Set `req.postgres` or `req.sqlite` in your middleware to activate the extension:
```ts
import { PrismaClient } from '@prisma/client'
import postgres from 'postgres'

const prisma = new PrismaClient()
const sql = postgres(process.env.DATABASE_URL!)

app.use((req, res, next) => {
  req.prisma = prisma
  req.postgres = sql
  next()
})
```

Without a connector on the request, the handlers use the standard PrismaClient. Set `DEBUG=true` in the environment to enable prisma-sql debug logging.

## Query parameter parsing

GET query values are parsed server-side. Strings starting with `{`, `[`, or `"` are JSON-parsed. The strings `true`, `false`, `null` are converted to their JS equivalents. Numeric conversion only applies to `take` and `skip`. Use `encodeQueryParams` on the client side to avoid encoding issues.

## Router schema

| Operation           | Method | Path             |
| ------------------- | ------ | ---------------- |
| findMany            | GET    | `/`              |
| findFirst           | GET    | `/first`         |
| findFirstOrThrow    | GET    | `/first/strict`  |
| findUnique          | GET    | `/unique`        |
| findUniqueOrThrow   | GET    | `/unique/strict` |
| findManyPaginated   | GET    | `/paginated`     |
| count               | GET    | `/count`         |
| aggregate           | GET    | `/aggregate`     |
| groupBy             | GET    | `/groupby`       |
| create              | POST   | `/`              |
| createMany          | POST   | `/many`          |
| createManyAndReturn | POST   | `/many/return`   |
| update              | PUT    | `/`              |
| updateMany          | PUT    | `/many`          |
| updateManyAndReturn | PUT    | `/many/return`   |
| upsert              | PATCH  | `/`              |
| delete              | DELETE | `/`              |
| deleteMany          | DELETE | `/many`          |

Paths shown are relative suffixes. Actual paths include the model prefix (e.g., `/user/first`) unless `addModelPrefix: false`, and any `customUrlPrefix`.

## Skipping models

Add `/// generator off` to a model's documentation to skip generation:
```prisma
/// generator off
model InternalLog {
  id Int @id
}
```

## Configuration
```ts
interface RouteConfig {
  enableAll?: boolean
  addModelPrefix?: boolean           // default: true
  customUrlPrefix?: string
  specBasePath?: string
  disableOpenApi?: boolean
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

  queryBuilder?: QueryBuilderConfig | false

  pagination?: {
    defaultLimit?: number
    maxLimit?: number
  }

  // per-operation config
  findMany?: OperationConfig
  findUnique?: OperationConfig
  findUniqueOrThrow?: OperationConfig
  findFirst?: OperationConfig
  findFirstOrThrow?: OperationConfig
  findManyPaginated?: OperationConfig
  create?: OperationConfig
  createMany?: OperationConfig
  createManyAndReturn?: OperationConfig
  update?: OperationConfig
  updateMany?: OperationConfig
  updateManyAndReturn?: OperationConfig
  upsert?: OperationConfig
  delete?: OperationConfig
  deleteMany?: OperationConfig
  aggregate?: OperationConfig
  count?: OperationConfig
  groupBy?: OperationConfig
}

interface OperationConfig {
  before?: RequestHandler[]
  after?: RequestHandler[]
  shape?: Record<string, any>
}

interface QueryBuilderConfig {
  enabled?: boolean
  port?: number
  host?: string
  schemaPath?: string
  databaseUrl?: string
}
```

`customUrlPrefix` is normalized to ensure a leading slash and strip trailing slashes.

`specBasePath` controls the base path used in OpenAPI spec paths and docs examples, independent of `customUrlPrefix`.

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