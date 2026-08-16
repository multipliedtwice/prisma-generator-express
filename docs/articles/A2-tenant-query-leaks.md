---
layout: article
article_id: A2
permalink: /articles/tenant-query-leaks/
---

A freight platform exposes `Shipment`, `Carrier`, and `Broker` records. Every request belongs to one broker. Most tenant leaks in a query API do not begin with an exotic database bug. They begin when a rule is expressed in a place that the query executor does not consistently use.

The fixes below prefer guard shapes and automatic scope where those mechanisms cover the rule. Two cases cannot be represented by a shape: genuinely disjunctive ownership and authorization that requires a database read. Those require an application query or database policy. The point is to put each rule in a layer that actually enforces it, not to force every rule into configuration.

Terms used throughout the series:

| Term | Meaning |
|---|---|
| shape | declarative description of the args a caller may send |
| variant / caller | named key selecting which shape applies |
| forced value | server-pinned value in a shape (literal or `force(x)`) |
| client-controlled | `true` in a shape |
| scope | automatic tenant filter from `@scope-root` + guard extension |
| hook | `before` / `after` request handler on an operation or variant |

Each item has the same review sequence: symptom, wrong implementation, reason, right implementation, and a test that distinguishes the two. The emitted-argument tests use the guard because they can establish the mechanism without an HTTP server or database. Outcome-level isolation still needs integration fixtures with at least two tenants.

## 1. Accepting the broker id from the client

**Derive tenant identity from request context and force it into the executed query.**

### Symptom

A shipment list works for normal callers, but changing `brokerId` in the request returns another broker's rows. The code checks that a broker id exists, yet never establishes that it came from authenticated state.

### Wrong

```ts
const shipmentShape = {
  where: {
    brokerId: { equals: true },
    reference: { contains: true },
  },
  select: {
    id: true,
    reference: true,
    status: true,
  },
  take: { max: 100, default: 25 },
}
```

Here `true` means client-controlled. It does not mean enabled, required, trusted, or forced. The request may choose any `brokerId` that has the right scalar type.

### Right

For one explicit server value, use a context-dependent shape:

```ts
const shipmentShape = (ctx: { brokerId: string }) => ({
  where: {
    brokerId: { equals: ctx.brokerId },
    reference: { contains: true },
  },
  select: {
    id: true,
    reference: true,
    status: true,
  },
  take: { max: 100, default: 25 },
})
```

For schema-wide tenant isolation, mark the root and let the scope extension inject the FK into top-level operations:

```prisma
/// @scope-root
model Broker {
  id        String     @id @default(cuid())
  name      String
  shipments Shipment[]
}

model Shipment {
  id        String @id @default(cuid())
  reference String
  status    String
  brokerId  String
  broker    Broker @relation(fields: [brokerId], references: [id])
}
```

The guard context key is the scope-root model name:

```ts
const prisma = new PrismaClient().$extends(
  guard.extension(() => ({
    Broker: requestStore.getStore()?.brokerId,
  })),
)
```

On top-level reads, scope ANDs the broker FK into `where`. On creates, it injects the broker FK into `data`; the FK does not belong in the create data shape. On updates and deletes, it merges the condition into `where` and strips the managed FK from data. If a client sends the scope FK, validation rejects it.

### Test

Do not test only that the forced value wins. A wholly-forced top-level scalar predicate is the one lenient position: client input for that field is accepted and silently discarded. The guard lab proves that same, different, and even different-operator client values all emit the forced value.

Test the emitted predicate recursively because an unrelated client filter can cause an `AND` wrapper:

```ts
const predicates = findPredicates(args.where, 'brokerId')
expect(predicates).toContainEqual({ equals: 'broker-a' })
```

Then run an integration test with shipments for `broker-a` and `broker-b`. Request as `broker-a`, send a discriminating filter, and assert no `broker-b` row appears. That outcome test proves isolation; the emitted-argument test proves which query shape produced it.

## 2. Putting tenant scope inside `OR`

**Never use a forced shape value to express disjunctive ownership.**

### Symptom

The business rule is “a shipment belongs to this broker or is shared with this broker.” A shape author nests a forced broker condition inside `OR` and expects it to become one permitted branch. The request returns fewer rows than intended, not more, and raises no error.

### Wrong

```ts
const shipmentShape = (ctx: { brokerId: string }) => ({
  where: {
    OR: {
      sharedWithBrokerId: { equals: true },
      brokerId: { equals: ctx.brokerId },
    },
  },
  select: { id: true, reference: true, status: true },
  take: { max: 100, default: 25 },
})
```

Forced values inside `AND` and `OR` are lifted into top-level AND constraints. They always restrict and never broaden. The shape therefore cannot mean “client branch OR server branch.” For a client request using the shared branch, the broker condition still applies to the entire query.

Do not confuse that nested shape with a sibling:

```ts
const differentShape = (ctx: { brokerId: string }) => ({
  where: {
    OR: {
      sharedWithBrokerId: { equals: true },
    },
    brokerId: { equals: ctx.brokerId },
  },
  select: { id: true, reference: true, status: true },
  take: { max: 100, default: 25 },
})
```

The sibling was never inside `OR`, so it demonstrates ordinary forced merging, not lifting. The two can emit similar arguments when the client supplies an `OR`, which is why a casual test misses the distinction. The discriminating request sends no `OR`: a forced value nested inside the shape's `OR` is still emitted without an `OR` container.

### Right

Three supported designs exist. Prefer one scoping column when the data model can normalize ownership. Otherwise implement a purpose-built application query whose server-authored Prisma `where` contains the complete disjunction. The third choice is a database policy such as PostgreSQL row-level security.

```ts
const brokerVisibilityWhere = (brokerId: string) => ({
  OR: [
    { brokerId },
    { sharedBrokerIds: { has: brokerId } },
  ],
})

const listVisibleShipments = (prisma: PrismaClient, brokerId: string) =>
  prisma.shipment.findMany({
    where: brokerVisibilityWhere(brokerId),
    select: { id: true, reference: true, status: true },
    take: 100,
  })
```

This is a custom application operation, not an unguarded generated operation. Writing and issuing the query with trusted server state is what enforces the disjunction.

### Test

Seed three rows: owned, shared but not owned, and neither owned nor shared. The expected result contains the first two and excludes the third. Also assert the complete server-authored `OR` in a unit test. A forced-shape test cannot prove this rule because the guard deliberately lifts forced combinator values to AND.

## 3. Rewriting a query inside a `before` hook

**Use hooks to validate or short-circuit, not as an undocumented query-rewrite contract.**

### Symptom

A team mutates `req.body.where` in a `before` hook and assumes the generated handler will execute the modified filter. One transport path appears to narrow correctly, while another path or a later generator version does not.

### Wrong

```ts
const shipmentRoutes = {
  findMany: {
    before: [
      (req, res, next) => {
        req.body.where = {
          AND: [req.body.where ?? {}, { brokerId: req.user.brokerId }],
        }
        next()
      },
    ],
  },
}
```

The HTTP lab proves that this rewrite is transport-dependent. In its Delivery analogue, mutating `req.body.where` in the hook narrows POST `/delivery/read` from six rows to two. The same hook initializes and mutates the body on GET `/delivery`, but that request still returns all six rows. These outputs establish the behavior, not an object-identity contract inside the generated router.

That absence matters. GET reads and POST reads carry equivalent Prisma arguments through different transport representations. GET values are parsed from query parameters; POST reads receive native JSON arguments. A hook coupled to `req.body` does not even name the GET source.

### Right

Put representable predicates in a context-dependent shape or use automatic scope:

```ts
const shipmentRoutes = {
  findMany: {
    shape: (ctx: { brokerId: string }) => ({
      where: {
        brokerId: { equals: ctx.brokerId },
        status: { equals: true },
      },
      select: { id: true, reference: true, status: true },
      take: { max: 100, default: 25 },
    }),
  },
}
```

If a hook must authorize something, let it reject or terminate the request. Directly mutating `res.locals.parsedQuery` narrowed the tested POST request in the HTTP lab, but that is internal coupling and is not a documented narrowing API. A shape, purpose-built handler, or database policy states the boundary without depending on transport storage.

### Test

The lab's Delivery analogue sends the same logical filter to GET `/delivery` and POST `/delivery/read`: body rewriting returns two POST rows and six GET rows. The application test to add sends equivalent freight filters to GET `/shipment` and POST `/shipment/read`, then proves the safe Shipment policy returns the same tenant rows through both twins.

## 4. Authorizing one id while executing another

**Authorize the exact documented selector that the handler executes.**

### Symptom

A hook confirms that a carrier belongs to the current broker, but the generated operation uses a different carrier id from the Prisma body. Both values are individually valid strings. Authorization succeeds for one record and execution targets another.

### Wrong

```ts
const requireCarrier = async (req: Request, res: Response, next: NextFunction) => {
  const authorizedId = req.params.carrierId
  const carrier = await req.prisma.carrier.findFirst({
    where: { id: authorizedId, brokerId: req.user.brokerId },
    select: { id: true },
  })

  if (!carrier) return res.status(403).json({ message: 'Forbidden' })
  next()
}
```

The generated update body can still contain `where: { id: anotherCarrierId }`. The bug is not in prisma-guard. It is a time-of-check/value-of-use mismatch in application code.

### Right

When the id is just an allowed filter, keep it in one guarded `where` and let automatic scope add the broker boundary:

```ts
const carrierUpdateShape = {
  where: { id: { equals: true } },
  data: { displayName: true, dispatchEmail: true },
  select: { id: true, displayName: true, dispatchEmail: true },
}
```

The top-level update is then constrained by both the client-selected unique id and injected broker scope. If a generated write needs a separate authorization read, authorize the exact documented body selector that the generated handler will execute: `req.body.where.id`. The hook should only reject or continue; it should not hand modified Prisma arguments to the generated handler through an undocumented internal value.

This is one of the places configuration can run out. A shape can validate and force fields, but it cannot prove an external fact that requires a query. If one normalized value cannot be shared without internal mutation, use a purpose-built handler that owns both authorization and execution. Do not read one transport location for authorization and another for execution.

### Test

Send two different ids in every transport location the application accepts. The request must either reject the mismatch or execute only the id that was authorized. Include GET/POST twins for read operations and normal JSON bodies for writes. A happy-path request containing the same id everywhere does not distinguish the safe and unsafe implementations.

## 5. Dispatching variants manually from a header

**Let declared caller routing select the shape and matched key.**

### Symptom

Manual code branches on `x-api-variant`. It works for exact strings, then a parameterized key such as `broker/:id` is introduced. The raw caller is `broker/brk_123`, but the declared contract and its hooks are stored under `broker/:id`. Manual dispatch chooses a different path from the router.

### Wrong

```ts
const chooseShape = (req: Request) => {
  if (req.header('x-api-variant') === 'broker/:id') return brokerShape
  return publicShape
}
```

Parameterized matching does not replace the raw string. It selects a declared key. Exact non-blank matches run before patterns. One `:` segment matches exactly one path segment. Multiple matching patterns throw `CallerError`. A missing, blank, or unmatched caller uses `default` when present and otherwise returns 400.

### Right

```ts
const shipmentRoutes = {
  findMany: {
    variants: {
      'broker/:id': {
        shape: {
          where: { reference: { contains: true } },
          select: { id: true, reference: true, status: true },
          take: { max: 100, default: 25 },
        },
        before: [requireBrokerSession],
      },
      publicFeed: {
        shape: {
          where: { status: { equals: 'in_transit' } },
          select: { id: true, status: true },
          take: { max: 20, default: 20 },
        },
      },
    },
  },
  guard: {
    variantHeader: 'x-api-variant',
  },
}
```

The router stores the declared matched key separately from the raw caller. `broker/brk_123` selects `broker/:id`, and variant hooks use the declared key. The `:id` segment is routing-only; it is not extracted into context and does not establish broker identity. Authorization still comes from trusted session state or scope context.

### Test

Test an exact key, one parameterized match, one extra-segment failure, blank input, and two overlapping patterns. The lab records `Ambiguous caller "/shop/ferns" matches multiple patterns: "/shop/:slug", "/:section/ferns"` and `Unknown caller: "/shop/ferns/extra". Allowed: "/shop/:slug"`. Also assert that resolution reports the declared pattern rather than the concrete input.

## 6. Assuming nested reads inherit tenant scope

**Guard every nested projection as a separate access decision.**

### Symptom

A top-level `Carrier` query is scoped to one broker. Its `include.shipments` relation returns rows that were not independently tenant-filtered. The parent was safe, but the projection exposed a relation with a broader boundary than intended.

### Wrong

```ts
const carrierShape = {
  where: { id: { equals: true } },
  include: {
    shipments: true,
  },
}
```

The scope extension intercepts top-level operations only. Nested reads loaded through `include` or `select` are not automatically scope-filtered. The related row may be fixed by a parent foreign key, but returning it remains a separate projection and authorization decision.

### Right for to-many relations

```ts
const carrierShape = (ctx: { brokerId: string }) => ({
  where: { id: { equals: true } },
  include: {
    shipments: {
      where: { brokerId: { equals: ctx.brokerId } },
      select: { id: true, reference: true, status: true },
      take: { max: 50, default: 20 },
    },
  },
})
```

Forced `where` works for a to-many nested relation. It is a strict forced position: the forced key is removed from the client-facing nested schema, so a client that sends it receives 400 `Unrecognized key(s)` rather than silently overriding it.

### Right for to-one relations

Prisma does not provide a nested `where` at the same projection position for a to-one relation. There are three mitigations: omit the relation, expose only safe scalars from it, or enforce the tenant boundary in the database. Do not present a forced nested filter as an option for to-one projection.

Nested writes have the same top-level limitation in stronger form: no automatic FK injection for nested creates, no tenant condition on nested updates or deletes, and no tenant filtering on nested connects. Validate ownership in application code or rely on database constraints such as foreign keys, row-level security, or triggers.

### Test

Inspect emitted arguments through the guarded delegate because read projection defaults are applied when the query executes, not by `guard.query().parse()`. Assert that the to-many nested `where` contains the broker predicate. Then seed a relation that would reveal the missing boundary and run an outcome test. For to-one relations, assert the exact scalar key list or absence of the relation.

## 7. Maintaining an opt-in tenant allowlist

**Generate scope from schema relationships and protect every unmapped root explicitly.**

### Symptom

A custom tenant extension lists models that should receive `brokerId`. A new `ShipmentDocument` model is added but not added to the list. Its route launches without a tenant predicate because absence means unscoped.

### Wrong

```ts
const scopedModels = new Set(['Shipment', 'Carrier'])

const maybeScope = (model: string, brokerId: string, where: object) =>
  scopedModels.has(model)
    ? { AND: [where, { brokerId }] }
    : where
```

This allowlist fails open for new models. It also duplicates relationship information already present in the Prisma schema.

### Right

Mark the tenant root with `/// @scope-root`. prisma-guard generates mappings for models that have an unambiguous foreign key to that root. The request context supplies the root model's key. Top-level operations on mapped models receive automatic predicates.

This is still not universal. The scope root itself is not self-scoped. Models with no generated mapping are not scoped. Composite and ambiguous relationships follow generator policy. Inspect the generated `SCOPE_MAP` when reviewing a schema change rather than assuming every reachable model is mapped.

Protect root delegates and unmapped models with explicit route shapes, application authorization, or database policies. Do not expose a root delegate merely because its children are scoped.

### Test

Record the generated map in deterministic lab output. Compare every schema model against it. The current nursery lab, for example, records mapped `Plant` and `Order` plus unmapped `Nursery`, `Customer`, and `OrderItem`; that exact result belongs to that schema, not the freight example. For freight, the acceptance test should fail when a newly added model is neither mapped nor listed in an explicit exception file with its protection strategy.

The test is a build assertion, not telemetry. It runs against generated artifacts and produces no runtime instrumentation.

## Bonus: passing E2E after the guard was dropped

**Run security-contract tests through the real guard even when browser E2E drops it.**

### Symptom

Browser E2E passes with fields and filters that production rejects. Production then returns a 400, or the E2E suite fails to exercise validation that should protect the route.

Generated routers compute:

```ts
const DROP_GUARD = GENERATOR_DROP_GUARD || process.env.E2E === 'true'
```

When true, the router calls Prisma directly instead of `delegate.guard(...)`. Caller routing is not dropped. The generated runtime still applies forced values and default projection through vendored helpers, but it does not validate client input. That split is why an E2E request can preserve a forced predicate while still accepting an argument that the real guard rejects.

### Wrong

```ts
it('rejects a client-supplied broker field', async () => {
  process.env.E2E = 'true'
  const response = await request(app)
    .get('/shipment')
    .query({ where: JSON.stringify({ brokerId: { equals: 'broker-b' } }) })

  expect(response.status).toBe(200)
})
```

This test does not exercise guard validation and does not assert rejection. A 200 only proves what dropped mode did.

### Right

Keep transport E2E for routing and product flow, and add a focused contract test through `guard.query().parse()` or the guarded delegate:

```ts
it('rejects a forced nested broker field through the real guard', () => {
  const query = guard.query('Carrier', 'findMany', carrierShape)

  expect(() => query.parse({
    include: {
      shipments: {
        where: { brokerId: { equals: 'broker-b' } },
      },
    },
  })).toThrow('Unrecognized key(s)')
})
```

Choose a strict position when the contract says the client cannot send a forced field. The wholly-forced top-level scalar position accepts and discards client input, so expecting a 400 there tests a property the runtime does not provide. For top-level isolation, assert the emitted forced predicate and run a discriminating two-tenant outcome test.

### Test

Run the same shape through both guard entry points. The current lab labels expected agreements and differences. Forced-position validation agrees; projection auto-application differs because it happens at execution time. Pin the exact version and regenerate artifacts before treating a changed message or emitted shape as a regression.

## 9. The test matrix for seven boundaries plus the E2E control

**Make every security test distinguish the unsafe implementation from the safe one.**

A request that merely succeeds is not an isolation test. A request with no foreign fixture cannot reveal a leak. A request that sends a forced top-level value and sees the forced value win proves override behavior, not rejection. A test running only with `E2E=true` proves dropped mode, not production validation.

Use this minimum matrix. The first seven rows correspond to the seven leak boundaries; the last row is the dropped-guard test-mode control:

| Boundary | Discriminating case | Direct evidence |
|---|---|---|
| tenant identity | authenticated broker A, client mentions broker B | emitted predicate and two-tenant result |
| disjunction | owned row, shared row, unrelated row | complete server-authored `OR` and result set |
| hook usage | same read through GET and POST | `article-labs/http/` GET/POST row-count result |
| id authorization | authorized id differs from executed id | generated write rejects from `req.body.where.id`, or one purpose-built handler authorizes and executes |
| variant routing | exact, pattern, blank, unknown, ambiguous | matched declared key or exact `CallerError` |
| nested projection | parent safe, nested relation discriminating fixture | emitted nested predicate and result set |
| scope coverage | every schema model compared with generated map | deterministic generated-map assertion |
| dropped guard | same invalid payload in active and dropped modes | active rejection plus explicit dropped-mode expectation |

The table separates mechanism evidence from outcome evidence. The shape lab proves construction, validation, merged arguments, scope injection, and caller resolution. The HTTP lab covers the GET/POST hook divergence in item 3: body rewrite yields two POST rows and six GET rows, while parsed-query rewrite yields two for the tested POST request. The second result documents internal behavior, not a recommended API. Returned tenant outcomes for other freight examples still require discriminating database fixtures.

## 10. Review the boundary as one executed query

**Trace trusted identity into final Prisma arguments before reviewing convenience layers.**

The anti-patterns look different because they sit in fields, combinators, hooks, headers, projections, schema maps, and test flags. They share one question: what exact Prisma operation executes, and which trusted value restricts it?

Start with identity. Name the authenticated source of brokerId. A body field, query parameter, route parameter, or caller header is not trusted because validation accepts its type. The source may be session state, verified token claims, or server credentials. Neither generator authenticates it.

Next trace identity into policy. Automatic scope uses context key Broker and injects its mapped FK on top-level operations. A dynamic shape can force trusted broker value. A custom query can author a complete disjunction. A database policy can enforce rows independently. Review one actual enforcement path, not comments saying another layer checked it.

Then trace request into final args. Client input may be nested under combinators, merged beside forced predicates, routed by variant, or projected through include. Capture delegate args. Search predicates recursively because forced fields may be inline or AND-wrapped. NOT can be object or array. For nested to-many reads, inspect nested where rather than only root.

Review transport. GET and POST share shapes and hooks but not raw input containers. The HTTP result is concrete: the generated POST handler observed the body mutation, while GET ignored a new body and used parsed query state. Equal logical requests must produce equal policy. A mechanism depending on one transport object fails.

Review projection independently. Correct root where cannot protect a nested relation that scope does not filter. Read projection auto-applies during execution, so inspect delegated projection keys. For to-one relation, no nested where rescue exists at that position; omit it, restrict scalars, or use database policy.

Finally review mode. E2E=true removes guard validation while preserving caller routing and generated forced/default helpers. Product-flow testing in that mode cannot establish production validation. Pair it with active guard and state what each proves.

### Evidence hierarchy

No single test proves the whole boundary. Construction proves configuration builds. Parsing proves validation and forced merging. Guarded delegates prove default projection and args. HTTP proves transport, hook order, status, and twin parity. Database integration proves outcomes. Database-policy tests prove enforcement when application guard is bypassed.

Use the smallest layer that answers each claim, then add an outcome test for isolation. A high-level test can pass without identifying why. A low-level test can prove predicate without returned result. The pair is stronger.

### Upgrade review

Pin guard, generator, Prisma, and Zod. Regenerate before running. A changed message is documentation work even if security result is stable. A changed argument is security review even if integration still passes.

Current guard results record one lenient forced position, four strict positions among shapes that build, and negative relation operators rejecting forced conditions at construction. They also record projection differences between parsing and execution. These are version-specific.

The HTTP hook result is also version-specific. It does not recommend mutating parsedQuery. It establishes that raw body rewriting is not transport-neutral. Re-run GET and POST after generator upgrades.

### Failure interpretation

Interpret a failure at its layer. A ShapeError during configuration means no request can safely exercise that shape. CallerError means routing did not select a declared contract. PolicyError under missing scope context means tenant policy rejected before the query completed. A Prisma error after delegated args were correct belongs to execution or data, not shape construction.

Successful output also needs interpretation. A forced top-level broker predicate accepting hostile client input is expected lenient behavior when the emitted value is still trusted. The equivalent field inside nested relation where is strict and client input rejects. A green test must state whether it proves override, rejection, or outcome isolation.

For combinators, compare intended Boolean expression with emitted expression. “No leaked row” is not enough when a lifted force accidentally removes rows that should be shared. The owned/shared/unrelated fixture distinguishes correct disjunction from restrictive conjunction. Availability failures matter even when confidentiality remains intact.

For caller routing, compare raw caller and matched key. A parameterized segment is not extracted identity. The session must still establish Broker. Ambiguous patterns should fail before variant hooks or handler. default should be reviewed as permission for all missing and unmatched callers, not merely a convenient branch.

For scope coverage, treat the generated map as evidence rather than inferring from relation chains. A model reachable through Shipment may still lack a direct root mapping. Every absent mapping needs either no exposed route or an explicit policy.

For dropped E2E, record the mode in test names. A test called “guard rejects” that runs with E2E=true is false documentation even when its product flow passes. Run validation claims under active guard and keep dropped-mode tests limited to the behavior they actually exercise.

### Publication checklist

Before publishing, answer:

- Which authenticated value names the broker?
- Which predicate or database policy enforces it?
- Is the model present in generated scope mapping?
- Are root and unmapped operations protected?
- Does every caller use declared routing?
- Do GET and POST apply identical policy?
- Does each nested relation have a projection decision?
- Are relation writes protected outside top-level scope?
- Does active guard run independently from dropped E2E?
- Do two-tenant fixtures make a leak observable?

An unanswered item is an unknown boundary. Record the application or database mechanism that closes it. Never claim the generator covers more than its README and harness establish.

Keep the review artifact beside route configuration. When Shipment gains a relation, operation, or audience, update the matrix before release. When Broker relationships change, regenerate scope mappings. When a client adopts POST reads, repeat parity tests. When E2E mode changes, rerun active validation independently.

The acceptance criterion is not “all requests passed.” Each trusted broker value needs one identified source, one enforcement path, one direct argument assertion, and one outcome test with a foreign fixture. Every projection needs an explicit key list. Every unmapped model needs an explicit decision. Every caller needs a declared match or intentional rejection.

Keep negative controls beside positive ones. Remove broker context and expect policy rejection. Send a foreign broker field and inspect the forced result. Remove the nested predicate and prove the fixture would leak. Send a concrete caller that matches no declared pattern. Run the same logical read over GET and POST. Repeat the invalid request with active guard and dropped guard so the difference is explicit.

These controls prevent a fixture, fallback, or transport default from making the safe path look effective. Each one changes exactly one boundary while holding the rest constant. When it does not change the result, investigate whether the test can actually observe the claimed protection.

This record clearly distinguishes library guarantees from application choices. Shapes enforce declared Prisma arguments. Scope intercepts documented top-level mapped operations. Hooks have documented order but not a universal rewrite API. Database policy enforces only what the database defines. Keeping boundaries separate prevents one correct feature from being cited as protection in another layer. Re-run every discriminating case after dependency upgrades, using the same fixtures and both read transports.

## Rules

1. Derive tenant identity from trusted context, never from a client-controlled shape field.
2. Assert the emitted tenant predicate recursively because guard merging may add `AND` wrappers.
3. Never use forced values inside `OR` to express disjunctive ownership; they lift into AND constraints.
4. Implement genuine server-authored disjunctions in one scoping column, a purpose-built application query, or a database policy.
5. Use hooks to validate or terminate requests, not as an undocumented query-rewrite contract.
6. For generated writes, authorize `req.body.where.id` and only reject; otherwise let one purpose-built handler authorize and execute.
7. Let named and parameterized caller routing choose variants instead of branching on raw headers.
8. Treat parameter segments as routing-only values, not extracted authorization context.
9. Guard nested to-many reads with forced `where` and handle to-one relations by omission, safe scalars, or database policy.
10. Never assume tenant scope descends into nested reads or nested writes.
11. Generate scope mappings from schema relationships and review unmapped models explicitly.
12. Protect scope-root delegates with a route shape, application authorization, or database policy.
13. Keep real-guard contract tests even when browser E2E uses `E2E=true`.
14. Test top-level forced predicates for override and strict forced positions for rejection.
15. Use discriminating multi-tenant fixtures for every outcome-level isolation test.
