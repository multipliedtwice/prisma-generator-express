import { isObject } from '../copy/misc'

const bigintReplacer = (_key: string, value: unknown): unknown =>
  typeof value === 'bigint' ? value.toString() : value

const encodeEntry = (key: string, value: unknown): string | null => {
  if (value === undefined) return null

  const encodedKey = encodeURIComponent(key)

  if (value === null) return encodedKey + '=null'

  if (typeof value === 'bigint') {
    return encodedKey + '=' + encodeURIComponent(value.toString())
  }

  if (typeof value === 'string') {
    return encodedKey + '=' + encodeURIComponent(JSON.stringify(value))
  }

  if (Array.isArray(value) || isObject(value)) {
    return encodedKey + '=' + encodeURIComponent(JSON.stringify(value, bigintReplacer))
  }

  return encodedKey + '=' + encodeURIComponent(String(value))
}

export const encodeQueryParams = (params: Record<string, unknown>): string => {
  const entries: string[] = []
  for (const [key, value] of Object.entries(params)) {
    const entry = encodeEntry(key, value)
    if (entry !== null) entries.push(entry)
  }
  return entries.join('&')
}