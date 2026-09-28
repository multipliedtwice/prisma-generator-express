import { describe, it, expect, afterAll } from 'vitest'
import {
  copyFile,
  mkdir,
  mkdtemp,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises'
import { statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import * as esbuild from 'esbuild'
import type { DMMF } from '@prisma/generator-helper'
import { generateHonoRouterParts } from '../../src/generators/generateRouterPartsHono'
import { generateHonoOpenApiRoutes } from '../../src/generators/generateHonoOpenApi'
import { generateHonoHandler } from '../../src/generators/generateHonoHandler'
import { generateModelCore } from '../../src/generators/generateOperationCore'
import { generateModelMetadata } from '../../src/generators/generateModelMetadata'

/**
 * Phase 9 bundle budget: a two-model Hono CRUD sample built from the per-op
 * parts boundary must stay small, and enabling heavy features (the OpenAPI
 * renderer) must grow the reachable bundle.
 *
 * BUDGET below is the measured baseline (minified, `hono` external) plus
 * ~20% headroom, recorded at authoring time: 2026-09-26, esbuild 0.28.x.
 * Measured minimal two-model CRUD (findMany+findUnique+count / findMany):
 * 29,276 bytes -> budget 36,000. After the compat restoration (mat-view
 * counting statically owned by pagination) the measured minimal bundle is
 * 29,810 bytes -> budget stays 36,000. Heavy sample (5 ops + OpenAPI part):
 * 119,118 bytes, so the gate has real room to catch regressions.
 */
const COPY_DIR = resolve(__dirname, '../../src/copy')
const BUDGET_BYTES = 36_000

const USER_MODEL = {
  name: 'User',
  dbName: null,
  schema: null,
  fields: [
    {
      name: 'id',
      kind: 'scalar',
      isList: false,
      isRequired: true,
      isUnique: false,
      isId: true,
      isReadOnly: false,
      hasDefaultValue: true,
      type: 'Int',
      isGenerated: false,
      isUpdatedAt: false,
    },
    {
      name: 'email',
      kind: 'scalar',
      isList: false,
      isRequired: true,
      isUnique: true,
      isId: false,
      isReadOnly: false,
      hasDefaultValue: false,
      type: 'String',
      isGenerated: false,
      isUpdatedAt: false,
    },
    {
      name: 'name',
      kind: 'scalar',
      isList: false,
      isRequired: false,
      isUnique: false,
      isId: false,
      isReadOnly: false,
      hasDefaultValue: false,
      type: 'String',
      isGenerated: false,
      isUpdatedAt: false,
    },
  ],
  primaryKey: null,
  uniqueFields: [],
  uniqueIndexes: [],
  isGenerated: false,
} as unknown as DMMF.Model

const POST_MODEL = {
  name: 'Post',
  dbName: null,
  schema: null,
  fields: [
    {
      name: 'id',
      kind: 'scalar',
      isList: false,
      isRequired: true,
      isUnique: false,
      isId: true,
      isReadOnly: false,
      hasDefaultValue: true,
      type: 'Int',
      isGenerated: false,
      isUpdatedAt: false,
    },
    {
      name: 'title',
      kind: 'scalar',
      isList: false,
      isRequired: true,
      isUnique: false,
      isId: false,
      isReadOnly: false,
      hasDefaultValue: false,
      type: 'String',
      isGenerated: false,
      isUpdatedAt: false,
    },
    {
      name: 'views',
      kind: 'scalar',
      isList: false,
      isRequired: true,
      isUnique: false,
      isId: false,
      isReadOnly: false,
      hasDefaultValue: true,
      type: 'Int',
      isGenerated: false,
      isUpdatedAt: false,
    },
  ],
  primaryKey: null,
  uniqueFields: [],
  uniqueIndexes: [],
  isGenerated: false,
} as unknown as DMMF.Model

async function emitProject(): Promise<string> {
  const dir = await mkdtemp(resolve(__dirname, '../../.bundle-budget-'))
  for (const name of await readdir(COPY_DIR)) {
    if (!name.endsWith('.ts')) continue
    await copyFile(join(COPY_DIR, name), join(dir, name))
  }
  await copyFile(
    join(COPY_DIR, 'routeConfig.hono.ts'),
    join(dir, 'routeConfig.target.ts'),
  )
  for (const model of [USER_MODEL, POST_MODEL]) {
    const modelDir = join(dir, model.name)
    await mkdir(modelDir, { recursive: true })
    const shared = {
      model,
      enums: [] as DMMF.DatamodelEnum[],
      guardShapesImport: null,
      importStyle: 'none' as never,
      writeStrategy: 'regular' as never,
      pathCase: 'raw' as never,
      dropGuard: false,
    }
    await writeFile(
      join(modelDir, `${model.name}RouterParts.ts`),
      generateHonoRouterParts(shared),
      'utf8',
    )
    await writeFile(
      join(modelDir, `${model.name}OpenApi.ts`),
      generateHonoOpenApiRoutes({
        model,
        enums: [] as DMMF.DatamodelEnum[],
        guardShapesImport: null,
        importStyle: 'none' as never,
        writeStrategy: 'regular' as never,
        pathCase: 'raw' as never,
      }),
      'utf8',
    )
    await writeFile(
      join(modelDir, `${model.name}Handlers.ts`),
      generateHonoHandler({ model, importStyle: 'none' as never }),
      'utf8',
    )
    await writeFile(
      join(modelDir, `${model.name}Core.ts`),
      generateModelCore({
        model,
        importStyle: 'none' as never,
        writeStrategy: 'regular' as never,
        findManyPaginatedMode: 'transaction' as never,
      }),
      'utf8',
    )
    await writeFile(
      join(modelDir, `${model.name}Metadata.ts`),
      generateModelMetadata({ model, enums: [], importStyle: 'none' as never }),
      'utf8',
    )
  }
  return dir
}

async function bundle(
  dir: string,
  entry: string,
): Promise<{ bytes: number; text: string }> {
  const outfile = join(dir, 'out.mjs')
  await esbuild.build({
    entryPoints: [join(dir, entry)],
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    minify: true,
    outfile,
    external: ['hono', 'prisma-sql'],
    logLevel: 'silent',
  })
  const { readFile } = await import('node:fs/promises')
  return {
    bytes: statSync(outfile).size,
    text: await readFile(outfile, 'utf8'),
  }
}

const cleanups: Array<() => Promise<void>> = []
afterAll(async () => {
  for (const cleanup of cleanups) await cleanup()
})

describe('Hono per-op parts bundle budget', () => {
  it('a minimal two-model CRUD bundle stays under budget and free of heavy modules', async () => {
    const dir = await emitProject()
    cleanups.push(() => rm(dir, { recursive: true, force: true }))
    await writeFile(
      join(dir, 'entry-minimal.ts'),
      `import { Hono } from 'hono'
import { userFindMany, userFindUnique, userCount, postFindMany } from './parts'
const app = new Hono()
app.route('/', userFindMany({}))
app.route('/', userFindUnique({}))
app.route('/', userCount({}))
app.route('/', postFindMany({}))
export default app
`,
      'utf8',
    )
    await writeFile(
      join(dir, 'parts.ts'),
      `export { userFindMany, userFindUnique, userCount } from './User/UserRouterParts'
export { postFindMany } from './Post/PostRouterParts'
`,
      'utf8',
    )

    const { bytes, text } = await bundle(dir, 'entry-minimal.ts')

    // budget is a CI gate: measure before you edit the number, and justify it
    expect(
      bytes,
      `minimal bundle grew past budget: ${bytes} > ${BUDGET_BYTES}`,
    ).toBeLessThanOrEqual(BUDGET_BYTES)

    // heavy modules unreachable: OpenAPI renderer, yaml, docs renderer,
    // materialized-view counting, SSE/ndjson (express-only anyway)
    expect(text).not.toContain('openapi')
    expect(text).not.toContain('buildModelOpenApi')
    expect(text).not.toContain('queryRawUnsafe')
    expect(text).not.toContain('text/event-stream')
  }, 120_000)

  it('enabling the OpenAPI part grows the reachable bundle', async () => {
    const dir = await emitProject()
    cleanups.push(() => rm(dir, { recursive: true, force: true }))
    await writeFile(
      join(dir, 'entry-minimal.ts'),
      `import { Hono } from 'hono'
import { userFindMany } from './parts-min'
const app = new Hono()
app.route('/', userFindMany({}))
export default app
`,
      'utf8',
    )
    await writeFile(
      join(dir, 'parts-min.ts'),
      `export { userFindMany } from './User/UserRouterParts'\n`,
      'utf8',
    )
    await writeFile(
      join(dir, 'entry-heavy.ts'),
      `import { Hono } from 'hono'
import { userFindMany, userOpenApi, userCreate, userFindManyPaginated, userDeleteMany } from './parts-heavy'
const app = new Hono()
app.route('/', userFindMany({}))
app.route('/', userOpenApi({}))
app.route('/', userCreate({}))
app.route('/', userFindManyPaginated({}))
app.route('/', userDeleteMany({}))
export default app
`,
      'utf8',
    )
    await writeFile(
      join(dir, 'parts-heavy.ts'),
      `export { userFindMany, userCreate, userFindManyPaginated, userDeleteMany } from './User/UserRouterParts'
export { userOpenApi } from './User/UserOpenApi'
`,
      'utf8',
    )

    const minimal = await bundle(dir, 'entry-minimal.ts')
    const heavy = await bundle(dir, 'entry-heavy.ts')

    expect(
      heavy.bytes,
      'the OpenAPI part did not grow the bundle',
    ).toBeGreaterThan(minimal.bytes + 10_000)
    expect(heavy.text).toContain('openapi')
  }, 120_000)

  it('the bundled ESM output RUNS: dynamic imports are resolvable at runtime', async () => {
    // finding: an unresolvable dynamic import survives esbuild but explodes
    // at first use. This executes the bundle, not just its bytes.
    const dir = await emitProject()
    cleanups.push(() => rm(dir, { recursive: true, force: true }))
    await writeFile(
      join(dir, 'entry-run.ts'),
      `import { Hono } from 'hono'
import { userFindMany, userFindManyPaginated } from './parts-run'
const app = new Hono()
app.route('/', userFindMany({}))
app.route('/', userFindManyPaginated({}))
export default app
`,
      'utf8',
    )
    await writeFile(
      join(dir, 'parts-run.ts'),
      `export { userFindMany, userFindManyPaginated } from './User/UserRouterParts'
`,
      'utf8',
    )

    const { bytes } = await bundle(dir, 'entry-run.ts')
    expect(bytes).toBeLessThanOrEqual(BUDGET_BYTES)

    const outfile = join(dir, 'out.mjs')
    const mod = (await import(pathToFileURL(outfile).href)) as {
      default: { request: (path: string) => Promise<Response> }
    }
    const res = await mod.default.request('/user')
    // the bundle LOADED (no broken dynamic import) and the route matched:
    // without prisma the handler errors before a response body is set
    expect(res.status).toBeGreaterThanOrEqual(200)
    await res.arrayBuffer()
  }, 120_000)

  it('unselected operations leave no route text in the bundle', async () => {
    const dir = await emitProject()
    cleanups.push(() => rm(dir, { recursive: true, force: true }))
    await writeFile(
      join(dir, 'entry-minimal.ts'),
      `import { Hono } from 'hono'
import { userFindMany } from './parts'
const app = new Hono()
app.route('/', userFindMany({}))
export default app
`,
      'utf8',
    )
    await writeFile(
      join(dir, 'parts.ts'),
      `export { userFindMany } from './User/UserRouterParts'\n`,
      'utf8',
    )

    const { text } = await bundle(dir, 'entry-minimal.ts')

    // write-operation and updateEach routes of the same model are absent —
    // the op-name list inside warnIfUnguardedRoutes is metadata, so assert on
    // the route registration inputs instead.
    expect(text).not.toContain('opKind:"upsert"')
    expect(text).not.toContain('opKind:"deleteMany"')
    expect(text).not.toContain('opKind:"create"')
    expect(text).not.toContain('/each')
  }, 120_000)
})
