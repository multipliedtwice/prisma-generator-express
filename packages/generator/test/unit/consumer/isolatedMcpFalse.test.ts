import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { execFileSync } from 'node:child_process'
import {
  mkdtempSync,
  rmSync,
  existsSync,
  readFileSync,
  readdirSync,
} from 'node:fs'
import { join, resolve, basename } from 'node:path'

/**
 * The packed artifact's MCP SURFACE for `mcp = false` consumers:
 *
 *  - the published manifest carries MCP packages only as OPTIONAL peers and
 *    has no MCP/prisma-guard runtime dependencies;
 *  - the dist ENTRY loads zero MCP modules (an mcp=false consumer never even
 *    parses the opt-in runtime);
 *  - the opt-in templates DO ship (mcp=true copies them into projects).
 *
 * SCOPE: this file checks the packed bytes and manifest. Full isolated
 * install/generate/mount execution is intentionally NOT claimed here — that
 * guarantee is covered against the generated output by mcpGeneration.test.ts
 * (runGenerate byte-identity + zero-MCP-emission) and by the DB-backed
 * readmeQuickstart/parity suites in this directory.
 */

const GENERATOR =
  basename(process.cwd()) === 'generator'
    ? process.cwd()
    : resolve('packages/generator')

let workdir: string
let packageRoot: string
let packFailed: string | null = null

beforeAll(() => {
  workdir = mkdtempSync(join(GENERATOR, '.isolated-mcp-'))
  try {
    execFileSync('npm', ['run', 'build'], {
      cwd: GENERATOR,
      stdio: 'pipe',
      encoding: 'utf-8',
    })
    const out = execFileSync(
      'npm',
      ['pack', '--ignore-scripts', '--pack-destination', workdir],
      { cwd: GENERATOR, stdio: 'pipe', encoding: 'utf-8' },
    )
    const tarball = out.trim().split('\n').pop()!.trim()
    execFileSync(
      'tar',
      ['-xzf', join(workdir, basename(tarball)), '-C', workdir],
      {
        stdio: 'pipe',
      },
    )
    packageRoot = join(workdir, 'package')
  } catch (error) {
    packFailed = error instanceof Error ? error.message : String(error)
  }
}, 900_000)

afterAll(() => {
  if (workdir) rmSync(workdir, { recursive: true, force: true })
})

function allFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name)
    if (entry.isDirectory()) allFiles(p, acc)
    else acc.push(p)
  }
  return acc
}

describe('packed artifact — manifest and import surface for mcp=false', () => {
  it('manifest declares MCP as optional peers only, no hard deps', () => {
    expect(packFailed).toBeNull()
    const manifest = JSON.parse(
      readFileSync(join(packageRoot, 'package.json'), 'utf-8'),
    )
    const deps = manifest.dependencies ?? {}
    // no MCP packages in runtime dependencies
    for (const name of Object.keys(deps)) {
      expect(name.startsWith('@modelcontextprotocol/'), name).toBe(false)
    }
    // prisma-guard is not a hard runtime dependency
    expect(deps['prisma-guard']).toBeUndefined()
    // MCP packages, when present at all, live in optional peerDependencies
    const peers = manifest.peerDependencies ?? {}
    const peerMeta = manifest.peerDependenciesMeta ?? {}
    for (const name of [
      '@modelcontextprotocol/server',
      '@modelcontextprotocol/node',
    ]) {
      expect(peers[name], `${name} should be an optional peer`).toBeDefined()
      expect(peerMeta[name]?.optional).toBe(true)
    }
    // prisma-guard stays an OPTIONAL peer for existing REST users
    expect(peers['prisma-guard']).toBe('>=1.0.0')
    expect(peerMeta['prisma-guard']?.optional).toBe(true)
  })

  it('tarball ships the MCP runtime only as an opt-in template, with no hard MCP imports in dist entry', () => {
    // The package IS the generator: its src/copy/mcpRuntime.ts and MCP
    // emitters ship as source templates (mcp=true copies them into consumer
    // projects). The no-MCP guarantee applies to GENERATED OUTPUT for
    // mcp=false — asserted in runGenerate in mcpGeneration.test.ts — and to
    // the manifest (above). Here we assert the shipped dist ENTRY does not
    // import MCP at module load, so mcp=false consumers never load it.
    expect(packFailed).toBeNull()
    const entryText = readFileSync(
      join(packageRoot, 'dist', 'index.js'),
      'utf-8',
    )
    expect(entryText.includes('@modelcontextprotocol')).toBe(false)
    // the templates are present for mcp=true consumers
    expect(
      existsSync(join(packageRoot, 'src', 'copy', 'mcpRuntime.ts')),
      'the MCP runtime template should ship for mcp=true',
    ).toBe(true)
  })

  it('packed dist imports no prisma-guard module', () => {
    expect(packFailed).toBeNull()
    // the copied runtime must not import prisma-guard anywhere
    for (const file of allFiles(join(packageRoot, 'src'))) {
      if (!file.endsWith('.ts')) continue
      const text = readFileSync(file, 'utf8')
      expect(
        /from ['"]prisma-guard|require\(['"]prisma-guard/.test(text),
        `${file} imports prisma-guard`,
      ).toBe(false)
    }
    // dist likewise
    for (const file of allFiles(join(packageRoot, 'dist'))) {
      if (!file.endsWith('.js')) continue
      const text = readFileSync(file, 'utf8')
      expect(
        /from ['"]prisma-guard|require\(['"]prisma-guard/.test(text),
        `${file} imports prisma-guard`,
      ).toBe(false)
    }
  })
})

const MCP_FILE_RE = /[Mm]cp/
