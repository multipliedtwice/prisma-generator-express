---
layout: article
article_id: A9
permalink: /articles/error-reference/
---

Use this page when `prisma-generator-express` or `prisma-guard` rejects a configuration or request. Find the message, check when it appeared, then apply the listed fix.

Every guard message quoted here was produced by running the code against `prisma-guard` 1.33.0 / `zod` 4.4.3 / Prisma 6.19.3, not read from documentation. One exception, marked where it starts: **§6** (transport layer) comes from the `prisma-generator-express` README, because reproducing it needs a running router and a database.

Error text can change between versions. Search for the stable part of the message and use the failure phase to narrow the cause.

**This article covers what throws.** Its companion, [Silent semantics and testing traps](./A10-silent-behaviors.md), covers the behaviors that produce no message at all — forced values discarded silently, a disjunction flattened, a guard dropped under `E2E=true`. Several entries here point at it.

## Before anything else: which layer are you in?

Four different things can produce a 400, and they fail at different times. Knowing which one you are looking at removes most of the guesswork.

| Layer | When it fails | Typical message opener |
|---|---|---|
| Router construction | at `Router(config)` call, before any request | both `shape` and `variants` on one operation; empty `variants` map |
| Shape construction | first time that shape is built for a request | `Empty "AND" combinator in where shape for model "Plant"` |
| Caller routing | per request, before variant hooks | `Unknown caller: "..."` |
| Body validation | per request, in the guard | `Invalid query on model "Plant": ...` |

And three error classes, mapped to HTTP by the generated error handler:

| Class | `status` | `code` | Meaning |
|---|---|---|---|
| `ShapeError` | 400 | `SHAPE_INVALID` | the shape config is wrong, or the request does not fit it |
| `CallerError` | 400 | `CALLER_UNKNOWN` | variant routing failed |
| `PolicyError` | 403 | `POLICY_DENIED` | scope denied, missing tenant context, rejected `findUnique` |

All HTTP error bodies are `{ "message": "..." }`.

One more thing that changes the message text: **the entry point**. The same failure is worded differently depending on whether you called `guard.query(model, method, shapes).parse(body, { caller })` or `prisma.model.guard(shape, caller).findMany(args)`.

```text
guard.query(...).parse(...)     -> Provide caller via opts.caller.
prisma.plant.guard(...)         -> Provide caller via guard(input, caller).
```

If you are searching a codebase for a message you saw in production, search for the distinctive middle of the string, not the tail.

---

## 1. Caller routing (`CallerError`, 400)

### `Missing caller. This query uses named shape routing with keys: "storefront", "backoffice". Provide caller via opts.caller.`

**Cause.** The shape config is a named map and the request produced no caller. In a generated route that means: `resolveVariant` returned `undefined` *and* the variant header was absent, and the map has no `default` key.

**Fix, option A — add a fallback.** A `default` key catches missing, blank, and unmatched callers:

```ts
findMany: {
  shape: {
    storefront: { where: { name: { contains: true } }, take: { max: 20 } },
    backoffice: { where: { name: { contains: true }, isDeleted: { equals: true } }, take: { max: 100 } },
    default:    { where: { name: { contains: true } }, take: { max: 5 } },
  },
}
```

**Fix, option B — send one.** The header name defaults to `x-api-variant` and is configurable:

```ts
guard: { variantHeader: 'x-caller' }
```

**Rule.** A named shape map without `default` is a closed set. Every caller must be enumerated, or the request is a 400.

### `Unknown caller: "nope". Allowed: "storefront", "backoffice"`

**Cause.** A caller arrived and matched nothing. Blank and whitespace-only callers land here too — `"   "` produces exactly the same message with the whitespace preserved in the quotes.

**Not a fix:** adding the missing key on the client. The allowed list is the security boundary; if the client is asking for a variant that does not exist, either the frontend route changed and the backend did not, or someone is probing.

**Rule.** Read the allowed list in the message. It is the complete set of variants that operation exposes.

### `Unknown caller: "/shop/ferns/extra". Allowed: "/shop/:slug"`

**Cause.** Parameterized patterns match **one path segment per parameter**. `/shop/:slug` matches `/shop/ferns` and does not match `/shop/ferns/extra`.

**Fix.** Declare the deeper path as its own variant. Segment counts are part of the key.

```ts
variants: {
  '/shop/:slug':            { shape: shopShape },
  '/shop/:slug/reviews':    { shape: reviewsShape },
}
```

**Rule.** One variant key per distinct frontend path shape, including its depth.

### `Pass caller via opts.caller, not in the request body.`

(Extension wording: `Pass caller via the guard(input, caller) argument, not in the request body.`)

**Cause.** The request body contains a `caller` key. The guard refuses to look at it — a body-supplied caller would let a client pick its own variant.

**Fix.** Remove it from the body. If a page needs to declare which surface it is, that is the header or `resolveVariant`, never the payload.

**Rule.** The caller is transport metadata, not data.

### `Ambiguous caller "/shop/ferns" matches multiple patterns: "/shop/:slug", "/:section/ferns"`

**Cause.** Two parameterized patterns match the same concrete caller.

**Fix.** Make one of them exact, or rename so the patterns cannot overlap. Exact non-blank keys are checked before patterns, so an exact key is the cheapest disambiguation.

### `Caller key "where" collides with reserved shape config key. Rename the caller path.`

(Extension entry point: `Caller key "where" collides with reserved guard shape key. Rename the caller path.`)

**Note the class:** this one is a `ShapeError`, not a `CallerError`, even though it reads like a routing problem. It is in this section because of where it sends you looking, not because of its type.

**Cause.** This is usually not about callers at all. You passed a **single shape** where a **named map** was expected, so the guard read its top-level keys (`where`, `data`, `select`, …) as variant names. It also fires when a named map legitimately contains a reserved word as a variant name.

The most common way to trigger it: calling `guard.query()` with a mutation shape. `guard.query()` accepts read methods only — `findMany`, `findFirst`, `findFirstOrThrow`, `findUnique`, `findUniqueOrThrow`, `count`, `aggregate`, `groupBy`. Mutations run through the extension: `prisma.plant.guard(shape).create(args)`.

```ts
// wrong
guard.query('Plant', 'update', { data: { name: true }, where: { id: true } })

// right
prisma.plant.guard({ data: { name: true }, where: { id: true } }).update(body)
```

**Rule.** `guard.query()` is for reads. Everything else goes through the guarded delegate.

### `Unknown shape config key "name"`

**Cause.** Same mistake, seen from the other side: a `data` shape's *fields* were interpreted as top-level shape keys. You are one nesting level short.

```ts
// wrong
guard.query('Plant', 'create', { name: true, priceCents: true })

// right
prisma.plant.guard({ data: { name: true, priceCents: true } }).create(body)
```

---

## 2. Shape construction (`ShapeError`, 400)

These fire the first time the shape is built. A unit test that builds the shape catches all of them before deploy.

### `Empty "AND" combinator in where shape for model "Plant". Define at least one field.`

**Cause.** `where: { AND: {} }`. An empty combinator looks restrictive and contributes nothing.

**Rule.** A combinator with no fields is a config bug, not a no-op.

### `Empty select config on model "Plant". Define at least one field.`

**Cause.** `select: {}`. Same reasoning: an empty projection would silently mean "everything" or "nothing" depending on how you read it, so it is rejected.

### `orderBy config for "name" on model "Plant" must be true or a relation config object`

**Cause.** A shape config value that is not exactly `true`:

```ts
// wrong
orderBy: { name: false }
orderBy: { name: 'desc' }

// right
orderBy: { name: true }
orderBy: { nursery: { name: true } }
```

The same strictness applies to `cursor`, `having`, `_count` in object form, `_avg`, `_sum`, `_min`, `_max`, and `skip` (which must be exactly `true`). Writing `{ orderBy: { name: false } }` expecting "ordering disabled" would otherwise silently *enable* it.

**Rule.** In a shape, `true` is the only affirmative value. `false` is never "off" — it is either a forced literal (in `where`/`data`) or an error (in config keys).

### `Conflicting forced where values for "isPublished.equals": shape defines both true and false`

**Cause.** The same field and operator carry different forced values in two places in one shape — typically a top-level force plus a force inside a combinator.

```ts
// wrong
where: {
  isPublished: { equals: force(true) },
  AND: { isPublished: { equals: force(false) } },
}
```

**Why it is fatal rather than "last one wins".** Silent overwrite of a forced value is exactly how a security rule disappears.

### `Guard shape requires "where" for updateMany to prevent unconstrained bulk mutations`

The other two operations produce the same sentence with their own name: `Guard shape requires "where" for updateManyAndReturn to prevent unconstrained bulk mutations` and `Guard shape requires "where" for deleteMany to prevent unconstrained bulk mutations`.

**Cause.** `updateMany`, `updateManyAndReturn`, and `deleteMany` require a `where` in the *shape*.

```ts
// wrong
updateMany: { shape: { data: { isPublished: true } } }

// right
updateMany: { shape: { data: { isPublished: true }, where: { isDeleted: { equals: true } } } }
```

### `Guard shape "data" is not valid for upsert. Use "create" and "update" instead.`

**Cause.** Upsert shapes use three keys: `where`, `create`, `update`. All three are required.

```ts
upsert: {
  shape: {
    where:  { id: true },
    create: { name: true, priceCents: true, tags: true },
    update: { name: true },
  },
}
```

### `Required field "tags" on model "Plant" is missing from create data shape, has no default, is not a scope FK, and is not covered by a relation write in the shape`

**Cause.** A create shape must be able to produce a valid row. The check accounts for four sources of a value: the client (field listed in `data`), a schema `@default`, the scope extension (the tenant FK), or a relation write in the shape.

The message names four of the five escape hatches, which makes it nearly self-diagnosing. The fifth, documented in the guard README rather than the message: a `@zod .default(...)` or `@zod .catch(...)` directive on the field also satisfies the check, and is injected as a forced value.

If `tags` should never be client-supplied, force it: `tags: force([])`. If it comes from a relation, model it as a relation write.

**Watch the `hasDefault` trap.** A Prisma `@default` counts only if it reaches the generated type map. A scalar list written as `tags String[] @default([])` *does* register (`hasDefault: true`) — but if you check this against stale generated output you will conclude the opposite. Regenerate before drawing conclusions about why a completeness check fires.

**Rule.** A create shape is a completeness contract, not just an allowlist.

### `connect config on "Order.customer" must be an object of unique selectors`

**Cause.** `connect: true` is not a valid relation-write config. Name the unique selector fields:

```ts
// wrong
data: { status: true, customer: { connect: true } }

// right
data: { status: true, customer: { connect: { id: true } } }
```

### `findUnique on model "Plant" requires unique where shape to cover a unique constraint using Prisma unique selector syntax: id`

**Cause.** `findUnique` needs a `where` that covers a real unique constraint. `where: { name: true }` on a non-unique column cannot be a unique lookup. The message lists the constraints available on that model.

Note the shape syntax difference: unique `where` shapes use `{ id: true }`, not `{ id: { equals: true } }`.

### `groupBy shape must define "by"`

**Cause.** `by` is required in the shape, not just in the request.

```ts
groupBy: { shape: { by: ['isPublished'], _count: { _all: true } } }
```

---

## 3. Request validation on reads (`ShapeError`, 400)

All of these start with `Invalid query on model "X":` and end with a Zod-derived detail.

### `Invalid query on model "Plant": where: Unrecognized key(s): priceCents`

**Cause.** The client filtered on a field the shape does not expose. This is the single most common 400 in normal operation, and it is the system working.

**Fix.** If the filter is legitimate, add it to the shape — `priceCents: { gte: true, lte: true }`. If it is not, the client is asking for something it should not have.

**Rule.** The shape is an allowlist. A field's absence is a 400, never a silent drop.

### `Invalid query on model "Plant": select: Unrecognized key(s): priceCents`

**Cause.** Same rule applied to projection. The shape's `select` is the complete set of fields a client may ask for.

### `Invalid query on model "Plant": Unrecognized key(s): skip`

**Cause.** `skip` is a permission flag. It must be `skip: true` in the shape before a client may send it. `distinct` behaves the same way in practice — a client `distinct` against a shape that does not list it produces `Unrecognized key(s): distinct`.

### `Invalid query on model "Plant": take: Number must be <= 50`

**Cause.** `take: { max: 50 }` in the shape, `take: 5000` in the request.

### `Invalid query on model "Plant": take: Number must be >= 1`

**Cause.** Negative `take`. Prisma supports negative `take` for backward cursor pagination; the guard does not — `take` is restricted to positive integers. If you need reverse pagination, build it server-side in a context-dependent shape.

### `Invalid query on model "Plant": take: Expected number`

**Cause.** `take: "10"` — a string. This is the classic GET-versus-POST trap. Scalar coercion is uneven by design, and it is worth knowing exactly where it applies:

| Sent value | Field | Result |
|---|---|---|
| `"500"` | `where.priceCents.gte` (Int) | coerced to `500` |
| `"2026-01-01"` | `where.createdAt.gte` (DateTime) | coerced to an ISO datetime |
| `"true"` | `where.isPublished.equals` (Boolean) | **400** |
| `"10"` | `take` | **400** |
| `"abc"` | `where.priceCents.gte` (Int) | **400** |

**Fix.** Use the generated `encodeQueryParams` on the client for GET requests: complex values (`where`, `select`, `include`, `omit`, `orderBy`) are JSON-stringified so their inner types survive the round trip, and primitives go through as-is. Or use the POST read twin, where the body is native JSON and no coercion is attempted at all.

**Rule.** Never hand-assemble a query string for these endpoints.

### `Invalid query on model "Plant": where.isPublished: No matching variant (branch 1: [equals: Expected boolean] | branch 2: [Expected boolean])`

**Cause.** Zod union failure, most often a string where a scalar belongs. Read the branches as "the two shapes this value could have had": the operator-object form (`{ equals: true }`) and the shorthand form (`true`).

### `Invalid query on model "Plant": orderBy: No matching variant (branch 1: [Unrecognized key(s): priceCents] | branch 2: [Expected array])`

**Cause.** Ordering by a field the shape does not list. Branch 2 exists because `orderBy` may also be an array.

### `Invalid query on model "Plant": where.name: Unrecognized key(s): mode`

**Cause.** The shape wrote `mode` as a **forced literal**:

```ts
// wrong — mode is now server-owned, and the client's own mode is a 400
where: { name: { contains: true, mode: 'insensitive' } }

// right — client may send it
where: { name: { contains: true, mode: true } }
```

These are not equivalent, and the difference is easy to get backwards:

| Shape | Client sends | Emitted args |
|---|---|---|
| `mode: 'insensitive'` (forced) | nothing | `{"name":{"contains":"fern","mode":"insensitive"}}` |
| `mode: 'insensitive'` (forced) | `mode: "insensitive"` | **400** `where.name: Unrecognized key(s): mode` |
| `mode: true` (client-controlled) | nothing | `{"name":{"contains":"fern"}}` — **no case-insensitivity** |
| `mode: true` (client-controlled) | `mode: "insensitive"` | `{"name":{"contains":"fern","mode":"insensitive"}}` |

So forcing it guarantees case-insensitive matching and forbids the client from mentioning it; making it client-controlled means a client that forgets `mode` silently gets case-*sensitive* search. Pick deliberately: force it if case-insensitivity is part of the endpoint's contract, allow it if the client decides. If you force it, audit what your clients actually send — a client that includes `mode` gets a 400 rather than the behavior it asked for.

This is the strict half of the forced-value rule: `mode` is a forced key sharing an object with a client-controlled operator, so it is removed from the client-facing schema. That is *not* how a wholly-forced field like `isPublished: { equals: force(true) }` behaves — that one accepts client input and silently discards it, which is the [companion article's](./A10-silent-behaviors.md) first entry.

### `Request cannot define both "include" and "select"`

**Cause.** Mutually exclusive at the same level, in the request and in the shape. `omit` may be combined with `include`, but not with `select`. `omit` also requires Prisma 6.2.0+; on 6.0.x–6.1.x it is a 400.

### `Invalid query on model "Nursery": include.plants.take: Number must be <= 20`

**Cause.** Nested pagination limits apply to nested includes exactly as top-level ones do. A client cannot widen a nested `take`.

---

## 4. Request validation on writes (`ShapeError`, 400)

### `Invalid data for create on model "Plant": Unrecognized key(s): isPublished`

**Cause.** `isPublished` is **forced** in the data shape, and forced fields are removed from the client-facing schema. The client may not send them at all — not even the same value the server would have used.

This is worth internalizing, because the behavior is *not* symmetric with `where`: a wholly-forced top-level `where` predicate accepts the same field and discards it silently. That asymmetry, and the four positions it does not apply to, are covered in [When Prisma Returns 200 but the Result Is Wrong](./A10-silent-behaviors.md).

**Fix.** Delete the field from the client payload. If the client legitimately decides it, it is `true` in the shape, not forced.

### `Invalid data for create on model "Plant": Unrecognized key(s): nurseryId`

**Cause.** The client sent the tenant foreign key. Under `@scope-root`, the scope extension injects it — that is why the FK does not appear in the data shape, and why sending it is rejected.

**Rule.** Never send a scope FK from a client. It is server-owned by construction.

### `Invalid data for create on model "Plant": priceCents: No matching variant (branch 1: [Expected number] | branch 2: [Expected string])`

**Cause.** A required field is missing from the body. The union branches are the accepted forms for that field's type, so the same shape of message appears for a type mismatch.

### `Invalid data for create on model "Customer": email: Invalid email format`

**Cause.** A `@zod .email()` directive in the Prisma schema, enforced at the boundary. Business validation lives in three places, all opt-in: `@zod` in the schema, an inline refine in the shape (`description: (base) => base.max(20)`, which produces `Invalid data for create on model "Plant": description: String must contain at most 20 character(s)`), or `guard.input({ refine })`.

**Rule.** Defaults are permissive on scalars, strict on structure. If exact scalar rules matter, say so explicitly.

### `Invalid data for update on model "Plant": Unrecognized key(s): priceCents`

**Cause.** Update data shapes are allowlists too. A field that is writable on create is not writable on update unless you list it there.

### `Invalid unique "where" on model "Plant". Allowed fields: id: id: No matching variant (branch 1: [Expected string] | branch 2: [Expected number]); Unrecognized key(s): name`

**Cause.** Single-record `update`/`delete` use unique selector syntax. Filtering by a non-unique field there is not a narrower query, it is a different operation — use `updateMany`.

### `updateMany requires at least one where condition`

**Cause.** The *shape* has a `where`, but the resolved runtime `where` is empty. Distinct from the router-level check: the generated route rejects a body with no `where` key at all, and the guard rejects a `where` that resolves to nothing.

Note the interaction: if your shape forces a condition, `{ "where": {} }` in the body is fine — the forced condition satisfies the requirement. A `deleteMany` shape of `where: { isDeleted: { equals: force(true) } }` with body `{ "where": {} }` resolves to `{ where: { isDeleted: { equals: true } } }`.

### `Guard shape where contains only forced conditions. Client where input is not accepted.`

**Cause.** The same shape, but the client sent a *non-empty* `where`. When every condition in a `where` shape is forced, there is nothing left for the client to fill in, so any client `where` content is refused rather than ignored.

**Fix.** Send `{ "where": {} }`, or open one field for the client if it genuinely needs to narrow further.

### `Guard shape does not define "select" or "include" for create return projection`

**Cause.** The client asked for a projection on a mutation and the shape defines none. Mutation projection is opt-in: without `select`/`include` in the shape, the client cannot request one, and by default Prisma returns the full record when the client asks for nothing.

**Fix.** Add the projection to the shape, and consider `enforceProjection` in the guard generator config if mutations should always return a fixed shape rather than the whole row.

### `createMany` with a single object

**Cause.** In guarded mode, `createMany` and `createManyAndReturn` require `data` to be an array. A single object is not silently wrapped. `skipDuplicates` passes through without shape configuration.

---

## 5. Scope and policy (`PolicyError`, 403)

### `prisma-guard: Missing scope context for model "Plant": roots "Nursery" not provided. All scope roots must be present.`

**Cause.** The context function returned nothing for a scope root on a scoped model. Usually one of: the request never entered the `AsyncLocalStorage` scope, an unauthenticated request reached a scoped route, or the context function read a header that was absent.

**Behavior differs by operation and config.** With `onMissingScopeContext = "error"` (the recommended setting) both reads and writes throw. With `"warn"` or `"ignore"`, **reads proceed with partial scope** — writes still throw unconditionally. That asymmetry is deliberate and it is also a footgun: a permissive setting turns a missing-context bug into a cross-tenant read instead of a 403.

**Rule.** Keep `onMissingScopeContext = "error"` in production. Fail closed.

### `Context required for shape function`

**Cause.** A context-dependent shape `(ctx) => ({...})` was resolved without a context. Note this arrives as a `PolicyError` — 403, not 400 — which is correct: a scope-derived shape that cannot see its scope is an authorization failure.

**Pattern.** Make the shape refuse to build rather than silently widening:

```ts
const activeNurseryShape = (ctx: Ctx) => {
  if (!ctx.nurseryId) throw new Error('Missing nurseryId in guard context')
  return {
    where: { nurseryId: { equals: force(ctx.nurseryId) } },
    take: { max: 50, default: 20 },
  }
}
```

Dropping the scope filter when context is missing widens the result set to every tenant. Throwing is the only correct branch.

### `findUnique` rejected

**Cause.** `findUniqueMode = "reject"` (the default in a generated config) refuses `findUnique` on scoped models, because Prisma's extension mode cannot safely add a scope condition to a unique lookup. Use `findFirst` with a scoped `where`, or set `findUniqueMode = "verify"` and accept the extra read. (The `"verify"` path is documented in the guard README; unlike the rest of this section it was not exercised in the harness.)

---

## 6. Transport-level errors from the generated router

These come from the route layer, not the guard, and this whole section is sourced from the `prisma-generator-express` README rather than the harness — reproducing them needs a running router. Exact wording can also differ by target (Express, Fastify, Hono); where a string below is target-specific, it is labelled.

| Symptom | Status | Cause |
|---|---|---|
| non-object request body (on the Hono target: `Request body must be a JSON object`) | 400 | body was `null`, an array, or a primitive |
| body missing `where` on `deleteMany`/`updateMany`/`updateManyAndReturn` | 400 | route-level batch guard; `{ "where": {} }` is accepted, a missing key is not |
| record not found | 404 | |
| unique constraint / transaction conflict | 409 | |
| `Internal server error` | 500 | unmapped error; details are suppressed in production |
| operation unsupported | 501 | e.g. `createManyAndReturn` on MySQL or SQL Server |
| connection pool timeout | 503 | |
| `Guard shapes require prisma-guard extension on PrismaClient. Install: npm install prisma-guard, then extend your client with guardExtension().` | 500 | the router has shapes but the client was never extended |

**404 on an endpoint you expected to exist.** Only operations listed in the config are registered — or all of them with `enableAll: true`. Check three things in order: the operation is in the config; `addModelPrefix` and `customUrlPrefix` are what you think; and for `POST /model/read`, that `disablePostReads` is not set. Remember `findMany` is the one read whose POST twin has a different path (`/read`), because `POST /model` is create.

**Router construction throws at boot.** Defining both `shape` and `variants` on one operation, an empty `variants` map, a variant entry without a shape, or a reserved key as a variant name all throw when the router is built, not when a request arrives. That is intentional: a misconfigured router should never start.

---

## Rules

1. Read the message opener first — it tells you whether you are in routing, shape construction, or body validation.
2. `ShapeError` and `CallerError` are 400; `PolicyError` is 403; every error body is `{ "message": "..." }`.
3. The same failure is worded differently per entry point — search the middle of a message, never the tail.
4. `guard.query()` handles reads only; mutations go through `prisma.model.guard(shape).method(args)`.
5. A named shape map without `default` rejects every unmatched caller with 400, and a caller is never read from the request body.
6. In shape config keys, `true` is the only affirmative value; `false` is an error, not "off".
7. A field absent from a shape is a 400, never a silent drop — on `where`, `select`, `orderBy`, and `data` alike.
8. `skip` and `distinct` are permission flags: absent from the shape means a client that sends them gets `Unrecognized key(s)`.
9. Forced values in a modifier, a relation filter, a nested `include`'s `where`, or a `data` shape are removed from the client-facing schema — sending them is a 400. A wholly-forced top-level `where` predicate is the exception and does not throw; see the companion article.
10. Never send a scope FK from a client; the scope extension injects it.
11. Keep `onMissingScopeContext = "error"` — a permissive setting turns a missing context into a cross-tenant read rather than a 403.
12. A context-dependent shape must throw when its context is missing, never drop the filter.
13. Use `encodeQueryParams` or the POST read twin; coercion is uneven and hand-built query strings hit it.
14. Bulk operations need `where` in the shape *and* a `where` that resolves to something at runtime.
15. A create shape must be complete: client field, schema default, scope FK, relation write, or a `@zod .default(...)` / `.catch(...)`.

---

## Appendix: reproducing any of this in 30 lines

Every guard message quoted above came out of this harness — §6's transport-layer table is the exception, and needs a running router. The harness needs no database and no HTTP server, and it is the same one behind the [companion article](./A10-silent-behaviors.md).

### The schema every example uses

This is the nursery half of `lab/prisma/schema.prisma`, verbatim. The same file also holds the ticketing models used by the `force()` article; nothing here references them.

```prisma
/// @scope-root
model Nursery {
  id     String  @id @default(cuid())
  name   String
  plants Plant[]
  orders Order[]
}

model Plant {
  id          String   @id @default(cuid())
  name        String
  /// @zod .max(2000)
  description String?
  priceCents  Int
  isPublished Boolean  @default(false)
  isDeleted   Boolean  @default(false)
  tags        String[]
  createdAt   DateTime @default(now())
  nurseryId   String
  nursery     Nursery  @relation(fields: [nurseryId], references: [id])
  orderItems  OrderItem[]
}

model Customer {
  id     String  @id @default(cuid())
  /// @zod .email()
  email  String  @unique
  name   String?
  orders Order[]
}

model Order {
  id         String      @id @default(cuid())
  status     String      @default("draft")
  total      Int         @default(0)
  createdAt  DateTime    @default(now())
  nurseryId  String
  nursery    Nursery     @relation(fields: [nurseryId], references: [id])
  customerId String
  customer   Customer    @relation(fields: [customerId], references: [id])
  items      OrderItem[]
}

model OrderItem {
  id       String @id @default(cuid())
  quantity Int
  orderId  String
  order    Order  @relation(fields: [orderId], references: [id])
  plantId  String
  plant    Plant  @relation(fields: [plantId], references: [id])
}
```

```ts
import { force } from 'prisma-guard'
import { guard } from './generated/guard/client'

const shape = {
  where: { isPublished: { equals: force(true) }, name: { contains: true } },
  take: { max: 50, default: 20 },
}

try {
  const args = guard.query('Plant', 'findMany', shape).parse({ where: { name: { contains: 'fern' } } })
  console.log(JSON.stringify(args))
} catch (err: any) {
  console.log(err.constructor.name, err.status, err.message)
}
```

For mutations and for scope behavior, go through the extension instead. A fake delegate that returns its own arguments is enough to see exactly what would have reached the database:

```ts
const ext = guard.extension(() => ({ Nursery: 'nursery-1' }))
const fake = { create: async (args: unknown) => args, findMany: async (args: unknown) => args }

const guarded = (ext.model as any).plant.guard.call({ $parent: { plant: fake } }, {
  data: { name: true, priceCents: true, tags: true, isPublished: force(false) },
})

console.log(await guarded.create({ data: { name: 'Fern', priceCents: 900, tags: [] } }))
// { data: { name: 'Fern', priceCents: 900, tags: [], isPublished: false } }
```

And to watch scope injection alone, call the extension's operation interceptor directly:

```ts
await (ext.query as any).$allOperations({
  model: 'Plant',
  operation: 'findMany',
  args: { where: { isPublished: true } },
  query: async (a: unknown) => a,
})
// { where: { AND: [ { isPublished: true }, { nurseryId: 'nursery-1' } ] } }
```

Three primitives — `parse`, a fake delegate, `$allOperations` — cover every guard error in this article (§1–§5; not the transport table in §6). Put them in a spec file and your access rules become assertions on the arguments that would have reached the database — the layer where the shape actually does its work, checked without standing anything up.
