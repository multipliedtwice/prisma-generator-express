import { GeneratorOptions } from '@prisma/generator-helper'

export function generateQueryBuilderHelper(options: GeneratorOptions): string {
  const schemaPath = options.schemaPath
    ? JSON.stringify(options.schemaPath)
    : "require('path').resolve(process.cwd(), 'prisma/schema.prisma')"

  return `import { spawn } from 'child_process'
import { resolve, join, dirname } from 'path'
import { existsSync, readFileSync } from 'fs'
import { createRequire } from 'module'
import type { ChildProcess } from 'child_process'

let _process: ChildProcess | null = null
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
    const cliPath = join(pkgDir, 'bin', 'cli.js')
    if (existsSync(cliPath)) return cliPath
  } catch {}

  let dir = process.cwd()
  const root = resolve(dir, '/')
  while (dir !== root) {
    const candidate = join(dir, 'node_modules', 'prisma-query-builder-ui', 'bin', 'cli.js')
    if (existsSync(candidate)) return candidate
    dir = dirname(dir)
  }

  return null
}

export function startQueryBuilder(options: QueryBuilderOptions = {}): void {
  if (_process) return

  const env = typeof process !== 'undefined' && process.env ? process.env : {} as Record<string, string | undefined>

  if (env.NODE_ENV === 'production') return

  const cliPath = findCliPath()
  if (!cliPath) {
    console.warn('[query-builder] prisma-query-builder-ui not found. Install: npm install prisma-query-builder-ui')
    return
  }

  const port = options.port || 5173
  const host = options.host || 'localhost'
  const schemaPath = options.schemaPath || ${schemaPath}
  const databaseUrl = options.databaseUrl || env.DATABASE_URL || ''

  if (!existsSync(schemaPath)) {
    console.error('[query-builder] Schema file not found: ' + schemaPath)
    return
  }

  let schemaContent: string
  try {
    schemaContent = readFileSync(schemaPath, 'utf-8')
  } catch (err) {
    console.error('[query-builder] Failed to read schema:', err)
    return
  }

  const schemaCwd = dirname(resolve(schemaPath))

  _process = spawn(process.execPath, [cliPath], {
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

  _process.on('error', (err) => {
    console.error('[query-builder] Failed to start:', err.message)
    _process = null
  })

  _process.on('exit', (code) => {
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
}

export function stopQueryBuilder(): void {
  if (!_process || _process.killed) return
  _stopping = true
  _process.kill()
}
`
}
