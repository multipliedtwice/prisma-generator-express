# Demo shop platform

Published source reference for `prisma-generator-express`: Express 5, Prisma 6, PostgreSQL Docker Compose, and Yarn 3 workspaces.

## What to inspect

- [Schema](https://github.com/multipliedtwice/prisma-generator-express/blob/master/packages/demo/prisma/schema.prisma) — Prisma Client, `prisma-guard`, and `prisma-generator-express` configuration; the guard uses a `@scope-root` tenant model and projection enforcement.
- [Prisma factory](https://github.com/multipliedtwice/prisma-generator-express/blob/master/packages/demo/src/prisma.ts) — guard-extended Prisma Client with request context.
- [Application wiring](https://github.com/multipliedtwice/prisma-generator-express/blob/master/packages/demo/src/index.ts) — generated routers, model and combined OpenAPI documentation, and the optional `postgres` connector used by `prisma-sql`.
- [Request context](https://github.com/multipliedtwice/prisma-generator-express/blob/master/packages/demo/src/context.ts) and [model configuration](https://github.com/multipliedtwice/prisma-generator-express/tree/master/packages/demo/src/models) — tenant and route behavior.
- [`prisma/generated/`](https://github.com/multipliedtwice/prisma-generator-express/tree/master/packages/demo/prisma/generated) — committed generator output for inspection before regeneration.

The Product configuration enables the query builder; the application exposes its playground through the generated documentation.

## Getting started

Follow the maintained [root quickstart](https://github.com/multipliedtwice/prisma-generator-express#quickstart) for installation and generation guidance. This demo document is a source map, not a tested startup guide.
