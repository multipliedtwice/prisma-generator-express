# Implementation plan

Review follow-up. Order: cheap/trust items first, deep emission changes last.

Rule: no commit without GPT authorization. Each phase = one PR, GPT reviews diff before merge.

Size legend: S < half day. M = day-ish. L = multi-day.

---

## Phase 1 — trust sweep (review item 8)

Size: M. Mostly mechanical.

1. README codecov badge: branch `main` -> `master`. One line.
2. Delete root `jest.config.js`. Real runner is Vitest.
3. Root `index.d.ts`: grep refs first. If unreferenced -> delete. If referenced -> finish augmentation properly. Default: delete.
4. Prisma version alignment. HARD RULE: product supports Prisma >= 6.0.0. Steps:
   - Grep generator src for `@prisma/internals` / `generator-helper` imports. Runtime code must use `generator-helper` public API only. `@prisma/internals` stays dev-only (root debug scripts `probe-dmmf.js`).
   - Align `@prisma/internals` versions across root and package (pick one range).
   - Build CI matrix: same test suite against `prisma@6` (latest 6.x) and `prisma@7` (latest 7.x). Two fixture schemas, `prisma generate` + run emitted-code smoke tests. Demo stays on 6.x as living proof of v6 support.
   - Document policy in README compatibility section: "tested on 6.x latest + 7.x latest".
5. Env switch rename: `E2E=true` -> `PGE_DROP_GUARD=true`. Keep old `E2E` reading as deprecated alias with one-time warning. Document both in env table. Remove alias next major.
6. `.gitignore`: add `coverage/`. Demo committed generated output: keep, add one line in demo README saying it is committed on purpose.

Accept:
- badge correct, no jest.config.js, no commented-out index.d.ts
- CI green on matrix prisma 6 + prisma 7
- env table lists `PGE_DROP_GUARD`

---

## Phase 2 — CI gate (review item 1)

Size: S-M.

Extend `.github/workflows/CI.yml`:

- Job `test`: runs on all PRs + pushes.
  - `yarn install`
  - `tsc --noEmit` strict over `packages/generator` (add strict to tsconfig if missing)
  - `vitest run --coverage` in `packages/generator`
  - `prettier --check .` (config exists; do NOT invent eslint)
  - upload coverage to codecov
- Jobs `test-prisma6`, `test-prisma7` (from phase 1.4).
- Job `publish`: add `needs: [test, test-prisma6, test-prisma7]`.

Accept:
- red build on failing PR test
- publish cannot run unless all test jobs green

---

## Phase 3 — docs restructure (review item 2)

Size: L (mostly moving text, but volume big).

1. Locate Field Guide source (github pages repo/branch). If editable -> target for moved content. If not -> create `docs/` in this repo first.
2. New README <= 150 lines:
   - logo, tagline, badges
   - quickstart: install, generator block, `npx prisma generate`, mount router (Express default)
   - feature bullets with anchor links
   - short compatibility table (frameworks, providers, min prisma)
   - link to Field Guide for everything else
3. Move rest of current README into guide. Keep anchors stable where possible, redirect nothing (no server redirects available) — accept link breakage risk, note in changelog.
4. Internal notes OUT of user docs -> `ARCHITECTURE.md`: "Required implementation notes", "Why not regenerate guard from SQLite schema", E2E SQLite harness design.
5. Fix while moving:
   - env table gets `PGE_DROP_GUARD`
   - resolve guarded-auto-include contradiction (one story: guarded auto-include = single-record reads only, everything else falls back)
   - document `scalarCdnUrl`
   - document planner limits with concrete numbers (read from source, do not guess)
   - document SSE keepalive interval (read from source)

Accept:
- README <= 150 lines, quickstart works copy-paste
- no internal design notes left in user-facing docs
- five doc gaps above closed

---

## Phase 4 — pathCase + per-op disablePostReads (review item 9)

Size: M.

1. Generator option `pathCase: "lower" | "kebab" | "raw"`. Default `"lower"` = current behavior, zero breaking change.
   - `"kebab"`: camel boundaries -> dash. `BlogPost` -> `/blog-post`. `INVOICE_RECORDS` -> unchanged segments (`invoice_records`) — underscore preserved as today.
   - `"raw"`: model name verbatim.
   - Touch: option parsing, path util, route registration (all three targets), OpenAPI path builder. One shared util, no per-target copies.
2. `disablePostReads`: add optional per-operation override. Merge order: operation > router-level global (same shallow-merge pattern as pagination).
3. Tests: casing table unit tests (User/BlogPost/INVOICE_RECORDS/apiKey x 3 modes), post-read toggle merge tests.

Accept:
- default output byte-identical to today
- new modes covered by tests
- OpenAPI paths match registered routes in every mode

---

## Phase 5 — type safety (review item 7)

Size: L.

1. Emit `PrismaClientLike` structural interface: only members handlers actually call. Generated handlers become generic `Handler<P extends PrismaClientLike>`, defaulting to real `PrismaClient` import.
2. Kill `TPrisma = any` from `routeConfig.{express,fastify,hono}.d.ts`. Plumb `<P>` through routers + hooks + guard `resolveVariant` params.
3. Docs edge example: replace `PRISMA: any` with minimal structural type.
4. Strict tsc gate from phase 2 keeps new `any` out.

Accept:
- no `any` in emitted `.d.ts`
- extended-client users get inference without casts
- all three targets compile in consumer test project with `strict: true`

---

## Phase 6 — generation-time guard warnings (review item 3)

Size: S-M.

1. During generate, after route config resolution:
   - per model: routes enabled + no guard shape anywhere -> warn once per model:
     `[warn] Model "User": routes enabled without guard shapes. All columns of this table readable/writable by any client.`
   - aggregate: bare `enableAll: true` producing zero guarded operations across all models -> one extra summary warn.
2. Opt-out generator option `suppressWarnings = true`.
3. Warnings go to generator stderr/log stream (standard prisma generator channel), never into generated code.

Accept:
- open schema produces warnings, guarded schema silent
- suppressWarnings silences
- generated files unchanged by warnings

---

## Phase 7 — metadata / discoverability (review item 6)

Size: S.

No rename. Only metadata:

1. npm `description`: name Express, Fastify, Hono explicitly.
2. npm keywords: `fastify`, `hono`, `crud`, `openapi`, `rest`, plus existing ones.
3. GitHub repo topics: same set.

Accept: `npm search`/npmjs page shows all three frameworks.

---

## Phase 8 — SSE simplification (review item 5)

Size: L.

Design first, then code:

1. Manual staged mode: stays stable API. Unchanged.
2. Auto-include mode: gate behind explicit `experimental: true` in progressive config. Docs mark experimental. No removal yet (compat), but not advertised as stable.
3. New simple mode: NDJSON chunked streaming.
   - Same read endpoints, trigger via `Accept: application/x-ndjson`.
   - Response: newline-delimited JSON page chunks, final line `{ "done": true }`. No custom event vocabulary, no client-side merge algorithm.
   - Guard-compatible same as JSON reads (shape enforcement identical).
   - All targets allowed here if trivially portable; Express minimum.
4. Protocol header: `X-Stream-Protocol-Version: 1` on all streaming responses (SSE + NDJSON).

Accept:
- NDJSON parse = split lines, JSON.parse each. Nothing else client-side.
- auto-include unreachable without `experimental: true`
- docs show NDJSON example ~10 lines client code

---

## Phase 9 — tree-shaking / bundle size (review item 4)

Size: XL. Last: touches emission structure deepest.

Goal: Hono target usable on Cloudflare Workers size limits.

1. Audit static import graph of emitted routers. Inventory: which runtime modules are imported unconditionally today (suspects: sse/autoIncludePlanner(+Guarded), docsRenderer, scalarTypes, materializedCount/Router, queryBuilder helper).
2. Granular imports: per-op files import only helpers they use. Router imports only enabled op files. Disabled ops -> dead for bundler.
3. Heavy modules imported ONLY from configs/routes that enable them (progressive config -> sse modules; docs config -> renderer; mat-view router standalone anyway).
4. Hono target emits pure ESM, no side effects, no CJS interop. Verify no top-level side effects in copied runtime files.
5. CI budget check: esbuild-bundle sample Hono app (2 models, enableAll, no extras) per release. Fail over configured KB budget. Budget number set AFTER measuring baseline — do not guess now.
6. Optional stretch: dynamic-import split for playground/docs paths. Skip if step 2-4 hit budget.

Accept:
- sample hono app bundles under budget in CI
- enabling SSE/docs/mat-view visibly grows bundle; plain CRUD stays small
- express/fastify targets unaffected functionally

---

## Global definition of done

- All 9 phases merged, GPT-approved diffs.
- CI: test + prisma6/prisma7 matrix + budget check gate publish.
- README short, guide complete, no doc contradictions from review.
- No telemetry introduced anywhere (standing restriction).
