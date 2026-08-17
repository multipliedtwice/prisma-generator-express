---
layout: article
article_id: A8
permalink: /articles/writes/
---

Generated write endpoints accept Prisma-style arguments. A guard shape decides which values the client may send, which values the server controls, which nested writes exist, and whether a bulk update or delete is narrow enough to run.

These rules reject unsafe or incomplete configurations. A create shape must cover every required field. A bulk mutation needs `where` in two places. An upsert needs separate create and update rules. A nested relation write does not inherit the top-level tenant filter.

The examples use subscription billing:

```prisma
/// @scope-root
model BillingAccount {
  id            String         @id @default(cuid())
  subscriptions Subscription[]
  invoices      Invoice[]
}

model Plan {
  id            String         @id @default(cuid())
  code          String         @unique
  isActive      Boolean        @default(true)
  subscriptions Subscription[]
}

model Subscription {
  id               String         @id @default(cuid())
  billingAccountId String
  planId           String
  externalKey      String         @unique
  status           String
  seatCount        Int
  version          Int            @default(0)
  billingAccount   BillingAccount @relation(fields: [billingAccountId], references: [id])
  plan             Plan           @relation(fields: [planId], references: [id])
  invoices         Invoice[]
}

model Invoice {
  id               String         @id @default(cuid())
  billingAccountId String
  subscriptionId   String
  status           String
  amountCents      Int
  billingAccount   BillingAccount @relation(fields: [billingAccountId], references: [id])
  subscription     Subscription   @relation(fields: [subscriptionId], references: [id])
}
```

Terms used throughout the series:

| Term | Meaning |
|---|---|
| shape | declarative description of the args a caller may send |
| variant / caller | named key selecting which shape applies |
| forced value | server-pinned value in a shape (literal or `force(x)`) |
| client-controlled | `true` in a shape |
| scope | automatic tenant filter from `@scope-root` + guard extension |
| hook | `before` / `after` request handler on an operation or variant |

The bundled guard README is the source for guarded mutation shape rules, scope injection, upsert, and relation-write limits. The generator README is the source for HTTP write bodies, `writeStrategy`, returning-operation provider support, and transport status. The current lab reproduces the guard errors and emitted arguments cited below without executing a database query.

---

## 1. Account for every create value in the data shape

**List every required create field as client-controlled, forced, defaulted, relation-covered, or scope-injected.**

In a data shape, `true` means the client may provide the field. A literal forces a server value. `force(value)` also forces a server value and is necessary when the literal to pin is `true`, because bare `true` already means client-controlled. A function receives the field's base Zod schema and returns a client-controlled inline refinement.

```ts
import { force } from 'prisma-guard'

const createSubscriptionShape = {
  data: {
    externalKey: (base) => base.min(1).max(100),
    planId: true,
    status: 'trialing',
    seatCount: (base) => base.int().min(1).max(500),
    version: 0,
  },
  select: {
    id: true,
    externalKey: true,
    status: true,
    seatCount: true,
  },
}
```

`billingAccountId` is required by the Prisma model but absent from this shape. That is correct only when the generated scope mapping identifies it as a scope foreign key and the top-level create executes through the scope extension. Scope injects the FK into create data. The create-completeness check recognizes that source and does not require the field in the data shape.

The complete set of accepted sources for a required field is documented by the guard: a client-controlled shape entry, a forced shape entry, a Prisma default, a scope FK, a covered relation write, or an omitted field carrying `@zod .default(...)` / `.catch(...)`. If none applies, shape evaluation fails before client input is accepted.

```ts
// wrong: seatCount has no source
data: {
  externalKey: true,
  planId: true,
  status: 'trialing',
}

// right
data: {
  externalKey: true,
  planId: true,
  status: 'trialing',
  seatCount: (base) => base.int().min(1),
}
```

The equivalent lab error names the missing model field:

```text
Required field "tags" on model "Plant" is missing from create data shape, has no default, is not a scope FK, and is not covered by a relation write in the shape
```

That exact string belongs to the lab's `Plant` schema; the subscription example would name its own missing field and model.

A forced `data` field is removed from the client-facing input. The client must omit it, even when it would send the same value:

```ts
// wrong request: status is server-owned
{
  data: {
    externalKey: 'sub-42',
    planId: 'plan-pro',
    status: 'trialing',
    seatCount: 10,
  },
}

// right request
{
  data: {
    externalKey: 'sub-42',
    planId: 'plan-pro',
    seatCount: 10,
  },
}
```

Forced update fields are not defaults. They are written on every matching update call. If a field should be immutable, omit it from the update data shape. Do not force its current value unless writing that value on every update is the intended operation.

## 2. Choose the write strategy as an API response contract

**Set `writeStrategy` with both provider support and response type in view.**

`writeStrategy` is a schema-wide `prisma-generator-express` option. It controls the non-returning bulk endpoints for `createMany` and `updateMany`. It does not change `deleteMany`.

```prisma
generator express {
  provider      = "prisma-generator-express"
  target        = "express"
  writeStrategy = "regular"
}
```

| Strategy | Generated `createMany` / `updateMany` behavior |
|---|---|
| `regular` | call the normal Prisma method and return `{ count }` |
| `throwOnNonReturning` | disable those two generated endpoints; direct calls return 501 |
| `forceReturn` | call the corresponding returning method and return an array of records |

`forceReturn` is not only a performance or implementation option. It changes the response contract from a count object to an array and enables returning-method projection behavior on those routes.

Returning bulk methods are provider-dependent. The generator compatibility table lists `createManyAndReturn` for PostgreSQL, CockroachDB, and SQLite, with a minimum Prisma version of 5.14.0. It lists `updateManyAndReturn` for the same providers, with a minimum Prisma version of 6.2.0. Unsupported providers receive 501 at runtime. `forceReturn` does not bypass those limits.

`skipDuplicates` has its own provider matrix: PostgreSQL, CockroachDB, and MySQL support it in the generator table; SQLite, SQL Server, and MongoDB do not. Guard validation can pass a valid boolean through, but the database provider still decides whether the operation exists.

Use `regular` when count-only bulk writes are the intended portable contract. Use `throwOnNonReturning` when clients must move explicitly to returning endpoints. Use `forceReturn` when an array response is intentional and every deployed provider supports the required Prisma method.

## 3. Satisfy bulk safety at shape construction and request time

**Require a meaningful `where` in the shape and make every bulk request carry the `where` key.**

`updateMany`, `updateManyAndReturn`, and `deleteMany` have two independent safety checks in guarded mode.

First, the guard shape must define `where`:

```ts
// wrong
const archiveInvoicesShape = {
  data: {
    status: 'void',
  },
}

// right
const archiveInvoicesShape = {
  where: {
    status: { equals: true },
  },
  data: {
    status: 'void',
  },
}
```

A missing shape predicate throws:

```text
Guard shape requires "where" for updateMany to prevent unconstrained bulk mutations
```

The same form exists for `updateManyAndReturn` and `deleteMany` with the operation name changed.

Second, the request body must include `where`, and the resolved guarded condition must not be empty. The guard rejects omitted, empty, or vacuous filters when no forced condition remains:

```ts
// wrong
{ data: { status: 'void' } }

// wrong when shape supplies no forced predicate
{ where: {}, data: { status: 'void' } }

// right
{
  where: { status: { equals: 'open' } },
  data: { status: 'void' },
}
```

The guard message for an empty resolved filter is:

```text
updateMany requires at least one where condition
```

This is stricter than the unguarded HTTP safety statement in the generator README. At the transport layer, `{ "where": {} }` is an intentional match-all body because the key is present. Under a guard shape, validation additionally rejects a `where` that resolves to nothing.

There is one valid guarded `{ where: {} }` case: the shape itself supplies a forced condition.

```ts
const expireShape = {
  where: {
    status: { equals: 'past_due' },
  },
  data: {
    status: 'expired',
  },
}

const body = {
  where: {},
  data: {},
}
```

The forced status remains, so the resolved filter is not empty. If the shape's `where` is entirely forced and a client supplies a non-empty filter, the guard rejects that input:

```text
Guard shape where contains only forced conditions. Client where input is not accepted.
```

Thus `{}` does not mean “delete or update everything” in this guarded shape. It means “I am supplying no client predicate; execute the server predicate.”

## 4. Keep batch create data as an array

**Send an array to guarded `createMany` and configure `skipDuplicates` as request data, not as a shape permission.**

Guarded `createMany` and `createManyAndReturn` require `data` to be an array. A single object is not silently wrapped.

```ts
// wrong
{
  data: {
    subscriptionId: 'sub-1',
    status: 'open',
    amountCents: 1200,
  },
}

// right
{
  data: [
    {
      subscriptionId: 'sub-1',
      status: 'open',
      amountCents: 1200,
    },
  ],
}
```

Every array element is validated against the same data shape. Scope FKs are injected into top-level create rows when the model has a generated mapping and context is present.

`skipDuplicates` is accepted as a boolean body key for `createMany` and `createManyAndReturn` and passes through without shape-level configuration:

```ts
{
  data: [
    { subscriptionId: 'sub-1', status: 'open', amountCents: 1200 },
    { subscriptionId: 'sub-2', status: 'open', amountCents: 2400 },
  ],
  skipDuplicates: true,
}
```

Do not add `skipDuplicates` to `data` or invent a top-level shape flag for it. The method body owns it. Provider support still applies after guard validation.

Bulk create data is scalar-only at the generated route layer. Nested relation writes are not supported for `createMany` or `createManyAndReturn`. Use top-level scalar foreign keys managed by scope, separate guarded operations, or an application transaction when related records must be created together.

## 5. Model upsert as three contracts, not one data shape

**Define `where`, `create`, and `update` separately and account for scope behavior in each branch.**

An upsert shape requires all three keys. `data` is invalid.

```ts
import { force } from 'prisma-guard'

const subscriptionUpsertShape = {
  where: {
    externalKey: true,
  },
  create: {
    externalKey: true,
    planId: true,
    status: 'trialing',
    seatCount: (base) => base.int().min(1).max(500),
    version: 0,
  },
  update: {
    planId: true,
    seatCount: (base) => base.int().min(1).max(500),
  },
  select: {
    id: true,
    externalKey: true,
    status: true,
    seatCount: true,
  },
}
```

```ts
// wrong
const shape = {
  where: { externalKey: true },
  data: { seatCount: true },
}

// right
const shape = {
  where: { externalKey: true },
  create: {
    externalKey: true,
    planId: true,
    status: 'trialing',
    seatCount: true,
  },
  update: {
    seatCount: true,
  },
}
```

The guard produces an explicit construction error for the wrong form:

```text
Guard shape "data" is not valid for upsert. Use "create" and "update" instead.
```

The create half follows create completeness rules. The update half treats all data fields as optional. Forced values apply per half: a forced create status affects only inserted records; the same force copied into `update` writes that status on every matched edit.

Automatic scope also acts per branch. For a mapped model, scope adds its condition to `where`, injects the scope FK into `create`, and strips the scope FK from `update`. All required scope roots must be present for writes, regardless of `onMissingScopeContext`.

The upsert `where` uses Prisma unique-selector syntax. For `externalKey`, write `{ externalKey: true }` in the shape and `{ externalKey: 'sub-42' }` in the request. Do not use normal filter syntax such as `{ externalKey: { equals: true } }` for this unique operation.

## 6. Expose only relation writes whose ownership rule exists elsewhere

**Restrict nested writes to the smallest operation set and authorize every selector outside automatic scope.**

The guard supports several nested relation operations, including `connect`, `disconnect`, nested create, update, delete, set, connect-or-create, update-many, and upsert where valid for the relation cardinality. Support does not make all of them appropriate for a generated public endpoint.

For changing a subscription's plan, a narrow shape may expose only `connect`:

```ts
const changePlanShape = {
  where: {
    id: true,
  },
  data: {
    plan: {
      connect: {
        id: true,
      },
    },
  },
}
```

Relation selector configs are client allowlists. They are not top-level `where` shapes and do not inherit forced unique-field syntax:

```ts
// wrong
plan: {
  connect: {
    id: force(approvedPlanId),
  },
}

// right shape, with ownership checked elsewhere
plan: {
  connect: {
    id: true,
  },
}
```

Nested writes bypass automatic scope. Nested creates do not receive scope FK injection. Nested updates and deletes do not receive tenant predicates. Nested connects reference records through their unique selectors without tenant filtering.

For tenant-safe or account-safe relation writes, the guard README directs applications to validate ownership in application code, use a top-level guarded operation, or rely on database constraints such as foreign keys, row-level security, and triggers. A before-hook may reject a client-selected ID after an authorization read, but it should not rewrite the nested selector; A5 covers that boundary.

Avoid unconstrained destructive nested operations. A nested `deleteMany: {}` can delete every child related to the parent and is not independently tenant-filtered. If an endpoint only needs connect and disconnect, expose only those operations. The omission is the protection.

## 7. Express compare-and-set in `where` and inspect the write result

**Put concurrency preconditions in the mutation predicate instead of checking them in a separate read.**

An optimistic state transition can be represented as an `updateMany` whose `where` includes both identity and expected version or status.

```ts
const advanceSubscriptionShape = {
  where: {
    id: { equals: true },
    version: { equals: true },
    status: { equals: true },
  },
  data: {
    status: true,
    version: true,
  },
}
```

```ts
await prisma.subscription
  .guard(advanceSubscriptionShape)
  .updateMany({
    where: {
      id: { equals: 'sub-42' },
      version: { equals: 7 },
      status: { equals: 'trialing' },
    },
    data: {
      status: 'active',
      version: 8,
    },
  })
```

Under regular write strategy, `updateMany` returns `{ count }`. A count of zero means no row matched all preconditions; a count of one means one row did. The precondition is carried in the same Prisma mutation instead of a separate application read.

If `forceReturn` redirects the generated endpoint to `updateManyAndReturn`, the response is an array instead of `{ count }`. The application then checks array length and can request an allowed projection. This again shows why write strategy is part of the API contract.

Compare-and-set does not remove the bulk safety rules. The shape still needs `where`, the request still needs `where`, and the resolved predicate must contain a condition. Scope adds another server condition for mapped models.

The example exposes `version` in `data`, so the client computes the next version. If the server must calculate it, a plain forced literal is not sufficient for arbitrary increments. Use a purpose-built operation that expresses the required Prisma update atomically.

## 8. Separate validation failures from provider failures

**Diagnose a write at the layer that rejected it: shape construction, request validation, scope policy, Prisma, or provider capability.**

A malformed shape can fail before a request exists. A client can then fail guard validation with HTTP 400 through the generated router. Missing scope context under the safe production setting produces `PolicyError` and maps to 403. Prisma constraint failures map through the generator's documented error handling. Unsupported returning operations map to 501.

These failures need different fixes. Changing a provider will not fix a missing `where` shape. Adding a shape key will not make `updateManyAndReturn` exist on MySQL. Retrying will not repair a client that echoed a forced data field.

When reviewing a route, record four contracts together:

1. the operation and native Prisma body keys;
2. the guard shape and every forced value;
3. the scope mapping and required context;
4. the provider-dependent method and response type.

That record makes a closed write look intentional instead of mysterious.

## 9. Keep each mutation body in native Prisma argument form

**Accept only the method's documented top-level keys and put projections in the body only when the shape permits them.**

Generated write routes accept a full Prisma args object, not a model data object by itself. The outer keys vary by operation:

| Operation | Core body keys |
|---|---|
| `create` | `data` |
| `createMany`, `createManyAndReturn` | `data`, optional `skipDuplicates` |
| `update`, `updateMany`, `updateManyAndReturn` | `where`, `data` |
| `upsert` | `where`, `create`, `update` |
| `delete`, `deleteMany` | `where` |

Returning methods may also accept `select` or `include` when the guard shape defines a projection. If a mutation body requests projection while the shape defines neither, the lab reproduces status 400 with:

```text
Guard shape does not define "select" or "include" for create return projection
```

Do not flatten model fields into the body:

```ts
// wrong
{
  externalKey: 'sub-42',
  planId: 'plan-pro',
  seatCount: 10,
}

// right
{
  data: {
    externalKey: 'sub-42',
    planId: 'plan-pro',
    seatCount: 10,
  },
}
```

The HTTP body itself must be a JSON object. The generator README documents a 400 for `null`, arrays used as the outer body, or another non-object body. For Hono it gives the normalized message `{ "message": "Request body must be a JSON object" }` for malformed or non-object JSON before the generated handler.

Guarded mutation bodies reject unknown keys. That means application commands such as `sendReceipt`, `preview`, or `approvalToken` do not belong beside Prisma args. Put application control in a separate route, header, authenticated context, or purpose-built handler rather than stripping private keys in front of a generated write.

## 10. Distinguish unique mutations from bulk filters

**Use direct unique selectors for single-record writes and operator objects for bulk predicates.**

`update`, `delete`, and `upsert` consume Prisma `WhereUniqueInput`. Their guard shapes list unique fields directly:

```ts
const updateShape = {
  where: {
    id: true,
  },
  data: {
    seatCount: true,
  },
}
```

Normal bulk `WhereInput` syntax uses operator objects:

```ts
const updateManyShape = {
  where: {
    status: { equals: true },
    seatCount: { gte: true },
  },
  data: {
    status: true,
  },
}
```

Mixing them produces a shape that is wrong for the method:

```ts
// wrong for update/upsert/delete
where: {
  id: { equals: true },
}

// right
where: {
  id: true,
}
```

A unique mutation may include extra non-unique direct scalar constraints beside a unique selector. This is the documented way to add a server-owned ownership or compare condition to one record:

```ts
const updateShape = (ctx) => ({
  where: {
    id: true,
    billingAccountId: force(ctx.BillingAccount),
  },
  data: {
    seatCount: true,
  },
})
```

At least one declared unique selector is still required. The non-unique condition narrows the mutation; it does not make a non-unique `where` valid for a unique method. For compound uniqueness, use Prisma's generated compound selector object or its configured constraint name.

This distinction prevents a common repair error: seeing a bulk safety failure and copying `{ equals: true }` into an upsert. The operation families have separate shape grammars even though both keys are named `where`.

## 11. Configure scope-relation writes explicitly

**Keep `onScopeRelationWrite = "error"` unless stripping a client relation is a deliberate contract.**

For top-level writes on a scoped model, the extension owns the scalar scope FK. A request might also try to send the corresponding Prisma relation field beside the managed `billingAccountId`. The guard generator option `onScopeRelationWrite` controls that collision:

```prisma
generator guard {
  provider             = "prisma-guard"
  output               = "generated/guard"
  onScopeRelationWrite = "error"
}
```

| Value | Behavior |
|---|---|
| `error` | reject with `ShapeError`; default |
| `warn` | remove the relation field and emit a warning |
| `strip` | remove the relation field silently |

`error` makes the mismatch visible and is the easiest contract to test. `warn` and `strip` let the request succeed after removing client intent, which can conceal a frontend that still sends obsolete ownership data. They do not grant nested scope enforcement; they only resolve collision with the managed top-level relation.

Scope context is stricter for writes than for reads. In a model with multiple scope roots, every root must be present for create, update, delete, bulk mutation, and upsert. A missing root throws `PolicyError` regardless of whether `onMissingScopeContext` is configured as `warn` or `ignore`. Create receives all present root FKs, and update/delete data cannot change them through the scoped path.

Keep this distinct from a non-scope relation such as `Subscription.plan`. Automatic scope does not authorize that nested connect. Its selector still needs application or database validation.

## 12. Review every deletion path as a separate operation

**Expose single delete, bulk delete, and nested delete independently instead of treating them as one permission.**

A top-level `delete` uses a unique selector and can receive scope constraints. A top-level `deleteMany` requires a guard `where`, a request `where`, and a non-empty resolved condition. A nested delete runs through relation-write configuration and bypasses automatic top-level scope.

These paths need separate shapes and separate authorization decisions:

```ts
const invoiceConfig = {
  delete: {
    shape: {
      where: {
        id: true,
      },
    },
  },
  deleteMany: {
    shape: {
      where: {
        status: { equals: true },
      },
    },
  },
}
```

Do not infer permission for `deleteMany` from a safe `delete` shape. Do not infer permission for nested `invoices.deleteMany` from either top-level route. If a relation shape omits nested delete operations, the client cannot express them through that guarded data shape.

Whether this billing API uses state transitions or physical deletion is an application decision, not behavior supplied by either library. The library-level rule is narrower: every destructive path must be explicitly exposed and constrained in its own operation grammar.

## 13. Test emitted arguments before testing database outcomes

**Assert forced data, scope injection, and resolved predicates at the guard boundary.**

The no-database lab can prove which arguments a guarded delegate would pass to Prisma. For writes, assert at least these cases:

1. a create that omits forced fields emits them;
2. a client that sends a forced data field receives status 400;
3. a scoped create receives the scope FK while client FK input is rejected;
4. an update omitting a forced update field still writes it;
5. each bulk operation rejects a missing shape `where`;
6. an empty client `where` fails unless a forced condition survives resolution;
7. an upsert emits independent forced values in `create` and `update`;
8. a nested relation selector remains client-controlled and receives no automatic tenant filter.

Then use a real provider integration test for behavior the shape lab cannot establish: unique constraints, actual returned counts or arrays, provider support, transaction behavior, and rows affected. Do not claim the fake delegate proves a database result. It proves the mechanism immediately before Prisma execution.

Use discriminating fixtures for outcome tests. Two billing accounts should both have subscriptions that otherwise satisfy the mutation predicate. A test containing rows for only the authorized account cannot expose a missing scope condition because scoped and unscoped writes have the same visible outcome.

## 14. Make mutation return projection an explicit production choice

**Enable enforced projection when omission must not return the full written record.**

Returning mutation shapes can define `select` or `include`. By default those declarations validate only a projection the client actually sends. If a client omits projection, Prisma receives none and returns its normal full payload. This is deliberately different from reads, whose shape projection auto-applies.

For billing records, relying on every caller to request a safe field list is usually the wrong boundary. Configure the guard once:

```prisma
generator guard {
  provider          = "prisma-guard"
  output            = "generated/guard"
  enforceProjection = "true"
}
```

Then a mutation shape projection applies even when omitted from the body:

```ts
const shape = {
  data: {
    status: true,
  },
  where: {
    id: true,
  },
  select: {
    id: true,
    status: true,
  },
}
```

This setting applies to `create`, `update`, `upsert`, `delete`, `createManyAndReturn`, and `updateManyAndReturn`. It cannot add projection to count-only `createMany`, `updateMany`, or `deleteMany`.

Nested relations in mutation returns follow the same limitation as nested reads: scope is not injected into them. Enforced projection ensures the tree is present; it does not make every branch scoped. Add forced `where` to sensitive to-many branches, restrict or omit to-one branches, or rely on a stated database guarantee.

Treat changing `enforceProjection` as an API response change. Existing clients that omitted projection move from full records to the shape projection. Update contract tests and consumers together.

Projection support also follows the effective method selected by `writeStrategy`. Under `regular`, generated `createMany` and `updateMany` return counts and cannot project. Under `forceReturn`, those routes invoke returning methods, return arrays, and may use the returning shape contract. A review that reads only the route name can therefore reach the wrong conclusion about response data. Record the schema-wide strategy next to the route configuration and test the actual emitted method and response type on every supported provider.

Do not use projection to conceal an unsafe write. It limits returned data, not affected rows or accepted input. `where`, `data`, relation-operation configuration, and scope remain independent boundaries even when the response contains only `id`.

Keep one test for each boundary. A single successful response cannot prove all four, especially when fixtures do not distinguish authorized and unauthorized rows. Test every exposed write operation separately. Keep this evidence in review.

## 15. Treat Zod create defaults as server-owned values

**Review `@zod .default()` and `.catch()` fields even when they are absent from the data shape.**

The guard generator records fields with Zod default or catch directives. During create completeness checking, those fields count as having a value source. At runtime, an omitted field is evaluated with `undefined`, and the result is injected as a forced value.

This differs from a Prisma `@default`, which the database or Prisma supplies, and from a client-controlled field with an inline refine. It also differs from listing the field as `true`: when a default/catch field is client-controlled, the guard preserves Zod's omission behavior instead of wrapping the schema in a way that would swallow the default.

The API consequence is important. If a default/catch field is omitted from the shape entirely, the client cannot provide it. The generated value is server-owned even though no literal appears in the route configuration. Include it in reviews of forced write behavior and in emitted-argument tests.

Do not duplicate the same policy as a hook assignment. The generated Zod default already owns the value source and participates in create completeness. A hook that also writes it creates two definitions whose precedence is not documented as a contract.

## Rules

1. Account for every required create field in the shape or an accepted default source.
2. Omit the scope FK from client data when top-level scope injects it.
3. Treat a forced update field as a write on every matching call.
4. Choose `writeStrategy` as a response and provider contract.
5. Require `where` in both guarded bulk shapes and bulk request bodies.
6. Reject a bulk filter that resolves to no condition.
7. Send arrays to guarded `createMany` and `createManyAndReturn`.
8. Pass `skipDuplicates` as a boolean body key and check provider support.
9. Define every upsert with `where`, `create`, and `update`, never `data`.
10. Use unique-selector syntax for update, delete, and upsert `where` shapes.
11. Treat every nested relation write as outside automatic scope.
12. Expose only the nested write operations the endpoint needs.
13. Authorize relation selectors in application code or the database.
14. Put compare-and-set preconditions in `where` and inspect count or array length.

## Reproduction appendix

Run `cd lab && npm run results` to reproduce the guard-level create completeness, forced-data, bulk-shape, empty-resolved-where, forced-only-where, upsert, and scope arguments cited here. `writeStrategy`, HTTP response types, provider support, and 501 behavior come from the current generator README and require a real provider to exercise; this shape-only lab does not claim to execute them.

Documentation sources: [`prisma-generator-express` README](https://github.com/multipliedtwice/prisma-generator-express/blob/master/README.md) and [`prisma-guard` README](https://github.com/multipliedtwice/prisma-guard/blob/main/README.md).
