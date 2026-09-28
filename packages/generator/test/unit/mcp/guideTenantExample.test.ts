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
import { fakeServer, fakeAuthInfo } from './mcpTestHarness'

/**
 * DOCS DRIFT GATE for the guide's tenant-safe Page example. The snippet is
 * EXTRACTED from docs/guide.md between stable markers — never copied — then:
 *  1. compiled under `tsc --strict` against the `PageRouteConfig` the
 *     generator emits WITH real prisma-guard 1.33 shape types, and
 *  2. executed: every action it configures is created through the emitted
 *     factory and registered for both tenants (registration runs the full
 *     fail-closed shape validation).
 * Editing the guide example so it no longer typechecks or registers fails
 * this test.
 */

const HERE = dirname(fileURLToPath(import.meta.url))
const GUIDE = resolve(HERE, '../../../../../docs/guide.md')
const WORK_DIR = resolve(HERE, '../../../.guide-example')
const START = '<!-- guide-example:mcp-tenant-page:start -->'
const END = '<!-- guide-example:mcp-tenant-page:end -->'
const TSC = createRequire(import.meta.url).resolve('typescript/lib/tsc.js')

/** The model the example is written for: compound @@unique([siteId, slug]). */
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

/** The single fenced `ts` block between the markers. */
function extractGuideExample(markdown: string): string {
  const start = markdown.indexOf(START)
  const end = markdown.indexOf(END)
  if (start < 0 || end < 0 || end < start) {
    throw new Error('guide example markers missing or out of order')
  }
  if (markdown.indexOf(START, start + 1) >= 0) {
    throw new Error('guide example start marker appears more than once')
  }
  const region = markdown.slice(start + START.length, end)
  const blocks = [...region.matchAll(/```ts\n([\s\S]*?)```/g)]
  if (blocks.length !== 1) {
    throw new Error(
      'expected exactly one ts block between the markers, found ' +
        blocks.length,
    )
  }
  return blocks[0]?.[1] ?? ''
}

const TSCONFIG = (prismaClientDir: string) =>
  JSON.stringify(
    {
      compilerOptions: {
        target: 'ES2022',
        module: 'ESNext',
        moduleResolution: 'Bundler',
        strict: true,
        noEmit: true,
        skipLibCheck: true,
        types: ['node'],
        baseUrl: '.',
        // the generated guard client and route types read the Prisma
        // namespace of the client generated for THIS schema
        paths: { '@prisma/client': [prismaClientDir] },
      },
      files: ['guideExample.ts'],
    },
    null,
    2,
  )

let snippet = ''

beforeAll(async () => {
  snippet = extractGuideExample(await readFile(GUIDE, 'utf8'))
  await generateWithArticleGuard({
    workDir: WORK_DIR,
    schemaDirName: 'guide-example',
    schema: SCHEMA,
    // generate never connects; the datasource only needs a well-formed URL
    databaseUrl: 'postgresql://unused:unused@127.0.0.1:1/unused',
    label: 'guide example',
  })
  await writeFile(
    resolve(WORK_DIR, 'guideExample.ts'),
    "import type { PageRouteConfig } from './api/Page/PageRouter'\n" +
      snippet +
      '\n// the example must be a valid, guard-typed generated route config\n' +
      'export const typedPageConfig: PageRouteConfig = pageConfig\n',
    'utf8',
  )
  await writeFile(
    resolve(WORK_DIR, 'tsconfig.json'),
    TSCONFIG(resolve(ARTICLE_GUARD_DIR, 'node_modules/@prisma/client')),
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
      resolve(WORK_DIR, 'api/Page/PageRouter.ts'),
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
    >(WORK_DIR, 'api/Page/PageMcp.ts')
    const runtime = await importFrom<{
      registerMcpTools: (
        server: McpServer,
        options: Record<string, unknown>,
      ) => void
    }>(WORK_DIR, 'api/mcpRuntime.ts')

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
