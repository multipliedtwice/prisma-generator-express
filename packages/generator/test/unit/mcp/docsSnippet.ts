import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Docs drift support: code blocks are EXTRACTED from the published markdown
 * between `<!-- name:start -->` / `<!-- name:end -->` markers — tests never
 * keep a second handwritten copy.
 */

const REPO_ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../..',
)

export const README_PATH = resolve(REPO_ROOT, 'README.md')
export const GUIDE_PATH = resolve(REPO_ROOT, 'docs/guide.md')

/** The single fenced `lang` block between the named markers. */
export function extractMarkedBlock(
  markdown: string,
  name: string,
  lang: string,
): string {
  const startMarker = '<!-- ' + name + ':start -->'
  const endMarker = '<!-- ' + name + ':end -->'
  const start = markdown.indexOf(startMarker)
  const end = markdown.indexOf(endMarker)
  if (start < 0 || end < 0 || end < start) {
    throw new Error(name + ': markers missing or out of order')
  }
  if (markdown.indexOf(startMarker, start + 1) >= 0) {
    throw new Error(name + ': start marker appears more than once')
  }
  const region = markdown.slice(start + startMarker.length, end)
  const fence = new RegExp('```' + lang + '\\n([\\s\\S]*?)```', 'g')
  const blocks = [...region.matchAll(fence)]
  if (blocks.length !== 1) {
    throw new Error(
      name +
        ': expected exactly one ' +
        lang +
        ' block between the markers, found ' +
        blocks.length,
    )
  }
  return blocks[0]?.[1] ?? ''
}

export async function readMarkedBlock(
  file: string,
  name: string,
  lang: string,
): Promise<string> {
  return extractMarkedBlock(await readFile(file, 'utf8'), name, lang)
}

/**
 * The README quickstart schema, pointed at the stack under test: the
 * published generator provider and the two relative outputs become the
 * `${API_BIN}` / `${API_OUT}` / `${GUARD_OUT}` placeholders
 * `generateWithArticleGuard` fills in. Each replacement must match exactly
 * once, so an edited schema fails loudly instead of silently diverging.
 */
export async function readmeQuickstartSchema(): Promise<string> {
  let schema = await readMarkedBlock(
    README_PATH,
    'readme-example:mcp-quickstart-schema',
    'prisma',
  )
  for (const [from, to] of [
    ['provider = "prisma-generator-express"', 'provider = "${API_BIN}"'],
    ['output   = "./generated/api"', 'output   = "${API_OUT}"'],
    ['output   = "./generated/guard"', 'output   = "${GUARD_OUT}"'],
  ] as const) {
    const count = schema.split(from).length - 1
    if (count !== 1) {
      throw new Error(
        'README schema: expected exactly one `' + from + '`, found ' + count,
      )
    }
    schema = schema.replace(from, to)
  }
  return schema
}

/** Strict tsconfig for a snippet compiled inside a generated work dir. */
export function snippetTsconfig(file: string, prismaClientDir: string): string {
  return JSON.stringify(
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
        // generated guard/route types read the Prisma namespace of the
        // client generated for THIS schema
        paths: { '@prisma/client': [prismaClientDir] },
      },
      files: [file],
    },
    null,
    2,
  )
}
