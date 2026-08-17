import { GeneratorOptions } from '@prisma/generator-helper'

/**
 * THE EMITTED DEFAULT IS THE CONSUMER'S OWN SCHEMA, NEVER THE GENERATOR'S.
 *
 * This baked `options.schemaPath` — an ABSOLUTE path on the machine that ran
 * `prisma generate` — into the generated helper as its runtime default. For a
 * consumer that generates and runs in the same checkout that is invisible; for
 * anyone else it is a path that does not exist, and for a generated artifact
 * built in a staging directory it is worse than that: the directory is renamed
 * away at adoption, so the shipped fallback can never resolve on ANY machine,
 * including the one that produced it.
 *
 * `resolve(process.cwd(), 'prisma/schema.prisma')` — Prisma's own convention,
 * relative to wherever the consumer's process runs — was already written here as
 * the no-schemaPath branch. It is now the only default.
 *
 * THE EXPLICIT OVERRIDE IS UNTOUCHED: `startQueryBuilder({ schemaPath })` still
 * wins, which is how a consumer with a different layout says so.
 */
export function generateQueryBuilderHelper(
  _options?: Partial<Pick<GeneratorOptions, 'schemaPath'>>,
): string {
  const schemaPath = "resolve(process.cwd(), 'prisma/schema.prisma')"

  return `import { spawn } from 'child_process'
import { resolve, join, dirname } from 'path'
import { existsSync, readFileSync } from 'fs'
import { createRequire } from 'module'
import type { ChildProcess } from 'child_process'

let _process: ChildProcess | null = null
let _starting: Promise<void> | null = null
let _stopping = false
let _cleanupRegistered = false

export interface QueryBuilderOptions {
  port?: number
  host?: string
  schemaPath?: string
  databaseUrl?: string
}

function findCliPath(): string | null {
  try {
    const req = createRequire(resolve(process.cwd(), 'package.json'))
    const pkgJsonPath = req.resolve('prisma-query-builder-ui/package.json')
    const pkgDir = dirname(pkgJsonPath)
    const cliPath = join(pkgDir, 'bin', 'cli')
    if (existsSync(cliPath)) return cliPath
  } catch {}

  let dir = process.cwd()
  const root = resolve(dir, '/')
  while (dir !== root) {
    const candidate = join(dir, 'node_modules', 'prisma-query-builder-ui', 'bin', 'cli')
    if (existsSync(candidate)) return candidate
    dir = dirname(dir)
  }

  return null
}

export function startQueryBuilder(options: QueryBuilderOptions = {}): void {
  if (_process || _starting) return

  _starting = doStart(options)
  _starting.finally(() => { _starting = null })
}

function doStart(options: QueryBuilderOptions): Promise<void> {
  return new Promise<void>((resolvePromise) => {
    const env = process.env

    if (env.NODE_ENV === 'production') {
      resolvePromise()
      return
    }

    const cliPath = findCliPath()
    if (!cliPath) {
      console.warn('[query-builder] prisma-query-builder-ui not found. Install: npm install prisma-query-builder-ui')
      resolvePromise()
      return
    }

    const port = options.port || 5173
    const host = options.host || 'localhost'
    const schemaPath = options.schemaPath || ${schemaPath}
    const databaseUrl = options.databaseUrl || env.DATABASE_URL || ''

    if (!existsSync(schemaPath)) {
      console.error('[query-builder] Schema file not found: ' + schemaPath)
      resolvePromise()
      return
    }

    let schemaContent: string
    try {
      schemaContent = readFileSync(schemaPath, 'utf-8')
    } catch (err) {
      console.error('[query-builder] Failed to read schema:', err)
      resolvePromise()
      return
    }

    const schemaByteLength = Buffer.byteLength(schemaContent, 'utf8')
    if (schemaByteLength > 28000) {
      console.warn(
        '[query-builder] Schema size is ' + schemaByteLength + ' bytes. ' +
        'Environment variable size limits may cause spawn failure on Windows (~32KB). ' +
        'If the query builder fails to start, this is the likely cause.',
      )
    }

    const schemaCwd = dirname(resolve(schemaPath))

    const child = spawn(process.execPath, [cliPath], {
      stdio: 'inherit',
      env: {
        ...env,
        PORT: String(port),
        HOST: host,
        PRISMA_QUERY_BUILDER_MODE: 'embedded',
        DISABLE_PERSISTENCE: 'true',
        PRISMA_QUERY_BUILDER_SCHEMA_CONTENT: schemaContent,
        PRISMA_QUERY_BUILDER_CWD: schemaCwd,
        DATABASE_URL: databaseUrl,
      },
    })
    _process = child

    child.on('error', (err) => {
      console.error('[query-builder] Failed to start:', err.message)
      _process = null
      resolvePromise()
    })

    child.on('exit', (code) => {
      const wasStopping = _stopping
      _stopping = false
      _process = null
      if (!wasStopping && code !== 0) {
        console.warn('[query-builder] Process exited with code ' + code)
      }
    })

    if (!_cleanupRegistered) {
      _cleanupRegistered = true

      process.on('exit', () => {
        stopQueryBuilder()
      })

      const handleSigint = () => {
        stopQueryBuilder()
        process.removeListener('SIGINT', handleSigint)
        process.kill(process.pid, 'SIGINT')
      }

      const handleSigterm = () => {
        stopQueryBuilder()
        process.removeListener('SIGTERM', handleSigterm)
        process.kill(process.pid, 'SIGTERM')
      }

      process.on('SIGINT', handleSigint)
      process.on('SIGTERM', handleSigterm)
    }

    console.log('[query-builder] Starting on http://' + host + ':' + port)
    resolvePromise()
  })
}

export function stopQueryBuilder(): void {
  if (!_process || _process.killed) return
  _stopping = true
  _process.kill()
}
`
}
