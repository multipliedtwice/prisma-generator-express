---
layout: article
article_id: A7
permalink: /articles/reads-at-scale/
---

Large read endpoints need different tools for different problems. A normal `findMany` returns one database result. `findManyPaginated` returns rows with a total. A POST read carries a large query in the request body instead of the URL. Server-Sent Events (SSE) can send parts of a response as they become ready. Each option solves a different problem and needs a different test.

This article uses `prisma-generator-express` 1.64.4, `prisma-guard` 1.33.0, Prisma 6.19.3, Node 22.14.0, and PostgreSQL 16.6. The HTTP examples are reproduced by `lab-http/`, which generates real Express routers and runs them through the normal Prisma query engine against PostgreSQL. The source READMEs define the supported contract; the lab records the concrete output used below.

Choose the route from the problem you need to solve:

| Need | Choose |
|---|---|
| rows only | normal JSON read |
| rows, total, and forward `hasMore` | paginated read |
| query is too large for a URL | POST read |
| useful partial data can arrive early | Server-Sent Events (SSE) |

The example domain is a delivery history with three models:

```prisma
model Courier {
  id         String     @id
  name       String
  deliveries Delivery[]
}

model Delivery {
  id        String   @id
  status    String
  city      String
  createdAt DateTime
  courierId String
  courier   Courier  @relation(fields: [courierId], references: [id])
  stops     Stop[]
}

model Stop {
  id         String   @id
  label      String
  position   Int
  deliveryId String
  delivery   Delivery @relation(fields: [deliveryId], references: [id])
}
```

The six fixed deliveries use three statuses and two couriers. The materialized count fixture deliberately says `99` while the live table contains six rows. That mismatch is not production advice. It makes every count-source decision visible in one response.

Terms used throughout the series:

| Term | Meaning |
|---|---|
| shape | declarative description of the args a caller may send |
| variant / caller | named key selecting which shape applies |
| forced value | server-pinned value in a shape (literal or `force(x)`) |
| client-controlled | `true` in a shape |
| scope | automatic tenant filter from `@scope-root` + guard extension |
| hook | `before` / `after` request handler on an operation or variant |

---

## Treat page rows and page metadata as one public response

**Use `findManyPaginated` only when the client needs rows, a total, and `hasMore` together.**

The generated endpoint returns exactly this outer shape:

```ts
type PaginatedResult<T> = {
  data: T[]
  total: number
  hasMore: boolean
}
```

For model `Delivery`, both transports share `/delivery/paginated`:

```http
GET /delivery/paginated?take=2&skip=1
POST /delivery/paginated
Content-Type: application/json

{"take":2,"skip":1}
```

The lab's forward-offset request uses `take: 2`, `skip: 1`, and an ascending id order. It returns two rows, `total: 6`, and `hasMore: true`. A `take: 0` request returns no rows, the same total, and `hasMore: false`:

```json
{"data":[],"total":6,"hasMore":false}
```

`take: 0` is therefore not an ambiguous edge case. It is useful when a screen needs a total without page rows, although the handler still follows its configured data-and-count execution path.

`hasMore` has a narrower contract than `total`. The generator README calls it reliable only for forward offset pagination: `skip` plus a positive `take`. Cursor pagination and negative `take` can produce a boolean, but the boolean may be inaccurate. The lab makes that distinction concrete. Its cursor request and backward request both happen to return `hasMore: true`; neither result widens the documented guarantee.

Do not convert that observation into a cursor protocol. For a cursor UI, use the returned rows and a cursor-specific continuation design owned by the application. For backward pagination, make direction explicit in that design. `hasMore` remains usable as documented for the common forward-offset case.

There is another boundary: `total` describes the count strategy, not necessarily a transactionally identical moment. That depends on the schema-wide execution mode.

### Keep the three page fields semantically separate

**Interpret `data`, `total`, and `hasMore` independently instead of deriving one from another.**

`data.length` is the size of this returned slice. It may be smaller than `take` because the result set ended, because filters excluded rows, or because `take` was zero. `total` comes from the configured count path and can describe all matching rows, distinct values, a guarded non-distinct fallback, or a materialized value. `hasMore` is the generated forward-offset continuation hint with the limitations already stated.

That means none of these substitutions is generally valid:

- `total = data.length` loses every row outside the current page;
- `hasMore = data.length === take` ignores the count and is especially weak for cursor or backward requests;
- `total = skip + data.length` describes only the farthest returned offset;
- `hasMore = total > data.length` forgets `skip` and fails on every page after the first.

The generated response exists so the server can make those calculations from the selected count strategy. Preserve all three fields through the frontend fetch wrapper and cache. If the screen intentionally ignores one field, ignore it at the rendering boundary rather than changing the shared response type.

Cache identity must include every argument that can change the page: `where`, `orderBy`, `cursor`, `skip`, `take`, `distinct`, the caller variant, and tenant identity when tenant context affects the query. A cache keyed only by the model and page number can attach a correct `total` to the wrong filter. The generator does not own frontend cache keys; this is an application requirement derived from the fact that the same route executes all of those argument combinations.

## Choose atomicity at generation time

**Set `findManyPaginatedMode` from the consistency guarantee the endpoint needs.**

The option belongs in the Prisma generator block. It is not a per-request switch and is not route-level pagination configuration.

```prisma
generator express {
  provider              = "prisma-generator-express"
  target                = "express"
  findManyPaginatedMode = "promiseAll"
}
```

The two values have different failure and consistency behavior:

| Mode | Execution | Consistency | Missing transaction support |
|---|---|---|---|
| `promiseAll` | root `findMany` and count run concurrently | not atomic under concurrent writes | works without `$transaction` |
| `transaction` | both operations run inside one interactive transaction | `data` and `total` share the transaction | HTTP 500, no fallback |

The default is `promiseAll`. It favors throughput and compatibility. A write can commit between the row query and count query, so `data.length`, `total`, and the state another request sees need not describe one database snapshot.

`transaction` favors a consistent page envelope. The lab generates a second router from the same schema with this block:

```prisma
generator expressTransaction {
  provider              = "prisma-generator-express"
  output                = "./generated/transaction"
  target                = "express"
  findManyPaginatedMode = "transaction"
}
```

With a normal Prisma client, the transaction route returns two rows, `total: 6`, and `hasMore: true`. With a client whose `$transaction` member is absent, the same generated handler returns 500:

```json
{
  "message": "findManyPaginatedMode=\"transaction\" requires transaction support on the Prisma client"
}
```

There is no silent downgrade to `Promise.all`. That is important operationally: choosing atomic metadata also chooses an explicit runtime dependency. Test that dependency in the deployment environment instead of assuming that every Prisma-compatible client exposes interactive transactions.

The verified transaction response covers the root data and total count. The lab does not claim a wider transaction boundary for separate follow-up work.

### Keep execution mode out of request negotiation

**Publish one consistency contract per generated deployment instead of letting callers select a mode.**

Because `findManyPaginatedMode` is schema-wide, every generated `findManyPaginated` handler in that output uses the same mechanism. A request cannot switch one page to a transaction. Route configuration can change page limits and count source, but it cannot replace this generator setting.

If one product genuinely needs both contracts, generate separate outputs or deploy separate API surfaces and name their guarantees explicitly. The lab does this only for verification: `generated/promise` and `generated/transaction` allow identical fixtures to exercise both implementations. It does not mount a request parameter that selects one.

This separation also keeps failure behavior stable. A client of the transaction surface knows that missing `$transaction` is a server error. A client of the promise-all surface knows it receives a non-atomic page envelope. A hidden runtime fallback would make successful responses indistinguishable while weakening the consistency contract, which is why the documented transaction implementation fails instead.

Transaction mode is not a general lock on the returned records. It keeps the root `findMany` and count mutually consistent within their interactive transaction. It does not promise that records remain unchanged after the response. Make update workflows use their own concurrency or compare-and-set rules rather than treating a paginated read as a reservation.

## Resolve page-size precedence before exposing the route

**Put public request bounds in route pagination and guarded defaults in the shape.**

There are two configuration layers:

```ts
DeliveryRouter({
  findManyPaginated: {
    shape: {
      where: { status: { equals: true } },
      take: { max: 10, default: 4 },
    },
  },
  pagination: {
    defaultLimit: 2,
    maxLimit: 3,
  },
})
```

`pagination.defaultLimit` belongs to the generated router. A guard shape's `take: { default }` belongs to the data boundary. The generator does not apply its default when a guard shape controls pagination. The guard is then responsible for the missing-client-value case.

`pagination.maxLimit` applies to the explicit positive incoming values exercised by the lab, including the guarded operation. The request must also survive the guard shape's own maximum.

The verified precedence table uses six rows and the configuration above:

| Operation | Client `take` | Rows returned | Reason |
|---|---:|---:|---|
| unguarded | omitted | 2 | router `defaultLimit: 2` |
| unguarded | 10 | 3 | router `maxLimit: 3` |
| guarded | omitted | 4 | shape default applies; router default does not |
| guarded | 10 | 3 | explicit request is capped by router maximum before execution |

The third row is worth reading carefully. A guard-injected default of four is not reduced to the router maximum of three in version 1.64.4. The router cap handles an incoming `take`; the guard default appears later. Therefore configure the shape default at or below the public router maximum when both are present. Do not depend on one layer correcting a conflicting value inserted by the other.

Each row needs its own test because no pair proves the whole precedence rule. The unguarded omitted case proves the router default exists. The unguarded explicit-ten case proves the cap exists. The guarded omitted case proves the router default steps aside and exposes the later shape default. The guarded explicit-ten case proves that adding a shape does not remove the incoming-value cap.

A test using only a small client value would miss both defaults and both caps. A test using only the guarded omission would establish the surprising four-row result but not show what happens when a guarded client sends ten. Preserve the four-case table when configuration changes. If the router maximum becomes five, update the fixture so the explicit client value still crosses it and the guard default still distinguishes which layer supplied the omission.

The table also separates policy from fixture size. Six rows are enough to show two, three, and four without the end of the dataset truncating any expected result. If the fixture contained only three deliveries, a guard default of four would still return three and would be indistinguishable from a router maximum of three. Keep more eligible rows than the largest expected page.

## Decide whether a distinct total must be exact

**Set `distinctCountLimit` from the largest exact distinct scan the endpoint can afford.**

A normal Prisma `count` does not express the total number of distinct projected values in the same way as a distinct `findMany`. The lab crosses an explicitly configured `pagination.distinctCountLimit` to distinguish the exact and fallback paths.

The lab contains three statuses across six deliveries. With a limit of ten, `distinct: status` stays below the threshold and returns three rows with `total: 3`:

```text
COUNT distinct-within-limit: {"total":3,"rows":3}
```

With a limit of one, the distinct probe crosses the threshold. The handler falls back to a non-distinct count, so the same page has three distinct rows but `total: 6`:

```text
COUNT distinct-over-limit: {"total":6,"rows":3}
```

The fallback is approximate relative to the requested distinct result. It is not an approximate database algorithm: it is a different count whose answer can exceed the number of distinct rows. The client receives a normal response. Treat this as response semantics, not an error path.

A guard shape changes the count plan. When a guarded operation also uses `distinct`, the generator falls back to a guarded non-distinct count so the internal count query does not have to reuse the public read projection. In the same fixture it returns `total: 6` with three distinct rows. The shape must allow `distinct`; the lab declares `distinct: ['status']`. A request cannot add `distinct` to a guarded route that omits it from the shape.

This gives three different contracts that may all be technically valid:

- exact distinct total below the threshold;
- non-distinct fallback after the threshold;
- guarded non-distinct fallback whenever guard plus distinct is present.

Choose the one the UI can explain. A label such as “three statuses” requires the exact value. A delivery browser that only needs a rough result magnitude may tolerate the fallback. Never label the fallback as an exact distinct count.

## Use a materialized count only for an unfiltered, unguarded total

**Configure `countSource` only when its precomputed row describes the entire eligible request.**

The lab exercises the materialized-view count source on PostgreSQL 16.6 and names its relation and result column in router configuration.

```ts
DeliveryRouter({
  findManyPaginated: {},
  pagination: {
    countSource: {
      type: 'materializedView',
      schema: 'public',
      relation: 'mv_delivery_count',
      column: 'total',
    },
  },
})
```

The lab's materialized view returns `99`. An unfiltered, unguarded request therefore returns `total: 99` even though the live table has six rows. This discriminating fixture proves that the view was used.

Three conditions disable it silently and select the normal delegate count instead:

| Request or operation condition | Verified total | Selected source |
|---|---:|---|
| none | 99 | materialized view |
| dynamic `where: { status: 'active' }` | 2 | delegate count |
| `distinct: status` | 3 | distinct count path |
| guard shape present | 6 | guarded delegate count |

These fallbacks preserve the relationship between the request boundary and its total. A precomputed global count cannot describe a dynamic status filter. A materialized count cannot automatically inherit a guard's tenant or visibility condition. A distinct result needs distinct-aware counting.

The fallback does not produce a marker in the response. If the performance difference matters, make the API contract and route configuration obvious from code review. Do not return a second field claiming which strategy ran unless the application intentionally owns such a contract; the generated response contains only `data`, `total`, and `hasMore`.

The absence of a response marker also matters for tests. A test that asserts only `total: 6` cannot prove whether a six-row materialized view or the delegate returned it. Use discriminating fixtures: the lab stores `99` in the view and six rows in the table. Then each branch has a distinct expected value. For dynamic `where`, the two active rows prove delegate filtering. For `distinct`, three statuses prove the distinct path. For a guard shape, six proves the guarded non-distinct fallback.

Keep those fixtures intentionally unequal. If the view is refreshed to six during setup, the main materialized-path test becomes non-discriminating and can pass after the implementation silently stops using the view. This is the same testing principle used for tenant isolation: two mechanisms must lead to different observable answers before an outcome assertion identifies which one ran.

## Use POST reads for transport size, not different query semantics

**Send large read arguments to the generated POST twin and keep operation policy identical.**

The lab verifies the two read pairs used in this article:

| Operation | GET | POST |
|---|---|---|
| `findMany` | `/delivery` | `/delivery/read` |
| `findManyPaginated` | `/delivery/paginated` | `/delivery/paginated` |

GET encodes complex arguments as JSON strings in the query string. The generated `encodeQueryParams` helper handles this representation. `take` and `skip` are primitive query parameters and valid integers are converted by the generated GET parser.

```ts
const query = encodeQueryParams({
  where: { status: 'active' },
  orderBy: { createdAt: 'desc' },
  take: 20,
})

await fetch(`/delivery?${query}`)
```

POST accepts the Prisma argument object as native JSON. Do not call `encodeQueryParams` on its body:

```ts
await fetch('/delivery/read', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    where: { status: 'active' },
    orderBy: { createdAt: 'desc' },
    take: 20,
  }),
})
```

The lab sends equivalent GET and POST filters and receives byte-equivalent JSON arrays. That establishes result equivalence for the exercised arguments; it does not erase the transport parsing difference below.

Transport parsing is still different. POST bodies receive no query-string coercion. Against a route without pagination normalization, `{ "take": "2" }` returns 400 with the final Prisma message:

```text
Argument `take`: Invalid value provided. Expected Int, provided String.
```

Send `{ "take": 2 }`. A string that was convenient in a hand-built URL is not a native JSON number.

This transport difference also makes body-rewriting hooks unsafe as query policy. The HTTP lab installs a before-hook that writes `req.body.where = { status: 'cancelled' }`. On POST `/delivery/read`, the handler observes the mutated POST body in 1.64.4, so the hook narrows six rows to two. On GET `/delivery`, initializing and rewriting `req.body` changes nothing; all six rows return because the handler reads the parsed GET query. A rule expressed that way protects one twin and misses the other.

Write query restrictions in the shape. If a disjunctive rule cannot be expressed by forced values, use a purpose-built handler that authors and executes the query, or a database policy. Do not use this observed body-mutation behavior as a public API. Directly rewriting `res.locals.parsedQuery` narrowed the lab request, but that is internal coupling and the README does not present it as a supported policy mechanism.

The three hook outputs are a complete negative-control set:

```text
HOOK mutate-body-post-row-count: 2
HOOK mutate-body-get-row-count: 6
HOOK mutate-parsed-query-row-count: 2
```

The first two use the same body-mutating hook. Their difference isolates transport: POST observes the mutation in this version, while GET does not. The third case changes the generated router's internal parsed-query local and proves that the two cancelled rows are a discriminating filter rather than an accidental fixture count.

That third case is evidence, not a recommendation. Depending on `res.locals.parsedQuery` would couple application policy to a generated internal storage choice. The safe conclusion is only that body mutation cannot protect both twins. A shape is evaluated by the generated guarded path for both transports; a purpose-built handler owns its own query; a database policy covers database access regardless of HTTP encoding.

For regression testing, assert all three row counts and the paths that produced them. If POST changes from two to six after an upgrade, the observed body-mutation behavior changed. That should not weaken security when policy lives in a shape, but it does identify hooks that were relying on undocumented body mutation. If GET changes from six to two, review the generated transport pipeline before accepting the new coupling.

## Stream fields only when the client implements the event contract

**Request progressive responses with `Accept: text/event-stream` on an Express GET read.**

The lab's progressive router is generated for Express and uses the normal GET path. A POST `/delivery/read` carrying `Accept: text/event-stream` still returns `application/json` with one JSON row, so the tested POST twin remains JSON-only.

```http
GET /delivery
Accept: text/event-stream
x-api-variant: stream
```

Each event is one SSE `data:` line containing JSON. The important event types are:

| Type | Meaning |
|---|---|
| `progress` | one named stage or relation stage advanced |
| `field` | a manual or single-record field patch |
| `rootArray` | root rows for auto-included `findMany` or paginated reads |
| `relationBatch` | one direct relation batch in the tested auto-include stream |
| `pageMeta` | pagination metadata before the tested paginated root array |
| `result` | authoritative assembled final value |
| `error` | terminal stream failure |

The client must parse every `data:` line and accumulate supported patches. It should still treat the terminal `result` as the final reconciliation value. A progressive UI that ignores `result` can retain a partially applied tree after a stage or client-side patch bug.

For the tested `findManyPaginated` auto-include, `pageMeta` arrives before `rootArray`. Its recorded payload is `{ "type": "pageMeta", "total": 6, "hasMore": true }`, and the terminal `result` data has outer keys `data`, `hasMore`, and `total`. The values belong to the six-row fixture; the verified payload fields are `total` and `hasMore`.

SSE uses a different terminal error channel from ordinary JSON. The lab's second manual stage throws after earlier events have been sent; the last event is `{ "type": "error", "message": "stage failed" }`. A generic fetch wrapper that checks only the initial response cannot identify that terminal event. The SSE consumer must parse the stream through `result` or `error`.

If an SSE request matches no progressive config, the router runs the ordinary read and emits one `result` event. That fallback is different from auto-include's configurable unsupported-plan fallback.

## Use manual stages for page composition

**Make every manual stage return an explicit patch or stop result.**

The lab configures manual mode per resolved `stream` variant and defines two named stages.

```ts
DeliveryRouter({
  resolveContext: () => ({}),
  findMany: {
    progressive: {
      stream: { stages: ['summary', 'statuses'] },
    },
    progressiveStages: {
      summary: async ({ prisma }) => ({
        key: 'summary',
        value: { total: await prisma.delivery.count() },
      }),
      statuses: async ({ prisma }) => ({
        key: 'statuses',
        value: await prisma.delivery.findMany({
          orderBy: { id: 'asc' },
          select: { id: true, status: true },
          take: 2,
        }),
      }),
    },
  },
})
```

The verified type sequence is:

```json
["progress","field","progress","field","progress","result"]
```

The final result is:

```json
{
  "type": "result",
  "data": {
    "summary": { "total": 6 },
    "statuses": [
      { "id": "d1", "status": "delivered" },
      { "id": "d2", "status": "delivered" }
    ]
  }
}
```

The two verified stages each return one top-level field patch. Their accumulated values appear together in the terminal result. Keep stage queries server-authored and test their final combined contract.

Stage failure occurs after HTTP headers may already have been sent. The lab makes its second stage throw `Error('stage failed')`. The client receives the progress and field events from the first stage, then a terminal error:

```json
["progress","field","progress","error"]
{"type":"error","message":"stage failed"}
```

Client code must treat an `error` event as failure and decide whether to keep, mark stale, or discard the partial UI.

## Use auto-include only for supported relation trees

**Let auto-include split a supported Prisma relation projection, then reconcile with `result`.**

The lab uses unguarded `findMany` and `findManyPaginated` with direct relation includes. The root rows arrive before the relation batches in both verified streams.

```ts
DeliveryRouter({
  findMany: {
    progressive: {
      stream: { mode: 'autoInclude', fallback: 'error' },
    },
  },
})
```

The lab requests two deliveries with `courier` and ordered `stops`. Its event types are:

```json
["rootArray","progress","relationBatch","progress","relationBatch","progress","result"]
```

The terminal result contains both requested relation keys on every row.

The lab makes one unsupported auto-include plan by putting `take: 1` inside the to-many `stops` relation. With `fallback: 'error'`, its only event is `error`. With `fallback: 'singleResult'`, its only event is `result`. Make this choice explicit instead of assuming every include tree streams.

The successful and fallback sequences answer different questions:

```text
SSE auto-types: ["rootArray","progress","relationBatch","progress","relationBatch","progress","result"]
SSE paginated-auto-types: ["pageMeta","rootArray","progress","relationBatch","progress","result"]
SSE paginated-auto-page-meta: {"type":"pageMeta","total":6,"hasMore":true}
SSE fallback-error: ["error"]
SSE fallback-single: ["result"]
SSE fallback-single-matches-json: true
SSE fallback-single-has-stops: true
```

The first line proves that the exercised non-paginated include is actually split: root rows precede two direct relation batches. The second proves that paginated streaming adds `pageMeta` before root rows and still ends in `result`. The last two prove that the same unsupported relation plan follows the configured branch instead of one universal fallback.

Do not replace those sequence assertions with “the response eventually emits `result`.” The tested single-result fallback also emits one `result` event and would make that assertion green without progressive loading. Conversely, do not assert only that an `error` event exists: the successful streams must prove their root, relation, and terminal phases in order.

The terminal-shape checks complete the sequence evidence. The non-paginated result has both `courier` and `stops` on every returned row. The paginated result has exactly `data`, `hasMore`, and `total` at its outer level, and every returned row has the requested `courier`. The single-result fallback is byte-equivalent to the ordinary JSON response and every returned row has `stops`. Together they show that staged delivery and the tested fallback preserve their requested direct relations and the normal response envelopes.

The lab attaches an operation after-hook counter. One ordinary JSON request increments it to one. The following progressive manual request leaves it at one. Generated after-hooks therefore do not run after the tested progressive middleware owns the response. They are not cleanup handlers.

### Keep progressive and ordinary reads behaviorally aligned

**Test the final SSE `result` against the ordinary JSON response for every supported plan.**

Progressive delivery changes event timing. It should not silently change the final data contract. For an unguarded supported include, issue the same args once as normal JSON and once with `Accept: text/event-stream`; compare the JSON body with the terminal event's `data`. For the verified paginated stream, the sequence starts with `pageMeta`, then `rootArray`, and the terminal data has exactly `data`, `hasMore`, and `total` keys.

Also test the chosen fallback. An unsupported plan under `fallback: 'singleResult'` should produce one `result` event whose data matches the normal handler. Under `fallback: 'error'`, it should end with an `error` event rather than quietly returning a single result. These are distinct configurations for distinct deployment goals: visibility during development and graceful compatibility where a non-progressive answer is acceptable.

Do not generalize one event count beyond its tested relation tree. Assert the root event, requested direct relations, and terminal result. Manual stages are fixed by configuration, so their named progress sequence can be asserted more tightly.

Finally, test hooks separately from SSE patching. The verified after-hook runs for ordinary JSON and not for the progressive response. If that hook performs a required side effect, the operation is not equivalent across those two response modes and should be redesigned or excluded from progressive configuration.

## Rules

1. Use `findManyPaginated` only when the client needs `data`, `total`, and `hasMore` together.
2. Trust `hasMore` only for forward offset pagination with positive `take`; treat `take: 0` as deterministically false.
3. Choose `promiseAll` for compatibility or `transaction` for atomic root rows and totals, and test `$transaction` support.
4. Put unguarded request defaults in `pagination.defaultLimit`, guarded defaults in the shape, and explicit request caps in `pagination.maxLimit`.
5. Keep a guard `take` default at or below the router maximum because the router does not cap the later guard-injected default in 1.64.4.
6. Label a distinct total exact only when it stays below `distinctCountLimit` and no guarded fallback changes the count plan.
7. Use a materialized count only for an unfiltered, unguarded, non-distinct request whose staleness contract the application accepts.
8. Send large read arguments as native JSON to the POST twin; do not encode its body with `encodeQueryParams`.
9. Express query restrictions in shapes, purpose-built handlers, or database policy; never rely on transport-dependent body mutation in hooks.
10. Request SSE only from Express GET reads and implement terminal `result` and `error` handling in the client.
11. Treat every manual stage query as application-owned data access; guard it explicitly when required.
12. Use auto-include only for documented projection forms and make unsupported-plan fallback explicit.
13. Never use generated after-hooks as SSE cleanup handlers.

## Reproduction appendix

The complete environment is in `lab-http/`. It pins the Node runner and dependency versions, starts PostgreSQL 16 through Docker Compose, generates promise-all and transaction routers, applies the schema, replaces all fixture rows, creates the discriminating materialized view, and compares normalized output with `RESULTS.txt`.

```sh
cd lab-http
docker compose build
docker compose up -d --wait postgres
docker compose run --rm runner
docker compose down -v
```

The runner executes `tsc --noEmit` before the database and HTTP checks. A changed output makes the `RESULTS.txt` comparison exit non-zero. The Prisma query engine is downloaded during the image build and is the normal runtime engine; this lab does not use the no-op stub from `lab/`.
