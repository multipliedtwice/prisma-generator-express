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
})
