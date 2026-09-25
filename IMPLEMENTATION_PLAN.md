# Implementation plan

Open work only. Phase numbers kept from original review plan so old refs still resolve.

Rule: no commit without GPT authorization. Each phase = one PR, GPT reviews diff before merge.

Size legend: S < half day. M = day-ish. L = multi-day. XL = week+.

Order:

1. Phase 0 — Publish job broken. Blocks release. First.
2. Leftovers of phases 1, 3, 7 — cheap, any time, independent.
3. Phase S — shared orchestration.
4. Phase 5 leftovers — type safety.
5. Phase 9 — static import boundary + bundle budget.
6. Phase 10 — MCP read-only.
7. Phase 11 — MCP writes.

MCP spec (phase 10) may be written now. MCP code waits for phase 9, so emitted imports not reworked twice.

---

## Phase 0 — Publish job broken (blocker)

Size: S.

`Publish` fails at `Install dependencies` on master `e6edb63` (runs `36167726472`, `36167727446`):

```text
error This project's package.json defines "packageManager": "yarn@3.4.1". However the current global version of Yarn is 1.22.22.
```

`packageManager` added in `f6411dc` (2026-08-22). `Test` + `Matrix` run `corepack enable`; `Publish` does not. Last npm release `1.66.0` (2026-08-18). Unreleased `feat:` commits (`270351d`, `c1f387e`) + `fix:` `b45280c` ship on first green `Publish` -> minor bump.

1. Add `corepack enable` to `Publish` after `setup-node`.
2. Duplicate runs confirmed: one push event, one workflow definition + ID, two independent run numbers / check suites, same SHA, actor, timestamp, `run_attempt: 1`. GitHub Actions duplicate scheduling; GitHub exposes no deeper cause. Risk: two concurrent `semantic-release`.
3. Job-level concurrency on `Publish`: `group: npm-publish`, `cancel-in-progress: false`. Only one publish job at a time. Never cancel: interrupting `semantic-release` mid-publication unsafe. Serialized duplicate finds release tag, no new releasable commits.

Accept:
- `Publish` jobs never overlap
- first job publishes successfully
- any duplicate job completes without publishing another version
- npm `latest` matches semantic-release output

---

## Phase 1 leftovers — trust sweep

Size: S.

1. `packages/generator/jest.config.js` still exists (ts-jest preset). Runner is Vitest (`"test": "vitest"`). Grep refs, delete.
2. Matrix jobs prove compile only. Add SQLite runtime smoke per matrix job (fixture already `provider = "sqlite"`):
   - migrate fixture DB
   - mount generated router
   - execute one read + one write, assert status + body
   - Prisma 7 runtime may need SQLite driver adapter. Verify in Prisma 7 docs, do not guess.

Accept:
- no jest.config.js anywhere in repo
- matrix smoke green on prisma 6 + 7

---

## Phase 3 leftovers — docs

Size: S.

1. README quickstart imports `./generated/User/UserRouter`. Default output is `<schemaDir>/generated/<target>` (`packages/generator/src/index.ts:170`), so real path has `express/` segment. Demo imports `../prisma/generated/express/User/UserRouter`. Fix README path.
2. Run quickstart copy-paste in clean temp dir. Confirm router mounts and `/user/openapi.json` responds.

Accept:
- quickstart works copy-paste, verified by run, not by reading

---

## Phase 7 leftovers — discoverability

Size: S.

GitHub topics now: `express, generator, prisma, api, api-rest, crud`. Add `fastify, hono, openapi, rest`. Outward-facing change (`gh repo edit --add-topic`): user OK first.

Accept:
- repo topics list all three frameworks + openapi + rest

---

## Phase S — shared orchestration

Size: L.

Why: authorize / variant / guard / hook order lives three times (`generateRouter.ts`, `generateRouterFastify.ts`, `generateRouterHono.ts`). `ARCHITECTURE.md` demands identical order across targets. Core runs raw Prisma when `ctx.guardShape` absent (`generateOperationCore.ts:101-104`), so no second transport may build `OperationContext` itself. Needed before MCP; worth it alone for dedup.

Express order today (read from `generateRouter.ts:55-120`, `:502-560`):

```text
authorize [hook] -> parse input -> setShape (caller -> variant resolution -> guard shape, or dropped-guard local apply; variant failure stored, not thrown)
-> operationBefore [hook] -> requireVariantKey (400 on stored failure) -> variantBefore [hook]
-> [progressive / ndjson] -> core -> variantAfter [hook] -> operationAfter [hook] -> respond
```

Hono also has public `GuardPolicy` (`src/copy/routeConfig.ts:282`), used only by Hono router (`generateRouterHono.ts:541-600`):
- `guardResolutionOrder: 'after-hooks'` (default) = same order as Express above.
- `guardResolutionOrder: 'before-hooks'` = settle guard before `operationBefore`.
- `validateResolvedShapes: true` -> shape resolution failure stored, settled as 500. Variant failure settled as 400.

Hooks interleave with neutral stages and can short-circuit. One opaque shared function cannot keep this order. Contract = separate stages. Adapters keep own middleware chain and call stages between their hooks.

1. Read Fastify order from `generateRouterFastify.ts`. Write Express, Fastify, Hono (both branches) into `ARCHITECTURE.md`. Default order (`after-hooks`) must match across all three; mismatch = bug, fix first. Hono `before-hooks` branch kept + documented, not removed.
2. Caller source: adapter passes pre-resolved `caller: string | undefined`. Pipeline never reads req, headers, or auth. `caller` = routing key only, not identity.
   - REST: unchanged, `config.guard.resolveVariant(req) ?? variantHeader` (default `x-api-variant`).
   - MCP (phase 10): `resolveCaller(authInfo)`.
3. Stages. Transport-neutral, not pure: may call async context, resolve dynamic shapes, write args.
   - `route({ opConfig, caller })` -> `{ ok: true, variantKey }` or `{ ok: false, failure }`. Sync. No context, no Prisma.
   - `prepareGuard(routed: RoutedOk, { opConfig, opKind, policy, getContext, args })` -> `{ ok: true, guardShape }` or `{ ok: false, failure }`. Accepts only successful route result (type-level). On route failure adapter skips `prepareGuard`, keeps route failure for its own `settle` slot.
   - Shape handling preserves today: default -> raw shape passed through unresolved. Resolve only when `policy.validateResolvedShapes` (Hono) or `policy.dropGuard` (local apply, writes through `args` channel).
   - `settle(stageResult)` -> rethrows stored failure unchanged. Called once per stage result, placement chosen by adapter (default order / Hono `before-hooks` / MCP).
   - `execute({ variantKey, guardShape }, { prisma, pagination, override, getContext, args })` -> result. Reads args from channel at call time.
   - `classifyError(err)` -> classified error.
4. Failures stored classified, not bare: variant failure = 400; resolved-shape failure (`validateResolvedShapes`) = 500. `settle` rethrows same classified error. No re-classification downstream.
5. One args channel per request: `args: { read(): Args; write(next: Args): void }`, backed by adapter request storage (Express `res.locals.parsedQuery` / `req.body`, Fastify request, Hono context vars). Stage results hold no args copy. Dropped-guard writes, framework hooks, `execute` all hit same storage, so guard transforms cannot be dropped.
6. Pipeline input = minimal execution policy `{ dropGuard, validateResolvedShapes }`, built per adapter. Not `GuardPolicy`: `resolveGuardPolicy` carries Hono defaults (`allowE2EGuardBypass: true`).
   - Express/Fastify: `dropGuard = DROP_GUARD || (config.allowE2EGuardBypass === true && env)` (today's code, `generateRouter.ts:500`, `generateRouterFastify.ts:271`); `validateResolvedShapes = false`.
   - Hono: values from `resolveGuardPolicy(config)`, as today (`generateRouterHono.ts:329`).
   - `guardResolutionOrder` stays adapter concern (where `settle` is called), not pipeline input.
7. Context: `type GetContext = () => Promise<unknown>`, one memoized instance per request, built by adapter, resolved at most once. Same instance passed as `getContext` to `prepareGuard`, `execute`, and override (`resolveOperationContext`). No stage receives resolved context value. Same semantics as today (`locals.resolveOperationContext = () => context ??= ...`).
8. Framework hooks `authorize` / `before` / `after` / variant hooks stay unchanged, stay in adapters. Adapters keep request/reply short-circuit. No breaking change.
9. Error classification shared. Encoding per transport (HTTP status per framework; MCP `isError` later).
10. Out of scope: cross-transport neutral hooks. No neutral before/after for REST in this plan.

Parity definition (used by phase 10 tests): same variant resolution, guard enforcement, pagination, override, core result, classified error. No parity claim for REST hooks.

Accept:
- three routers call same stages; order section in `ARCHITECTURE.md` matches code, incl. Hono `before-hooks`
- existing unit suite green, no behavior change
- tests: context resolved exactly once per request; dropped-guard arg writes survive to `execute`; variant failure 400 + shape failure 500 unchanged through `settle`
- `generatedRouterTsc` green all three targets

---

## Phase 5 leftovers — type safety

Size: M.

Route-config types already use `TPrisma extends PrismaClientLike`; docs edge example uses `PrismaClientLike`. Left:

1. Remove `any`. Full scope (47 sites, from `rg` over `src/copy`, `src/generators`, `src/client`):
   - `src/copy/buildModelOpenApi.ts` — 29: 27, 30, 128, 163, 177, 344, 811, 815, 892, 926, 959, 989, 1021, 1051, 1084, 1116, 1152, 1193, 1226, 1258, 1295, 1329, 1361, 1390, 1447, 1477, 1514, 1522, 1561
   - `src/copy/docsRenderer.ts` — 11: 130, 429, 457, 502, 503, 520, 523, 526, 532, 578, 595
   - `src/copy/operationDefinitions.ts` — 1: 520 (`isOperationEnabled` config param)
   - `src/generators/generateModelMetadata.ts` — 6: 43, 58, 69, 85, 86, 87 (generator-side, not emitted; use `DMMF` types)
   Line numbers drift; re-run inventory before start.
2. After phase S: `<P>` flows through the one pipeline, not three routers.

Accept:
- `rg -n '(:|<|,|\(|\|)\s*any\b|\bas any\b|any\[\]' packages/generator/src` returns zero code hits
- all three targets compile in consumer test project with `strict: true`

---

## Phase 9 — tree-shaking / bundle size

Size: XL.

Goal: Hono target usable on Cloudflare Workers size limits.

Premise fix: ops, progressive, docs are enabled by runtime config. Router factory importing every op file cannot be tree-shaken by bundler, whatever the file split. Old steps "router imports only enabled op files" and "heavy modules imported only from configs that enable them" do not work under runtime config.

1. Audit static import graph of emitted routers. Inventory unconditional imports (suspects: sse / autoIncludePlanner(+Guarded), docsRenderer, scalarTypes, materializedCount / Router, queryBuilder helper).
2. Decision first — pick one static boundary:
   - per-op exports + assembly API: user imports op modules, passes them to router
   - generate-time op selection: generator config lists ops, unselected ops not emitted
   - other assembly API, explicitly designed
   Promise dead-code elimination only through chosen boundary.
   Boundary must be additive + opt-in. Existing router factories (all three targets, incl. Hono) keep working unchanged. Any breaking change -> deferred to next major, listed separately.
3. Heavy modules (sse, docs renderer, mat-view) reachable only through that boundary.
4. Hono target emits pure ESM, no top-level side effects in copied runtime files, no CJS interop.
5. CI budget check: esbuild-bundle sample Hono app (2 models, CRUD only) per release. Fail over budget. Budget number set AFTER measuring baseline — do not guess.
6. Optional stretch: dynamic-import split for playground/docs paths. Skip if 2-4 hit budget.

Accept:
- sample hono app bundles under budget in CI
- enabling SSE/docs/mat-view visibly grows bundle; plain CRUD stays small
- express/fastify targets unaffected functionally
- existing router factory API unchanged; old consumer test project compiles + passes untouched

---

## Phase 10 — MCP read-only

Size: L. After phase 9.

Shape: MCP = second transport over phase S pipeline. Same process as backend. Not separate CRUD engine.

Dependency:
- SDK v2: `@modelcontextprotocol/server` + adapter `@modelcontextprotocol/express` / `fastify` / `hono`. Optional peer deps. Not v1 `@modelcontextprotocol/sdk`.
- Generator option `mcp = true`. Off -> zero MCP files, imports, deps in output.

Mount:
- One app-level registry `registerMcpTools(server, options)`. Models contribute tools. Not per-model router mount. Precedent: app-level emits `combinedDocs` + `queryBuilder` (`src/index.ts:334-349`).
- First release: one Streamable HTTP endpoint `/mcp`, same process. No stdio.
- Registration at runtime. Explicit model + op allowlist. Allowlist form follows phase 9 boundary, so unselected tools drop from bundle.
- Caller-specific tools built through SDK v2 authenticated per-request server factory. Not a persistent session registry. Not v1 `extra.authInfo`.

Identity (verified in SDK v2 `docs/serving/authorization.md`):
- Express `requireBearerAuth` puts verified `AuthInfo` on `req.auth`.
- Per-request factory receives it as `ctx.authInfo`; registers caller's tool set before any handler runs.
- Tool handlers read it as `ctx.http.authInfo`.
- Web-standard handlers: `handler.fetch(request, { authInfo })`.
- Variant resolved server-side from verified `AuthInfo`. Never from tool argument.
- Required option `resolveCaller(authInfo) -> string | undefined`. Output = `caller` passed to phase S `route`. Routing key only, not identity. Missing option -> `registerMcpTools` throws.
- Principal locked to verified `AuthInfo`, passed as-is. No `resolvePrincipal`. Caller string never used as identity.

MCP authorize:
- One MCP-only, framework-neutral callback. Object arg:

  ```ts
  authorize({ principal, model, operation, args, variant }) // principal: AuthInfo, args: schema-validated, variant: resolved key
  ```

- Required. `registerMcpTools` throws when missing.
- Order per call: schema validation -> `route` -> `settle` (variant) -> `authorize` -> `prepareGuard` -> `settle` (guard) -> `execute`.
- `authorize` runs before any context resolution or dynamic shape evaluation. Denied caller triggers no app context work.
- Success: returns `void` (sync or Promise). Denial: throws typed `McpAuthorizationError` -> classified error -> MCP `isError` result. Any other throw -> classified internal error, not treated as allow.
- No MCP `before` / `after` hooks in first release.
- Existing Express / Fastify / Hono hooks unchanged.

Tools:
- One tool per model op, name like `user_find_many`. No universal `execute_prisma`.
- Ops: `findMany`, `findUnique`, `findFirst`, `count`, `findManyPaginated`.
- Annotations: explicit per-op metadata, not inferred from `kind`. `OpMetadata` (`src/copy/operationDefinitions.ts`) has no annotation fields today. Add `readOnly`, `destructive`, `idempotent` to every entry. Map to `readOnlyHint` / `destructiveHint` / `idempotentHint`. Mapping unit test per op.
- Row limits for `findMany` + `findManyPaginated`. Composition with prisma-guard (upstream README, query shape syntax): undeclared query keys rejected; `take: { max, default }` / `take: N` (= max + default N) / `take: { max }` (omitted stays omitted). So pipeline may inject `take` only when shape declares it.
  - Required: every exposed list-op shape (each variant) declares `take`. Static shapes checked at registration -> throw. Dynamic shapes: MCP execution policy always resolves shape (`validateResolvedShapes: true`); check after resolution per call -> classified 500, no execution.
  - Required `registerMcpTools` options `defaultLimit` + `maxLimit`. Missing -> throws. No built-in numbers.
  - Option validation at registration: both `Number.isSafeInteger` and `> 0`; `defaultLimit <= maxLimit`. Else throw.
  - Pre-guard normalization (legal because shape declares `take`): `take` absent -> `defaultLimit`. `|take| > maxLimit` -> `sign(take) * maxLimit` (negative take keeps sign). Non-integer / non-finite `take` -> 400, same as REST.
  - Guard then applies shape `take.max`. Stricter guard limit wins. Unknown, verify in prisma-guard source before spec freeze: `take > shape max` rejected or clamped; negative `take` accepted (README says "client may send 1..100"). `defaultLimit` must be `<=` shape `take.max`, else injected default is rejected: static check at registration, dynamic check after resolution.
  - Applied even when REST pagination config absent, and with guard shape present. REST path alone leaves MCP unbounded: `applyPaginationLimits` skips `defaultLimit` when guard shape present (`src/copy/pagination.ts:20-26`).
  - Tool description states limits.
  - Tests (guard active, no REST pagination): omitted `take` -> `defaultLimit`; oversized positive + negative `take` clamped with sign kept; shape `take.max` stricter than `maxLimit` -> guard limit wins; shape without `take` -> registration throws; dynamic shape without `take` / with `take.max < defaultLimit` -> classified 500, no DB call; invalid options: `0`, negative, fractional, `NaN`, `Infinity`, non-number, `defaultLimit > maxLimit` -> each throws.
- Result-size cap: serialized-result-size cap on top of row limits. Cap number set after measuring, do not guess.
- Size = UTF-8 bytes of final serialized payload (after `transformResult`): `new TextEncoder().encode(json).byteLength`. Not `string.length`, not `Buffer`-only (must run on edge runtimes).
- Over cap: return MCP error result asking for narrower query (smaller `take`, tighter `select`). Never truncate structured JSON. Test exact boundary: size == cap passes, cap + 1 byte errors. Boundary test includes multibyte UTF-8 content.

Security (fail closed):
- `mcp = true` + generator `dropGuard = true` -> generation fails.
- `PGE_DROP_GUARD=true` or deprecated `E2E=true` effective -> `registerMcpTools` throws before registering any tool.
- `allowE2EGuardBypass` cannot enable MCP under dropped guard.
- Refusal applies to read-only tools too.
- Every exposed op needs guard shape or variants. Else throw.
- Exposed op whose REST config has `authorize`, `before`, `after` or variant hooks -> `registerMcpTools` throws. Silent ignore could bypass security or input/result transforms.
- No override flag: no `allowUnguardedMcp`, no `allowHookDivergence`.
- `enableAll: true` never implies MCP exposure.

Schemas:
- Extract shared op-contract / JSON Schema builder from `buildModelOpenApi.ts`. OpenAPI + MCP both consume it. No OpenAPI -> MCP back-conversion.
- Narrowing:
  - static single shape -> narrow exactly
  - multiple variants -> per-request factory registers tools for caller's resolved variant
  - dynamic shape functions -> broad schema + runtime rejection

Tests:
- Parity tests MCP vs REST (phase S parity definition) on Postgres fixture, guard active.
- MCP `authorize` separate tests: missing callback throws at registration; runs after variant settle; runs before context resolution + dynamic shape (spy asserts zero context calls on deny); `void` allows; `McpAuthorizationError` denies with `isError`; other throw -> internal error, no execution.
- Annotation mapping test for every exposed op.
- Result-size boundary test.
- Registration refusal: exposed op with REST hooks; op without guard shape/variants.
- Generation fails on `mcp` + `dropGuard`.
- `registerMcpTools` throws under `PGE_DROP_GUARD=true` and under `E2E=true`.
- Guard-dropped SQLite harness is not MCP parity gate. No MCP test skipped because of it.

Accept:
- `mcp` off -> output byte-identical to before phase 10
- all tests above green
- guide section: mount, allowlist, principal propagation, fail-closed rules

---

## Phase 11 — MCP writes

Size: M-L. After phase 10 parity tests green.

1. Per-op explicit opt-in for write ops. `enableAll` never implies.
2. Annotations: `destructiveHint`, `idempotentHint` from explicit per-op metadata added in phase 10. Mapping test per write op.
3. Same fail-closed rules as phase 10.
4. Parity tests extended to every exposed write op.

Accept:
- write parity tests green
- writes absent unless opted in per op

---

## Global definition of done

- All phases merged, GPT-approved diffs.
- CI: test + prisma6/prisma7 matrix + budget check gate publish.
- No telemetry introduced anywhere (standing restriction).
