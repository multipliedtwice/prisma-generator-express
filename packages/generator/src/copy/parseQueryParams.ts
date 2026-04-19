import { isObject, isSafeKey, sanitizeKeys } from './misc.js'

type QueryParams =
  | string
  | Record<string, unknown>
  | string[]
  | Record<string, unknown>[]
  | undefined

const NUMERIC_KEYS = new Set(['take', 'skip'])

const INTEGER_RE = /^-?\d+$/

const parseQueryValue = (value: string, key?: string): unknown => {
  if (value.startsWith('{') || value.startsWith('[') || value.startsWith('"')) {
    try {
      const parsed = JSON.parse(value)
      return sanitizeKeys(parsed)
    } catch {
      // fall through
    }
  }
  if (value === 'true') return true
  if (value === 'false') return false
  if (value === 'null') return null
  if (key && NUMERIC_KEYS.has(key) && INTEGER_RE.test(value)) {
    return parseInt(value, 10)
  }
  return value
}

export const parseQueryParams = (params: QueryParams): unknown => {
  if (typeof params === 'string') {
    return parseQueryValue(params)
  }
  if (Array.isArray(params)) {
    return params.map(parseQueryParams)
  }
  if (isObject(params)) {
    const parsedParams: Record<string, unknown> = {}
    for (const key of Object.keys(params)) {
      if (!isSafeKey(key)) continue
      const raw = params[key]
      if (typeof raw === 'string') {
        parsedParams[key] = parseQueryValue(raw, key)
      } else {
        parsedParams[key] = sanitizeKeys(raw)
      }
    }
    return parsedParams
  }
  return params
}