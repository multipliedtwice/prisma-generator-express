import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { generateQueryBuilderHelper } from '../../src/generators/generateQueryBuilderHelper'

const require = createRequire(import.meta.url)
const tscPath = require.resolve('typescript/bin/tsc')
const nodeTypesRoot = dirname(
  dirname(require.resolve('@types/node/package.json')),
)

const emit = () =>
  generateQueryBuilderHelper({
    schemaPath: '/tmp/query-builder-regression/schema.prisma',
  })

describe('generated query builder helper', () => {
  it('keeps the spawned process in a non-null local binding', () => {
    const output = emit()

    expect(output).toContain('const child = spawn(')
    expect(output).toContain('_process = child')
    expect(output).toContain("child.on('error'")
    expect(output).toContain("child.on('exit'")
    expect(output).not.toContain('_process.on(')
  })

  it('uses the Node process environment without a weaker fallback type', () => {
    const output = emit()

    expect(output).toContain('const env = process.env')
    expect(output).not.toContain('as Record<string, string | undefined>')
  })

  it('typechecks when a consumer requires NODE_ENV on ProcessEnv', () => {
    const workdir = mkdtempSync(join(tmpdir(), 'query-builder-types-'))
    const generatedPath = join(workdir, 'queryBuilder.ts')
    const augmentationPath = join(workdir, 'process-env.d.ts')
    const configPath = join(workdir, 'tsconfig.json')

    try {
      writeFileSync(generatedPath, emit())
      writeFileSync(
        augmentationPath,
        [
          'declare namespace NodeJS {',
          '  interface ProcessEnv {',
          "    readonly NODE_ENV: 'development' | 'production' | 'test'",
          '  }',
          '}',
        ].join('\n'),
      )
      writeFileSync(
        configPath,
        JSON.stringify({
          compilerOptions: {
            esModuleInterop: true,
            module: 'CommonJS',
            moduleResolution: 'Node',
            noEmit: true,
            skipLibCheck: true,
            strict: true,
            target: 'ES2022',
            typeRoots: [nodeTypesRoot],
            types: ['node'],
          },
          include: [generatedPath, augmentationPath],
        }),
      )

      execFileSync(process.execPath, [tscPath, '--project', configPath], {
        stdio: 'pipe',
      })
    } finally {
      rmSync(workdir, { force: true, recursive: true })
    }
  })

  /**
   * THE GENERATED DEFAULT MUST NOT NAME THE GENERATING MACHINE.
   *
   * The helper used to bake `options.schemaPath` in as its runtime default. That
   * is an absolute path on whoever ran `prisma generate`; a consumer running the
   * emitted code elsewhere gets a path that does not exist, and a build that
   * generates into a temporary staging directory ships a fallback that resolves
   * nowhere at all once that directory is renamed away.
   */
  it("defaults to the consumer's own prisma/schema.prisma, whatever schemaPath was", () => {
    const emitted = generateQueryBuilderHelper({
      schemaPath: '/tmp/some-build-dir/prisma/schema.prisma',
    })

    expect(emitted).not.toContain('/tmp/some-build-dir')
    expect(emitted).toContain("resolve(process.cwd(), 'prisma/schema.prisma')")
  })

  it('keeps the explicit caller override working', () => {
    // The escape hatch for a consumer whose layout is not Prisma's convention.
    const emitted = generateQueryBuilderHelper({
      schemaPath: '/tmp/x/schema.prisma',
    })

    expect(emitted).toContain('const schemaPath = options.schemaPath ||')
    expect(emitted).toContain('schemaPath?: string')
  })

  it('emits the same helper whoever generated it', () => {
    // Byte-identical from two different generation contexts: the emitted text
    // carries nothing derived from where the generator ran.
    expect(
      generateQueryBuilderHelper({ schemaPath: '/a/prisma/schema.prisma' }),
    ).toBe(
      generateQueryBuilderHelper({ schemaPath: '/b/elsewhere/schema.prisma' }),
    )
  })
})
