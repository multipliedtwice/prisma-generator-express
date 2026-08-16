---
layout: article
article_id: A4
permalink: /articles/caller-routing-variants/
---

One hotel inventory model may serve a public feed, the hotel storefront, a distribution partner, a corporate booking portal, and backoffice staff. Those callers should not share one permissive query contract. `prisma-generator-express` and `prisma-guard` let one generated operation expose several named shapes and select one for each request.

The important boundary is not the header itself. A header is client input. The boundary is the declared variant key selected by the router and the shape attached to that key. If choosing a more powerful key would reveal data, derive the caller on the server with `resolveVariant`. If the choices are intentionally public contracts, a header is enough.

Terms used throughout the series:

| Term | Meaning |
|---|---|
| shape | declarative description of the args a caller may send |
| variant / caller | named key selecting which shape applies |
| forced value | server-pinned value in a shape (literal or `force(x)`) |
| client-controlled | `true` in a shape |
| scope | automatic tenant filter from `@scope-root` + guard extension |
| hook | `before` / `after` request handler on an operation or variant |

The configuration examples use an Express router for a `Room` model. Caller routing itself works the same way for Express, Fastify, and Hono; only hook types and the request value passed to `resolveVariant` differ.

## 1. Choose `shape` or `variants` for one operation

**Use `shape` when only the contract changes; use `variants` when hooks also change.**

An operation accepts one of two descriptors. `shape` accepts a direct shape, a context-dependent shape function, or a named shape map. `variants` accepts a named map whose entries each contain one shape and optional variant hooks. They are mutually exclusive on one operation.

This is a complete named `shape` map for two read audiences:

```ts
const roomRoutes = {
  findMany: {
    shape: {
      storefront: {
        where: {
          isPublished: { equals: true },
          name: { contains: true },
        },
        select: { id: true, name: true, nightlyRate: true },
        take: { max: 40, default: 20 },
      },
      backoffice: {
        where: {
          isPublished: { equals: true },
          name: { contains: true },
          floor: { equals: true },
        },
        select: {
          id: true,
          name: true,
          nightlyRate: true,
          floor: true,
          internalNote: true,
        },
        take: { max: 200, default: 50 },
      },
    },
  },
  guard: {
    variantHeader: 'x-api-variant',
  },
}
```

The same operation uses `variants` when a partner request needs its own precondition:

```ts
const roomRoutes = {
  findMany: {
    before: [authenticateRequest],
    after: [setResponseHeaders],
    variants: {
      storefront: {
        shape: {
          where: {
            isPublished: { equals: true },
            name: { contains: true },
          },
          select: { id: true, name: true, nightlyRate: true },
          take: { max: 40, default: 20 },
        },
      },
      partner: {
        shape: {
          where: {
            isPublished: { equals: true },
            name: { contains: true },
          },
          select: { id: true, name: true, nightlyRate: true, partnerCode: true },
          take: { max: 100, default: 50 },
        },
        before: [requirePartnerAgreement],
      },
    },
  },
  guard: {
    variantHeader: 'x-api-variant',
  },
}
```

For `partner`, hook order is operation `before`, variant `before`, generated handler, variant `after` if present, then operation `after`. Operation hooks run for every successfully routed variant. Variant hooks run only for the selected declared key. After-hooks are not `finally` handlers and are not guaranteed to run.

`variants[key].shape` must be one direct operation shape or one context-dependent shape function. It cannot contain another named map. Descriptor objects are normalized at router construction, before anything reaches guard validation, dropped-guard projection helpers, progressive planning, or OpenAPI extraction.

## 2. Understand where the caller comes from

**Resolve the raw caller in the documented order.**

For every request, the generated router first calls `config.guard.resolveVariant(request)` when configured. If that returns a string, that string is the raw caller. If it returns `undefined`, the router reads the configured header. The header name defaults to `x-api-variant`. If neither source produces a caller, routing starts with `undefined`.

```ts
const roomRoutes = {
  findMany: {
    shape: {
      storefront: {
        where: { isPublished: { equals: true } },
        select: { id: true, name: true, nightlyRate: true },
        take: { max: 40, default: 20 },
      },
      backoffice: {
        where: { floor: { equals: true } },
        select: { id: true, name: true, floor: true, internalNote: true },
        take: { max: 200, default: 50 },
      },
    },
  },
  guard: {
    resolveVariant: (req) => req.user?.isStaff ? 'backoffice' : 'storefront',
    variantHeader: 'x-api-variant',
  },
}
```

A staff session selects `backoffice` before the header is considered. Every other request selects `storefront`, so a client cannot reach `backoffice` by changing the header. If this callback returned `undefined` for non-staff requests, the router would fall through to the header and reopen client selection of the privileged key. Reserve that fallback for operations whose header-selectable contracts are all intentionally public.

After obtaining the raw caller, the router uses prisma-guard's routing rules. It checks an exact non-blank key first. If no exact key matches, it tests parameterized patterns. If one pattern matches, it selects that declared key. If no key matches, `default` is selected when present. Without `default`, missing, blank, and unknown callers become HTTP 400 `CallerError`s.

The lab captures the direct parsing entry-point wording for a missing caller:

```text
Missing caller. This query uses named shape routing with keys: "storefront", "backoffice". Provide caller via opts.caller.
```

The guarded delegate uses a different tail:

```text
Missing caller. This guard uses named shape routing with keys: "storefront". Provide caller via guard(input, caller).
```

Both errors carry status 400. Generated routers map `CallerError` to HTTP 400 and return `{ "message": "..." }`; their normal guarded execution uses the extension path. Message tails are entry-point-specific, so lower-level assertions should target the API they call.

## 3. Treat `default` as an explicit fallback contract

**Add `default` only when every unmatched caller may receive it.**

`default` is not a cosmetic convenience. It changes a closed map into a fallback map. It is selected when the caller is missing, blank, whitespace-only, or unmatched. Without it, all those paths reject.

```ts
const roomRoutes = {
  findMany: {
    shape: {
      backoffice: {
        where: { floor: { equals: true } },
        select: { id: true, name: true, floor: true, internalNote: true },
        take: { max: 200, default: 50 },
      },
      default: {
        where: { isPublished: { equals: true } },
        select: { id: true, name: true, nightlyRate: true },
        take: { max: 40, default: 20 },
      },
    },
  },
  guard: {
    variantHeader: 'x-api-variant',
  },
}
```

This configuration is appropriate only if the public projection is safe for any request that reaches the route. A typo such as `backofice` will not produce a diagnostic; it will receive `default`. If callers must notice bad keys, omit `default` and enumerate every valid key.

The verified unknown-caller error without a fallback is:

```text
Unknown caller: "nope". Allowed: "storefront", "backoffice"
```

A blank caller is not an exact match and does not match a parameterized pattern. The lab records whitespace as an unknown caller with the whitespace preserved inside the quoted message. This is different from a missing caller, but both can fall back to `default`.

Do not put `caller` in the Prisma argument body. Named routing rejects it. The verified direct parsing message is `Pass caller via opts.caller, not in the request body.` The guarded delegate says `Pass caller via the guard(input, caller) argument, not in the request body.` The caller is transport metadata, not query data.

## 4. Match exact keys before parameterized keys

**Use parameterized callers for contract families, not for extracting authorization data.**

Parameterized keys use path-like segments. A segment beginning with `:` matches exactly one segment. Matching is case-sensitive. Segment counts must be equal. Parameters are not extracted into the guard context.

```ts
const bookingRoutes = {
  update: {
    variants: {
      'corporate/bookings/:id': {
        shape: {
          where: { id: { equals: true } },
          data: { guestName: true, arrivalDate: true },
        },
        before: [requireCorporateSession],
      },
      'backoffice/bookings/:id': {
        shape: {
          where: { id: { equals: true } },
          data: {
            guestName: true,
            arrivalDate: true,
            internalNote: true,
            status: true,
          },
        },
        before: [requireStaffSession],
      },
    },
  },
  guard: {
    variantHeader: 'x-api-variant',
  },
}
```

The client may send `corporate/bookings/bkg_123`. The matched key is `corporate/bookings/:id`; the `bkg_123` segment is not extracted or checked against `where.id`. The request still needs its normal guarded `where` argument. If identity equality matters, enforce it through authenticated application state or a purpose-built operation; parameter matching does not create that equality.

The router stores the declared matched key separately from the concrete raw caller. Variant hook lookup, shape memoization, planning, and returned resolution metadata use the declared key. For a raw caller `corporate/bookings/bkg_123`, the useful identity is therefore:

```text
raw caller:     corporate/bookings/bkg_123
matched key:    corporate/bookings/:id
selected hooks: variants['corporate/bookings/:id']
```

Exact keys win before patterns. If the map also declares the exact key `corporate/bookings/preview`, that key wins over `corporate/bookings/:id` for the matching raw caller.

Patterns must not overlap. The lab proves that `/shop/ferns` matching both `/shop/:slug` and `/:section/ferns` throws:

```text
Ambiguous caller "/shop/ferns" matches multiple patterns: "/shop/:slug", "/:section/ferns"
```

A caller with an extra segment does not match a shorter pattern. The verified message is `Unknown caller: "/shop/ferns/extra". Allowed: "/shop/:slug"`.

## 5. Keep reserved words out of variant names

**Never use a bare guard shape key as a caller key.**

Keys such as `where`, `data`, `create`, `update`, `select`, `include`, and `orderBy` belong to shape configuration. They cannot also identify named variants. The full set is defined by the guard runtime, so use audience names or full path-like keys rather than trying to maintain a local partial list.

```ts
// wrong
const roomShapes = {
  select: {
    where: { isPublished: { equals: true } },
    select: { id: true, name: true },
  },
}

// right
const roomShapes = {
  publicFeed: {
    where: { isPublished: { equals: true } },
    select: { id: true, name: true },
  },
}
```

The direct parser reports `Caller key "select" collides with reserved shape config key. Rename the caller path.` The guarded delegate uses `reserved guard shape key` instead. Despite the word “caller,” this is a `ShapeError`, not a `CallerError`.

The bare words `create` and `update` are reserved because they are upsert branch keys. Full paths such as `/admin/create` and `/api/room/update` are unaffected; only the bare keys collide.

There is a second common cause for this message: passing one direct shape where an API expects a named map. The runtime reads top-level `where` or `select` as if it were a caller key. Check the expected nesting before renaming a legitimate shape field.

## 6. Derive public variants from frontend routes carefully

**Derive route-selected variants from one shared function.**

When every variant is intentionally public, the page route can select the API contract. A storefront route can request the storefront projection; a public feed route can request the feed projection; a corporate page can request the corporate contract after separate authentication and authorization have already decided that it may use that page.

```ts
const apiVariantForPath = (pathname: string) => {
  if (pathname.startsWith('/partners/')) return 'partner'
  if (pathname.startsWith('/corporate/')) return 'corporate'
  if (pathname.startsWith('/staff/')) return 'backoffice'
  if (pathname.startsWith('/feed/')) return 'publicFeed'
  return 'storefront'
}

const fetchRooms = async (pathname: string, search: string) => {
  const variant = apiVariantForPath(pathname)
  const response = await fetch(`/room?${search}`, {
    headers: { 'x-api-variant': variant },
  })

  if (!response.ok) throw new Error(`Room request failed: ${response.status}`)
  return response.json()
}
```

The benefit is one explicit mapping between frontend surface and backend contract. The cost is coordination: renaming a page or a declared key requires changing the shared mapping. Do not scatter header literals across page components.

This convention is not authorization. A browser can send any header. It is correct only when selecting another declared key buys nothing the caller has not already been authorized to receive. If `backoffice` returns private fields, the server must derive it from trusted session state or a variant hook must independently reject unauthorized sessions before the generated handler.

Cache identity must include the selected variant. The same URL and Prisma arguments can return different projections under `storefront` and `backoffice`. A cache key that ignores the variant can serve a response from one contract to a consumer expecting another. This is an application cache rule; prisma-guard does not create frontend cache keys.

## 7. Derive privileged variants from authenticated state

**Use `resolveVariant` when the client must not choose a privileged shape.**

An authenticated server can resolve a declared key from session state. The browser then sends ordinary query arguments and cannot upgrade itself by changing `x-api-variant` because `resolveVariant` wins when it returns a value.

```ts
const roomRoutes = {
  findMany: {
    shape: {
      storefront: {
        where: { isPublished: { equals: true } },
        select: { id: true, name: true, nightlyRate: true },
        take: { max: 40, default: 20 },
      },
      partner: {
        where: { isPublished: { equals: true } },
        select: { id: true, name: true, nightlyRate: true, partnerCode: true },
        take: { max: 100, default: 50 },
      },
      corporate: {
        where: { isPublished: { equals: true } },
        select: { id: true, name: true, nightlyRate: true, corporateRate: true },
        take: { max: 100, default: 50 },
      },
      backoffice: {
        where: { floor: { equals: true } },
        select: { id: true, name: true, floor: true, internalNote: true },
        take: { max: 200, default: 50 },
      },
      publicFeed: {
        where: { isPublished: { equals: true } },
        select: { id: true, name: true },
        take: { max: 20, default: 20 },
      },
    },
  },
  guard: {
    resolveVariant: (req) => req.user?.apiAudience ?? 'storefront',
    variantHeader: 'x-api-variant',
  },
}
```

The callback should return only declared values. Here an unauthenticated request receives the declared safe fallback, so it cannot reopen header selection of `backoffice`. Returning an unknown value produces the normal unknown-caller 400 unless `default` catches it. A stable session-to-key mapping is easier to audit than branching separately inside each operation.

`resolveVariant` and a variant hook solve different problems. Resolution chooses the contract. A hook may authenticate or authorize before execution. When a variant is privileged, it is reasonable to do both: derive the key from trusted state and retain an explicit authorization hook. The documented router order runs operation before-hooks before a stored routing failure is surfaced, then variant before-hooks only after routing succeeds.

## 8. Omit operations to deny them

**Represent an absent capability by omitting its variant shape.**

A model can use different named maps for different operations. Backoffice may read, create, update, and delete. A storefront caller may only read. A partner may read and update availability but not delete rooms.

```ts
const roomRoutes = {
  findMany: {
    shape: {
      storefront: {
        where: { isPublished: { equals: true } },
        select: { id: true, name: true, nightlyRate: true },
        take: { max: 40, default: 20 },
      },
      partner: {
        where: { isPublished: { equals: true } },
        select: { id: true, name: true, nightlyRate: true, partnerCode: true },
        take: { max: 100, default: 50 },
      },
      backoffice: {
        where: { floor: { equals: true } },
        select: { id: true, name: true, floor: true, internalNote: true },
        take: { max: 200, default: 50 },
      },
    },
  },
  delete: {
    shape: {
      backoffice: {
        where: { id: { equals: true } },
      },
    },
  },
  guard: {
    resolveVariant: (req) => req.user?.apiAudience ?? 'storefront',
    variantHeader: 'x-api-variant',
  },
}
```

If `partner` reaches the registered delete route, caller routing finds no partner shape and returns `CallerError` 400. This is a contract decision: the key is absent. It is separate from authentication, tenant scope, and database authorization.

There is a larger route-level decision too. Only operations listed in the router config are registered, unless `enableAll: true` is set. An unlisted operation with `enableAll` disabled has no generated route. Prefer explicit operation registration for an externally exposed API; use named shapes inside each registered operation to define who can use it.

## 9. Fail at router construction for invalid descriptors

**Treat router-construction failures as configuration failures.**

The generator validates `variants` descriptors while constructing the router. An empty variants map, a variant entry without a shape, a reserved variant name, or both `shape` and `variants` on one operation throws immediately instead of registering the route.

```ts
// wrong
const roomRoutes = {
  findMany: {
    shape: {
      publicFeed: {
        where: { isPublished: { equals: true } },
        select: { id: true, name: true },
      },
    },
    variants: {
      backoffice: {
        shape: {
          where: { floor: { equals: true } },
          select: { id: true, name: true, floor: true },
        },
      },
    },
  },
}

// right
const roomRoutes = {
  findMany: {
    variants: {
      publicFeed: {
        shape: {
          where: { isPublished: { equals: true } },
          select: { id: true, name: true },
        },
      },
      backoffice: {
        shape: {
          where: { floor: { equals: true } },
          select: { id: true, name: true, floor: true },
        },
      },
    },
  },
}
```

Do not catch this and continue with an unguarded operation. A descriptor failure means the configured API contract was not created. Fix the configuration before serving requests.

Both `shape` and `variants` may be absent when an operation needs only operation-wide hooks or pagination. In that case the generated handler calls Prisma directly with no guard enforcement. That is a deliberate unguarded route, not a fallback for a broken descriptor.

## 10. Review the complete five-audience boundary

**Audit every operation as a matrix of declared keys and shapes.**

The final review unit is not one shared list of audiences. It is the operation-by-variant matrix. For every registered operation, record which declared keys exist, how each raw caller is obtained, what shape each key selects, and which hooks run.

| Audience | Caller source | Read projection | Write capability |
|---|---|---|---|
| storefront | public route mapping or fallback | public room fields | none |
| partner | authenticated session | public fields plus partner code | availability only |
| corporate | authenticated session | public fields plus corporate rate | booking operations only |
| backoffice | authenticated staff session | internal fields | explicitly configured operations |
| public feed | public route mapping | smallest public projection | none |

This table is application design, not generated metadata. Its value is that it makes omissions visible. A key that should not delete should be absent from the delete map. A privileged projection should never be reachable only because a browser supplied a header. A parameterized key should identify a contract family, not pretend to bind its parameter to a Prisma `where` value.

The declared matched key is the stable identity to use when attaching variant hooks or other per-contract behavior. Keep the raw caller only when the concrete value itself is needed by separately authorized application code. The guard does not extract parameter segments for you.

## 11. Follow routing through the generated request lifecycle

**Separate raw caller resolution, declared-key matching, hook execution, and guard execution.**

The router prepares routing before it runs operation hooks, but it stores a routing failure rather than immediately returning it. On a successful request, it resolves raw caller, finds declared key, prepares guard shape, runs operation before-hooks, runs variant before-hooks, calls handler, runs variant after-hooks, then operation after-hooks.

On routing failure, operation before-hooks still run. The stored failure becomes HTTP 400 before any variant hook or generated handler runs. This preserves operation-wide authentication timing without pretending an invalid caller selected a variant. After-hooks do not run because handler phase was never reached; they are not cleanup.

This order creates three review questions. Can operation authentication run safely when no variant exists? Does any operation hook incorrectly assume a matched key? Does a variant hook run only after its own shape has been selected? Treat those as separate assertions.

The normalized guard shape is stored in framework-specific request context. The declared matched key is stored separately from raw input. Do not branch again on the raw header inside a hook; that recreates manual dispatch and loses exact/default/parameterized semantics.

Dropped guard mode keeps routing. E2E=true does not turn named operations into unguarded caller fallback. The same resolver selects declared key and the same routing failures occur after operation before-hooks. Generated helpers still apply forced values and default read projection, while validation itself is absent. Test routing and validation as separate features.

## 12. Design the five audiences as independent contracts

**Give each audience the smallest complete projection and operation set.**

Storefront needs public inventory, availability, and price. Public feed may need an even smaller stable projection for syndication. Partner may need partner code and larger pagination. Corporate may need negotiated rate. Backoffice may need internal notes and write capability.

Do not build backoffice by taking storefront and adding one field dynamically in a hook. Declare the complete shape under backoffice. That keeps projection, filters, limits, and validation reviewable in one place. It also keeps generated OpenAPI extraction tied to shapes rather than hook side effects.

Do not share one permissive projection and rely on clients to request fewer fields. Read shape projection is default when omitted. A permissive shared shape therefore returns permissive fields to a forgetful client. Separate declared keys let each omission produce that audience's own safe default.

Operation maps may differ. Storefront and feed exist on findMany. Corporate may exist on booking create and update. Backoffice may exist on delete. Absence is meaningful: no key means routing failure. It is clearer than a key selecting a shape and then a hook refusing every request.

Scope remains independent. Hotel tenant context determines rows; variant determines arguments and projection. A backoffice variant without tenant context should still fail under safe missing-scope configuration. Conversely, correct scope does not make internalNote public.

## 13. Test the full matching algorithm

**Test exact, pattern, blank, fallback, unknown, and ambiguous callers.**

Start with an exact key and assert matchedKey equals it. Add a pattern and a concrete caller with the same number of segments. Assert matchedKey is the declared pattern, not concrete input. Add an exact key that also matches a pattern and assert exact wins.

Send missing caller. With no default, assert missing CallerError and entry-point wording. With default, assert matchedKey default. Send whitespace. It skips exact and pattern matching; with fallback it selects default, without fallback it becomes unknown rather than missing.

Send unknown nonblank caller and assert allowed keys in the error. Send one extra path segment and assert pattern does not match. Matching is case-sensitive, so include a case-changed input when naming conventions could drift.

Create two overlapping patterns and send the shared concrete value. Assert ambiguous CallerError lists both patterns. Do not rely on object order to resolve an ambiguity; the runtime intentionally refuses it.

Put caller in request body and assert rejection. This establishes that transport metadata remains outside Prisma args. Put reserved bare word in map and assert ShapeError rather than CallerError. Test the entry point the application uses because message tails differ.

For generated router tests, assert operation before-hook ran on routing failure and no variant hook or handler ran. On success, assert documented order. Do not assert after-hooks as finally cleanup on errors.

## 14. Keep header and session conventions synchronized

**Use one server resolver and one client mapping for each public contract.**

The default x-api-variant header is a transport convention. Changing variantHeader requires changing clients, examples, and tests. A resolveVariant callback can replace header choice for authenticated contracts while still returning undefined to permit public fallback.

Avoid a callback that derives some roles and lets privileged unknown roles fall to the header accidentally. Return a declared safe key for every authenticated state or reject in authentication. Use undefined intentionally, not as a generic error result.

Client page routing is useful for public contract selection. Keep mapping in one function. Include selected variant in cache identity because one URL and argument set can return different projections. Tenant and other response dimensions belong there too when application context changes results.

Parameterized page callers increase coordination cost. Renaming route segments can break backend matching. Since parameter values are not extracted, do not use this mechanism merely to repeat a record id already carried in guarded where. Use it when one declared shape genuinely represents a route family.

Session-derived routing has a different cost: backend authentication types and variant maps must stay aligned. Review every possible resolver output against every operation. An audience existing on findMany may be intentionally absent on delete; that absence should remain a reviewed authorization decision.

## 15. Attribute errors to construction or request time

**Fix invalid descriptors before serving and handle request callers at runtime.**

Empty variants, missing entry shape, reserved variant name, and shape plus variants are router-construction failures. They mean the configured route contract could not be normalized. CI should construct every router so these fail before deployment.

Missing, unknown, and ambiguous callers are request-time CallerError. They map to HTTP 400 with message body. A reserved caller collision from a named shape map is ShapeError even though text says caller. Keep error class in assertions.

A route with neither shape nor variants is not a construction error. It deliberately calls Prisma without guard enforcement. That may be valid for an operation protected elsewhere, but it must be explicit in review. Do not treat omission as automatic deny once the operation itself is registered.

Named shape map and variants descriptor ultimately select one shape. The difference is placement of hooks and router-time descriptor validation, not a second authorization system. Keep authentication, tenant scope, caller selection, shape validation, and database policy named separately in documentation.

## 16. Publish a caller matrix with evidence

**Make every declared and absent key visible before release.**

For each operation, list exact and parameterized keys, caller source, fallback, projection, limits, hooks, and scope requirement. Mark absent keys. Run construction checks, direct resolver checks, and HTTP lifecycle checks against that matrix.

Record versions because exact messages and planning details can change. The pinned guard lab establishes direct caller messages, default behavior, parameter match, ambiguity, body rejection, reserved collision, and matchedKey. The generator README establishes resolver priority, router order, descriptor construction failures, context storage, and dropped routing behavior.

Do not claim the shape lab observed Express status responses. It observed error objects and statuses at guard entry points. A generated-router HTTP test is the evidence for response mapping and hook lifecycle.

The publication-ready conclusion is narrow: one model can expose five different declared contracts without five endpoint implementations. Security comes from deriving privileged keys from trusted state, giving each key a restrictive shape, applying tenant scope separately, and omitting capabilities that audience must not have.

## Rules

1. Use `shape` for routing shapes alone and `variants` when matched keys need their own hooks.
2. Never configure both `shape` and `variants` on one operation.
3. Let `resolveVariant` win over the header, and use `undefined` only to permit header fallback.
4. Add `default` only when every missing, blank, or unmatched caller may receive that contract.
5. Keep caller metadata out of the Prisma argument body.
6. Match exact keys before parameterized keys and reject overlapping parameter patterns.
7. Treat a parameter segment as routing syntax, not extracted authorization context.
8. Use the declared matched key for variant hooks and per-contract configuration.
9. Keep bare reserved shape keys out of caller maps.
10. Derive privileged callers from authenticated server state rather than a client-controlled header.
11. Include the variant in frontend cache identity when variants return different contracts.
12. Omit a caller key from an operation when that caller must not perform it.
13. Treat router-construction errors as fatal configuration errors.
14. Remember that an operation with neither `shape` nor `variants` calls Prisma without guard enforcement.
15. Audit caller routing as an operation-by-variant matrix.
