export const isObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isPlainObject(
  value: unknown,
): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false
  if (Array.isArray(value)) return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

export function isSafeKey(key: string): boolean {
  return !UNSAFE_KEYS.has(key)
}

export function sanitizeKeys<T>(value: T): T {
  if (Array.isArray(value)) {
    let mutated = false
    const out: unknown[] = new Array(value.length)
    for (let i = 0; i < value.length; i++) {
      const sanitized = sanitizeKeys(value[i])
      if (sanitized !== value[i]) mutated = true
      out[i] = sanitized
    }
    return (mutated ? out : value) as T
  }
  if (isPlainObject(value)) {
    const keys = Object.keys(value)
    let hasUnsafe = false
    let childrenMutated = false
    const sanitizedChildren: Record<string, unknown> = {}
    for (const key of keys) {
      if (!isSafeKey(key)) {
        hasUnsafe = true
        continue
      }
      const original = (value as Record<string, unknown>)[key]
      const sanitized = sanitizeKeys(original)
      if (sanitized !== original) childrenMutated = true
      sanitizedChildren[key] = sanitized
    }
    if (!hasUnsafe && !childrenMutated) return value
    return sanitizedChildren as T
  }
  return value
}

export function normalizePrefix(p: string): string {
  if (!p) return ''
  let result = p
  if (!result.startsWith('/')) result = '/' + result
  while (result.length > 1 && result.endsWith('/')) result = result.slice(0, -1)
  if (result === '/') return ''
  return result
}

export function removeTrailingSlash(path: string): string {
  if (path === '/') return ''
  return path.endsWith('/') ? path.slice(0, -1) : path
}

export function getEnv(): Record<string, string | undefined> {
  return typeof process !== 'undefined' && process.env
    ? process.env
    : ({} as Record<string, string | undefined>)
}

let dropGuardDeprecationWarned = false

export function resolveDropGuardEnv(
  env: Record<string, string | undefined>,
): boolean {
  if (env.PGE_DROP_GUARD === 'true') return true
  if (env.E2E === 'true') {
    if (!dropGuardDeprecationWarned) {
      dropGuardDeprecationWarned = true
      console.warn(
        '[prisma-generator-express] E2E=true guard bypass is deprecated. Use PGE_DROP_GUARD=true.',
      )
    }
    return true
  }
  return false
}
