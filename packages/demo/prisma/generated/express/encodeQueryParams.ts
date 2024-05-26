import { isObject } from './misc'

/**
 * Encodes query parameters recursively, skipping undefined values.
 * @param {Record<string, unknown>} params - The query parameters to encode.
 * @returns {string} The encoded query string.
 */
export const encodeQueryParams = (params: Record<string, unknown>): string => {
  const customEncodeURIComponent = (str: string): string => {
    return encodeURIComponent(str).replace(
      /[!'()*~]/g,
      (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
    )
  }

  const encode = (key: string, value: unknown): string => {
    if (value === undefined) {
      return ''
    }
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return `${customEncodeURIComponent(key)}%5B%5D=`
      }
      return value
        .map((v, i) => encode(`${key}[${i}]`, v))
        .filter(Boolean)
        .join('&')
    }
    if (isObject(value)) {
      return Object.entries(value)
        .map(([k, v]) => encode(`${key}[${k}]`, v))
        .filter(Boolean)
        .join('&')
    }
    return `${customEncodeURIComponent(key)}=${customEncodeURIComponent(
      String(value),
    )}`
  }

  return Object.entries(params)
    .map(([k, v]) => encode(k, v))
    .filter(Boolean)
    .join('&')
}
