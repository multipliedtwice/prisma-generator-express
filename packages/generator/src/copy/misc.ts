export function isJsonString(str: string | unknown): boolean {
  if (typeof str !== 'string') {
    return false
  }

  try {
    JSON.parse(str)
  } catch (e: unknown) {
    return false
  }
  return true
}

export function safeJSONparse<T>(
  data: unknown,
): T | boolean | undefined | null {
  if (data === 'false') return false
  if (data === 'undefined') return undefined
  if (data === 'null') return null
  return isJsonString(data) ? JSON.parse(data as string) : data as any
}

export const isObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

export function isSafeKey(key: string): boolean {
  return !UNSAFE_KEYS.has(key)
}

export function sanitizeKeys<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(sanitizeKeys) as T
  }
  if (isObject(value)) {
    const result: Record<string, unknown> = {}
    for (const key of Object.keys(value)) {
      if (!isSafeKey(key)) continue
      result[key] = sanitizeKeys((value as Record<string, unknown>)[key])
    }
    return result as T
  }
  return value
}