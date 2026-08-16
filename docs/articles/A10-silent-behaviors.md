---
layout: article
article_id: A10
permalink: /articles/silent-behaviors/
---

Companion to [the error reference]({{ '/articles/error-reference/' | relative_url }}), which is a lookup for messages that throw. This one collects the opposite: behaviors that produce no message at the point where you would look for one.

They are not all the same failure. Three kinds are mixed here deliberately, because they are found the same way — by reading emitted arguments rather than status codes:

- **A request succeeds and the arguments are not what the shape's author intended.** Forced values discarded silently, a disjunction flattened to a conjunction, a projection applied at a different time than expected.
- **A behavior is correct and load-bearing, and surprises people who did not know it was there.** Read projection defaults, mutation projection *not* defaulting, a materialized count quietly stepping aside — that last one keeps the answer right and changes what it costs.
- **A test passes and production does not.** The guard is dropped under `E2E=true`, so a shape that 400s for a real client is green in the harness.

The unifying property is not the status code. It is that the response alone does not tell you which of these you are looking at.

Versions: `prisma-guard` 1.33.0, `zod` 4.4.3, Prisma 6.19.3. Examples use the Nursery/Plant subset of [A9's schema]({{ '/articles/error-reference/' | relative_url }}#the-schema-every-example-uses) — the same models, minus the ones no example here touches:

```prisma
/// @scope-root
model Nursery {
  id     String  @id @default(cuid())
  name   String
  plants Plant[]
}

model Plant {
  id          String   @id @default(cuid())
  name        String
  description String?
  priceCents  Int
  isPublished Boolean  @default(false)
  isDeleted   Boolean  @default(false)
  nurseryId   String
  nursery     Nursery  @relation(fields: [nurseryId], references: [id])
}
```

**Where each claim comes from.** This article mixes harness output with documented behavior more than A9 does, so each section says which:

| Section | Evidence |
|---|---|
| forced-value positions, combinator lifting | run in `article-labs/guard/`; emitted arguments, both guard entry points |
| read projection auto-apply | run in `article-labs/guard/`; the `parse()`-versus-delegate difference is observed |
| mutation projection | run in `article-labs/guard/` for the *arguments* — no `select` is emitted. That this returns the full record is Prisma's behavior for a query with no projection, and the `enforceProjection` switch is documented in the `prisma-guard` README |
| nested reads, scope roots, raw SQL | `prisma-guard` README |
| pagination, materialized count | `prisma-generator-express` README |
| `DROP_GUARD` / `E2E=true` | `prisma-generator-express` README |

One limit worth stating plainly: the lab has no database and no HTTP server, so it proves which arguments would have reached Prisma. It does not prove which rows come back or what status a real request returns. Every claim below about *rows* or *status* is README-sourced, not harness-sourced.

---

## A forced value sometimes rejects the client that sends it, and sometimes silently discards it

The most surprising behavior in the stack, and the one people generalize wrongly. There is exactly one lenient case:

**Lenient — a top-level `where` field whose predicate is *entirely* forced.** The field stays in the client-facing schema; whatever the client sends for it is thrown away.

```ts
where: { isPublished: { equals: force(true) }, name: { contains: true } }
```

| Client sends | Result |
|---|---|
| nothing | `isPublished = true` |
| `isPublished: { equals: true }` | `isPublished = true`, **no error** |
| `isPublished: { equals: false }` | `isPublished = true`, **no error** |
| `isPublished: { not: false }` — a *different* operator | `isPublished = true`, **no error** |

Same for forced strings and numbers: a shape of `name: { contains: 'fern' }` against a client `contains: 'rose'` emits `contains: "fern"`, no error.

**Strict — everything else.** In these four positions the forced key is removed from the client-facing schema, so sending it at all is a 400:

| Position | Shape | Client sends | Result |
|---|---|---|---|
| a forced *modifier* beside a client-controlled operator | `name: { contains: true, mode: 'insensitive' }` | `mode: "insensitive"` | **400** `where.name: Unrecognized key(s): mode` |
| anything inside a relation filter | `nursery: { is: { id: { equals: force('n1') } } }` | the same id | **400** `where.nursery.is.id: Unrecognized key(s): equals` |
| anything inside a nested `include`'s `where` | `include: { plants: { where: { isDeleted: { equals: force(false) } } } }` | `isDeleted: { equals: true }` | **400** `include.plants.where.isDeleted: Unrecognized key(s): equals` |
| anything in a `data` shape | `data: { isPublished: force(false) }` | `isPublished: false` | **400** `Unrecognized key(s): isPublished` |

**The rule, stated once.** A wholly-forced scalar predicate at the top level of `where` is *merged*. Forced values anywhere else — a modifier beside a client operator, a relation-filter member, a nested `include`'s `where`, a `data` field — are *removed*, and sending them is a 400.

**In practice.** A frontend sending its own tenant id into a top-level forced filter keeps working for years and proves nothing: the server was overriding it, and would have overridden a foreign id identically. Against a relation-scoped shape the same frontend 400s on the first request — so migrating a client onto a forced scope means *removing* the field from the payload, not correcting it.

**For tests:** sending a foreign id and asserting only that the request succeeded passes whether or not the forcing exists — as does asserting against fixtures where both outcomes look alike. Make it discriminating (two tenants, both with rows, assert on what comes back) and it does distinguish them: without the force, the client's foreign id is what reaches Prisma. Asserting on emitted args tests the same thing without the database.

One syntax note while here: the shorthand form of a forced value — `where: { isPublished: force(true) }` without an operator — is not accepted. It fails with `Operator "value" not supported for type "Boolean"`. Forced values live inside an operator: `{ equals: force(true) }`.

## Forced values inside `OR` are lifted out of it

The force has to be *inside* the combinator for this to be about lifting at all — a force that is a sibling of `OR` is an ordinary top-level forced predicate:

```ts
where: {
  OR: {
    name: { contains: true },
    description: { contains: true },
    isPublished: { equals: force(true) },
  },
}
```

Client sends an `OR` array; the emitted args are:

```json
{"where":{"AND":[{"OR":[{"name":{"contains":"fern"}},{"description":{"contains":"fern"}}]},{"isPublished":{"equals":true}}]}}
```

The clearest evidence that the force left the combinator is a client that sends nothing at all. An `OR` branch would make an empty request match anything in the disjunction; instead the `OR` disappears entirely:

```json
{"where":{"isPublished":{"equals":true}}}
```

Forced values inside `AND` and `OR` become top-level AND constraints. Forced values always restrict, never broaden.

Worth knowing when reading someone else's shape: the sibling form and the nested form emit *identical* args for a client that does send an `OR`, so a test built on that request alone cannot tell you which shape you have.

`NOT` is the documented exception to the merge, not to the lifting: a forced `NOT` and a client `NOT` are kept as separate logical branches rather than merged like scalar fields, so Prisma's `NOT` semantics survive. The emitted form is not stable across requests, which is the part worth knowing here — alone the forced `NOT` is an object, and the moment a client sends its own `NOT`, in either the object or the array spelling, it becomes a two-branch array with the client's branch first:

```json
{"where":{"NOT":{"isCancelled":{"equals":true}}}}
{"where":{"NOT":[{"title":{"contains":"draft"}},{"isCancelled":{"equals":true}}]}}
```

An assertion that indexes `where.NOT.isCancelled` therefore passes until the first client `NOT` arrives. A3 §5 has the shape that produces both.

**The consequence people miss:** a genuinely disjunctive scope — "rows where I am the buyer **or** the seller" — cannot be expressed with forced values. Lifting turns it into "buyer AND seller", which matches almost nothing. It has to be expressed somewhere else: a single scoping column that collapses the rule to an equality, a purpose-built handler that runs the query itself, or a database-level policy.

## The shape's projection is applied when the client omits `select`

On reads, `select`/`include` in the shape is both the whitelist and the default: a client that sends no projection gets the shape's, so an endpoint's response shape is defined in one place. The consequence to watch is that adding one field to a `select` several variants share widens what every caller of all of them receives.

**And the trap:** auto-apply happens when the query *executes*, not when the shape parses.

```ts
guard.query('Plant', 'findMany', { select: { id: true, name: true }, take: { max: 10 } }).parse({})
// {}                                  <- no select here

prisma.plant.guard({ select: { id: true, name: true }, take: { max: 10 } }).findMany({})
// { select: { id: true, name: true } } <- applied here
```

Both are correct. But a unit test asserting on `parse()` output reports a missing projection that is not missing. Assert projection through the delegate; assert `where` and `take` through `parse()`.

## Mutations do not apply the shape's projection by default

The mirror image: a create/update with `select` in the shape but no `select` in the request returns the **full record**. `enforceProjection` changes this. If a mutation must never return a column, do not rely on the projection shape alone.

## Nested reads are not tenant-filtered

The scope extension operates on the top-level operation only. `include: { plants: true }` from a scope-root model emits `{"include":{"plants":true}}` — no injected condition anywhere.

For to-many relations the mitigation is a forced `where` in the include shape. For **to-one** relations there is no forced-where mitigation: omit the relation, restrict its scalars with a nested `select`, or rely on database-level constraints.

**Rule.** Every nested relation in a projection is a separate access decision. Nothing about the parent's scope descends into it.

## Scope roots are not self-scoped, and raw SQL is not intercepted

`Nursery` is the scope root, so a `findMany` on `Nursery` returns every nursery. The scope extension adds no filter here — protect the operation with an explicit route shape, application authorization, or a database policy. Likewise `$queryRaw` and `$executeRaw` bypass every mechanism described in either article.

*The four pagination entries that follow are sourced from the `prisma-generator-express` README, not from the harness — they need a running router and a database to observe.*

## `hasMore` is not always right

`findManyPaginated` returns `{ data, total, hasMore }`. `hasMore` is reliable for forward offset pagination — `skip` plus a positive `take`. With cursor-based pagination or a negative `take` (backward pagination) it may be inaccurate. `take: 0` is not in that category: `hasMore` is then `false`, deterministically. And `total` is not atomic with `data` under the default `findManyPaginatedMode = "promiseAll"` — two concurrent queries, no transaction. Switch to `"transaction"` if a page number that disagrees with its own rows is a real problem for you, and accept the 500 on clients without transaction support.

## Pagination defaults: who wins

- `pagination.maxLimit` caps `take` by absolute value **even when a guard shape is present**. ("Absolute value" is the router's rule and covers negative `take`; a guard shape rejects negatives before that with `take: Number must be >= 1`.)
- `pagination.defaultLimit` is **not** applied when a guard shape controls pagination — the shape's `take.default` is.
- With neither, `take` is simply absent from the emitted args and Prisma's own behavior applies.

Verified: `take: { max: 10, default: 3 }` with an empty body emits `{"take":3}`; `take: { max: 10 }` with an empty body emits `{}`.

## The materialized count source silently stops being used

`countSource: { type: 'materializedView', ... }` is used **only** when the request has no dynamic `where`, no `distinct`, and no guard shape. Any of those three and the handler falls back to a normal delegate count, so `total` stays consistent with the data. If you added a guard shape to a route and your cheap count got slow, that is why.

## It passes E2E and 400s in production

```ts
const DROP_GUARD = GENERATOR_DROP_GUARD || process.env.E2E === 'true'
```

With guard dropped, the router calls Prisma directly. Forced values and default projection are still applied by vendored helpers — but **nothing is validated**, so a shape that would be rejected in production sails through the harness. Caller routing is *not* dropped.

**Countermeasure.** A 200 in E2E proves nothing about a shape. Parse it through the real guard instead — no server, no database, no fixtures:

```ts
const args = guard
  .query('Plant', 'findMany', { '/shop': shopShape })
  .parse(body, { caller: '/shop' })

expect(findPredicate(args.where, 'isPublished')).toEqual({ equals: true })
```

**Do not index `args.where.isPublished` directly.** A forced condition is AND-wrapped when the client filtered a different field, and inline-merged into a flat object when the client touched the same one. Both are normal, so a top-level assertion passes or fails on an unrelated part of the request body. `findPredicate` is a fifteen-line recursive walk over `AND`/`OR`/`NOT`, and it makes every scope assertion in the suite stable.

---

## Rules

1. A wholly-forced predicate at the top level of `where` accepts client input and silently discards it — the only lenient position of five.
2. Forced values everywhere else — a modifier beside a client operator, a relation-filter member, a nested `include`'s `where`, a `data` field — are removed from the client-facing schema, and sending them is a 400. The five positions describe shapes that build: under a negative relation operator (`none`, to-one `isNot`) a forced condition is rejected at construction instead.
3. Sending a foreign value and observing "no leak" proves nothing against a top-level forced predicate; assert on emitted args, or use fixtures that make the outcome discriminating.
4. Nest a force inside `AND`/`OR` if you mean to test lifting — a sibling force emits identical args for an `OR`-sending client and demonstrates nothing.
5. Forced values inside combinators lift to top-level AND, so a disjunctive scope cannot be declarative.
6. Read projection auto-applies at execute time, not parse time: assert projection through the guarded delegate, `where` and `take` through `parse()`.
7. Mutation projection is opt-in — without `enforceProjection`, a mutation with no client `select` returns the full record.
8. Scope covers the top-level operation only; every nested relation in a projection is a separate access decision.
9. Scope roots are not self-scoped, and raw SQL bypasses all of it.
10. `hasMore` is reliable only for forward offset pagination with a positive `take`.
11. `pagination.maxLimit` caps an explicit client `take` even under a guard shape; `pagination.defaultLimit` does not apply when a shape controls pagination, and a later guard default is not router-capped in 1.64.4.
12. A materialized `countSource` is silently abandoned when the request has a dynamic `where`, a `distinct`, or a guard shape.
13. `E2E=true` drops the guard: forced values still apply, nothing is validated, and a shape that would 400 in production passes.
14. Assert forced conditions with a helper that walks `AND`/`OR`/`NOT` — AND-wrap versus inline merge depends on the request body.
15. Treat a 200 as evidence of nothing until you have looked at the arguments that reached the database.

---

## Appendix

The harness behind the rows marked "run in `article-labs/guard/`" in the provenance table above is described in full in the [error reference appendix]({{ '/articles/error-reference/' | relative_url }}#appendix-reproducing-any-of-this-in-30-lines): `guard.query(...).parse(body)` for read args, a fake delegate for mutations and projection, and the extension's `$allOperations` for scope injection.

What it gives you is the argument object that would have reached the database. That is the right assertion target for everything in the first two sections here, and it is not a substitute for an integration test where the claim is about returned rows or HTTP status — those rows in the table are documented behavior, and testing them needs the real thing.
