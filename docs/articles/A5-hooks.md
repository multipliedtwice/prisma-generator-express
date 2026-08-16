---
layout: article
article_id: A5
permalink: /articles/hooks/
---

# When configuration runs out: hooks that narrow, hooks that enrich, hooks that must not exist

Generated routes remove repeated request plumbing. They do not remove the need for application decisions. A warehouse API still has to decide whether an operator may count stock in a location, whether a transfer crosses a boundary that needs approval, and whether a completed write should trigger a downstream action.

The first question is where that decision belongs. A shape describes the Prisma arguments a caller may express. A variant chooses a shape and a set of hooks. Scope injects top-level tenant conditions. A hook runs application code before or after the generated handler. Those are different jobs.

This article uses three warehouse models:

```prisma
model Location {
  id          String       @id @default(cuid())
  warehouseId String
  code        String
  isActive    Boolean      @default(true)
  counts      StockCount[]
  outgoing    Transfer[]   @relation("TransferFrom")
  incoming    Transfer[]   @relation("TransferTo")
}

model StockCount {
  id         String   @id @default(cuid())
  locationId String
  sku        String
  quantity   Int
  status     String
  location   Location @relation(fields: [locationId], references: [id])
}

model Transfer {
  id             String   @id @default(cuid())
  sku            String
  quantity       Int
  status         String
  fromLocationId String
  toLocationId   String
  fromLocation   Location @relation("TransferFrom", fields: [fromLocationId], references: [id])
  toLocation     Location @relation("TransferTo", fields: [toLocationId], references: [id])
}
```

The examples use the Express target. Fastify hooks receive `(request, reply)`. Hono route hooks receive one context, continue by returning `void`, and short-circuit by returning a `Response` or throwing. The placement rules are the same, but the function signatures are not.

Terms used throughout the series:

| Term | Meaning |
|---|---|
| shape | declarative description of the args a caller may send |
| variant / caller | named key selecting which shape applies |
| forced value | server-pinned value in a shape (literal or `force(x)`) |
| client-controlled | `true` in a shape |
| scope | automatic tenant filter from `@scope-root` + guard extension |
| hook | `before` / `after` request handler on an operation or variant |

The generator README is the source for hook order, routing timing, target-specific short-circuit behavior, and route configuration in this article. The guard README is the source for shape syntax, scope limits, and relation-write limits. Where those documents do not define a hook behavior, this article does not promise one.

---

## 1. Put the hook in the exact phase that owns the decision

**Keep operation-wide policy outside variants, and keep caller-specific work inside the matched variant.**

For a successfully routed variant, the order is fixed:

```text
operation before-hooks
variant before-hooks
generated handler
variant after-hooks
operation after-hooks
```

An operation hook applies to every successfully routed variant for that operation. A variant hook runs only for the selected declared key. The reverse scope after the handler matters: the selected variant's after-hooks run before the operation after-hooks.

```ts
const transferConfig = {
  create: {
    before: [requireWarehouseSession],
    after: [scheduleTransferFollowUp],
    variants: {
      operator: {
        shape: operatorTransferShape,
        before: [authorizeOperatorTransfer],
        after: [notifyOperator],
      },
      supervisor: {
        shape: supervisorTransferShape,
        before: [authorizeSupervisorTransfer],
      },
    },
  },
  guard: {
    resolveVariant: (req) => req.user?.kind,
  },
}
```

For an `operator` request the sequence is `requireWarehouseSession`, `authorizeOperatorTransfer`, the create handler, `notifyOperator`, then `scheduleTransferFollowUp`. A `supervisor` request does not run either operator hook.

Caller-routing failure has a precise place in this sequence. The router resolves the raw caller and declared variant key, then runs operation before-hooks. A stored routing failure becomes HTTP 400 before any variant hook or generated handler. That permits operation-wide authentication to run consistently, but it means an operation before-hook cannot assume a variant was accepted merely because it is running.

Do not treat after-hooks as cleanup:

```ts
// wrong
const releaseLease = (_req, _res, next) => {
  lease.release()
  next()
}

const config = {
  create: {
    before: [acquireLease],
    after: [releaseLease],
  },
}
```

The generator README says a terminal response or error stops the remaining hooks in that phase and that operation after-hooks are not `finally` handlers. Progressive Express responses can also complete without running variant or operation after-hooks. Resource cleanup belongs in the code that acquired the resource, using `try`/`finally`, or in application infrastructure whose cleanup contract is independent of route after-hooks.

```ts
// right
const createTransferWithLease = async ({ acquireLease, createTransfer }, args) => {
  const lease = await acquireLease()
  try {
    return await createTransfer(args)
  } finally {
    await lease.release()
  }
}
```

This is a purpose-built application operation, not a generated operation after-hook. The code that acquires the resource directly owns the guarded work and its `finally` block.

## 2. Use a before-hook to authorize a client-chosen identifier

**Validate the same identifier the generated handler will use, and reject the request instead of rewriting it.**

A shape can allow a unique relation selector:

```ts
const transferShape = {
  data: {
    sku: true,
    quantity: (base) => base.int().positive(),
    status: 'pending',
    fromLocation: { connect: { id: true } },
    toLocation: { connect: { id: true } },
  },
  select: {
    id: true,
    status: true,
    fromLocationId: true,
    toLocationId: true,
  },
}
```

That shape answers which nested operations and selector fields the client may send. It does not prove that the selected locations belong to the operator's warehouse. The guard README explicitly warns that nested connects bypass automatic tenant scope injection. If authorization needs a database read, a before-hook can perform that read and reject a bad selection.

Keep extraction and authorization small and testable:

```ts
const transferLocationIds = (body) => ({
  from: body?.data?.fromLocation?.connect?.id,
  to: body?.data?.toLocation?.connect?.id,
})

const authorizeLocations = ({ findAllowedLocations }) => async (req, res, next) => {
  const ids = transferLocationIds(req.body)
  if (typeof ids.from !== 'string' || typeof ids.to !== 'string') {
    res.status(400).json({ message: 'Both locations are required' })
    return
  }

  const allowed = await findAllowedLocations({
    warehouseId: req.user.warehouseId,
    ids: [ids.from, ids.to],
  })

  if (allowed.length !== 2) {
    res.status(403).json({ message: 'Location is outside this warehouse' })
    return
  }

  next()
}
```

The custom 400 and 403 messages above belong to this application example; they are not generator error strings. The important boundary is structural: the hook reads the exact two selector values in the request body and either continues or terminates. It does not replace either ID, append a filter, or create a second interpretation of the request.

An authorization read followed by a write is not automatically atomic. If another transaction can change the authorization fact between the hook and the generated write, enforce the invariant with database constraints or move the read and write into a purpose-built transactional handler. A hook is suitable only when the checked fact is stable enough for that split.

## 3. Pass trusted application state through request context, not Prisma args

**Store preloaded application data in framework-local state and keep it out of the request body.**

Hooks often need the same trusted row more than once. For example, an operation before-hook may load a warehouse and a variant before-hook may check its operating state. Express exposes `res.locals` for request-local data, and the generated router itself uses it for normalized guard state.

```ts
const loadWarehouse = ({ findWarehouse }) => async (req, res, next) => {
  const warehouse = await findWarehouse(req.user.warehouseId)
  if (!warehouse) {
    res.status(403).json({ message: 'Warehouse is unavailable' })
    return
  }

  res.locals.warehouse = warehouse
  next()
}

const requireOpenWarehouse = (req, res, next) => {
  if (!res.locals.warehouse.isOpen) {
    res.status(409).json({ message: 'Warehouse is closed' })
    return
  }
  next()
}
```

Do not place `warehouse`, `approval`, or another custom control value beside Prisma arguments:

```ts
// wrong
{
  "data": { "sku": "A-42", "quantity": 3 },
  "approval": "supervisor"
}
```

Write request bodies are full Prisma argument objects. Guarded mutation bodies accept method-specific keys and reject unknown keys. An unguarded generated handler passes Prisma arguments rather than defining a second custom payload language. Headers, route parameters, authenticated request properties, and request-local framework state are the separate channels.

The same rule avoids a dangerous stripping design. A before-hook that deletes a custom key from `req.body` depends on when parsing and normalization occurred. The READMEs do not promise that mutation will become the handler's effective guarded input. Do not build a contract on undocumented sequencing. Keep the custom value outside the Prisma-args object from the start.

After-hooks are appropriate for post-handler side effects shown by the generator's own variant example, such as notification work. The documentation does not expose a portable, target-independent result value for an after-hook to transform. Therefore this article does not recommend using an after-hook to enrich returned rows. If response composition is required, use a purpose-built handler or the documented progressive-read system rather than assuming an after-hook can rewrite a response already produced by the generated handler.

## 4. Treat nested relation ownership as an application or database concern

**Do not use `force()` as if it could pin a nested `connect` selector.**

Top-level unique `where` shapes and nested relation selectors follow different validation paths. At the top level, a forced direct field may add an ownership constraint:

```ts
const updateShape = (ctx) => ({
  where: {
    id: true,
    warehouseId: force(ctx.warehouseId),
  },
  data: {
    quantity: (base) => base.int().nonnegative(),
  },
})
```

Relation-write selectors are allowlists for client-provided unique selectors:

```ts
// wrong
data: {
  location: {
    connect: { id: force(trustedLocationId) },
  },
}

// right
data: {
  location: {
    connect: { id: true },
  },
}
```

The right shape means the client chooses an ID. It does not mean the ID is authorized. The guard README gives three supported places for tenant-safe relation writes: validate ownership in application code, use a top-level guarded operation, or rely on database constraints such as foreign keys, row-level security, or triggers.

This distinction rules out a tempting hook:

```ts
// wrong
const pinLocation = (req, _res, next) => {
  req.body.data.location = { connect: { id: trustedLocationId } }
  next()
}
```

Neither README promises that rewriting the body in a before-hook changes the effective guarded args. Even if one generated version happens to observe the mutation, it creates two sources for one value and is not a documented security boundary.

Use a hook to authorize the client-selected ID when the split read/write model is acceptable. Use a custom handler when the server must construct the nested connect itself. Use a database policy when every path, including raw or non-generated writes, must enforce the ownership rule.

## 5. Keep shapes, variants, and scope out of hooks

**Express every rule in the narrowest documented mechanism that already owns it.**

Four hook patterns duplicate stronger mechanisms.

First, do not dispatch variants manually:

```ts
// wrong
const chooseShape = (req, res, next) => {
  res.locals.shape = req.header('x-api-variant') === 'supervisor'
    ? supervisorShape
    : operatorShape
  next()
}

// right
const config = {
  create: {
    variants: {
      operator: { shape: operatorShape },
      supervisor: { shape: supervisorShape },
    },
  },
  guard: {
    resolveVariant: (req) => req.user.kind,
  },
}
```

The declared variant mechanism owns exact, default, and parameterized matching and stores the declared matched key separately from the raw caller. A manual header branch does not reproduce that contract.

Second, do not rewrite a query to narrow it. Put stable conjunctions in `where`, use automatic scope for configured tenant roots, or write the complete query in a custom handler. The generator README does not present hooks as query-transform middleware.

Third, do not recreate scope in an allowlist hook. The scope extension injects top-level predicates for models with generated mappings. For nested reads and nested writes, where scope does not descend, use the explicit mitigations documented by the guard: forced `where` on to-many reads, restricted or omitted to-one projections, application authorization, or database policy.

Fourth, do not use an after-hook as `finally`. A route that terminates early may never reach it. Cleanup must be guaranteed by the owner of the resource.

These are not style preferences. Each removes a duplicate interpretation of authorization or query intent.

## 6. Keep custom request parameters outside the Prisma argument object

**Choose a separate channel for application controls instead of teaching the generated handler a private body format.**

Generated write endpoints accept the full Prisma args object. A transfer create body therefore has `data` and, when the shape permits it, a return projection. A custom flag such as `dryRun`, `approvalToken`, or `notify` is not a Prisma argument.

Good placements depend on meaning:

| Value | Suitable channel |
|---|---|
| authenticated warehouse identity | server-side request/session context |
| caller selection when client choice is allowed | configured variant header |
| resource identity present in the route | route parameter |
| state shared among hooks | `res.locals` / target-equivalent request context |
| value that changes the database query | Prisma args, represented in the shape |

If a custom command fundamentally changes the operation—preview transfer, approve transfer, cancel transfer—it is usually a different application action, not an extra boolean accepted by a generic Prisma endpoint. Give it a purpose-built route or handler. That keeps generated operations native to Prisma's argument grammar and makes the action visible in authorization review.

## 7. Test hooks as functions, then test only the router contract that matters

**Inject dependencies into hooks and assert continuation, termination, and call order directly.**

Express hooks are functions. An authorization hook does not need a listening server to prove that it looks up both IDs and rejects an unauthorized one.

```ts
const makeResponse = () => {
  const state = { status: 200, body: undefined }
  return {
    locals: {},
    status(code) {
      state.status = code
      return this
    },
    json(body) {
      state.body = body
      return this
    },
    state,
  }
}

const testUnauthorizedLocation = async () => {
  const hook = authorizeLocations({
    findAllowedLocations: async () => [{ id: 'from-1' }],
  })
  const req = {
    user: { warehouseId: 'warehouse-1' },
    body: {
      data: {
        fromLocation: { connect: { id: 'from-1' } },
        toLocation: { connect: { id: 'foreign-2' } },
      },
    },
  }
  const res = makeResponse()
  let continued = false

  await hook(req, res, () => {
    continued = true
  })

  if (continued) throw new Error('hook continued')
  if (res.state.status !== 403) throw new Error('expected 403')
}
```

This test establishes the hook's application policy. It does not establish generated router ordering. The ordering itself is documented; when your configuration depends on it, one narrow router integration test can record the observed sequence. Do not substitute a mocked hook unit test for claims about caller-routing timing or whether after-hooks run on errors.

For shape behavior, test the shape through `prisma-guard`, as the existing series lab does. For HTTP transport behavior, use a real generated router. Test boundaries separately so a green hook test cannot conceal a malformed shape.

## 8. Short-circuit in the way the selected target documents

**End a request with the target's terminal-response mechanism and do not call its continuation path afterward.**

The three generated targets expose the same before/after phases through different hook contracts. Copying an Express middleware pattern into Hono or Fastify is not a harmless typing mistake; it changes how continuation and termination are expressed.

Express uses `RequestHandler[]`. A continuing hook calls `next()`. A terminating hook sends the response and returns without calling `next()`.

```ts
const requireUser = (req, res, next) => {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' })
    return
  }
  next()
}
```

Fastify hooks receive `(request, reply)`. Sending a reply skips subsequent hooks and the generated handler. A continuing asynchronous hook returns normally.

```ts
const requireUser = async (request, reply) => {
  if (!request.user) {
    await reply.code(401).send({ message: 'Unauthorized' })
  }
}
```

Hono route hooks are generated pre/post-handler hooks, not native Hono middleware chains. A hook continues by returning `void`. It terminates by returning a `Response`, or errors by throwing. The generator README explicitly says not to use `await next()` in these route hooks.

```ts
const requireUser = async (c) => {
  if (!c.get('user')) {
    return c.json({ message: 'Unauthorized' }, 401)
  }
}
```

Throwing Hono's `HTTPException` is normalized by the router to `{ "message": err.message }` with the exception's status. A custom body attached to the exception is not preserved; return a `Response` directly when a custom response body is required.

These differences are transport contracts, not shape behavior. Keep the authorization predicate in a plain function when possible, then give each target a small adapter that terminates correctly. That preserves one policy decision without pretending the framework APIs are interchangeable.

```ts
const mayCountStock = ({ user, location }) =>
  user.warehouseId === location.warehouseId && location.isActive

const requireCountAccess = (req, res, next) => {
  if (!mayCountStock({ user: req.user, location: res.locals.location })) {
    res.status(403).json({ message: 'Stock count is not allowed' })
    return
  }
  next()
}
```

The predicate is the reusable part. The response mechanics remain target-specific.

## 9. Use a context-dependent shape before reaching for a hook

**Keep synchronous decisions based on trusted request context inside a shape function.**

`prisma-guard` supports context-dependent shapes. The same context object can carry scope-root values, a caller, and arbitrary application keys. A shape function can vary limits, forced values, or exposed fields without adding a query or mutating a request.

```ts
const stockCountShape = (ctx) => ({
  where: {
    locationId: { equals: force(ctx.locationId) },
    sku: { equals: true },
  },
  take: ctx.access === 'supervisor'
    ? { max: 500, default: 100 }
    : { max: 100, default: 25 },
  select: {
    id: true,
    sku: true,
    quantity: true,
    status: true,
  },
})
```

This is the right mechanism when all required facts already exist in stable request context. The guard README recommends `AsyncLocalStorage` as the source and requires the context function to return a plain object. Dynamic shape functions must also return a plain guard shape object. Invalid context produces `PolicyError`; an invalid function result produces `ShapeError`.

A hook is warranted when the application must perform work the shape function cannot express, most commonly a database lookup or an external authorization decision. Do not hide asynchronous work inside a shape function. The documented shape function is a resolver of shape structure from context, not an application workflow stage.

This produces a useful decision sequence:

| Question | Mechanism |
|---|---|
| Is the field always forbidden or always client-controlled? | static shape |
| Does a trusted context value choose a limit or forced value? | context-dependent shape |
| Does a named audience need a different shape or hooks? | variant |
| Is this a mapped top-level tenant condition? | scope |
| Must the application read another record before allowing the request? | before-hook or purpose-built handler |
| Must the application construct a query the shape language cannot express? | purpose-built handler |
| Must every database access path enforce the rule? | database policy or constraint |

Following the table keeps hooks small. It also prevents a hook from becoming a second, undocumented shape language.

## 10. Understand which requests can reach which hook

**Place authentication before caller-specific authorization without assuming every request reaches the generated handler.**

Route registration is the outermost boundary. Only operations listed in configuration are mounted, unless `enableAll: true` registers all. If an operation is absent, none of its hooks can run because there is no route for it.

Within a registered operation, the router first resolves caller information from `guard.resolveVariant(request)` and then the configured header, whose default is `x-api-variant`. It stores routing success or failure, applies dropped-guard projection defaults for successful routing, and runs operation before-hooks. Only after those operation hooks does it surface a routing failure as HTTP 400. Variant hooks and the generated handler do not run on that failure.

That timing supports this division:

```ts
const config = {
  create: {
    before: [requireAuthenticatedSession],
    variants: {
      operator: {
        shape: operatorShape,
        before: [authorizeOperatorAction],
      },
      supervisor: {
        shape: supervisorShape,
        before: [authorizeSupervisorAction],
      },
    },
  },
}
```

The operation hook can require an authenticated session for every attempt that reaches the registered operation. The variant hook can rely on having a selected declared variant, because routing failure stops before it. Neither fact means the generated write will run: any before-hook may still terminate, and guard validation or Prisma may fail later.

Do not send a notification that claims “transfer created” from an operation before-hook. At that point caller routing, variant authorization, validation, and database execution may still fail. Completion-dependent work belongs after successful handling or in a purpose-built transactional workflow with explicit result handling.

## 11. Review hook configuration as executable policy

**Audit every hook for scope, input source, terminal behavior, and failure semantics.**

A short hook can still be a security boundary. Review it with a fixed checklist:

1. Is it operation-wide or variant-specific, and is that placement deliberate?
2. Does it read the same request value the handler will consume?
3. Does it only validate, or does it mutate query/data arguments?
4. If it terminates, does it use the target's documented mechanism?
5. If it acquires a resource, who guarantees release when later phases fail?
6. If it performs a read before a write, can the authorization fact change between them?
7. Is the rule already expressible as a shape, context-dependent shape, variant, scope mapping, or database constraint?
8. Does the test prove the hook function, the router sequence, or both—and does it claim only that boundary?

The desired answer to mutation is normally “no.” A hook that decorates request-local application state is different from one that rewrites Prisma args. The former shares trusted facts between phases; the latter creates an undocumented query pipeline.

## 12. Keep the generated contract visible

**Do not use hooks to create behavior that the route shape and generated documentation cannot describe.**

At router construction, variant descriptors are normalized and their hook functions are removed before guard configuration, dropped-guard projection logic, progressive planning, or OpenAPI extraction. OpenAPI generation extracts shapes; it does not publish the application behavior inside hooks.

That is appropriate for authentication checks and side effects, but it creates an API-design constraint. If a hook silently makes a request parameter required, changes the meaning of a field, or treats one value as a different operation, generated documentation cannot express that private rule.

For example, a `create Transfer` hook should not reinterpret `status: "approved"` as a supervisor command. The data shape should force or allow `status` according to the variant. If approval is a separate transition with separate authorization, expose it as a separate application operation rather than hiding it in a generic create hook.

Hooks also do not register routes by themselves. Both `shape` and `variants` may be absent when an operation only needs hooks or pagination, but the operation descriptor must still exist—or be enabled through `enableAll`—for the route to be mounted. Conversely, omitting a variant entry can be an authorization decision: a caller with no matching entry and no `default` receives caller-routing failure before the generated handler.

Keep router construction errors separate from request errors. On one operation, `shape` and `variants` are mutually exclusive. A variant entry contains one shape or one context-dependent shape function; it cannot contain another named map. Reserved shape keys such as `where`, `data`, `select`, and `include` cannot be variant names. `updateEach` supports operation-wide hooks but not variants. These are configuration constraints, so no before-hook can recover from them at request time.

When a hook implements application policy that clients must know, document that policy beside the route configuration. State its input channel, termination status, and whether it runs operation-wide or only for named variants. Do not imply OpenAPI inferred it from the function.

The separation can be summarized as follows:

| Contract element | Generated description source |
|---|---|
| accepted Prisma fields and projections | shape |
| caller-specific accepted shapes | named shapes or variants |
| mounted operation and path | route configuration |
| application lookup or side effect | hand-written documentation for the hook |

If the last row changes the request grammar, the design should usually move that behavior into a visible route or shape instead.

Parameterized callers add one more reason not to reproduce routing in a hook. A raw caller such as `warehouse/42` may match the declared key `warehouse/:id`. The router stores the declared matched key separately from the raw caller, and variant hooks are selected by that declared key. A hand-written string comparison against the raw header does not implement the same precedence or ambiguity checks. When a hook needs caller identity, rely on the router's resolved variant placement or authenticated application context; do not parse path-like caller strings as if the parameter were extracted. The guard documentation states that caller parameters are routing-only and are not copied into context.

This also keeps trust decisions explicit. `resolveVariant` is the documented place to derive caller selection from a session when the client must not choose it. A variant before-hook then performs policy for the selected audience. Combining resolution and authorization inside one hook makes it unclear whether a missing match should be a caller-routing 400 or an application authorization response.

## 13. Keep hook tests active when guard validation is dropped

**Test hook policy and real shape parsing separately because dropping the guard does not drop caller routing or hooks.**

The generator defines `DROP_GUARD` as `GENERATOR_DROP_GUARD || process.env.E2E === 'true'`. In that mode, caller routing still resolves, hooks still run, and vendored helpers preserve forced values and default projection, but shape validation is absent. An end-to-end request may therefore reach the hook and generated handler even though the same body receives a guard 400 in production.

This matters when a hook test assumes the guard already normalized or rejected input. The hook should validate only its application-specific decision. A separate guard test should parse or execute the real shape with guard enabled and assert its emitted arguments or rejection.

```ts
const testLayers = async () => {
  await testUnauthorizedLocationHook()
  await testTransferShapeRejectsForcedFields()
  await testDeclaredVariantRouting()
}
```

Those tests answer different questions. The first proves the application lookup. The second proves guarded Prisma argument rules. The third proves caller selection. A green dropped-guard E2E run cannot replace the second.

Do not add compensating validation to every hook merely because one test environment drops guard. Keep production shape validation exercised directly in a unit or integration test that imports the real guard. Otherwise hook code becomes a duplicate validator and can still drift from production.

## Rules

1. Put operation-wide policy in operation hooks and caller-specific work in variant hooks.
2. Treat every after-hook as optional post-handler work, never cleanup.
3. Validate the exact identifier the handler will use and reject instead of rewriting it.
4. Keep custom state in request context, not inside Prisma arguments.
5. Do not force values inside nested relation selectors.
6. Use application authorization or database constraints for nested relation ownership.
7. Use declared variants instead of branching on the variant header in a hook.
8. Keep stable filters in shapes and tenant predicates in scope mappings.
9. Use a purpose-built handler when the server must compose a query the generated route cannot express.
10. Test hook functions directly and router sequencing at the router boundary.

## Reproduction and source appendix

Hook sequencing, variant timing, target signatures, short-circuit behavior, request-body grammar, and the absence of a `finally` guarantee come from the current `prisma-generator-express` README. Shape syntax, nested relation selector semantics, and scope limits come from the bundled `prisma-guard` README. The application-specific authorization messages and warehouse policies are examples, not library behavior.

Documentation sources: [`prisma-generator-express` README](https://github.com/multipliedtwice/prisma-generator-express/blob/master/README.md) and [`prisma-guard` README](https://github.com/multipliedtwice/prisma-guard/blob/main/README.md).
