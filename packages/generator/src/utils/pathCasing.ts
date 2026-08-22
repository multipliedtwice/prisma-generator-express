export type PathCase = 'lower' | 'kebab' | 'raw'

export function parsePathCase(raw: unknown): PathCase {
  const value = String(raw ?? 'lower').toLowerCase()
  if (value === 'lower' || value === 'kebab' || value === 'raw') return value
  throw new Error(
    `Invalid pathCase "${String(raw)}". Expected "lower", "kebab", or "raw".`,
  )
}

export function toKebabCase(name: string): string {
  let out = ''
  for (let i = 0; i < name.length; i++) {
    const ch = name[i]
    const prev = i > 0 ? name[i - 1] : undefined
    const next = name[i + 1]
    const isUpper = ch >= 'A' && ch <= 'Z'
    const prevIsLower = prev !== undefined && prev >= 'a' && prev <= 'z'
    const prevIsDigit = prev !== undefined && prev >= '0' && prev <= '9'
    const nextIsLower = next !== undefined && next >= 'a' && next <= 'z'
    if (
      isUpper &&
      i > 0 &&
      (prevIsLower ||
        prevIsDigit ||
        (prev !== undefined && prev >= 'A' && prev <= 'Z' && nextIsLower))
    ) {
      out += '-'
    }
    out += ch.toLowerCase()
  }
  return out
}

export function modelPathSegment(
  modelName: string,
  pathCase: PathCase,
): string {
  if (pathCase === 'raw') return modelName
  if (pathCase === 'kebab') return toKebabCase(modelName)
  return modelName.toLowerCase()
}
