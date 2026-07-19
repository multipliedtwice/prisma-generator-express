export type GuardVariantResolutionInput =
  | { kind: 'single' }
  | {
      kind: 'named'
      keys: readonly string[]
      caller?: string
      reservedKeys: ReadonlySet<string>
    }

export type GuardVariantResolution =
  | { ok: true; key: string }
  | {
      ok: false
      code:
        | 'reserved-key'
        | 'missing-caller'
        | 'ambiguous-caller'
        | 'unknown-caller'
      caller?: string
      key?: string
      keys: readonly string[]
      matches?: readonly string[]
    }

function matchVariantPatterns(
  keys: readonly string[],
  caller: string,
): string[] {
  const callerParts = caller.split('/')
  const matches: string[] = []

  for (const pattern of keys) {
    if (!pattern.includes(':')) continue

    const patternParts = pattern.split('/')
    if (patternParts.length !== callerParts.length) continue

    let matchesCaller = true

    for (let index = 0; index < patternParts.length; index++) {
      if (patternParts[index].startsWith(':')) continue
      if (patternParts[index] !== callerParts[index]) {
        matchesCaller = false
        break
      }
    }

    if (matchesCaller) matches.push(pattern)
  }

  return matches
}

export function resolveGuardVariantKey(
  input: GuardVariantResolutionInput,
): GuardVariantResolution {
  if (input.kind === 'single') {
    return { ok: true, key: '_default' }
  }

  const { keys, caller, reservedKeys } = input

  for (const key of keys) {
    if (reservedKeys.has(key)) {
      return {
        ok: false,
        code: 'reserved-key',
        key,
        keys,
      }
    }
  }

  const hasDefault = keys.includes('default')

  if (typeof caller !== 'string') {
    if (hasDefault) return { ok: true, key: 'default' }
    return { ok: false, code: 'missing-caller', keys }
  }

  if (caller.trim().length === 0) {
    if (hasDefault) return { ok: true, key: 'default' }
    return { ok: false, code: 'unknown-caller', caller, keys }
  }

  if (keys.includes(caller)) {
    return { ok: true, key: caller }
  }

  const matches = matchVariantPatterns(keys, caller)

  if (matches.length === 1) {
    return { ok: true, key: matches[0] }
  }

  if (matches.length > 1) {
    return {
      ok: false,
      code: 'ambiguous-caller',
      caller,
      keys,
      matches,
    }
  }

  if (hasDefault) return { ok: true, key: 'default' }

  return { ok: false, code: 'unknown-caller', caller, keys }
}
