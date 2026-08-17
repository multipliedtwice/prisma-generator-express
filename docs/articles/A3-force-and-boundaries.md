---
layout: article
article_id: A3
permalink: /articles/force-and-boundaries/
---

A guard shape may look like a Prisma query, but it answers a simpler question: who chooses each value? The client chooses some values. The server owns the rest.

```ts
{ status: true }              // the client chooses
{ status: 'published' }       // the server chose, at deploy time
{ status: force('published') } // same, spelled so a literal `true` is unambiguous
{ status: (base) => base.max(20) } // the client chooses, within a rule
```

That is the whole vocabulary. The tricky part is what happens when a client sends a server-owned value. One position silently replaces the client value. Four positions reject it. The result depends on where `force()` appears in the shape, not only on the value itself.

By the end, you will know how to place a forced value, when the client receives a 400, how Boolean operators move forced conditions, and how to test the final Prisma arguments.

Examples use an event-ticketing schema:

```prisma
/// @scope-root
model Organizer {
  id     String  @id @default(cuid())
  name   String
  events Event[]
}

model Event {
  id          String   @id @default(cuid())
  title       String
  venue       String
  startsAt    DateTime
  isPublished Boolean  @default(false)
  isCancelled Boolean  @default(false)
  organizerId String
  organizer   Organizer @relation(fields: [organizerId], references: [id])
  tickets     Ticket[]
}

model Ticket {
  id        String  @id @default(cuid())
  priceCents Int
  tier      String
  eventId   String
  event     Event   @relation(fields: [eventId], references: [id])
}
```

Behavior here was run against `prisma-guard` 1.33.0, `zod` 4.4.3, Prisma 6.19.3. Every claim is reproducible; the harness is at the end.

---

## 1. The four value types

| Written as | Meaning | Client may send it? |
|---|---|---|
| `true` | client-controlled; `@zod` chains from the schema apply | yes |
| a bare literal (`'published'`, `false`, `42`) | forced by the server | depends — §3 |
| `force(v)` | forced by the server | depends — §3 |
| `(base) => schema` | client-controlled, with an inline refine replacing `@zod` | yes |

`force()` exists because `true` is already the sentinel for "client-controlled", so a shape has no other way to pin a boolean to `true`. On any other value it is legal but redundant — `force('published')` and `'published'` behave identically. Use it anyway on security-relevant fields, so a reader need not remember which literals are special.

**Rule.** In a shape, `true` is never a value. It is a permission.

---

## 2. Forced values must live inside an operator

In a `where` shape, a forced value belongs to an operator, not to the field:

```ts
// wrong
where: { isPublished: force(true) }

// right
where: { isPublished: { equals: force(true) } }
```

The wrong form fails at shape construction:

```text
Operator "value" not supported for type "Boolean"
```

The message names an operator you never wrote — the guard is treating the wrapper as an operator object — which makes it hard to place. In `data` shapes the field-level form *is* correct (`data: { isPublished: force(false) }`), so the two halves of a config are not symmetric.

**Rule.** `where` forces an operator. `data` forces a field.

---

## 3. Where the forced value sits decides whether the client may send it

Among shapes that build, one lenient position and four strict ones. A fifth case does not reach client validation at all: forced conditions under a negative relation operator are rejected when the shape is constructed — §7 covers it.

### Lenient: a top-level `where` field whose predicate is entirely forced

```ts
findMany: {
  shape: {
    default: {
      where: { isPublished: { equals: force(true) }, title: { contains: true } },
      take: { max: 50, default: 20 },
    },
  },
}
```

The field stays in the client-facing schema. Whatever the client sends for it is discarded:

| Client sends | Emitted args |
|---|---|
| nothing | `{"take":20,"where":{"isPublished":{"equals":true}}}` |
| `isPublished: { equals: true }` | `{"take":20,"where":{"isPublished":{"equals":true}}}` |
| `isPublished: { equals: false }` | `{"take":20,"where":{"isPublished":{"equals":true}}}` |
| `isPublished: { not: false }` — a different operator | `{"take":20,"where":{"isPublished":{"equals":true}}}` |

(`take: 20` is the shape's `default`, not something the client sent.)

No error in any row, and the same holds for strings and numbers: a shape forcing `title: { contains: 'gala' }` against a client sending `contains: 'anything'` emits `contains: "gala"`.

### Strict: a forced modifier beside a client-controlled operator

```ts
where: { title: { contains: true, mode: 'insensitive' } }
```

Here `contains` is the client's and `mode` is the server's, in the same object. The forced key is removed from the client-facing schema, so a client that sends it is rejected:

```text
Invalid query on model "Event": where.title: Unrecognized key(s): mode
```

Note the flip side: with `mode: true` instead, a client that *forgets* `mode` silently gets case-sensitive search. Neither option is a safe default. Force it when case-insensitivity is part of the endpoint's contract and no caller should be able to opt out — then make sure no client sends `mode`, because doing so is a 400. Open it when the caller genuinely chooses, and accept that a caller which omits it gets exact matching.

### Strict: anything inside a relation filter

```ts
where: { organizer: { is: { id: { equals: force(ctx.organizerId) } } } }
where: { tickets: { some: { tier: { equals: force('vip') } } } }
```

```text
Invalid query on model "Event": where.organizer.is.id: Unrecognized key(s): equals
Invalid query on model "Event": where.tickets.some.tier: Unrecognized key(s): equals
```

Rejected whether the client sends the *right* value or a foreign one. Tenant scoping usually lives here, which is why teams who scope through a relation come away believing forced values are always strict.

### Strict: anything in a nested `include`

```ts
include: {
  events: {
    where: { isCancelled: { equals: force(false) }, title: { contains: true } },
    take: { max: 20, default: 10 },
  },
}
```

```text
Invalid query on model "Organizer": include.events.where.isCancelled: Unrecognized key(s): equals
```

The client may still filter the relation on the fields you opened, and its filter is AND-wrapped with yours:

```json
{ "include": { "events": { "where": { "AND": [ { "title": { "contains": "gala" } },
                                               { "isCancelled": { "equals": false } } ] }, "take": 10 } } }
```

Nested bounds hold too — a client sending `take: 500` inside the include gets `include.events.take: Number must be <= 20`.

### Strict: anything in a `data` shape

```ts
create: {
  shape: {
    default: {
      data: { title: true, venue: true, startsAt: true, isPublished: force(false) },
    },
  },
}
```

```text
Invalid data for create on model "Event": Unrecognized key(s): isPublished
```

(`title`, `venue` and `startsAt` are required with no default, so a shape omitting them fails §6's completeness check before any client input is read. `organizerId` is absent because the scope extension injects it.)

Upsert splits this across its two halves and says which one it means:

```text
Invalid data for upsert (create) on model "Event": Unrecognized key(s): isPublished
```

### The rule, stated once

> A wholly-forced scalar predicate at the top level of `where` is **merged** — the client may send the field and its input is silently discarded. Forced values anywhere else — a modifier beside a client operator, a relation-filter member, a nested `include`'s `where`, a `data` field — are **removed** from the client-facing schema, and sending them is a 400.

There is exactly one lenient position, and it is the one people reach for first when adding a filter to a list endpoint.

Every **read** case above ran through both entry points — `guard.query(...).parse(body)` and `prisma.event.guard(shape).findMany(body)` — and they agree. The `data`-shape row is delegate-only, since `guard.query()` accepts read methods only. Four cases elsewhere do *not* agree, and all are findings rather than defects: three are projection auto-apply, two of those on nested projections, and the fourth is a mutation shape passed to `guard.query()`. All of them are §8.

**What to do with this.** Decide, per shape, which behavior you are relying on, and write the test that proves *that* one.

If your scope is a top-level forced predicate, one specific test shape does **not** prove it: sending a foreign value and then asserting only that the request succeeded, or asserting against fixtures where both outcomes look alike — an empty second tenant, or one whose rows you never check for. Remove the forcing and that assertion still holds, so it was never testing the forcing.

Make it discriminating and it does bite: with a second tenant that actually has rows, dropping the force sends the client's foreign id through to Prisma and the foreign row comes back. That is a real isolation test. It costs a database, a server and a seeded dataset per case, and it proves a *different* thing than an args assertion — outcome-level isolation for this request, rather than the shape of the query the guard emitted. Asserting on the emitted args inspects the mechanism directly and needs neither.

---

## 4. The documentation says conflicting client values throw. They do not.

The `prisma-guard` 1.33.0 README, under "Forced where merge strategy", says:

> Inline merge — if a forced field's value is a plain operator object and the client also provided an operator object for the same field, the forced operator keys are merged into the client's operator object. […] **Conflicts on the same op key (different values) throw `ShapeError`.**

Read straight, that sentence promises rejection: force `organizerId` to `org_1`, have a client send `org_2`, get a 400. Tested on four field types, through both entry points:

| Shape | Client sends | Documented | Actual |
|---|---|---|---|
| `isPublished: { equals: force(true) }` | `equals: false` | `ShapeError` | `{"isPublished":{"equals":true}}` |
| `title: { contains: 'gala' }` | `contains: 'anything'` | `ShapeError` | `{"title":{"contains":"gala"}}` |
| `priceCents: { gte: 100 }` | `gte: 5` | `ShapeError` | `{"priceCents":{"gte":100}}` |
| `organizerId: { equals: force('org_1') }` | `equals: 'org_2'` | `ShapeError` | `{"organizerId":{"equals":"org_1"}}` |

No error in any case. The forced value wins silently.

The check does exist — it runs somewhere else. A conflict *inside the shape config*, between a top-level force and a force in a combinator, throws at construction:

```text
Conflicting forced where values for "isPublished.equals": shape defines both true and false
```

So: **conflict detection applies to your configuration, not to client input.** Client input never competes with a forced value, so it can never conflict with one.

**Why this matters more than a doc nit.** Someone who reads that line and writes

```ts
// this test passes for the wrong reason
await expect(request(app).get('/event').query({ where: { organizerId: { equals: 'org_2' } } }))
  .rejects.toThrow()
```

The request succeeds and returns correctly-scoped rows, so the assertion fails, so the developer "fixes" it by asserting a 200 and moves on believing the scope was tested. It was not.

Worth reporting upstream: either the runtime should reject a conflicting client value, or that README sentence should say the check is shape-only. Until then, treat the runtime as the specification.

---

## 5. Where a forced condition lands in the emitted query

Two merge strategies, and which one you get depends on the request, not the shape.

**AND-wrap** — the client filtered a different field:

```json
{ "where": { "AND": [ { "title": { "contains": "gala" } }, { "isPublished": { "equals": true } } ] }, "take": 20 }
```

**Inline merge** — the client touched the same field:

```json
{ "take": 20, "where": { "isPublished": { "equals": true } } }
```

So the obvious assertion is unstable — `expect(args.where.isPublished)` is `undefined` whenever the client filtered anything else. Write the helper once:

```ts
export function findPredicate(where: any, field: string): any {
  if (!where || typeof where !== 'object') return undefined
  if (field in where) return where[field]
  for (const key of ['AND', 'OR', 'NOT']) {
    const branch = where[key]
    if (!branch) continue
    for (const entry of Array.isArray(branch) ? branch : [branch]) {
      const found = findPredicate(entry, field)
      if (found !== undefined) return found
    }
  }
  return undefined
}
```

```ts
expect(findPredicate(args.where, 'isPublished')).toEqual({ equals: true })
```

**Combinators.** A forced value written *inside* `AND` or `OR` is lifted out and applied as a top-level AND constraint. Note where the `force()` sits below: a member of the `OR`, not a sibling of it.

```ts
where: {
  OR: {
    title: { contains: true },
    venue: { contains: true },
    isPublished: { equals: force(true) },
  },
}
```

A client sending two `OR` branches gets them AND-ed with the forced condition, not OR-ed:

```json
{"where":{"AND":[{"OR":[{"title":{"contains":"gala"}},{"venue":{"contains":"hall"}}]},{"isPublished":{"equals":true}}]}}
```

The proof that it left the combinator is an empty request. An `OR` branch would make that match anything in the disjunction; instead no `OR` survives:

```json
{"where":{"isPublished":{"equals":true}}}
```

Forced values restrict, never broaden. So a genuinely disjunctive rule — "events I organize **or** events that are public" — cannot be expressed with forced values: lifting turns it into a conjunction that matches almost nothing.

The rule has to live somewhere the guard is not doing the narrowing. Three choices, in the order worth trying them: model the rule as a single scoping column, so the disjunction collapses to an equality the shape *can* force; write a purpose-built handler that composes and issues the query itself, with the disjunction authored server-side; or enforce the policy in the database.

Be careful with the middle option. Writing the handler is what enforces the rule, and it is now your code's job rather than the guard's.

### `NOT` is the exception to the merge, and it changes shape

A forced `NOT` and a client `NOT` are kept as separate branches rather than merged, so Prisma's `NOT` semantics survive. What the README does not say is that the *emitted form changes* depending on whether the client sent one.

With a shape whose `NOT` declares one forced key and one client-controlled key:

```ts
where: { NOT: { isCancelled: { equals: force(true) }, title: { contains: true } }, venue: { contains: true } }
```

a client that sends nothing gets an object:

```json
{"where":{"NOT":{"isCancelled":{"equals":true}}}}
```

and a client that sends its own `NOT` gets an array of two branches — the client's first, the forced one second:

```json
{"where":{"NOT":[{"title":{"contains":"draft"}},{"isCancelled":{"equals":true}}]}}
```

The client's object form and array form both arrive there; `NOT: { title: ... }` and `NOT: [{ title: ... }]` emit the same thing. This is the same assertion trap as AND-wrap versus inline merge, one level deeper: a test reading `where.NOT.isCancelled` passes for as long as no client sends a `NOT`, and breaks the first time one does — while the guard is behaving correctly. Walk it.

A client `NOT` is only accepted at all because the shape's `NOT` declares a client-controlled key inside it. Against a wholly-forced `NOT`, the strict rule applies as everywhere else:

```text
Invalid query on model "Event": where.NOT: No matching variant (branch 1: [Unrecognized key(s): venue] | branch 2: [Expected array])
```

---

## 6. Forced values and validation are different layers

A forced value is still validated against the field's schema. `@zod` directives and inline refines apply to client-controlled fields; forcing skips the question of who supplies the value, not the question of whether the value is legal.

```ts
create: {
  shape: {
    default: {
      data: {
        title: true,                          // @zod chains from the schema apply
        venue: (base) => base.max(120),       // inline refine replaces @zod for this field
        startsAt: true,
        isPublished: force(false),
        isCancelled: force(false),
      },
    },
  },
}
```

Failures are reported per field, and the message names the model and operation:

```text
Invalid data for create on model "Event": venue: String must contain at most 120 character(s)
```

`startsAt` is listed for a reason that has nothing to do with forcing: a create shape has to be *complete*. If a required field has no client entry, no schema default, no scope FK injection, no relation write and no `@zod .default(...)` or `.catch(...)` directive, the shape is rejected at construction — before any request is examined — with a message that lists the escape hatches:

```text
Required field "venue" on model "Event" is missing from create data shape, has no default,
is not a scope FK, and is not covered by a relation write in the shape
```

That is a shape bug, not a request bug — it fires before any client is involved.

**Forced fields are applied on update too, not only on create.** A shape of `data: { title: true, isCancelled: force(true) }` against a client body of `{ title: 'x' }` emits:

```json
{ "data": { "title": "x", "isCancelled": true }, "where": { "id": "e1" } }
```

A forced value in an update shape is not a guard rail, it is a side effect: every call through that variant sets the field whether the caller meant to or not. Right for `updatedBy`, wrong for anything a user would be surprised to have changed. To merely *prevent* a field being written, leave it out of the shape — omission already denies it.

**Upsert forces per half.** `create` and `update` are separate shapes with separate forced values:

```ts
upsert: {
  shape: {
    where:  { id: true },
    create: { title: true, venue: true, startsAt: true, isPublished: force(false), isCancelled: force(false) },
    update: { title: true },
  },
}
```

A new row is always unpublished; an existing row's `isPublished` is untouched because the update half omits it. Forcing in `update` as well silently unpublishes every event anyone edits.

---

## 7. Where forced values do not reach

Four boundaries worth knowing before you rely on one. Three of them are visible in emitted args, so they are shown that way rather than asserted.

### Nested to-many reads

A relation loaded through `include`/`select` is not tenant-filtered by the scope extension. For a to-many relation the mitigation is a forced `where` inside the include shape, and it does what you would hope — the guarded delegate emits it whether or not the client asked:

```json
{"include":{"events":{"where":{"isPublished":{"equals":true}}}}}
```

It is also a strict position, so the client cannot supply that field itself:

```text
Invalid query on model "Organizer": include.events.where.isPublished: Unrecognized key(s): equals
```

### Nested to-one reads

Here the mitigation does not exist, and the guard says so outright rather than ignoring the attempt:

```text
Relation "event" on model "Ticket" is to-one. Only "select" and "include" are supported for to-one nested reads, not where/orderBy/cursor/take/skip.
```

A to-one relation is reached through the foreign key on the row you already returned, so there is no collection to filter. The foreign key fixes *which* row comes back. It does not decide whether the caller may see that row.

The missing `where` means the shape cannot make that access decision. Omit the relation, restrict its fields with a nested `select`, or enforce the rule in the database.

This message is a `ShapeError` at 400 and comes from the shape, not the request. A shape written this way fails the first time it is built, not on a later request.

### Relation filters are not lifted

A forced value inside `some` stays inside `some`; it is not pulled to the top level the way a combinator member is:

```json
{"where":{"tickets":{"some":{"tier":{"equals":"vip"}}}}}
```

When the client also filters inside that relation, the AND-wrap happens *at the relation level*, not the top:

```json
{"where":{"tickets":{"some":{"AND":[{"priceCents":{"gte":100}},{"tier":{"equals":"vip"}}]}}}}
```

That is the behavior you want: a relation-scoped rule stays attached to the relation it scopes.

`none` behaves differently, and this is the second place in this article where the runtime does not match its own message. A forced condition under `none` is rejected at shape construction:

```text
Relation filter "tickets.none" on model "Event" mixes client-controlled and forced conditions. Under negative relation operators (none, isNot), merging weakens the filter. Either move forced conditions to a separate top-level "none" branch, or make all conditions under this operator client-controlled or all forced.
```

The reasoning is sound. Under a negation, adding an `AND` condition makes the exclusion narrower. That quietly weakens the rule the forced value was meant to enforce.

The message still describes the wrong trigger. A `none` shape with one forced condition and no client-controlled key throws the same error. It also throws with an empty request body, so this is shape construction rather than request validation.

The final advice in the message—make all conditions forced—does not work in 1.33.0. That all-forced shape is the case that throws.

The same forced conditions under `some` and `every` build and run normally, which is what tells you the check is specific to negative operators rather than to your shape. The cleanest demonstration is the to-one pair — same relation, same forced condition, opposite operator:

```ts
where: { organizer: { is:    { name: { equals: force('Acme') } } } }   // builds
where: { organizer: { isNot: { name: { equals: force('Acme') } } } }   // ShapeError
```

```text
Relation filter "organizer.isNot" on model "Event" mixes client-controlled and forced conditions. Under negative relation operators (none, isNot), merging weakens the filter. Either move forced conditions to a separate top-level "isNot" branch, or make all conditions under this operator client-controlled or all forced.
```

A wholly *client-controlled* `isNot` builds and runs. So the trigger is not negation, and not mixing — it is a forced condition appearing anywhere under a negative operator. On a to-many relation `isNot` is not available in the first place:

```text
Operator "isNot" not supported for to-many relation "tickets". Allowed: some, every, none
```

**What to do.** Put the forced condition where it will not be negated: a separate top-level predicate, or `some`/`every` phrased positively. If the rule is genuinely "no ticket of this tier", 1.33.0 will not express it declaratively at all — the message's own suggested remedy, an all-forced block under the operator, is the case that throws. Check this against your own version before designing around it; of everything in this article it is the likeliest to have moved.

### Relation writes

Forced values do not describe a `connect`. The shape configures which relation operations are permitted and what identifies the target:

```ts
// wrong
data: { tickets: { connect: true } }
// -> connect config on "Event.tickets" must be an object of unique selectors

// right
data: { tickets: { connect: { id: true } } }
```

Restricting to `connect`/`disconnect` means a client can only reference existing rows — but *which* rows is not something `force()` can pin. Ownership of the connected id is a hook's job.

### Scope roots

The `@scope-root` model is not scoped to itself, and the difference is plain in what the extension injects. A scoped model gets the tenant filter:

```json
{"where":{"organizerId":"org_1"}}
```

The scope root gets nothing at all — an unfiltered `findMany` on `Organizer` stays unfiltered, and a client `where` passes through untouched:

```json
{}
{"where":{"name":{"contains":"a"}}}
```

Which is correct: there is no column on `Organizer` that says which organizer it belongs to. It is also the boundary people are most surprised by, because models that *do* have a generated scope mapping are filtered automatically and the difference is invisible at the call site. Check the generated `SCOPE_MAP` rather than assuming. Across the two schemas in the lab it maps three models and no others, which the harness records rather than leaving to the article:

```text
MAP     Plant      -> [{"fk":"nurseryId","root":"Nursery","relationName":"nursery"}]
MAP     Order      -> [{"fk":"nurseryId","root":"Nursery","relationName":"nursery"}]
MAP     Event      -> [{"fk":"organizerId","root":"Organizer","relationName":"organizer"}]
MAP     Ticket     -> (no scope mapping — unscoped, queries on it are not filtered)
MAP     OrderItem  -> (no scope mapping — unscoped, queries on it are not filtered)
MAP     Customer   -> (no scope mapping — unscoped, queries on it are not filtered)
MAP     Nursery    -> (no scope mapping — unscoped, queries on it are not filtered)
MAP     Organizer  -> (no scope mapping — unscoped, queries on it are not filtered)
```

`Ticket`, `OrderItem`, and `Customer` are reached through a scoped parent but carry no mapping of their own, so a query that *starts* at one of them is unscoped — as is any query on a root. The scope extension adds no filter in those cases. Protect the operation with an explicit route shape, application authorization, or a database policy.

### Raw SQL

`$queryRaw` and `$executeRaw` are not intercepted by anything in this article. That one is from the `prisma-guard` README, not the harness — the lab asserts on arguments passed to a fake delegate, and raw SQL never reaches it.

## 8. Testing a shape without a server

Shapes are data. You can assert on the exact arguments that would have reached Prisma with no HTTP, no database, and no fixtures.

```ts
import { guard } from './generated/guard/client'

const args = guard
  .query('Event', 'findMany', { '/public/events': publicEventsShape })
  .parse(body, { caller: '/public/events' })

expect(findPredicate(args.where, 'isPublished')).toEqual({ equals: true })
expect(args.take).toBeLessThanOrEqual(50)
```

Three things it catches cheaply: a forced value removed during a refactor, a `take` bound raised past what the page needs, a new field added to a shared `select`. Two caveats before building a suite around it.

**`parse()` is reads-only.** A mutation shape passed to `guard.query()` produces `Caller key "where" collides with reserved shape config key` — the top-level keys get read as variant names. Mutations go through the guarded delegate.

**`parse()` does not show projection.** The shape's `select` is applied when the query executes:

```ts
guard.query('Event', 'findMany', { select: { id: true, title: true }, take: { max: 10 } }).parse({})
// {}

prisma.event.guard({ select: { id: true, title: true }, take: { max: 10 } }).findMany({})
// { select: { id: true, title: true } }
```

Assert `where` and `take` through `parse()`; assert projection through the delegate. A test suite that checks projection via `parse()` reports a missing `select` that is not missing.

---

## Rules

1. In a shape, `true` is a permission, not a value.
2. `force()` is only *required* for a literal `true`; use it anyway on security-relevant fields for readability.
3. In `where`, force an operator (`{ equals: force(x) }`); in `data`, force the field. `where: { f: force(x) }` fails with `Operator "value" not supported`.
4. A wholly-forced predicate at the top level of `where` accepts client input and discards it silently — this is the only lenient position.
5. Forced values anywhere else — a modifier beside a client operator, a relation-filter member, a nested `include`'s `where`, a `data` field — are removed, and sending them is a 400.
6. Do not trust the README line promising `ShapeError` on conflicting client values; the runtime silently overrides. Conflict detection is shape-only.
7. Against a top-level forced predicate, sending a foreign value and checking only that the request succeeded — or checking a result that looks the same either way — proves nothing. Assert on emitted args with a recursive helper (AND-wrap versus inline merge depends on the request body), or use fixtures that make the outcome discriminating.
8. Forced values inside `AND`/`OR` lift to top-level AND, so a disjunctive scope cannot be declarative; nest the force inside the combinator or you are testing a different shape.
9. Forced `NOT` stays its own branch, and the emitted form flips from object to array the moment a client sends its own `NOT` — walk it, never index it.
10. Forced values are still validated; forcing decides who supplies a value, not whether it is legal. `guard.query()` is reads-only, and the guarded delegate is the only place projection auto-apply appears.
11. A create shape must be complete: client field, schema default, scope FK, relation write, or a `@zod .default(...)` / `.catch(...)` directive.
12. A forced field in an `update` shape writes on every call through that variant — to merely deny a field, omit it instead. Upsert forces per half.
13. Forced conditions inside `some`/`every` stay at the relation level and AND-wrap there, not at the top. Under `none` and to-one `isNot` they are refused at construction — the message says "mixes" but fires with nothing mixed, so treat negative relation operators as closed to forcing in 1.33.0.
14. Scope does not descend into nested reads: a forced `where` in the include shape is the only shape-level filtering mitigation, and only for to-many relations — a to-one relation takes `select`/`include` and nothing else, so omit it, restrict its scalars, or constrain it in the database.
15. Forced values do not reach relation-write targets, raw SQL, or the scope root, which is never scoped to itself.


---

## Appendix: reproducing every claim here

```ts
import { force } from 'prisma-guard'
import { guard } from './generated/guard/client'

const shape = {
  where: { isPublished: { equals: force(true) }, title: { contains: true } },
  take: { max: 50, default: 20 },
}

console.log(JSON.stringify(guard.query('Event', 'findMany', shape).parse({
  where: { isPublished: { equals: false } },
})))
// {"where":{"isPublished":{"equals":true}},"take":20}
```

For the delegate side — mutations, projection, and the second half of every position case — you do not need a Prisma client. `guard(input, caller)` resolves its delegate from `this.$parent`, so any object with the right method names works:

```ts
const ext = guard.extension(() => ({ Organizer: 'org_1' }))
const fake = { findMany: async (args: unknown) => args, create: async (args: unknown) => args }

const guarded = (ext.model as any).event.guard.call({ $parent: { event: fake } }, shape)
console.log(await guarded.findMany({ where: { isPublished: { equals: false } } }))
```

Run both for every read case. Agreement means you have a behavior rather than an artefact of one code path; disagreement is worth writing down, and this article contains four of those — three projection auto-apply differences, two of them on nested projections, plus one mutation shape passed to the read-only entry point. Mutations have only the delegate, so there is nothing to compare — label those cases rather than quietly counting them as agreeing.

The §7 scope claims need one more primitive. Scope injection happens in the extension's query layer rather than in the shape, so neither `parse()` nor the guarded delegate shows it — call `$allOperations` directly and let the `query` callback hand the args straight back:

```ts
const scoped = (model: string, operation: string, args: unknown) =>
  (ext.query as any).$allOperations({ model, operation, args, query: async (a: unknown) => a })

console.log(await scoped('Event', 'findMany', {}))      // {"where":{"organizerId":"org_1"}}
console.log(await scoped('Organizer', 'findMany', {}))  // {}
```

Three primitives, then: `parse()`, a fake delegate, and `$allOperations`. Between them they cover every claim in this article except raw SQL, which by definition never reaches any of them.
