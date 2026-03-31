import { isObject } from '../copy/misc'

/**
 * Frontend query encoder for prisma-generator-hono
 *
 * Encodes complex Prisma query structures as JSON strings in query params.
 * Objects and arrays are JSON-stringified. Primitives are encoded directly.
 *
 * @example
 * const params = encodeQueryParams({
 *   where: { OR: [{ status: 'active' }, { featured: true }] },
 *   take: 10
 * })
 * // where=%7B%22OR%22%3A...&take=10
 * fetch(`/api/posts?${params}`)
 */

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
