# prisma-generator-express — Stack Demo

Full-featured B2B commerce API showing the stack around `prisma-generator-express`:

- **prisma-generator-express** — routers, OpenAPI, docs
- **prisma-guard** — `@scope-root` tenancy, guard variants, `enforceProjection`
- **prisma-sql** — SQL speed extension wired via `req.postgres`
- **prisma-query-builder-ui** — visual playground per model
- **Manual + auto-include progressive SSE** — streamed responses

## Compatibility

This demo targets Prisma 6.x. Do not upgrade to Prisma 7 without revalidating
`prisma-guard`, `prisma-sql`, and generator behavior against the newer client.

### writeStrategy=forceReturn

The generator config sets `writeStrategy = "forceReturn"`. Supported batch-write
endpoints return records instead of `{ count }`. Applicability depends on
provider and Prisma version:

- `POST /api/v1/product/many` (`createMany`) returns records on Postgres 6.x.
- `PUT /api/v1/product/many` (`updateMany`) returning records requires a Prisma
  version where `updateManyAndReturn` is supported. On unsupported versions the
  endpoint responds 501 at runtime.

### Package versions

`prisma-guard`, `prisma-query-builder-ui`, and `prisma-sql` are consumed via
`workspace:*`. Outside the monorepo, replace with exact versions verified
against Prisma 6.x.

## Quick start

```
cp .env.example .env
npm install
npm run db:up
npm run generate
npm run db:push
npm run db:seed
npm run dev
```

Server: http://localhost:3000
Docs:   http://localhost:3000/docs
Playground: http://localhost:3000/docs/product?ui=playground

## Auth

Send `x-auth-token`. Tokens are hardcoded in `src/context.ts`:

| Token          | Shop        | Role   |
| -------------- | ----------- | ------ |
| `owner-acme`   | shop-acme   | OWNER  |
| `admin-acme`   | shop-acme   | ADMIN  |
| `member-acme`  | shop-acme   | MEMBER |
| `owner-globex` | shop-globex | OWNER  |

Docs / OpenAPI / playground bypass auth.

## Variants

All guarded reads require `x-api-variant`. Available variants per model are
listed in that model's shape map. Common ones:

| Header value | Purpose                                     |
| ------------ | ------------------------------------------- |
| `owner`      | Full access shape                           |
| `admin`      | Restricted shape                            |
| `member`     | Self-only shape (User) or public (Product)  |
| `dashboard`  | Order.findMany manual progressive SSE       |
| `detail`     | OrderLine.findMany auto-include SSE         |
| `catalog`    | Product.findManyPaginated public catalog    |

## Progressive SSE

Two modes are demonstrated:

**Manual (`Order.findMany` dashboard variant)** — `src/models/order/stages.ts`
defines three stages that stream identity, line summary, and product info as
separate patches. Required because auto-include SSE cannot combine with guard
shapes.

**Auto-include (`OrderLine.findMany` detail variant)** — no shape on the
operation. Client sends `include`, generator streams relations.

Send both with `Accept: text/event-stream` and the matching `x-api-variant`.

## Playground and auth

Docs and playground routes bypass auth so they render without a token. The
embedded query builder UI may or may not forward `x-auth-token` on requests
it makes. If queries in the playground return 401, execute them via `curl`
instead. This depends on the `prisma-query-builder-ui` version.

## Other targets

Same schema generates Fastify and Hono routers by changing one config line:

```
generator generator_express {
  provider = "node ../generator"
  target   = "fastify"
}
```

See the main `prisma-generator-express` README for target-specific mounting.

## Layout

```
src/
  context.ts               ALS + fake-JWT middleware
  prisma.ts                extended client factory
  hooks.ts                 shared cross-model hooks
  models/
    shop/config.ts
    user/config.ts
    customer/config.ts
    product/
      config.ts
      decorators.ts        prefetch/attach demo
    order/
      config.ts
      stages.ts            manual progressive SSE stages
    orderLine/
      config.ts
      hooks.ts             enforceShopThroughOrder
  index.ts                 wiring + startup log
```