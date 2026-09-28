import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ARTICLE_GUARD_DIR,
  generateWithArticleGuard,
} from './articleGuardStack'
import {
  README_PATH,
  readMarkedBlock,
  readmeQuickstartSchema,
  snippetTsconfig,
} from './docsSnippet'

/**
 * DOCS DRIFT GATE for the README MCP quickstart TYPES. The README schema and
 * `server.ts` are EXTRACTED between stable markers, the schema is generated
 * with real prisma-guard 1.33 into a consumer-shaped work dir
 * (`./generated/guard`, `./generated/api`), and `server.ts` — verbatim — must
 * compile under `tsc --strict`. Runtime behaviour of the same quickstart is
 * readmeQuickstart.test.ts.
 */

const HERE = dirname(fileURLToPath(import.meta.url))
const WORK_DIR = resolve(HERE, '../../../.readme-example')
const TSC = createRequire(import.meta.url).resolve('typescript/lib/tsc.js')

let server = ''

beforeAll(async () => {
  server = await readMarkedBlock(
    README_PATH,
    'readme-example:mcp-quickstart-server',
    'ts',
  )
  await generateWithArticleGuard({
    workDir: WORK_DIR,
    schemaDirName: 'readme-example',
    schema: await readmeQuickstartSchema(),
    databaseUrl: 'postgresql://unused:unused@127.0.0.1:1/unused',
    label: 'README quickstart types',
    outDir: 'generated',
  })
  await writeFile(resolve(WORK_DIR, 'server.ts'), server, 'utf8')
  await writeFile(
    resolve(WORK_DIR, 'tsconfig.json'),
    snippetTsconfig(
      'server.ts',
      resolve(ARTICLE_GUARD_DIR, 'node_modules/@prisma/client'),
    ),
    'utf8',
  )
}, 300_000)

afterAll(async () => {
  if (!process.env.PARITY_KEEP_WORK_DIR) {
    await rm(WORK_DIR, { recursive: true, force: true })
    await rm(resolve(ARTICLE_GUARD_DIR, 'readme-example'), {
      recursive: true,
      force: true,
    })
  }
})

describe('README MCP quickstart server.ts (extracted from README.md)', () => {
  it('annotates its route config with the generated, guard-typed UserRouteConfig', async () => {
    expect(server).toMatch(/const userConfig: UserRouteConfig\b/)
    const router = await readFile(
      resolve(WORK_DIR, 'generated/api/User/UserRouter.ts'),
      'utf8',
    )
    // the route type is built from prisma-guard shapes: not a vacuous check
    expect(router).toMatch(/UserUpdateShape/)
  })

  it('compiles under tsc --strict against the generated output', () => {
    try {
      const out = execFileSync(
        process.execPath,
        [TSC, '--noEmit', '-p', 'tsconfig.json'],
        { cwd: WORK_DIR, encoding: 'utf8', stdio: 'pipe' },
      )
      expect(out).toBe('')
    } catch (error) {
      const failure = error as { stdout?: string; stderr?: string }
      expect.fail(
        'the README quickstart server.ts does not typecheck:\n' +
          (failure.stdout ?? '') +
          (failure.stderr ?? ''),
      )
    }
  }, 180_000)
})
