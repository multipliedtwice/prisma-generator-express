<p align="center">
  <img src="https://raw.githubusercontent.com/multipliedtwice/prisma-generator-express/master/docs/assets/favicon.svg" width="88" height="88" alt="Prisma Generator Express logo">
</p>

<h1 align="center">Prisma Generator Express</h1>

<p align="center"><strong>Ship Prisma APIs faster by generating Express, Fastify, or Hono CRUD routes, OpenAPI, pagination, hooks, guard enforcement, and guarded MCP tools directly from your schema.</strong></p>

<p align="center">
  <a href="https://www.npmjs.com/package/prisma-generator-express"><img src="https://badge.fury.io/js/prisma-generator-express.svg" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/prisma-generator-express"><img src="https://img.shields.io/npm/dt/prisma-generator-express.svg" alt="npm downloads"></a>
  <a href="https://codecov.io/gh/multipliedtwice/prisma-generator-express"><img src="https://img.shields.io/codecov/c/github/multipliedtwice/prisma-generator-express/master.svg" alt="Coverage"></a>
  <a href="https://github.com/multipliedtwice/prisma-generator-express/blob/master/LICENSE"><img src="https://img.shields.io/npm/l/prisma-generator-express.svg" alt="License"></a>
</p>

<p align="center">
  <a href="https://multipliedtwice.github.io/prisma-generator-express/">Field Guide</a> ·
  <a href="https://multipliedtwice.github.io/prisma-generator-express/guide/">Full reference</a> ·
  <a href="https://www.npmjs.com/package/prisma-generator-express">npm</a>
</p>

## Quickstart

```bash
npm install -D prisma-generator-express prisma
npm install @prisma/client express
```

```prisma
// schema.prisma — project root
datasource db {
  provider = "sqlite"
  url      = "file:./dev.db"
}

generator client {
  provider = "prisma-client-js"
}

generator express {
  provider = "prisma-generator-express"
  output   = "./generated/express"
}

model User {
  id    Int    @id @default(autoincrement())
  email String @unique
  name  String
}
```

> On Prisma 7 the datasource `url` moves to `prisma.config.ts` — see the
> [compatibility section](https://multipliedtwice.github.io/prisma-generator-express/guide/#compatibility).

```bash
npx prisma generate
```

Mount the generated router:

```ts
import express from 'express'
import { PrismaClient } from '@prisma/client'
import { UserRouter } from './generated/express/User/UserRouter'

const prisma = new PrismaClient()
const app = express()

app.use(express.json())

app.use((req, res, next) => {
  req.prisma = prisma
  next()
})

app.use('/', UserRouter({ enableAll: true }))

app.listen(3000)
```

That is a full CRUD API with OpenAPI docs at `/user/openapi.json`.

> `enableAll: true` exposes every operation of the model. For anything beyond internal tools, restrict operations and add guard shapes — see [guard integration](https://multipliedtwice.github.io/prisma-generator-express/guide/#guard-shapes-prisma-guard-integration).

## What you get

- Handler functions for all Prisma operations (`findMany`, `create`, `update`, `delete`, aggregates and more) — [request body format](https://multipliedtwice.github.io/prisma-generator-express/guide/#request-body-format)
- **Express, Fastify, and Hono** targets via the `target` generator option — [Express](https://multipliedtwice.github.io/prisma-generator-express/guide/#usage-express) / [Fastify](https://multipliedtwice.github.io/prisma-generator-express/guide/#usage-fastify) / [Hono](https://multipliedtwice.github.io/prisma-generator-express/guide/#usage-hono)
- OpenAPI 3.1 spec (JSON + YAML) registered automatically per router — [documentation endpoints](https://multipliedtwice.github.io/prisma-generator-express/guide/#documentation-endpoints)
- Router generator with operation-wide and per-variant before/after hooks — [selective routes](https://multipliedtwice.github.io/prisma-generator-express/guide/#selective-routes-with-middleware)
- Schema-level `findManyPaginated` execution mode (`Promise.all` or interactive transaction) — [execution mode](https://multipliedtwice.github.io/prisma-generator-express/guide/#findmanypaginated-execution-mode)
- Per-route and per-endpoint pagination config, including materialized-view count sources — [pagination](https://multipliedtwice.github.io/prisma-generator-express/guide/#pagination)
- POST read endpoints for complex queries exceeding URL length limits — [POST reads](https://multipliedtwice.github.io/prisma-generator-express/guide/#post-read-endpoints)
- Guard/variant shape enforcement with tenant isolation via [prisma-guard](https://github.com/multipliedtwice/prisma-guard) — [guard shapes](https://multipliedtwice.github.io/prisma-generator-express/guide/#guard-shapes-prisma-guard-integration)
- Opt-in MCP transport (`mcp = true`): one Streamable HTTP `/mcp` endpoint in the same process, explicit per-model allowlist, verified-principal authorization, SDK v2. Read and write actions are exposed only when allowlisted; all nine guarded write actions (create, createMany, createManyAndReturn, update, updateMany, updateManyAndReturn, upsert, delete, deleteMany) are per-operation opt-in and never implied by `enableAll`. MCP represents each action as a tool — [MCP guide](https://multipliedtwice.github.io/prisma-generator-express/guide/#mcp-model-context-protocol)
- Express-only progressive read streaming over SSE (manual stages or auto-include splitting) — [progressive composition](https://multipliedtwice.github.io/prisma-generator-express/guide/#progressive-endpoint-composition-express-sse)
- Express-only read-only materialized view router — [materialized views](https://multipliedtwice.github.io/prisma-generator-express/guide/#materialized-views-router-express)
- Client-side query parameter encoder — [query encoding](https://multipliedtwice.github.io/prisma-generator-express/guide/#query-encoding-client-side)
- SQL optimization via optional [prisma-sql](https://multipliedtwice.github.io/prisma-generator-express/guide/#prisma-sql-integration) integration

## Compatibility

| Framework | Target value | Generated output |
| --------- | ------------ | ---------------- |
| Express   | `"express"` (default) | `express.Router()` factory per model |
| Fastify   | `"fastify"`  | Fastify plugin function per model |
| Hono      | `"hono"`     | `Hono` instance factory per model |

Minimum supported Prisma version: **6.0.0** (CI generates and strict-typechecks emitted output against the latest 6.x and 7.x lines). Some operations require newer versions or specific database providers — see the [compatibility section](https://multipliedtwice.github.io/prisma-generator-express/guide/#compatibility) for the exact matrix.

Progressive SSE streaming and the materialized views router are Express-only today.

## Documentation

The full reference lives in the [GitHub Pages guide](https://multipliedtwice.github.io/prisma-generator-express/guide/):

- [Guard shapes and variants](https://multipliedtwice.github.io/prisma-generator-express/guide/#guard-shapes-prisma-guard-integration) — whitelists, forced values, caller routing, tenant isolation
- [Configuration](https://multipliedtwice.github.io/prisma-generator-express/guide/#configuration) — every route-config option
- [Environment variables](https://multipliedtwice.github.io/prisma-generator-express/guide/#environment-variables)
- [Pagination](https://multipliedtwice.github.io/prisma-generator-express/guide/#pagination), [error handling](https://multipliedtwice.github.io/prisma-generator-express/guide/#error-handling), [security notes](https://multipliedtwice.github.io/prisma-generator-express/guide/#security)
- [updateEach batch route](https://multipliedtwice.github.io/prisma-generator-express/guide/#updateeach-express-fastify-hono-internal-batch)
- [MCP tools](https://multipliedtwice.github.io/prisma-generator-express/guide/#mcp-model-context-protocol) — enable, allowlist, auth, limits, opt-in writes, fail-closed rules

### MCP quickstart

This example is executed as a test against generated output
(`packages/generator/test/unit/mcp/readmeQuickstart.test.ts`) — real Postgres, real prisma-guard, real auth. It is the actual shape, not pseudocode.

```prisma
// schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

generator guard {
  provider = "prisma-guard"
  output   = "./generated/guard"
}

generator api {
  provider = "prisma-generator-express"
  output   = "./generated/api"
  target   = "express"
  mcp      = true
}

model User {
  id     String @id @default(cuid())
  email  String @unique
  siteId String
  posts  Post[]
}

model Post {
  id       String @id @default(cuid())
  title    String
  author   User   @relation(fields: [authorId], references: [id])
  authorId String
}
```

```bash
# install dependencies FIRST — prisma generate needs prisma-guard resolvable.
# The quickstart is verified against Prisma 6 (Prisma 7 moves the datasource
# URL into prisma.config.ts — see compatibility below).
npm install @prisma/client@6 prisma-guard@^1.33.0 zod
npm install -D prisma@6 tsx
# SDK v2 — the only MCP packages the generated output imports,
# plus the express adapter for requireBearerAuth below:
npm install @modelcontextprotocol/server @modelcontextprotocol/node @modelcontextprotocol/express

# one-off Postgres (or point DATABASE_URL at your existing instance):
docker run -d --name my-pg -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16-alpine

export DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/postgres"

npx prisma generate
npx prisma db push
```

```ts
// server.ts
import express from 'express'
import {
  McpServer,
  createMcpHandler,
  type AuthInfo,
} from '@modelcontextprotocol/server'
import { requireBearerAuth } from '@modelcontextprotocol/express'
import { toNodeHandler } from '@modelcontextprotocol/node'
import { force } from 'prisma-guard'
import { PrismaClient } from '@prisma/client'
import { guard } from './generated/guard/client'
import {
  userFindManyTool,
  userCreateTool,
  userUpdateTool,
} from './generated/api/User/UserMcp'
import { registerMcpToolsOnServer } from './generated/api/mcp'

// guarded client: guard(shape, caller) is what the tools execute through
const prisma = new PrismaClient().$extends(guard.extension())

// a real route config: guard shapes with a FORCED tenant value + bounded take
// (MCP schemas assume prisma-guard >= 1.33 semantics). Write actions are
// per-operation opt-in: nothing writes until you import its factory and
// place it in `tools`. `enableAll` never exposes writes.
const userConfig = {
  findMany: {
    shape: {
      where: { siteId: { equals: force('tenant-a') } },
      take: { max: 50 },
    },
  },
  create: {
    // siteId is server-owned: agents cannot choose the tenant
    shape: { data: { email: true, siteId: force('tenant-a') } },
  },
  update: {
    // select by id AND the forced tenant: another tenant's row is a 404
    shape: {
      where: { id: true, siteId: force('tenant-a') },
      data: { email: true },
    },
  },
}

const MCP_TOKEN = process.env.MCP_TOKEN // your issuer's token

const buildServer = (authInfo: AuthInfo): McpServer => {
  const server = new McpServer({ name: 'my-api', version: '1.0.0' })
  registerMcpToolsOnServer(server, {
    tools: [
      userFindManyTool({ config: userConfig }),
      userCreateTool({ config: userConfig }),
      userUpdateTool({ config: userConfig }),
    ],
    resolveCaller: (info) => info.clientId, // routing key only
    authorize: ({ principal }) => {
      if (!principal) throw new Error('unauthenticated')
    },
    defaultLimit: 20,
    maxLimit: 100,
    maxResultBytes: 262_144,
    prisma,
    authInfo, // verified principal — required, fail closed without it
  })
  return server
}

const app = express()
app.use(express.json())

// verified authentication is yours; without a verified token nothing is served
const auth = requireBearerAuth({
  verifier: {
    async verifyAccessToken(token) {
      if (token !== MCP_TOKEN) throw new Error('invalid token')
      return {
        token,
        clientId: 'tenant-a',
        scopes: ['mcp'],
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
      }
    },
  },
})

const mcpHandler = createMcpHandler((ctx) => buildServer(ctx.authInfo as AuthInfo))
app.all('/mcp', auth, (req, res) => {
  const node = toNodeHandler(mcpHandler)
  node(req, res, req.body)
})

app.listen(3000)
```

```bash
MCP_TOKEN=dev-token DATABASE_URL="$DATABASE_URL" npx tsx server.ts
```

Maintainer-facing design notes: [`ARCHITECTURE.md`](https://github.com/multipliedtwice/prisma-generator-express/blob/master/ARCHITECTURE.md).

## License

MIT
