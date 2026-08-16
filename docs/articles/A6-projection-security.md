---
layout: article
article_id: A6
permalink: /articles/projection-security/
---

# Projection is a security boundary: `select`, `include`, and the relation that carries no scope

A query can have a perfect tenant filter and still return a private field. Filtering decides which records qualify. Projection decides which fields and related records leave the server. They are separate boundaries.

This distinction matters in a generated API because clients can request native Prisma arguments. A response shape that accidentally exposes an internal note, an agent email, or an unrestricted relation is not repaired by a correct root `where` clause.

The examples use a helpdesk schema:

```prisma
/// @scope-root
model Account {
  id            String         @id @default(cuid())
  tickets       Ticket[]
  customerNotes CustomerNote[]
  agentNotes    AgentNote[]
}

model Ticket {
  id            String         @id @default(cuid())
  accountId     String
  subject       String
  description   String
  requesterEmail String
  internalScore Int?
  account       Account        @relation(fields: [accountId], references: [id])
  customerNotes CustomerNote[]
  agentNotes    AgentNote[]
}

model CustomerNote {
  id        String @id @default(cuid())
  ticketId  String
  accountId String
  body      String
  ticket    Ticket @relation(fields: [ticketId], references: [id])
  account   Account @relation(fields: [accountId], references: [id])
}

model AgentNote {
  id        String @id @default(cuid())
  ticketId  String
  accountId String
  body      String
  authorEmail String
  ticket    Ticket @relation(fields: [ticketId], references: [id])
  account   Account @relation(fields: [accountId], references: [id])
}
```

`Account` is the scope root. `Ticket`, `CustomerNote`, and `AgentNote` can have generated scope mappings through `accountId`. That top-level scope relationship does not automatically constrain a relation loaded inside another query.

Terms used throughout the series:

| Term | Meaning |
|---|---|
| shape | declarative description of the args a caller may send |
| variant / caller | named key selecting which shape applies |
| forced value | server-pinned value in a shape (literal or `force(x)`) |
| client-controlled | `true` in a shape |
| scope | automatic tenant filter from `@scope-root` + guard extension |
| hook | `before` / `after` request handler on an operation or variant |

The bundled guard README is the source for projection auto-apply, nested projection syntax, mutation behavior, and scope limitations. The generator README is the source for Prisma version requirements and transport-level support for `omit`. The existing lab independently reproduces the execute-time read projection and mutation asymmetry described below.

---

## 1. Define the read projection once, as whitelist and default

**Put every field a read endpoint may return in its shape projection, and assume omitted client projection means the whole shaped projection.**

On reads, a shape-level `select` or `include` has two jobs. It limits what a client may request, and it supplies the default projection when the client sends neither. A client may narrow within the whitelist. It may not widen beyond it.

```ts
const customerTicketShape = {
  where: {
    id: { equals: true },
  },
  select: {
    id: true,
    subject: true,
    description: true,
    customerNotes: {
      select: {
        id: true,
        body: true,
      },
      orderBy: { id: true },
      take: { max: 50, default: 20 },
    },
  },
}
```

A client may send only the `where` argument:

```json
{
  "where": {
    "id": { "equals": "ticket-1" }
  }
}
```

The guarded read executes with the shape's projection. The client does not need to repeat the field list. If it sends a projection, that request must fit inside the declared tree:

```ts
// right: narrower than the shape
select: {
  id: true,
  subject: true,
}

// wrong: internalScore is absent from the shape
select: {
  id: true,
  internalScore: true,
}
```

The important timing is easy to test incorrectly. `guard.query().parse()` validates read input but does not synthesize the default read projection. The guarded delegate applies the projection when the query executes. The lab captures this difference: parsing `{}` produces `{}`, while the fake guarded delegate receives `{"select":{"id":true,"name":true}}` for the corresponding nursery shape. Therefore a projection test must observe guarded execution or use the documented `resolve()` planning result. An assertion against parse output alone reports a false absence.

This dual role makes a projection change an API change. Adding `requesterEmail` to the shape does not merely allow an explicit client request. It also adds that field to the default response for clients that omit projection.

## 2. Choose `select`, `include`, or `omit` by what must be explicit

**Use `select` for an explicit allowlist, `include` for relations added to scalar output, and `omit` only when a deny-list is the intended contract.**

Prisma's three projection forms have different meanings:

| Form | Response contract |
|---|---|
| `select` | return only selected scalar fields and relations |
| `include` | return relations in addition to all scalar fields |
| `omit` | exclude named scalar fields |

For a public or customer response, `select` is usually the clearest boundary because a newly added model field stays absent until someone deliberately opens it.

```ts
// right for a customer-facing endpoint
select: {
  id: true,
  subject: true,
  description: true,
}
```

An `include` declaration loads relations but keeps all root scalars. If the `Ticket` model contains `internalScore` or another internal scalar, `include` alone does not remove it.

```ts
// wrong for a restricted root payload
include: {
  customerNotes: true,
}

// right: restrict root scalars and relation scalars
select: {
  id: true,
  subject: true,
  customerNotes: {
    select: {
      id: true,
      body: true,
    },
  },
}
```

At one object level, `select` and `include` cannot coexist. `select` and `omit` also cannot coexist. The generator supports `omit` with `include`, but `omit` requires Prisma 6.2.0 or newer; requests using it on Prisma 6.0.x or 6.1.x return 400.

The guard shape language documented for projections is `select` and `include`. Do not assume a transport-level `omit` feature is accepted by every guarded shape path merely because the generated unguarded endpoint supports it. Keep version and integration support explicit when choosing it.

`omit` is useful when most scalars are intentionally public and only a small stable set is private. It is a poor fit when model evolution must fail closed. A newly added scalar is returned unless it is added to the deny-list; an allowlist `select` keeps it closed by default.

## 3. Constrain every to-many relation inside its projection

**Put the relation's filter, ordering, and bounds in the nested projection object instead of trusting the root query.**

To-many nested projections can carry `where`, `orderBy`, `cursor`, `take`, and `skip`. The shape may force relation filters and expose bounded client controls.

```ts
import { force } from 'prisma-guard'

const agentTicketShape = (ctx) => ({
  select: {
    id: true,
    subject: true,
    agentNotes: {
      where: {
        accountId: { equals: force(ctx.Account) },
      },
      orderBy: {
        id: true,
      },
      take: {
        max: 100,
        default: 25,
      },
      skip: true,
      select: {
        id: true,
        body: true,
      },
    },
    _count: {
      select: {
        agentNotes: {
          where: {
            accountId: { equals: force(ctx.Account) },
          },
        },
      },
    },
  },
})
```

The relation filter and `_count` filter are separate declarations because they control different queries. Filtering returned notes does not imply that a count of notes is filtered the same way. Repeating the forced predicate is intentional here.

When the client sends `agentNotes: true` against an object-shaped relation declaration, the guard expands the boolean to the relation's default projection skeleton. Nested defaults and forced conditions still apply. This prevents `true` from bypassing the nested `take` or `where`.

Forced fields inside a nested `where` are strict client positions among shapes that build. The client must not echo `accountId`; sending the forced field receives a 400 `Unrecognized key(s)` validation error. The server-authored predicate remains in the emitted Prisma arguments.

Ordering permission has its own syntax. In the shape, sortable fields are marked `true`; in the request, the client sends a Prisma direction such as `desc`. A nested `take: { max: 100, default: 25 }` both caps a supplied positive value and supplies 25 when omitted. Use `{ max: 100 }` without `default` when omission should stay omission.

## 4. Add explicit protection because scope does not descend

**Assume every nested relation is unscoped until its projection or the database proves otherwise.**

The scope extension intercepts top-level Prisma operations. A nested `include` or `select` is part of the parent operation, not a new scoped delegate call. The guard README states that nested reads are not automatically tenant-filtered. This applies to read responses and mutation return projections.

The risk is visible in a root query whose filter is correct:

```ts
// wrong
const shape = {
  where: { id: { equals: true } },
  select: {
    id: true,
    agentNotes: {
      select: {
        id: true,
        body: true,
        authorEmail: true,
      },
    },
  },
}
```

Automatic scope may constrain the top-level `Ticket`. It does not add an `accountId` condition inside `agentNotes`. Schema relationships and database constraints might make a cross-account child impossible, but the scope extension itself supplies no nested predicate.

For a to-many relation, add a forced `where` condition:

```ts
// right
const shape = (ctx) => ({
  where: { id: { equals: true } },
  select: {
    id: true,
    agentNotes: {
      where: {
        accountId: { equals: force(ctx.Account) },
      },
      select: {
        id: true,
        body: true,
      },
    },
  },
})
```

To-one relations cannot use a nested Prisma `where`. The guard README gives three mitigations: omit the relation, restrict its scalar fields through nested `select`, or rely on database-level guarantees such as row-level security and foreign-key invariants.

```ts
// right: expose only non-sensitive account identity
select: {
  id: true,
  subject: true,
  account: {
    select: {
      id: true,
    },
  },
}
```

Restricted scalars reduce data exposure; they do not turn the to-one load into a scope-filtered query. If the relation itself must be authorized independently, omission or database enforcement is the stronger boundary.

## 5. Configure mutation projection separately from read projection

**Enable `enforceProjection` when a mutation must never return Prisma's full default payload.**

Mutation projection differs intentionally from read projection. By default, a mutation shape's `select` or `include` validates a client-requested projection. If the client sends no projection, Prisma returns its normal full record. The lab observes the emitted-argument side: no `select` is passed by default.

```ts
const createTicketShape = {
  data: {
    subject: true,
    description: true,
    requesterEmail: true,
  },
  select: {
    id: true,
    subject: true,
  },
}
```

These two requests are not equivalent under the default guard configuration:

```ts
// wrong if the response must always be restricted
prisma.ticket.guard(createTicketShape).create({
  data: {
    subject: 'Printer offline',
    description: 'Third floor',
    requesterEmail: 'requester@example.com',
  },
})

// right only when client projection is part of the contract
prisma.ticket.guard(createTicketShape).create({
  data: {
    subject: 'Printer offline',
    description: 'Third floor',
    requesterEmail: 'requester@example.com',
  },
  select: {
    id: true,
    subject: true,
  },
})
```

For a server-owned response boundary, configure the guard generator:

```prisma
generator guard {
  provider          = "prisma-guard"
  output            = "generated/guard"
  enforceProjection = "true"
}
```

With `enforceProjection`, supported mutation methods synthesize the shape projection when the client omits it. The setting covers `create`, `update`, `upsert`, `delete`, `createManyAndReturn`, and `updateManyAndReturn`.

Non-returning batch methods are different. `createMany`, `updateMany`, and `deleteMany` return a `BatchPayload` count and do not support projection. Putting `select` or `include` in their shape or body throws `ShapeError`. The generator's `writeStrategy = "forceReturn"` can redirect `createMany` and `updateMany` endpoints to returning counterparts, changing both response type and projection capability; it does not change `deleteMany`.

## 6. Split projections by audience and pin their exact key sets

**Give each audience an independently reviewed projection instead of sharing a broad object by convenience.**

Projection objects are easy to reuse and hard to review when reuse crosses trust boundaries:

```ts
// wrong
const ticketSelect = {
  id: true,
  subject: true,
  requesterEmail: true,
  internalScore: true,
}

const customerShape = { select: ticketSelect }
const agentShape = { select: ticketSelect }
```

Adding an agent-only field silently widens the customer default response because read projections auto-apply. Deduplicate only inside the same exposure class.

```ts
// right
const customerTicketSelect = {
  id: true,
  subject: true,
  description: true,
}

const agentTicketSelect = {
  id: true,
  subject: true,
  description: true,
  requesterEmail: true,
  internalScore: true,
}
```

A canary test should pin keys without relying on source-object identity:

```ts
const sortedKeys = (value) => Object.keys(value).sort()

const expectedCustomerKeys = ['description', 'id', 'subject']
const actualCustomerKeys = sortedKeys(customerTicketSelect)

if (JSON.stringify(actualCustomerKeys) !== JSON.stringify(expectedCustomerKeys)) {
  throw new Error(`customer projection changed: ${actualCustomerKeys.join(',')}`)
}
```

This is a source-level canary, not a runtime guard test. Pair it with a guarded-delegate test that verifies the default projection is emitted when the request omits `select`. For nested relations, recursively inspect the emitted projection and forced `where`, because checking only root keys cannot detect a widened child.

Treat the expected list as an explicit API contract. A legitimate change updates the shape, the test, and the consumer contract together. An unrelated model field addition should leave it untouched.

## 7. Review projection as a tree, not a root field list

**Audit every relation node for scalars, bounds, filters, and scope before publishing the endpoint.**

A secure root `select` can contain an insecure child. Review each node with four questions:

1. Which scalar fields can leave this node?
2. Which relations can be traversed from it?
3. What limits the size and ordering of each to-many relation?
4. What proves tenant or ownership isolation for that relation?

For a customer ticket endpoint, `agentNotes` should normally be absent. For an agent endpoint, the relation may be present but `authorEmail` may still be unnecessary. A forced child `where` can constrain rows, while a nested `select` independently constrains fields. Both can be required.

Do not infer safety from a parent foreign key without stating the database invariant that makes it safe. The scope extension does not inspect and certify those invariants; it only injects documented top-level filters. If the database guarantees every note's `accountId` matches its ticket's account, record that as a database boundary. Otherwise add the to-many forced filter.

## 8. Understand what the guard synthesizes from a projection

**Test the effective nested projection after defaults and forced conditions are applied.**

Default projection synthesis does not copy every client-controllable option from the shape into the body. It builds the structural skeleton: scalar fields marked `true`, nested `select` or `include` trees, `_count`, and relation object skeletons needed for nested defaults. Client-controllable nested `where`, `orderBy`, `take`, `skip`, and `cursor` are omitted from that initial skeleton. Parsing then fills configured defaults, and the forced-value pipeline merges forced `where` conditions.

This order explains why the following shape can safely provide a useful default without inventing a client sort:

```ts
const shape = {
  select: {
    id: true,
    customerNotes: {
      where: {
        accountId: { equals: force(accountId) },
        body: { contains: true },
      },
      orderBy: {
        id: true,
      },
      take: {
        max: 50,
        default: 20,
      },
      select: {
        id: true,
        body: true,
      },
    },
  },
}
```

When the client omits projection, the nested relation still receives `take: 20` and the forced account predicate. It does not receive an `orderBy`, because `orderBy: { id: true }` grants a client permission rather than declaring a default direction. It also does not receive a client body filter merely because `body.contains` is allowed.

When a client explicitly sends a narrower projection, only requested allowed fields remain. When it sends `customerNotes: true`, the guard expands that boolean to the configured relation skeleton, preserving nested defaults and forced conditions. Therefore test at least three cases for a security-sensitive relation: omitted root projection, explicit nested projection, and relation boolean shorthand.

If an object skeleton remains empty after parsing, the guard collapses it back to `true`. Do not assert that every relation is represented as an object merely because its shape used object syntax. Assert semantic requirements: selected scalar keys, forced predicates, and bounds.

The same synthesis rules power mutation projections only when `enforceProjection` is enabled. Without it, omission on a mutation emits no projection at all.

## 9. Treat `_count` as a separate information channel

**Apply the same row restriction to a relation count that you apply to the returned relation.**

A count can disclose data even when the related rows are absent. For a customer-facing ticket, returning `agentNotes: []` while exposing `_count.agentNotes = 7` still reveals internal activity. Projection review must include `_count`, not only `select` and `include` branches.

The guard supports a filtered relation count inside a projection:

```ts
const shape = (ctx) => ({
  select: {
    id: true,
    customerNotes: {
      where: {
        accountId: { equals: force(ctx.Account) },
      },
      select: {
        id: true,
        body: true,
      },
    },
    _count: {
      select: {
        customerNotes: {
          where: {
            accountId: { equals: force(ctx.Account) },
          },
        },
      },
    },
  },
})
```

The two filters must agree by deliberate construction. One controls loaded note rows; the other controls the count. A test should locate both forced predicates in emitted args. Checking only that `_count` is allowed does not establish that its population matches the visible relation.

For an audience that does not need the information, omit `_count` entirely. A shape is an allowlist: absence is clearer than a filter whose business meaning is uncertain.

## 10. Audit mutation return relations with the same nested-scope rule

**Apply nested read protection to records returned by create, update, upsert, and delete.**

Mutation return projection uses the same nested `select` and `include` syntax as reads. Forced `where` conditions on to-many nested includes work the same way. The top-level mutation may be scope-filtered while its returned relations are not, because nested loading remains part of that one top-level operation.

```ts
const updateTicketShape = (ctx) => ({
  where: {
    id: true,
  },
  data: {
    subject: true,
  },
  select: {
    id: true,
    subject: true,
    customerNotes: {
      where: {
        accountId: { equals: force(ctx.Account) },
      },
      select: {
        id: true,
        body: true,
      },
    },
  },
})
```

With default guard configuration, this projection constrains a client that sends it but does not automatically apply when the mutation request omits it. With `enforceProjection`, omission synthesizes it. Both settings still require the forced child condition because automatic scope does not descend.

The returning methods that support `select` and `include` are `create`, `createManyAndReturn`, `update`, `updateManyAndReturn`, `upsert`, and `delete`. The count-only batch methods `createMany`, `updateMany`, and `deleteMany` do not. Review the actual effective method when generator `writeStrategy` can redirect a bulk route to its returning counterpart.

Delete return projection deserves the same review as create or update. Deleting a record does not make its returned relations non-sensitive. If the endpoint returns the deleted record with an included relation, projection and nested-scope rules still apply to that response.

## 11. Make projection changes visible in review

**Review an exposure matrix beside the shape instead of treating projection edits as ordinary refactors.**

For each variant, record root scalars, relations, nested scalars, relation limits, and isolation source. A compact matrix for this domain could look like this:

| Audience | Root scalars | Customer notes | Agent notes | Isolation source |
|---|---|---|---|---|
| customer | `id`, `subject`, `description` | body, capped and forced by account | absent | root scope plus child forced `where` |
| agent | customer fields plus requester identity | body, capped and forced | body, capped and forced | root scope plus both child forced filters |
| supervisor | explicitly reviewed superset | explicitly bounded | explicitly bounded | same, or documented database policy |

The table does not replace code or tests. It makes unintended sharing visible. If two audiences use the same projection object while their rows differ in the matrix, reuse crossed a trust boundary.

Review defaults separately from client-requested narrowing. A read shape change affects omitted-projection clients immediately. A mutation shape change affects omitted-projection clients only when `enforceProjection` is enabled, but it still widens what explicit clients are allowed to request. Both are API changes.

## 12. Read projection errors as boundary evidence

**Use a rejected widening request to prove the client cannot escape the declared tree.**

The lab's nursery shape permits `id` and `name` but not `priceCents`. A client widening attempt produces `ShapeError` status 400:

```text
Invalid query on model "Plant": select: Unrecognized key(s): priceCents
```

A request containing both projection forms is also rejected before Prisma receives it:

```text
Request cannot define both "include" and "select"
```

An empty projection is a construction error rather than an endpoint that returns nothing:

```text
Empty select config on model "Plant". Define at least one field.
```

These tests establish three different boundaries: field allowlisting, request grammar, and valid shape construction. Keep them separate so a failure identifies the contract that changed.

Nested bounds deserve the same negative test. The ticketing harness gives a client a nested maximum of 20 and sends a larger value. Both guard entry points reject it with status 400:

```text
Invalid query on model "Organizer": include.events.take: Number must be <= 20
```

Positive default-projection tests prove what is returned when the client omits fields. Negative widening tests prove what the client cannot request. A publication-ready projection boundary needs both.

The limitation on to-one filtering also has a reproduced construction error. When the ticketing harness puts `where` on the to-one `Ticket.event` projection, both entry points return status 400:

```text
Relation "event" on model "Ticket" is to-one. Only "select" and "include" are supported for to-one nested reads, not where/orderBy/cursor/take/skip.
```

Do not answer that error by removing the filter while leaving a sensitive relation broad. Choose one of the documented to-one mitigations: remove the relation, narrow its scalar projection, or establish the isolation invariant in the database. The error is evidence that the desired row predicate cannot live at that projection node, not evidence that the row is safe without it.

Run the negative tests against every audience shape, not only the broadest one. A supervisor projection rejecting an unknown field says nothing about a customer projection that accidentally lists it. Named shapes and variants are independent response contracts. Exercise omitted projection and explicit widening for each declared caller whose exposure differs, and include at least one sensitive nested scalar in the rejection set.

Record the expected emitted projection beside each case so a future dependency upgrade exposes both newly rejected requests and silently widened defaults.

Keep this evidence visible.

## 13. Keep projection on every path that can return the data

**Do not assume a guarded route projection protects raw SQL, an unguarded delegate, or a different operation.**

A shape belongs to the guarded operation that uses it. It does not rewrite the Prisma model globally. Another generated variant, an operation with neither `shape` nor `variants`, a direct unguarded Prisma call, and raw SQL each need their own boundary.

The guard README explicitly says `$queryRaw` and `$executeRaw` bypass all guard protections. A safe `Ticket.findMany` projection therefore says nothing about a raw reporting query that selects `requesterEmail` or `AgentNote.authorEmail`. Restrict the SQL statement and its returned mapping in the application or database layer.

Scope roots require the same care. `@scope-root` marks a context root; direct calls to the root model are not self-scoped. If an `Account` route exposes related tickets, its nested projections still need explicit review. A root annotation is not a blanket projection policy.

When the same record can leave through read and mutation operations, pin both contracts. Read projection auto-applies. Mutation projection needs `enforceProjection` for the same omission behavior. A safe `findUnique` shape cannot prevent an `update` response from returning a full record when the mutation shape is absent or optional.

Build an operation inventory for sensitive models: every generated read, every returning mutation, every variant, custom handlers, and raw SQL. The projection audit is complete only when each path has an explicit boundary or is not exposed.

## Rules

1. Treat projection as a data boundary separate from filtering.
2. Use a read shape projection as both whitelist and default response.
3. Observe guarded execution, not parse output alone, when testing read defaults.
4. Prefer `select` when newly added fields must remain closed by default.
5. Never assume `include` removes sensitive root scalars.
6. Do not combine `select` with `include` or `omit` at the same level.
7. Put explicit bounds and forced filters on every sensitive to-many projection.
8. Treat every nested read as unscoped until its own shape or the database proves otherwise.
9. Omit, scalar-restrict, or database-protect a sensitive to-one relation.
10. Enable `enforceProjection` when mutation responses must always use the shape projection.
11. Do not put projection on non-returning batch methods.
12. Keep projections separate across trust boundaries and pin their exact key sets.

## Reproduction appendix

Run `cd article-labs/guard && npm run results` and inspect the projection rows in `RESULTS.txt`. They show read projection appearing at delegate execution but not `guard.query().parse()`, mutation projection remaining absent by default, nested forced `where`, and unscoped nested reads. HTTP `omit` compatibility and provider behavior are README-sourced rather than exercised by this no-database lab.

Documentation sources: [`prisma-generator-express` README](https://github.com/multipliedtwice/prisma-generator-express/blob/master/README.md) and [`prisma-guard` README](https://github.com/multipliedtwice/prisma-guard/blob/main/README.md).
