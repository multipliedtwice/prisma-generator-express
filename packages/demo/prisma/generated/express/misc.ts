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
  return isJsonString(data) ? JSON.parse(data as string) : data
}

export const isObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
