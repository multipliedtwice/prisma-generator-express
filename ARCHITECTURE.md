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
