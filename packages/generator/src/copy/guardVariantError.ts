import type { GuardVariantResolution } from './guardVariantRouting'

export function formatGuardVariantResolutionError(
  resolution: Extract<GuardVariantResolution, { ok: false }>,
): string {
  const keys = resolution.keys.map((key) => `"${key}"`).join(', ')

  if (resolution.code === 'reserved-key') {
    return `Caller key "${resolution.key}" collides with reserved guard shape key. Rename the caller path.`
  }

  if (resolution.code === 'missing-caller') {
    return (
      `Missing caller. This guard uses named shape routing with keys: ${keys}. ` +
      'Provide caller via guard(input, caller).'
    )
  }

  if (resolution.code === 'ambiguous-caller') {
    const matches = (resolution.matches ?? [])
      .map((pattern) => `"${pattern}"`)
      .join(', ')

    return `Ambiguous caller "${resolution.caller}" matches multiple patterns: ${matches}`
  }

  return `Unknown caller: "${resolution.caller}". Allowed: ${keys}`
}
