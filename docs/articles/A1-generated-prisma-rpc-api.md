---
layout: article
article_id: A1
permalink: /articles/generated-prisma-rpc-api/
---

# A whole product API without writing an endpoint: Prisma + generated RPC routes

This tutorial builds the API boundary for an online plant nursery. Prisma describes the data. prisma-generator-express emits model routers. prisma-guard emits validation and tenant-scope artifacts. The application still assembles Express, authenticates requests, supplies scope context, and chooses route configuration, but it does not hand-write CRUD endpoint handlers.

The result is a public plant catalog plus a seller API. Both use one generated Plant router and different named shapes. Public callers search published plants and receive a small projection. Sellers see inventory for their nursery and create plants whose publication state is pinned by the server. Tenant identity comes from authenticated request context, not the body.

Terms used throughout the series:

| Term | Meaning |
|---|---|
| shape | declarative description of the args a caller may send |
| variant / caller | named key selecting which shape applies |
| forced value | server-pinned value in a shape (literal or `force(x)`) |
| client-controlled | `true` in a shape |
| scope | automatic tenant filter from `@scope-root` + guard extension |
| hook | `before` / `after` request handler on an operation or variant |

All library behavior stated here comes from the current generator and guard READMEs, the pinned shape lab, or the PostgreSQL HTTP lab. The text distinguishes emitted-argument evidence from executed HTTP and database evidence.

## 1. Describe the boundary in Prisma

**Mark the tenant root and put field validation beside the governed fields.**

Nursery is the tenant root. Plant and Order each have one unambiguous FK to it, so guard can map them to Nursery. Customer and OrderItem have no direct nursery FK and are not automatically scoped.

~~~prisma
generator client {
  provider = "prisma-client-js"
}

generator guard {
  provider          = "prisma-guard"
  output            = "../generated/guard"
  enforceProjection = "true"
}

generator express {
  provider = "prisma-generator-express"
  target   = "express"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

/// @scope-root
model Nursery {
  id     String  @id @default(cuid())
  name   String
  plants Plant[]
  orders Order[]
}

model Plant {
  id          String   @id @default(cuid())
  /// @zod .min(1).max(120)
  name        String
  /// @zod .max(2000)
  description String?
  priceCents  Int
  isPublished Boolean  @default(false)
  tags        String[]
  createdAt   DateTime @default(now())
  nurseryId   String
  nursery     Nursery  @relation(fields: [nurseryId], references: [id])
  orderItems  OrderItem[]
}

model Customer {
  id     String  @id @default(cuid())
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
~~~

The @scope-root marker identifies Nursery as a context root. It does not make direct Nursery delegate calls self-scoping. Protect root operations with an explicit shape, application authorization, or a database policy.

The two @zod chains apply when name or description is client-controlled in a data shape. Guard validates directive syntax during generation. An inline refine is a full replacement for that field's @zod chain, not an additional rule.

Scope follows generated relationships, not reachability. The committed lab records Plant and Order as mapped and Nursery, Customer, and OrderItem as unmapped. Review SCOPE_MAP whenever relationships change.

Plant tags has no default. A create shape must account for it. Required fields may come from the client, a forced shape value, a Prisma default, scope FK injection, a relation write, or a recognized @zod default/catch.

## 2. Generate every artifact together

**Run Prisma generation after every schema or generator change.**

Install the documented packages, then run:

~~~bash
npx prisma generate
~~~

Prisma invokes all generators. The client generator emits the database client. Guard writes the extended-client helper, model metadata, validation chains, and scope map. Express writes model routers and helpers such as encodeQueryParams.

Generated directories preserve model casing. Plant remains Plant on disk, while the URL segment is flat lowercase /plant. OrderItem becomes /orderitem, not /order-item. Underscores are preserved; camel-case boundaries are not.

Generation is a build step. A schema change can alter completeness checks, field maps, @zod validation, relations, scope mapping, routes, and OpenAPI output. Never diagnose new source against stale generated files.

The generators solve separate problems. Express emits transport adapters and handlers. Guard emits argument boundaries for the extended client. A guarded route needs both. If the route receives an unextended Prisma client, the generator README documents a 500:

~~~text
Guard shapes require prisma-guard extension on PrismaClient. Install: npm install prisma-guard, then extend your client with guardExtension().
~~~

That is server wiring failure, not client validation failure. Do not hide it behind an unguarded fallback.

## 3. Mount one model router

**Attach the extended client before mounting guarded routes.**

Express needs JSON parsing before writes and POST reads. It also needs stable request context. Guard recommends AsyncLocalStorage because context may be read during caller routing, shape resolution, and scope injection.

~~~ts
import { AsyncLocalStorage } from 'node:async_hooks'
import express from 'express'
import { PrismaClient } from '@prisma/client'
import { guard } from './generated/guard/client'
import { PlantRouter } from './generated/Plant/PlantRouter'
import { plantRoutes } from './plantRoutes'

type RequestContext = {
  nurseryId: string
  audience: 'public' | 'seller'
}

const requestStore = new AsyncLocalStorage<RequestContext>()
const prisma = new PrismaClient().$extends(
  guard.extension(() => {
    const context = requestStore.getStore()
    return {
      Nursery: context?.nurseryId,
      caller: context?.audience,
    }
  }),
)

const app = express()
app.use(express.json())
app.use((req, res, next) => {
  const session = requireSession(req)
  requestStore.run(
    { nurseryId: session.nurseryId, audience: session.audience },
    () => {
      req.prisma = prisma
      next()
    },
  )
})
app.use('/', PlantRouter(plantRoutes))
app.listen(3000)
~~~

This project layout keeps the route shapes shown below in `plantRoutes.ts`; the generated import paths match the generator README's default examples. A project that configures different generator outputs must change these imports to match its own directories.

requireSession is application code, not a library API. It must derive nursery identity from trusted state. A raw tenant header is client-controlled and is not a boundary.

caller selects a named shape. Nursery supplies scope context. The guard README says caller is not used for scoping. Context keys matching root model names supply scope.

Only configured operations register unless enableAll is true. enableAll is useful for exploration but should not replace an exposure review. updateEach is opt-in even under enableAll and bypasses guard shapes.

The generated Plant surface is:

| Operation | Method | Path |
|---|---:|---|
| findMany | GET | /plant/ |
| findMany | POST | /plant/read |
| findFirst | GET or POST | /plant/first |
| findFirstOrThrow | GET or POST | /plant/first/strict |
| findUnique | GET or POST | /plant/unique |
| findUniqueOrThrow | GET or POST | /plant/unique/strict |
| findManyPaginated | GET or POST | /plant/paginated |
| count | GET or POST | /plant/count |
| aggregate | GET or POST | /plant/aggregate |
| groupBy | GET or POST | /plant/groupby |
| create | POST | /plant/ |
| createMany | POST | /plant/many |
| createManyAndReturn | POST | /plant/many/return |
| update | PUT | /plant/ |
| updateMany | PUT | /plant/many |
| updateManyAndReturn | PUT | /plant/many/return |
| upsert | PATCH | /plant/ |
| delete | DELETE | /plant/ |
| deleteMany | DELETE | /plant/many |

findMany alone needs /read for its POST twin because POST /plant/ is create. Other read twins share paths. addModelPrefix false removes the model segment; customUrlPrefix replaces it.

## 4. Define the public catalog

**Expose only searchable published plants and make the safe projection the default.**

~~~ts
import { force } from 'prisma-guard'

const publicPlantList = {
  where: {
    name: { contains: true, mode: 'insensitive' },
    isPublished: { equals: force(true) },
  },
  select: {
    id: true,
    name: true,
    description: true,
    priceCents: true,
    tags: true,
  },
  orderBy: {
    name: true,
    priceCents: true,
    createdAt: true,
  },
  take: { max: 50, default: 20 },
  skip: true,
}
~~~

true means client-controlled. The client supplies contains, allowed orderBy, and optional skip.

The literal insensitive is forced. A `mode: true` shape lets the client choose and lets omission remain case-sensitive. Audit actual clients before selecting either. The pinned guard lab records the strict failure:

~~~json
{
  "where": {
    "name": { "contains": "fern", "mode": "insensitive" }
  }
}
~~~

~~~text
400 Invalid query on model "Plant": where.name: Unrecognized key(s): mode
~~~

Boolean true needs force(true), because bare true is the sentinel. A forced scalar must sit inside an operator. equals: force(true) is valid; force(true) as the whole field is not.

Read projection has two jobs: whitelist a requested projection and supply a default when omitted. Auto-application happens during guarded execution. guard.query().parse() does not show it; the guarded delegate does.

take permits values within max and emits default on omission. max without default leaves omission unchanged. The router pagination maximum can still cap take even under a guard shape.

The top-level forced publication predicate is lenient. Client input for that wholly-forced scalar is accepted and overwritten. Test the emitted predicate, not a nonexistent rejection.

## 5. Add a seller audience

**Select a second shape instead of duplicating the endpoint.**

~~~ts
const sellerPlantList = {
  where: {
    name: { contains: true, mode: 'insensitive' },
    isPublished: { equals: true },
  },
  select: {
    id: true,
    name: true,
    description: true,
    priceCents: true,
    isPublished: true,
    tags: true,
    createdAt: true,
  },
  orderBy: {
    name: true,
    priceCents: true,
    createdAt: true,
  },
  take: { max: 200, default: 50 },
  skip: true,
}

const plantRoutes = {
  findMany: {
    shape: {
      public: publicPlantList,
      seller: sellerPlantList,
    },
  },
  guard: {
    resolveVariant: () => requestStore.getStore()?.audience,
    variantHeader: 'x-api-variant',
  },
}
~~~

resolveVariant wins over the header. If it returns seller, a browser cannot switch by changing x-api-variant. If it returns undefined, header fallback runs. Derive privileged callers from authenticated state.

A named map without default is closed. Missing or unknown callers become 400 CallerError. default catches missing, blank, and unmatched callers, so add it only when that fallback is safe.

Variant and scope are separate. The seller shape defines arguments and projection. Nursery context defines tenant rows. Both apply.

Use shape maps when only routing differs. Use variants maps when matched keys need hooks. shape and variants are mutually exclusive per operation.

## 6. Add seller create

**List client fields, force server fields, and omit the scope FK.**

~~~ts
const sellerPlantCreate = {
  data: {
    name: true,
    description: true,
    priceCents: true,
    tags: true,
    isPublished: false,
  },
  select: {
    id: true,
    name: true,
    description: true,
    priceCents: true,
    isPublished: true,
    tags: true,
    createdAt: true,
  },
}

const plantRoutes = {
  findMany: {
    shape: {
      public: publicPlantList,
      seller: sellerPlantList,
    },
  },
  create: {
    shape: {
      seller: sellerPlantCreate,
    },
  },
  guard: {
    resolveVariant: () => requestStore.getStore()?.audience,
    variantHeader: 'x-api-variant',
  },
}
~~~

name, description, priceCents, and tags are client-controlled. @zod applies to name and description. isPublished false is forced. nurseryId is absent: scope injects it and completeness accounts for it.

Plant requires tags because it has no default. Omitting tags from the shape fails completeness. Description is nullable, so the request may omit it.

Public has no create shape and cannot route to seller. Forced data is strict. This client request is rejected by the pinned guard lab:

~~~json
{
  "data": {
    "name": "Fern",
    "description": "Shade plant",
    "priceCents": 1200,
    "tags": ["shade"],
    "isPublished": false
  }
}
~~~

~~~text
400 Invalid data for create on model "Plant": Unrecognized key(s): isPublished
~~~

The client must omit `isPublished`. This differs from lenient top-level forced `where`.

Mutation projection differs from reads. By default it validates only a client-requested projection, and omission returns Prisma's full mutation record. This tutorial sets enforceProjection to true in the guard generator, so the create projection is always synthesized and applied.

## 7. Encode GET and use POST for large reads

**Use encodeQueryParams for GET and native JSON for POST.**

~~~ts
import { encodeQueryParams } from './generated/client/encodeQueryParams'

const params = encodeQueryParams({
  where: { name: { contains: 'fern' } },
  orderBy: { priceCents: 'asc' },
  take: 20,
})
const response = await fetch('/plant?' + params, {
  headers: { 'x-api-variant': 'public' },
})
~~~

The encoder serializes complex arguments and handles BigInt. One encoder avoids dependence on uneven coercion. The lab shows numeric/date field strings can coerce, while Boolean string input and string take passed directly to guard reject.

For a large filter:

~~~ts
const response = await fetch('/plant/read', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-variant': 'public',
  },
  body: JSON.stringify({
    where: {
      name: { contains: 'fern' },
      tags: { hasSome: ['shade', 'pet-safe'] },
    },
    orderBy: [{ priceCents: 'asc' }, { name: 'asc' }],
    take: 20,
  }),
})
~~~

POST bodies use native JSON and bypass GET parsing. No string coercion applies. GET and POST use the same shape, hooks, and middleware. POST reads are enabled by default and disabled globally by disablePostReads.

POST solves argument size, not authorization. It must select the same caller and scope.

## 8. Align frontend route and cache identity

**Derive the variant once and cache by variant and tenant.**

~~~ts
const plantAudienceForPage = (pathname: string) =>
  pathname.startsWith('/seller/') ? 'seller' : 'public'

const plantQueryKey = (input: {
  url: string
  params: Record<string, object | string | number>
  variant: 'public' | 'seller'
  nurseryId: string
}) => [
  'plant',
  input.url,
  input.params,
  input.variant,
  input.nurseryId,
]
~~~

This cache key is application design. Variants can return different projections for one operation, and scope can return different tenant rows. Ignoring either conflates response contracts.

Keep route mapping centralized and do not duplicate permissions in the frontend. The shape remains authoritative. Route-derived caller is selection, not authorization.

Resolve seller and nursery state before server-side fetches. Invalidate browser cache when nursery changes. Never rely on cache partitioning for tenant isolation; backend guard scope remains mandatory.

## 9. Add one filter end to end

**Add one shape key and one client field for a supported filter.**

Add priceCents: { lte: true } to publicPlantList.where. Then send:

~~~ts
const params = encodeQueryParams({
  where: {
    name: { contains: 'fern' },
    priceCents: { lte: 3500 },
  },
  take: 20,
})
~~~

No endpoint handler, DTO, query translator, or response mapper changes.

This count applies only when the Prisma field already exists and the operator is supported. A new field, index, UI, validation rule, or documentation entry adds work.

Test the request through real guard. Assert the emitted lte and rejection of an unlisted operator. Walk AND, OR, and NOT when finding forced predicates because merge position depends on client input.

## 10. Know where configuration stops

**Move rules requiring external facts into application code or the database.**

Shapes cover allowed args, forced scalar conditions, projection, limits, validation, caller contracts, and top-level scope. They do not cover everything.

Forced values inside AND and OR lift to top-level AND, so they cannot express genuine disjunctive visibility. Use one normalized scope column, a server-authored query, or database policy.

Nested reads do not inherit scope. Forced nested where works for to-many. For to-one: omit the relation, expose safe scalars, or enforce the database boundary. Nested writes bypass scope.

Hooks fit authorization requiring a read, request-local prefetch/state, documented post-handler side effects, or application handling of nested relations. The READMEs do not expose one portable result-transformation API, so this tutorial does not promise response rewriting. Hooks do not replace routing or scope. After-hooks are not guaranteed cleanup.

Raw SQL bypasses guard. Roots do not self-scope. An operation with neither shape nor variants calls Prisma unguarded.

E2E=true drops guard validation. Caller routing remains, and generated helpers still apply forced values and default read projection. Keep real-guard contract tests.

## 11. Test each layer

**Distinguish generated arguments, HTTP transport, and returned outcomes.**

For public list, assert caller, allowed filters, forced publication, injected nurseryId, and applied projection.

For seller, verify caller separately from tenant. onMissingScopeContext error is the safe production setting. warn/ignore can let reads proceed with partial scope; writes still reject missing roots.

For create, verify completeness, @zod, forced publication, injected nursery FK, and projection policy. Sending nurseryId or isPublished should reject.

For clients, verify GET encoding, POST JSON, caller identity, and cache partitioning. A 200 alone is not proof. Shape lab establishes args; HTTP tests establish transport; two seeded nurseries establish outcome isolation.

Pin versions and regenerate before interpreting diffs. Current lab versions are prisma-guard 1.33.0, Prisma 6.19.3, and Zod 4.4.3.

## 12. Review operation exposure before enabling it

**Register only operations the product intends to support.**

The route table describes capability, not a recommended public surface. A catalog often needs findMany, findFirst, findUnique, count, and selected seller writes. It may not need aggregate, groupBy, bulk mutation, or delete at all. When an operation is absent from config and enableAll is false, the router does not register it. That is a stronger and simpler result than registering an operation and hoping every caller fails later.

Review each write independently. createMany and updateMany behavior can change under the schema-wide writeStrategy option. regular uses Prisma's normal non-returning methods and returns count. throwOnNonReturning disables those generated endpoints and direct calls return 501. forceReturn invokes returning counterparts and returns record arrays where the provider supports them. It does not change deleteMany. This tutorial does not need those strategies, so it should not enable bulk writes accidentally.

Bulk update and delete need their own safety review. Guard requires a where key in the shape for updateMany, updateManyAndReturn, and deleteMany. It also rejects an omitted or resolved-empty runtime where. A body where object that resolves to a forced condition is not unconstrained. Conversely, the generator's unguarded transport rule that accepts an intentional empty object must not be mistaken for guarded behavior. The shape and the executed guard determine the final predicate.

findUnique on scoped models also needs policy. The guard generator defaults to rejecting scoped findUnique in its documented configuration because extension mode cannot simply append arbitrary scope to a unique lookup. The documented alternative is findFirst with scoped where, or verify mode with its additional read. The current lab has not exercised verify mode, so this tutorial does not depend on it.

The public catalog can start with findMany and count. The seller API can add create and update only after their shapes exist. This incremental registration makes the code review answer concrete: every route exists because a complete config entry requested it.

## 13. Read the shape as a complete contract

**Review client control, forced state, projection, and limits separately.**

The public list shape contains four distinct policy kinds. name.contains is client input. name.mode is server-pinned behavior. isPublished is a forced boundary. select is output policy. take and skip are resource-control policy. They happen to live in one object, but each needs a different test.

Client-control tests send accepted and rejected keys. A shape allows only configured fields and operators. It is not enough to send one happy value; send a sibling field that should be absent and assert the 400. For mode, test omission and explicit input because forced and client-controlled configurations differ exactly on those requests.

Forced-state tests inspect final args. When the client filters another field, forced where commonly becomes an AND branch. When the client touches the same field, force may merge flat into that operator. Forced values inside AND and OR lift into top-level AND. Forced NOT is kept as a separate logical branch and can change from object to array when the client also sends NOT. A recursive predicate search is more stable than indexing args.where.isPublished.

Projection tests use guarded execution or resolve planning, not parse alone. The lab verifies that parse returns no synthesized select while the delegate receives the default select. A client may narrow within the whitelist, but it cannot widen beyond it. The public projection should have an exact-key canary test so adding a Prisma field does not silently expose it.

Limit tests cover omission, boundary, and overflow. With max 50 and default 20, omission becomes 20, a permitted value remains, and a value above 50 rejects. If the router also has pagination.maxLimit, test the combined policy at HTTP level because the shape-only lab cannot observe the generated router's final cap.

Create deserves a different checklist. Confirm every required field source. Confirm forced data is absent from the client schema. Confirm scope FK injection. Confirm validation on client-controlled data. Confirm the mutation projection setting instead of copying assumptions from reads.

This decomposition keeps one compact shape from becoming one opaque security claim. Each key is evidence for one boundary, and each boundary receives a discriminating request.

## 14. Treat tenant scope as generated query policy

**Verify both mapped and unmapped models instead of assuming global tenancy.**

Marking Nursery as root does not make every model in the graph tenant-aware. The generator follows unambiguous foreign keys. Plant and Order carry nurseryId and are mapped. Customer represents a purchaser who may interact with several nurseries and has no direct mapping. OrderItem reaches Plant and Order through relations but has no direct Nursery FK. Direct operations on those unmapped models receive no Nursery predicate from scope.

This has product consequences. A public Plant list is automatically restricted after Nursery context is supplied. A direct Customer list needs an explicit access policy. A direct OrderItem list needs either a new direct scoping column, a custom server-authored query through its parent, explicit application authorization, or database policy. Choosing one is a data-model decision, not a router flag.

Scope roots need protection too. Nursery findMany is not narrowed merely because Nursery bears @scope-root. Exposing it could reveal every tenant root. The correct options are an explicit route shape that forces a safe condition, application authorization, or database policy. If the operation is unnecessary, do not register it.

Nested projections are another boundary. A top-level scoped Plant query may include relations, but scope does not descend into include or select. A to-many relation can have forced nested where in its shape. A to-one relation cannot use that same projection filter; omit it, restrict its scalars, or rely on database policy. This applies to relations returned from mutations too.

Missing context policy is part of isolation. error rejects missing context on reads and writes. warn and ignore allow reads to proceed with whatever partial scope is available while writes still reject missing roots. A production API that depends on tenant isolation should use error. A test should remove Nursery context deliberately and assert PolicyError 403 rather than only testing the normal session.

Scope also manages mutation FKs. It injects nurseryId on create, merges the predicate on update and delete, strips the managed FK from write data, and handles upsert across where, create, and update. None of that reaches nested writes. Relation writes need application or database enforcement.

## 15. Keep generated HTTP behavior and guard behavior distinct

**Attribute every observed behavior to the layer that produced it.**

The generated router decides paths, methods, GET parsing, POST body handling, caller extraction, hook order, Prisma client lookup, and HTTP error mapping. Guard decides shape construction, validation, forced-value merging, default read projection, scope injection, and guarded method execution. Prisma and the database decide whether the final query is supported and what rows it returns.

This separation prevents bad diagnoses. A missing caller is caller routing, not a Zod field error. An unrecognized forced data key is guard validation, not Express JSON parsing. A 500 about the absent guard extension is route wiring. A 404 is transport not-found mapping. A tenant row appearing despite correct emitted scope needs database-fixture investigation, while a missing scope predicate is already visible before execution.

The shape lab deliberately avoids a database engine. It builds DMMF-backed shapes, calls both guard entry points, captures errors, and inspects delegated args. The separate HTTP lab runs generator 1.64.4 with guard 1.33.0, Prisma 6.19.3, Node 22.14.0, and PostgreSQL 16.6. It reproduces GET/POST read equality for one filter and the POST native-type boundary: string `take` returns 400. The recorded equality proves that one pair produced the same body against seeded PostgreSQL; it does not prove every operation or arbitrary input. The full route table and encoder rules remain generator-README sourced. Neither result should be widened into claims the recorded cases do not establish.

The HTTP lab also records the transport-dependent hook trap relevant to generated read twins: rewriting `req.body.where` narrowed POST but not GET. This tutorial therefore keeps tenant predicates in shapes and scope rather than raw body hooks. That is observed evidence for the design choice, not a claim that all hooks behave identically.

For this tutorial, a publishable verification packet contains the generated SCOPE_MAP, active guard version, emitted args for public list and seller create, caller-resolution cases, exact projection keys, and a two-nursery integration result from the consuming application. The first five are reproducible in the current lab style. The last requires a real database.

This evidence also makes upgrades reviewable. Regenerate, rerun, inspect the result diff, and revisit only the article claims attached to changed lines. Do not rely on remembered defaults across versions.

## 16. Prepare the generated API for publication

**Publish the contract only after docs and runtime use the same router configuration.**

Each generated router registers OpenAPI JSON and YAML endpoints outside production. The generator also emits documentation helpers that the application mounts manually. Runtime paths and spec paths depend on addModelPrefix, customUrlPrefix, and the base-path configuration, so pass the same route config to documentation helpers. A client document showing /plant while the deployed router uses a custom prefix is not a harmless presentation defect; it describes a different API.

POST read endpoints appear in OpenAPI when enabled. Their request bodies use native JSON argument types. If disablePostReads is true, remove client examples that use /plant/read. Do not document an endpoint that configuration did not register.

Document caller selection beside every named operation. The default header is x-api-variant, but this tutorial uses resolveVariant for trusted seller selection. A public SDK may still expose the public caller, yet it must not imply that a browser header grants seller access. If variantHeader changes, update frontend fetch code, examples, and integration tests together.

Document the response projection from the shape rather than from a sampled database row. A sample row can omit nullable fields or relations and cannot establish the whitelist. Read shapes auto-apply their projection, so the shape is the actual default read contract. Mutation examples need a separate statement because projection is optional unless enforceProjection is enabled.

Document errors by layer. ShapeError and CallerError map to 400, PolicyError to 403, and generated responses use a message object. The generator also maps not-found, conflict, unsupported provider behavior, and pool timeout to its documented statuses. Do not invent exact text for a transport error that has not been captured or stated upstream.

Before release, run generation from a clean dependency install, run guard verification, boot the real router against the intended database, and exercise public and seller calls with two nursery fixtures. Confirm that the public request cannot widen projection, that seller cannot cross nursery scope, that create ignores no missing required field, and that POST /plant/read matches the GET contract.

Finally, review generated files as artifacts, not hand-edited source. Schema and route config are the authored contract. Manual changes under generated directories disappear on the next generation and create a false review trail. If the generator cannot express a required operation, place that operation in explicit application code and document the boundary instead of patching emitted handlers.

The release checklist should name ownership. Schema owners approve relationships, defaults, and annotations. API owners approve registered operations, callers, shapes, hooks, and prefixes. Security reviewers approve context derivation, scope mappings, unmapped models, nested relations, raw SQL boundaries, and database policies. Client owners approve encoding, POST-read usage, variant selection, and cache identity. Test owners keep emitted-argument assertions separate from transport and outcome assertions.

This division does not add runtime machinery. It prevents one green request from standing in for five independent contracts. A generated API reduces repeated endpoint code; it does not remove the need to review what was generated and how configuration selects it.

Keep the publication example pinned to exact dependency versions. If a future guard release changes forced merging, caller messages, projection planning, or scope policy, the article must change with its recorded output. If a generator release changes paths or transport parsing, the HTTP examples must change with its router results. “Generated” means repeatable from declared inputs; it does not mean behavior is fixed across upgrades.

The final acceptance condition is therefore reproducibility: a reader can start from the shown schema, identify every authored config decision, generate the same categories of artifacts, and trace every security statement to a shape, scope mapping, router rule, or explicit application boundary. The reader should also be able to identify which remaining claims require the running database rather than mistaking generated arguments for returned outcomes.

This distinction between generated arguments and returned outcomes is mandatory.

## Rules

1. Mark roots with @scope-root and review generated mappings.
2. Protect root delegates and unmapped models explicitly.
3. Regenerate all artifacts after schema or generator changes.
4. Attach the extended client before guarded routes.
5. Derive scope from authenticated state.
6. Use true for client control and force(true) for forced boolean true.
7. Put forced scalars inside operators.
8. Treat read projections as whitelists and defaults.
9. Keep mutation projection policy explicit.
10. Omit scope FKs from create shapes.
11. Use encodeQueryParams for GET and native JSON for POST.
12. Cache by variant and tenant when both affect responses.
13. Add supported filters as shape keys.
14. Move unrepresentable rules into application or database policy.
15. Keep real-guard tests when E2E drops guard.
