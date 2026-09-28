# Implementation plan

Open work only. Phase numbers kept from original review plan so old refs still resolve.

Rule: no commit without GPT authorization. Each phase = one PR, GPT reviews diff before merge.

Size legend: S < half day. M = day-ish. L = multi-day. XL = week+.

Order:

1. Leftovers of phases 1, 7 — cheap, any time, independent.
2. Phase 11 — MCP writes.

Phase 11 (MCP writes) builds on the merged read-only MCP surface (phases
S/5/9/10): per-op tool factories, explicit allowlist,
`McpAuthorizationError`, per-op `readOnly`/`destructive`/`idempotent`
annotation metadata.

---

## Phase 1 leftovers — trust sweep

Size: S.

1. `packages/generator/jest.config.js` still exists (ts-jest preset). Runner is Vitest (`"test": "vitest"`). Grep refs, delete.
2. Default output override dead in published installs. `index.ts:159-174` compares prisma-resolved output against `__dirname`-based manifest path; never equal when installed from npm. Unset `output` lands at `<schemaDir>/../generated/output` (flat, no target segment). Verified on npm 1.67.0 + prisma 6: quickstart schema at `prisma/schema.prisma` wrote `./generated/output/`. Decide: fix override to intended `<schemaDir>/generated/<target>` + add unset-output fixture to matrix, or document `generated/output` as the default. Docs now avoid the case: quickstart + guide generator blocks set `output` explicitly.
3. Matrix jobs prove compile only. Add SQLite runtime smoke per matrix job (fixture already `provider = "sqlite"`):
   - migrate fixture DB
   - mount generated router
   - execute one read + one write, assert status + body
   - Prisma 7 runtime may need SQLite driver adapter. Verify in Prisma 7 docs, do not guess.

Accept:
- no jest.config.js anywhere in repo
- matrix smoke green on prisma 6 + 7
- default-output contract decided + documented, verified on prisma 6 and 7
- if override fixed: unset-output matrix fixture produces intended `<schemaDir>/generated/<target>` on both prisma lines

---

## Phase 7 leftovers — discoverability

Size: S.

GitHub topics now: `express, generator, prisma, api, api-rest, crud`. Add `fastify, hono, openapi, rest`. Outward-facing change (`gh repo edit --add-topic`): user OK first.

Accept:
- repo topics list all three frameworks + openapi + rest

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
