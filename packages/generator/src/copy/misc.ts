export const isObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
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
    return value.map(sanitizeKeys) as T
  }
  if (isPlainObject(value)) {
    const result: Record<string, unknown> = {}
    for (const key of Object.keys(value)) {
      if (!isSafeKey(key)) continue
      result[key] = sanitizeKeys((value as Record<string, unknown>)[key])
    }
    return result as T
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