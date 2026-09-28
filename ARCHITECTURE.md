# Architecture notes (internal)

Design rationale and implementation invariants for maintainers. Not user
documentation — the user-facing guide lives in `docs/guide.md`.

## Guard drop design

### Why not regenerate guard from SQLite schema

Do not depend on SQLite-generated guard output for this path.

The SQLite schema is a derived test schema. It may intentionally erase Postgres-only field information such as scalar-list types. Guard correctness belongs to the production schema, not the SQLite test schema.

Global E2E guard drop keeps this path simple:

```text
production keeps guard
E2E skips guard
E2E list-op extension handles hasSome
SQL extension receives normal id filters
```

### Required implementation notes

The shared runtime helper resolves the environment bypass once per process:

- `PGE_DROP_GUARD=true` drops the guard
- `E2E=true` keeps working as a deprecated alias and logs a one-time warning
- anything else leaves the guard active

The router always resolves caller routing first. On a successful match:

- active mode stores the normalized guard shape for `delegate.guard(...)`
- dropped mode applies the same matched shape locally before operation before-hooks

On a routing failure, the router stores the failure, runs operation before-hooks, then returns HTTP 400 before variant hooks or the handler. This ordering is identical across Express, Fastify, and Hono.

The dropped runtime must remain self-contained. Generated code must not require `prisma-guard` to be installed or resolvable when `dropGuard=true` or `PGE_DROP_GUARD=true`.

## Generator structure

Facts for navigation (verified against source):

- `packages/generator/src/generators/` — per-target router emitters (`generateRouter.ts` Express, `generateRouterFastify.ts`, `generateRouterHono.ts`) plus handler/docs/metadata emitters.
- `packages/generator/src/copy/` — runtime modules copied verbatim into the user's generated folder. Shipped via the package's `src/**/*` files entry; generation copies them at generate time.
- Emitted routers import these helpers relatively (`../misc.ts` etc.), one shared copy per generated folder.
- The published package runs on `@prisma/generator-helper` only. `@prisma/internals` is a root devDependency used solely by the `probe-dmmf.js` debug script.
- Prisma compatibility: supported range >= 6.0.0. CI matrix jobs generate a fixture under prisma 6.x and 7.x and strict-typecheck the emitted output (`packages/generator/matrix/`). Note: v6 fixture keeps `url` in the datasource block; v7 removed schema-level URLs, hence two schema files.

## Shared orchestration (phase S)

Execution order lives once, in `src/copy/operationPipeline.ts`, consumed by all three REST emitters and the MCP runtime. Stages: `route` (sync variant routing), `prepareGuard` (shape resolution or local apply when dropped), `settle` (rethrows the stored classified failure, placement chosen by the adapter), `execute` (reads the request argument channel at call time), `classifyError` (shared `mapError`).

- Adapters pass a pre-resolved `caller`. The pipeline never reads requests, headers or authentication; `caller` is a routing key, never identity.
- One argument channel per request (`{ read, write }`) fronts the adapter's storage (Express locals/body, the Fastify request, Hono context vars), so dropped-guard transforms, hooks, overrides and execution observe the same arguments.
- One memoized `GetContext` per request, resolved at most once, shared by shape resolution, the operation core and overrides.
- Variant failures are stored classified as 400; resolved-shape failures as 500. `settle` rethrows without reclassification.
- Framework `authorize`/`before`/`after` and variant hooks stay in the adapters. No neutral REST/MCP hooks exist.

### Exact execution orders

Express (per route): `authorize` -> parse -> `setShape` (route + prepareGuard; failures stored) -> `operationBefore` -> settle (stored route failure 400, stored guard failure) -> variant `before` -> handler (execute) -> variant `after` -> `operationAfter` -> respond.

Fastify: identical to Express (settle sits after `operationBefore`).

Hono: same as above when `guardResolutionOrder: 'after-hooks'` (default). With `'before-hooks'`, settle runs before `operationBefore` — a hook cannot answer a request whose guard was never established. Both branches live in `src/copy/routerParts.ts` (`createReadRoute`/`createWriteRoute`).

MCP (per call): schema validation -> `route` -> settle variant -> MCP `authorize` -> `prepareGuard` -> settle guard -> execute -> transform -> size cap -> encode. Authorization precedes context resolution and dynamic shape evaluation.

## Static import boundary (phase 9)

Audit result: the emitted Hono router factory statically imported `buildModelOpenApi` (pulling `yaml`) and, through `pagination`, `materializedCount`; operations were runtime-configured, so `enableAll` could never be a tree-shaking boundary.

Decision: per-op exports + assembly API.

- `src/copy/routerParts.ts` holds the shared per-op route creators. Each model emits `UserRouterParts.ts` with one named factory per operation returning a Hono sub-app; `UserOpenApi.ts` is a separate module and the only static referencer of the OpenAPI renderer and `yaml`.
- `pagination` loads `materializedCount` through an opaque dynamic-import specifier, so materialized-view support is unreachable from a minimal CRUD bundle.
- The parts file is side-effect free at module top level (environment read inside functions) so unused exports — and everything only they reference — drop out of esbuild/Rollup output.
- Legacy router factories are unchanged in behavior and remain the default path. `enableAll` remains runtime configuration, never a bundle boundary.
- `operationRuntime`'s optional `prisma-sql` probe moved from module load to first use, so the copied runtime is free of top-level side effects (pure ESM).
- CI budget: esbuild-bundled two-model Hono CRUD sample (findMany+findUnique+count / findMany, `hono` external, minified). Measured 29,276 bytes at authoring time; budget 36,000 (see `test/unit/bundleBudget.test.ts`). Enabling the OpenAPI part grows the bundle to ~119,000 bytes.

## MCP transport, reads (phase 10)

Second transport over the shared pipeline, in the same process. Emitted only for `mcp = true`: per-model tool factories (`UserMcp.ts`, per-op named exports — the same static-boundary discipline), app-level `mcp.ts` (`registerMcpTools(server, options)` with an explicit `tools` allowlist), target mount glue `mcpMount.ts`, shared `mcpRuntime.ts`. Tool input schemas come from the shared operation-contract builder (`operationSchemas.ts`, also feeding OpenAPI POST-read bodies), narrowed by the static guard shape so fields the shape rejects are not advertised.

Verified SDK v2 surfaces (ts.sdk.modelcontextprotocol.io/v2, packages at 2.x): `createMcpHandler(factory)` web-standard handler with `.fetch(request, { authInfo, parsedBody })`; factory receives `ctx.authInfo`; tool handlers read `ctx.http?.authInfo`; `fromJsonSchema` wraps plain JSON Schema; `toNodeHandler` (from `@modelcontextprotocol/node`) adapts to Express/Fastify. No legacy `@modelcontextprotocol/sdk`.

Security invariants (fail closed): generation refuses `mcp = true` + `dropGuard = true`; effective `PGE_DROP_GUARD`/`E2E` env makes `registerMcpTools` throw before registering anything; every exposed operation requires a guard shape or variants (list shapes must declare `take` with room for the injected default); REST hooks on an exposed operation refuse registration; unroutable callers get no tool; caller/variant/principal are never accepted in tool arguments.

## MCP write actions (phase 11)

Same transport, same pipeline. `UserMcp.ts` also exports one factory per guarded write op, derived from `OPERATION_METADATA` (`create`, `createMany`, `createManyAndReturn`, `update`, `updateMany`, `updateManyAndReturn`, `upsert`, `delete` -> `deleteUnique` core, `deleteMany`). `updateEach` bypasses guard shapes, so it has no factory and `createMcpWriteTool` refuses it by name. A write exists only when application code imports its factory and places it in `tools`; `enableAll` never implies one, and there is no universal tool, no implicit registration and no server-side confirmation flag — annotations are hints, `authorize` plus the allowlist enforce.

`createMcpWriteTool` and `createMcpReadTool` share one factory (`createMcpOperationTool`): guard required, REST hooks refused, per-variant shape validation, fail-closed routing. Write-specific rules: dynamic (function) write shapes are refused at creation — schemas narrow from static shapes only, never an opaque fallback; `writeShapeConfigProblem` mirrors guard's mutation table (per-op shape keys, required `where`/`data`, unique-selector `where` for update/upsert/delete incl. extended non-unique keys, filter `where` for bulk ops, data configs, projections); `buildModelAwareWriteArgsSchema` advertises only `true` data fields, create requiredness from `hasDefaultValue`, nullable optional fields. Relation writes and inline refines refuse registration — a static JSON Schema cannot mirror them.

`writeStrategy` is baked into every emitted write factory (same value the cores were generated with): under `forceReturn` the createMany/updateMany tools validate and advertise against the returning guard methods the cores call; under `throwOnNonReturning` those two factories throw at creation, because their cores 501 on every call.

Execution: sanitized tool arguments become `ctx.body`, `parsedQuery` stays empty — exactly what REST write routes hand the operation core. A fully forced selector or filter leaves `where` optional in the schema; the runtime then injects `where: {}` (on a copy of the arguments) so the core's required-field check matches REST and guard merges the forced values. Bulk filters with any client-controlled key require a client condition — stricter than REST, so an agent cannot write a whole tenant by omission. Guard compile, forced merge, override, Prisma call and error classification are the REST path. A write result over `maxResultBytes` is returned as success with the result omitted — the write is committed, and an error would invite a duplicating retry.

Annotations follow MCP semantics: `destructiveHint: false` means only additive updates, so the update, upsert and delete families are destructive; every tool sets `openWorldHint: false`.

Tenant safety is a shape property: per-tenant static variants forcing the tenant column in data, in unique wheres (a compound selector with the tenant half forced — typed; or the extended `{ id: true, siteId: force(t) }`, which guard accepts at runtime but prisma-guard 1.33's shape types reject) and in bulk filters. The Postgres parity suite runs cross-tenant update/delete/upsert/bulk attacks (asserting the other tenant's rows are unchanged) and authorization denials (asserting zero writes).
