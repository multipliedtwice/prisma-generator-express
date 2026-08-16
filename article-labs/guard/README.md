# guard-lab

Verification harness. Every *guard* error string quoted in the articles came out of here, not out of a README. Transport-layer strings (HTTP status mapping, router construction, body parsing) are not reproducible here — they need a running router and a database, and the articles mark them as README-sourced.

Versions pinned by `package.json`: `prisma-guard` 1.33.0, `zod` 4.4.3, Prisma 6.19.3.

## Setup

```bash
npm install
npm run generate
npm run verify
```

`npm run generate` runs `generate.mjs`, which writes a no-op stub next to itself (`.engine-stub`, or `.engine-stub.cmd` on Windows), points `PRISMA_SCHEMA_ENGINE_BINARY` and `PRISMA_QUERY_ENGINE_LIBRARY` at its absolute path, sets `PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1`, and then invokes `prisma generate`. The CLI checks for both engines before running any generator; the guard generator itself needs only the DMMF, which Prisma parses with WASM, so the stubs are never executed.

The stub is generated rather than hard-coded because `/bin/true` does not exist on macOS. Consequence of stubbing: `prisma db push` and `prisma migrate` do NOT work in this project — it never touches a database.

If you drop either variable you get `Failed to fetch the engine file at https://binaries.prisma.sh/... - 403 Forbidden` on a network that blocks those binaries, and nothing is generated.

There is no `prisma-client-js` generator in the schema on purpose: the client generator does need real engines. `@prisma/client` is still a dependency because the generated guard imports its *types*; no client is ever instantiated and no query is ever executed.

## What each script proves

| Script | Covers |
|---|---|
| `verify-reads.ts` | forced values (top-level and relation-filter), caller routing, `mode` modifier, scalar coercion, shape-construction errors, projection auto-apply |
| `verify-writes-and-scope.mts` | `data` shapes, create completeness, bulk-mutation safety, upsert, relation writes, entry-point wording, scope injection, `PolicyError` cases |
| `verify-extras.mts` | projection auto-apply (parse vs execute), take defaults, bulk-safety messages for every operation, ambiguous callers, forced merge strategy (AND-wrap vs inline), relation-write config errors |
| `verify-forced-positions.mts` | the forced-value position matrix, every case run through **both** entry points, plus a direct probe of the README's "conflicts on the same op key throw `ShapeError`" claim |
| `verify-a3-ticketing.mts` | every message and emitted-args snippet quoted in `docs/articles/A3-force-and-boundaries.md`, on that article's own schema |
| `verify-wrong-api.ts` | what happens when a mutation shape is passed to `guard.query()` — kept because those confusing errors are documented in the FAQ |

`RESULTS.txt` is the recorded output of **all six**, in that order, with a header line per script. Every guard error string quoted in `docs/articles/` appears in it.

`MAP` lines record the generated `SCOPE_MAP` for every model in both schemas, including the unmapped ones, so A3 §7's model-by-model scope claim is sourced from the generator rather than from the article. They are labelled `MAP` rather than `SCOPE` deliberately: `SCOPE` counts scope-injection cases in the tally, and reusing it inflated that count from 3 to 11.

Error text is captured to 400 characters per case, which is enough for the longest message the guard currently produces (the negative-relation-filter refusal). Regenerate it with **`npm run results`**, never by piping `npm run verify` into the file — piping loses the version header and captures npm's own command banners, which makes two runs of identical code diff against each other. `npm run results` also prints an `AGREE / DIFFER / DELEGATE-ONLY / SCOPE` tally so a changed count is visible immediately.

Versions are pinned exactly in `package.json` and locked in `package-lock.json`; install with `npm ci`. The recorded output is version-specific, so an unpinned install would silently invalidate it.

### Both entry points

`verify-forced-positions.mts` and `verify-a3-ticketing.mts` run every **read** case twice — through `guard.query(...).parse(body)` and through the guarded delegate — and label the line `AGREE` or `DIFFER`. **Mutation** cases are labelled `DELEGATE-ONLY`, because `guard.query()` accepts read methods only and there is no second entry point to compare against. The other four scripts are single-entry-point and carry no label. Scope-injection cases are labelled `SCOPE`: the tenant filter is added in the extension's query layer, so neither read entry point shows it and the case runs through `$allOperations` instead.

On prisma-guard 1.33.0 the tally is 58 `AGREE`, 4 `DIFFER`, 8 `DELEGATE-ONLY`, 3 `SCOPE`. All four `DIFFER` lines are expected, and each is a documented finding rather than a defect:

1. **projection auto-apply** — `parse()` returns `{}` where the delegate returns the shape's `select`, because projection is applied at execution.
2. **a mutation shape passed to `guard.query()`** — `parse()` raises `Caller key "where" collides with reserved shape config key`, while the delegate runs the mutation normally.
3. **a to-many `include` carrying a forced `where`** — the same mechanism as 1: `parse()` returns `{}`, the delegate emits the nested `where`.
4. **a to-one relation in `select`** — likewise, `parse()` returns `{}` and the delegate emits the projection.

A fifth `DIFFER`, or any of these four disappearing, is a real change in the runtime. Re-run after every upgrade and compare the tally line.

The tally moved from `39 / 2 / 8` when `verify-a3-ticketing.mts` was extended, in three rounds, with cases that had never been run: nested reads and scope injection, forced `NOT`, and forced conditions under relation filters. Both new `DIFFER`s are instances of finding 1, not new behavior.

Two of those rounds changed article claims rather than confirming them:

- **forced `NOT`** emits `{"NOT":{forced}}` alone and `{"NOT":[{client},{forced}]}` once a client sends its own — from either client spelling. "Kept as separate branches" was right; the shape-change was undocumented.
- **negative relation operators refuse forced conditions at construction**, with a message naming a client/forced mixture — and it fires with nothing mixed. `some` and `every` accept the same conditions. The to-one pair isolates it: `organizer.is` wholly forced builds, `organizer.isNot` with the identical condition throws, and a wholly client-controlled `organizer.isNot` builds. Re-check this one on every guard upgrade; it is the likeliest of these to change.

The four `DIFFER`s are three projection auto-apply differences — two of them on nested projections — plus one mutation shape passed to the read-only `guard.query()` entry point.

### One thing the runtime does that its README says it does not

The bundled prisma-guard README states, under "Forced where merge strategy", that conflicts on the same op key with different values throw `ShapeError`. For **client-supplied** values that does not happen — the forced value silently replaces the client's, verified on Boolean, String, Int and a scope-style FK through both entry points. The check does exist for conflicts **inside the shape config** (top level versus combinator), which is the `CONTROL` case at the end of `verify-forced-positions.mts`. Do not write a security test that expects a 400 from a conflicting client value.

## The three primitives

Mutations and scope normally need a real `PrismaClient`. They don't here.

**1. Reads — `guard.query().parse()`** returns the args that would have reached Prisma:

```ts
guard.query('Plant', 'findMany', shape).parse(body, { caller: '/shop' })
```

**2. Writes — call the model extension with a fake delegate.** `guard(input, caller)` resolves its delegate from `this.$parent[key]`, so any object with the right method names works:

```ts
const ext = guard.extension(() => ({ Nursery: 'nursery-1' }))
const fake = { create: async (args: unknown) => args }
const guarded = (ext.model as any).plant.guard.call({ $parent: { plant: fake } }, shape)
await guarded.create(body)
```

**3. Scope — call the operation interceptor directly:**

```ts
await (ext.query as any).$allOperations({
  model: 'Plant',
  operation: 'findMany',
  args: { where: { isPublished: true } },
  query: async (a: unknown) => a,
})
```

Both 2 and 3 reach into runtime internals (`$parent`, `$allOperations`). They are stable enough for a test harness on a pinned version and could break on any upgrade. Re-run the suite when bumping `prisma-guard` — a diff in `RESULTS.txt` is exactly the list of article claims that need re-checking.

## Schema notes

Two domains live in one schema, because Prisma allows one schema per project and the articles use different domains:

- `Nursery` (`@scope-root`) → `Plant`, `Order`; plus `Customer`, `OrderItem` — used by A9.
- `Organizer` (`@scope-root`) → `Event` → `Ticket` — used by A3.

They do not interact. Each article's quoted messages name its own models, which is the point: a message is only quotable if the harness produced it verbatim.

`tags String[]` on `Plant` is deliberately declared with **no** default. That is what triggers the create-completeness error quoted in the FAQ:

```
Required field "tags" on model "Plant" is missing from create data shape, has no default,
is not a scope FK, and is not covered by a relation write in the shape
```

Adding `@default([])` **does** register in the generated type map (`hasDefault: true`) and silences the check. Do not add it, or that FAQ entry stops reproducing.

An earlier version of this note claimed the opposite. The claim came from grepping generated output after a `prisma generate` that had silently failed (missing engine stub, see above), so the artifacts were stale. Regenerate before concluding anything from `generated/`.
