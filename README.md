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
npm install prisma-guard       # Guard shape enforcement
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

## Guard shapes (variant-based field access)

Guard shapes require the `prisma-guard` package for runtime enforcement.

### Setup
```bash
npm install prisma-guard
```

Extend your PrismaClient with the guard extension:
```ts
import { PrismaClient } from '@prisma/client'
import { guardExtension } from 'prisma-guard'

const prisma = new PrismaClient().$extends(guardExtension())
```

### Configuration
```ts
const userConfig = {
  findMany: {
    shape: {
      admin: { select: { id: true, email: true, role: true } },
      public: { select: { id: true, email: true } },
    },
  },
  guard: {
    variantHeader: 'x-api-variant',
  },
}

app.use('/', UserRouter(userConfig))
```

When a guard shape is configured on an operation, the variant is resolved from the configured header (default: `x-api-variant`) or a custom `resolveVariant` function. The resolved variant selects which shape config to apply. If prisma-guard is not installed or the client is not extended with the guard extension, requests to guarded routes return 500 with an actionable error message.

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