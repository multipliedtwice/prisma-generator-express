import { spawnSync } from 'node:child_process'
import { access, cp, mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

/**
 * The real generation stack the Postgres-backed MCP suites run on: prisma 6 +
 * prisma-guard 1.33 from the article-labs/guard environment, and THIS
 * worktree's built generator (`dist/bin.js`). Generation emits the guard
 * client and shape types next to the API, so the emitted route configs are
 * typed against real prisma-guard shapes.
 */

const HERE = dirname(fileURLToPath(import.meta.url))

export const ARTICLE_GUARD_DIR = resolve(
  HERE,
  '../../../../../article-labs/guard',
)
export const PRISMA_BIN = resolve(
  ARTICLE_GUARD_DIR,
  'node_modules/prisma/build/index.js',
)
export const GENERATOR_BIN = resolve(HERE, '../../../dist/bin.js')

export async function waitForBuiltGenerator(
  timeoutMs = 120_000,
): Promise<void> {
  // the consumer metadata test rebuilds `dist` via prepack; a parallel run can
  // observe the directory mid-rebuild
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      await access(GENERATOR_BIN)
      return
    } catch {
      await new Promise((r) => setTimeout(r, 500))
    }
  }
  throw new Error('dist/bin.js did not appear — did the generator build run?')
}

/**
 * Writes `schema` (with `${GUARD_OUT}`, `${API_BIN}` and `${API_OUT}`
 * placeholders) under the article env, places the prisma-guard 1.33 runtime
 * in `workDir`, and runs `prisma generate`. Returns the schema path and the
 * environment later CLI calls (db push) must reuse.
 */
export async function generateWithArticleGuard(input: {
  workDir: string
  /** Directory under ARTICLE_GUARD_DIR that holds the schema file. */
  schemaDirName: string
  schema: string
  databaseUrl: string
  label: string
  /**
   * Subdirectory of workDir the guard/api outputs land in: '' gives
   * `workDir/guard` + `workDir/api`; 'generated' mirrors a consumer project
   * (`./generated/guard`, `./generated/api`) so extracted docs snippets
   * resolve their own import paths unchanged.
   */
  outDir?: string
}): Promise<{ schemaPath: string; env: NodeJS.ProcessEnv }> {
  const out = resolve(input.workDir, input.outDir ?? '')
  await waitForBuiltGenerator()
  const schemaDir = resolve(ARTICLE_GUARD_DIR, input.schemaDirName)
  const schemaPath = resolve(schemaDir, 'schema.prisma')
  await mkdir(input.workDir, { recursive: true })
  await mkdir(schemaDir, { recursive: true })
  await writeFile(
    schemaPath,
    input.schema
      .replace('${GUARD_OUT}', resolve(out, 'guard'))
      .replace('${API_BIN}', GENERATOR_BIN)
      .replace('${API_OUT}', resolve(out, 'api')),
    'utf8',
  )
  // the guard RUNTIME must match the generator that produced the type map:
  // place 1.33 locally so the emitted guard/client resolves exactly that
  await mkdir(resolve(input.workDir, 'node_modules'), { recursive: true })
  await cp(
    resolve(ARTICLE_GUARD_DIR, 'node_modules/prisma-guard'),
    resolve(input.workDir, 'node_modules/prisma-guard'),
    { recursive: true },
  )
  const env = {
    ...process.env,
    // generator-by-name resolution: the `prisma-guard` generator binary is
    // taken from the article env (1.33), whatever else is on PATH
    PATH:
      resolve(ARTICLE_GUARD_DIR, 'node_modules/.bin') +
      ':' +
      (process.env.PATH ?? ''),
    DATABASE_URL: input.databaseUrl,
    // no engine stubs: callers may need the REAL engines (schema engine for
    // db push, query engine for the client at runtime)
  }
  const generate = spawnSync(
    process.execPath,
    [PRISMA_BIN, 'generate', '--schema', schemaPath],
    { cwd: ARTICLE_GUARD_DIR, env, encoding: 'utf8' },
  )
  if (generate.status !== 0) {
    throw new Error(
      input.label +
        ' prisma generate failed:\n' +
        (generate.stdout ?? '') +
        (generate.stderr ?? '') +
        String(generate.error ?? ''),
    )
  }
  return { schemaPath, env }
}

/** Absolute-URL import; vite transforms emitted .ts inside the project root. */
export async function importFrom<T>(
  workDir: string,
  modulePath: string,
): Promise<T> {
  return (await import(pathToFileURL(resolve(workDir, modulePath)).href)) as T
}
