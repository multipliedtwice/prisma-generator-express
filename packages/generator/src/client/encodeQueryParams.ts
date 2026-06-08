import { isObject } from '../copy/misc'

function replacer(_key: string, value: unknown): unknown {
  if (typeof value === 'bigint') {
    return value.toString()
  }
  return value
}

export const encodeQueryParams = (params: Record<string, unknown>): string => {
  const entries: string[] = []

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue

    if (value === null) {
      entries.push(`${encodeURIComponent(key)}=null`)
      continue
    }

    if (typeof value === 'bigint') {
      entries.push(
        `${encodeURIComponent(key)}=${encodeURIComponent(value.toString())}`,
      )
      continue
    }

    if (typeof value === 'string') {
      entries.push(
        `${encodeURIComponent(key)}=${encodeURIComponent(JSON.stringify(value))}`,
      )
      continue
    }

    if (Array.isArray(value) || isObject(value)) {
      entries.push(
        `${encodeURIComponent(key)}=${encodeURIComponent(JSON.stringify(value, replacer))}`,
      )
      continue
    }

    entries.push(
      `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`,
    )
  }

  return entries.join('&')
}