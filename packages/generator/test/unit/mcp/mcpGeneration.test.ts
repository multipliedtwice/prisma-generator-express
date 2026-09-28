import { describe, it, expect, afterAll } from 'vitest'
import { runGenerate } from '../../../src/index'
import { copyFiles } from '../../../src/utils/copyFiles'
import type { GeneratorOptions, DMMF } from '@prisma/generator-helper'
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { resolve } from 'node:path'

/**
 * Generation-level MCP gates over the REAL onGenerate path (runGenerate):
 *  - mcp=false emits ZERO MCP files, imports or dependencies;
 *  - mcp=true adds exactly the MCP files, and every non-MCP file is
 *    BYTE-IDENTICAL to the mcp=false generation of the same schema;
 *  - mcp=true with dropGuard=true fails generation inside runGenerate itself.
 */

function scalarField(name: string, type = 'String'): DMMF.Field {
  return {
    name,
    kind: 'scalar',
    isList: false,
    isRequired: true,
    isUnique: name === 'id',
    isId: name === 'id',
    isReadOnly: false,
    hasDefaultValue: false,
    type,
    isGenerated: false,
    isUpdatedAt: false,
  } as unknown as DMMF.Field
}

const USER_MODEL: DMMF.Model = {
  name: 'User',
  dbName: null,
  schema: null,
  fields: [
    scalarField('id'),
    scalarField('email'),
    {
      name: 'posts',
      kind: 'object',
      isList: true,
      isRequired: true,
      isUnique: false,
      isId: false,
      isReadOnly: false,
      hasDefaultValue: false,
      type: 'Post',
      isGenerated: false,
      isUpdatedAt: false,
      relationName: 'UserToPost',
      relationFromFields: [],
      relationToFields: [],
    } as unknown as DMMF.Field,
  ],
  primaryKey: null,
  uniqueFields: [],
  uniqueIndexes: [],
  isGenerated: false,
} as unknown as DMMF.Model

const POST_MODEL: DMMF.Model = {
  name: 'Post',
  dbName: null,
  schema: null,
  fields: [scalarField('id'), scalarField('title')],
  primaryKey: null,
  uniqueFields: [],
  uniqueIndexes: [],
  isGenerated: false,
} as unknown as DMMF.Model

function fakeOptions(
  output: string,
  config: Record<string, unknown>,
): GeneratorOptions {
  return {
    generator: {
      config,
      output: { value: output, fromEnvVar: null },
      name: 'express',
      provider: { fromEnvVar: null, value: 'x' },
    },
    dmmf: {
      datamodel: { models: [USER_MODEL, POST_MODEL], enums: [] },
    } as never,
    schemaPath: resolve(output, 'schema.prisma'),
    datasources: [],
    otherGenerators: [
      {
        name: 'client',
        provider: { fromEnvVar: null, value: 'prisma-client-js' },
        output: { value: resolve(output, 'client'), fromEnvVar: null },
      } as never,
    ],
    version: '0.0.0',
    binaryPaths: {},
    env: {},
  } as unknown as GeneratorOptions
}

async function generateInto(config: Record<string, unknown>): Promise<string> {
  const dir = await mkdtemp(resolve(__dirname, '../../../.mcp-gen-'))
  // register FIRST: a throwing generation (mcp+dropGuard) must not leak the dir
  cleanups.push(() => rm(dir, { recursive: true, force: true }))
  await runGenerate(fakeOptions(dir, config))
  return dir
}

async function listFiles(dir: string): Promise<string[]> {
  const out: string[] = []
  async function walk(d: string) {
    for (const entry of await readdir(d, { withFileTypes: true })) {
      const p = resolve(d, entry.name)
      if (entry.isDirectory()) await walk(p)
      else out.push(p.slice(dir.length + 1))
    }
  }
  await walk(dir)
  return out.sort()
}

const MCP_FILE_RE = /[Mm]cp/

const cleanups: Array<() => Promise<void>> = []
afterAll(async () => {
  for (const cleanup of cleanups) await cleanup()
})

describe('mcp generation gates (full runGenerate)', () => {
  it('mcp=false emits zero MCP files and no MCP references anywhere', async () => {
    const dir = await generateInto({ target: 'express' })
    cleanups.push(() => rm(dir, { recursive: true, force: true }))
    const files = await listFiles(dir)
    expect(files.filter((f) => MCP_FILE_RE.test(f))).toEqual([])
    for (const file of files) {
      const text = await readFile(resolve(dir, file), 'utf8')
      expect(
        text.includes('@modelcontextprotocol'),
        file + ' references the MCP SDK',
      ).toBe(false)
      expect(
        /registerMcpTools|createMcpReadTool|createMcpWriteTool|McpServer/.test(
          text,
        ),
        file + ' references MCP APIs',
      ).toBe(false)
    }
  })

  it('mcp=true adds exactly the MCP files; every shared file is byte-identical', async () => {
    const offDir = await generateInto({ target: 'express' })
    const onDir = await generateInto({ target: 'express', mcp: true })
    cleanups.push(() => rm(offDir, { recursive: true, force: true }))
    cleanups.push(() => rm(onDir, { recursive: true, force: true }))

    const offFiles = await listFiles(offDir)
    const onFiles = await listFiles(onDir)

    const added = onFiles.filter((f) => !offFiles.includes(f))
    expect(added.sort()).toEqual([
      'Post/PostMcp.ts',
      'User/UserMcp.ts',
      'mcp.ts',
      'mcpMount.ts',
      'mcpRuntime.ts',
    ])

    // every shared file is byte-identical
    for (const file of offFiles) {
      const offBytes = await readFile(resolve(offDir, file))
      const onBytes = await readFile(resolve(onDir, file))
      expect(
        offBytes.equals(onBytes),
        file + ' differs between mcp=false and mcp=true',
      ).toBe(true)
    }

    // the emitted tool factory is model-aware: carries fields + related index
    const userMcp = await readFile(resolve(onDir, 'User/UserMcp.ts'), 'utf8')
    expect(userMcp).toContain('fields: MODEL_FIELDS')
    expect(userMcp).toContain("from '../Post/PostMetadata'")
    expect(userMcp).toContain('userFindManyTool')

    // every guarded write op has a factory beside the reads; delete binds
    // the deleteUnique core (Prisma's delegate method name)
    for (const op of [
      'Create',
      'CreateMany',
      'CreateManyAndReturn',
      'Update',
      'UpdateMany',
      'UpdateManyAndReturn',
      'Upsert',
      'Delete',
      'DeleteMany',
    ]) {
      expect(userMcp).toContain('export function user' + op + 'Tool')
    }
    expect(userMcp).toContain('createMcpWriteTool')
    expect(userMcp).toMatch(/core\.deleteUnique,/)
    // updateEach bypasses guard shapes: no MCP factory
    expect(userMcp).not.toContain('userUpdateEachTool')

    // the registry requires a verified principal
    const runtime = await readFile(resolve(onDir, 'mcpRuntime.ts'), 'utf8')
    expect(runtime).toContain("'@modelcontextprotocol/server'")
    expect(runtime).not.toContain('@modelcontextprotocol/sdk')
  })

  it('every write factory carries the generation writeStrategy; reads carry none', async () => {
    for (const strategy of ['regular', 'throwOnNonReturning', 'forceReturn']) {
      const dir = await generateInto({
        target: 'express',
        mcp: true,
        writeStrategy: strategy,
      })
      const userMcp = await readFile(resolve(dir, 'User/UserMcp.ts'), 'utf8')
      const tagged = userMcp.match(/writeStrategy: '([A-Za-z]+)'/g) ?? []
      // nine guarded write factories, each tagged with THIS strategy
      expect(tagged).toEqual(
        Array.from({ length: 9 }, () => "writeStrategy: '" + strategy + "'"),
      )
    }
  })

  it('mcp=true plus dropGuard=true fails generation inside runGenerate', async () => {
    await expect(
      generateInto({ target: 'express', mcp: true, dropGuard: true }),
    ).rejects.toThrow(/mcp=true cannot be combined with dropGuard=true/)
  })

  it('copyFiles honours the mcp flag directly (runtime copy gating)', async () => {
    const dir = await mkdtemp(resolve(__dirname, '../../../.mcp-gen-'))
    cleanups.push(() => rm(dir, { recursive: true, force: true }))
    const options = fakeOptions(dir, {})
    await copyFiles(options, 'hono', 'none', false)
    expect((await listFiles(dir)).filter((f) => MCP_FILE_RE.test(f))).toEqual(
      [],
    )
    await copyFiles(options, 'hono', 'none', true)
    expect((await listFiles(dir)).filter((f) => MCP_FILE_RE.test(f))).toEqual([
      'mcpRuntime.ts',
    ])
  })
})
