import * as fs from 'fs'
import * as path from 'path'
import type { GeneratorOptions } from '@prisma/generator-helper'

export type ImportStyle = 'none' | 'js' | 'ts'

const VALID_OVERRIDES = new Set(['auto', 'none', 'js', 'ts'])
const NODE_MODULE_KEYWORDS = new Set(['node16', 'node18', 'nodenext'])

function stripJsonComments(input: string): string {
  let out = ''
  let i = 0
  let inString = false
  let stringChar = ''
  while (i < input.length) {
    const c = input[i]
    const next = input[i + 1]
    if (inString) {
      out += c
      if (c === '\\' && i + 1 < input.length) {
        out += input[i + 1]
        i += 2
        continue
      }
      if (c === stringChar) inString = false
      i++
      continue
    }
    if (c === '"' || c === "'") {
      inString = true
      stringChar = c
      out += c
      i++
      continue
    }
    if (c === '/' && next === '/') {
      while (i < input.length && input[i] !== '\n') i++
      continue
    }
    if (c === '/' && next === '*') {
      i += 2
      while (i < input.length && !(input[i] === '*' && input[i + 1] === '/')) i++
      i += 2
      continue
    }
    out += c
    i++
  }
  return out.replace(/,\s*(?=[\]}])/g, '')
}

function findUpwards(startDir: string, filename: string): string | null {
  let dir = path.resolve(startDir)
  const root = path.parse(dir).root
  let result: string | null = null
  let stop = false
  while (!stop) {
    const candidate = path.join(dir, filename)
    if (fs.existsSync(candidate)) {
      result = candidate
      stop = true
      break
    }
    if (dir === root) {
      stop = true
      break
    }
    const parent = path.dirname(dir)
    if (parent === dir) {
      stop = true
      break
    }
    dir = parent
  }
  return result
}

function resolveExtendsTarget(extendsValue: string, fromFile: string): string | null {
  const fromDir = path.dirname(fromFile)
  if (extendsValue.startsWith('.') || path.isAbsolute(extendsValue)) {
    const direct = path.resolve(fromDir, extendsValue)
    if (fs.existsSync(direct) && fs.statSync(direct).isFile()) return direct
    const withExt = direct + '.json'
    if (fs.existsSync(withExt)) return withExt
    const asIndex = path.join(direct, 'tsconfig.json')
    if (fs.existsSync(asIndex)) return asIndex
    return null
  }
  try {
    return require.resolve(extendsValue, { paths: [fromDir] })
  } catch {
    try {
      return require.resolve(extendsValue + '/tsconfig.json', { paths: [fromDir] })
    } catch {
      return null
    }
  }
}

type TsConfigRaw = {
  extends?: string | string[]
  compilerOptions?: Record<string, unknown>
}

function readTsConfig(filePath: string, seen: Set<string> = new Set()): Record<string, unknown> {
  const abs = path.resolve(filePath)
  if (seen.has(abs)) return {}
  seen.add(abs)

  let parsed: TsConfigRaw
  try {
    const raw = fs.readFileSync(abs, 'utf-8')
    parsed = JSON.parse(stripJsonComments(raw)) as TsConfigRaw
  } catch {
    return {}
  }

  const extendsList: string[] = Array.isArray(parsed.extends)
    ? parsed.extends
    : parsed.extends
      ? [parsed.extends]
      : []

  let merged: Record<string, unknown> = {}
  for (const ext of extendsList) {
    const target = resolveExtendsTarget(ext, abs)
    if (target) merged = { ...merged, ...readTsConfig(target, seen) }
  }
  if (parsed.compilerOptions) merged = { ...merged, ...parsed.compilerOptions }
  return merged
}

function readPackageType(startDir: string): string | null {
  const pkgPath = findUpwards(startDir, 'package.json')
  if (!pkgPath) return null
  try {
    const json = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
    return typeof json.type === 'string' ? json.type : null
  } catch {
    return null
  }
}

export function resolveImportStyle(options: GeneratorOptions): ImportStyle {
  const config = (options.generator.config || {}) as Record<string, string>
  const raw = typeof config.importStyle === 'string'
    ? config.importStyle.toLowerCase()
    : 'auto'

  if (!VALID_OVERRIDES.has(raw)) {
    console.warn(
      '[prisma-generator-express] Invalid importStyle "' + config.importStyle +
      '". Expected one of: auto, none, js, ts. Falling back to auto.',
    )
  } else if (raw !== 'auto') {
    return raw as ImportStyle
  }

  const outputPath = options.generator.output?.value
  const schemaDir = options.schemaPath ? path.dirname(options.schemaPath) : process.cwd()
  const startDir = outputPath ? path.dirname(outputPath) : schemaDir

  const tsconfigPath =
    findUpwards(startDir, 'tsconfig.json') ||
    findUpwards(schemaDir, 'tsconfig.json')

  const compilerOptions: Record<string, unknown> = tsconfigPath
    ? readTsConfig(tsconfigPath)
    : {}

  if (compilerOptions.allowImportingTsExtensions === true) return 'ts'

  const moduleVal = String(compilerOptions.module ?? '').toLowerCase()
  const moduleResolution = String(compilerOptions.moduleResolution ?? '').toLowerCase()

  if (NODE_MODULE_KEYWORDS.has(moduleVal) || NODE_MODULE_KEYWORDS.has(moduleResolution)) {
    return 'js'
  }
  if (moduleResolution === 'bundler' || moduleResolution === 'classic' || moduleResolution === 'node') {
    return 'none'
  }

  const pkgType = readPackageType(startDir) || readPackageType(schemaDir)
  if (pkgType === 'module') return 'js'

  return 'none'
}