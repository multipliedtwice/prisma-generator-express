import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { McpServer } from '@modelcontextprotocol/server'
import {
  ARTICLE_GUARD_DIR,
  generateWithArticleGuard,
  importFrom,
} from './articleGuardStack'
import { GUIDE_PATH, readMarkedBlock, snippetTsconfig } from './docsSnippet'
import { fakeServer, fakeAuthInfo } from './mcpTestHarness'

/**
 * DOCS DRIFT GATE for the guide's tenant-safe Page example. The snippet is
 * EXTRACTED from docs/guide.md between stable markers — never copied — and
 * placed in a work dir laid out like a consumer project (`./generated/api`,
 * `./generated/guard`), so its own imports resolve unchanged. Then:
 *  1. it compiles under `tsc --strict` against the `PageRouteConfig` the
 *     generator emits WITH real prisma-guard 1.33 shape types, and
 *  2. it executes: every action it configures is created through the
 *     emitted factory and registered for both tenants (registration runs
 *     the full fail-closed shape validation).
 */

const HERE = dirname(fileURLToPath(import.meta.url))
const WORK_DIR = resolve(HERE, '../../../.guide-example')
const TSC = createRequire(import.meta.url).resolve('typescript/lib/tsc.js')

/** The model the example is written for (named in the example's comment). */
const SCHEMA = `datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

generator guard {
  provider = "prisma-guard"
  output   = "\${GUARD_OUT}"
}

generator api {
  provider = "\${API_BIN}"
  output   = "\${API_OUT}"
  target   = "express"
  mcp      = true
}

model Page {
  id     String @id @default(cuid())
  siteId String
  slug   String
  title  String

  @@unique([siteId, slug])
}
`

let snippet = ''

beforeAll(async () => {
  snippet = await readMarkedBlock(
    GUIDE_PATH,
    'guide-example:mcp-tenant-page',
    'ts',
  )
  await generateWithArticleGuard({
    workDir: WORK_DIR,
    schemaDirName: 'guide-example',
    schema: SCHEMA,
    // generate never connects; the datasource only needs a well-formed URL
    databaseUrl: 'postgresql://unused:unused@127.0.0.1:1/unused',
    label: 'guide example',
    outDir: 'generated',
  })
  // the snippet verbatim, plus an independent assignment so removing the
  // snippet's own annotation cannot make the type check vacuous
  await writeFile(
    resolve(WORK_DIR, 'guideExample.ts'),
    snippet +
      "\nimport type { PageRouteConfig as GeneratedPageRouteConfig } from './generated/api/Page/PageRouter'\n" +
      'export const typedPageConfig: GeneratedPageRouteConfig = pageConfig\n',
    'utf8',
  )
  await writeFile(
    resolve(WORK_DIR, 'tsconfig.json'),
    snippetTsconfig(
      'guideExample.ts',
      resolve(ARTICLE_GUARD_DIR, 'node_modules/@prisma/client'),
    ),
    'utf8',
  )
}, 300_000)

afterAll(async () => {
  if (!process.env.PARITY_KEEP_WORK_DIR) {
    await rm(WORK_DIR, { recursive: true, force: true })
    await rm(resolve(ARTICLE_GUARD_DIR, 'guide-example'), {
      recursive: true,
      force: true,
    })
  }
})

describe('guide tenant-safe Page example (extracted from docs/guide.md)', () => {
  it('is one extracted block that defines pageConfig and imports force', () => {
    expect(snippet).toContain("import { force } from 'prisma-guard'")
    expect(snippet).toMatch(/const pageConfig\b/)
  })

  it('the route types really come from prisma-guard shapes (the check is not vacuous)', async () => {
    const router = await readFile(
      resolve(WORK_DIR, 'generated/api/Page/PageRouter.ts'),
      'utf8',
    )
    expect(router).toMatch(/PageCreateShape/)
    expect(router).toMatch(/PageUpdateShape/)
  })

  it('compiles under tsc --strict against the generated PageRouteConfig', () => {
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
        'the guide example does not typecheck against the generated route config:\n' +
          (failure.stdout ?? '') +
          (failure.stderr ?? ''),
      )
    }
  }, 180_000)

  it('registers every configured action for each tenant through the emitted factories', async () => {
    const example = await importFrom<{
      typedPageConfig: Record<string, unknown>
    }>(WORK_DIR, 'guideExample.ts')
    const factories = await importFrom<
      Record<string, (o: { config: unknown }) => unknown>
    >(WORK_DIR, 'generated/api/Page/PageMcp.ts')
    const runtime = await importFrom<{
      registerMcpTools: (
        server: McpServer,
        options: Record<string, unknown>,
      ) => void
    }>(WORK_DIR, 'generated/api/mcpRuntime.ts')

    const operations = Object.keys(example.typedPageConfig)
    expect(operations.length).toBeGreaterThan(0)
    for (const tenant of ['tenant-a', 'tenant-b']) {
      const { server, tools } = fakeServer()
      runtime.registerMcpTools(server, {
        prisma: {},
        resolveCaller: () => tenant,
        authorize: () => undefined,
        defaultLimit: 5,
        maxLimit: 50,
        maxResultBytes: 1_000_000,
        authInfo: fakeAuthInfo({ clientId: tenant }),
        tools: operations.map((op) => {
          const factory =
            factories[
              'page' + op.charAt(0).toUpperCase() + op.slice(1) + 'Tool'
            ]
          if (!factory) throw new Error('no emitted factory for ' + op)
          return factory({ config: example.typedPageConfig })
        }),
      })
      expect(tools.map((t) => t.name)).toEqual(
        operations.map(
          (op) => 'page_' + op.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase()),
        ),
      )
    }
  })
})
