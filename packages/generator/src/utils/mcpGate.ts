import fs from 'node:fs'
import path from 'node:path'

/**
 * MCP is fail-closed at GENERATION time: a guard-dropped artifact must not
 * carry MCP support, because read-only tools enforce guard shapes and a
 * dropped guard would turn every tool into an unguarded read.
 *
 * MCP tool schemas are built against prisma-guard 1.33 semantics (unique
 * selectors, operator configs, forced-value merging). A consumer running an
 * older guard would accept shapes the tool schemas misrepresent, so an
 * mcp=true generation REFUSES to emit MCP support unless prisma-guard
 * >= 1.33.0 is resolvable from the schema's project.
 */
export function assertMcpGuardCompatibility(
  mcp: boolean,
  dropGuard: boolean,
): void {
  if (mcp && dropGuard) {
    throw new Error(
      'Generator option mcp=true cannot be combined with dropGuard=true. ' +
        'MCP is fail-closed: read-only tools enforce guard shapes, so a ' +
        'guard-dropped generation refuses to emit MCP support.',
    )
  }
}

const MCP_MIN_GUARD = '1.33.0'

type Semver = {
  core: [number, number, number]
  pre: string[]
}

/** Semver 2.0.0 ordering, including prerelease precedence. */
export function parseSemver(v: string): Semver | null {
  // strict semver 2.0.0: no leading-zero numeric identifiers, no empty
  // dot-separated prerelease/build identifiers; build metadata is parsed
  // and ignored for precedence
  const numeric = '0|[1-9]' + '\\d*'
  const ident = '[0-9A-Za-z-]+'
  const dotted = ident + '(?:\\.' + ident + ')*'
  const m = new RegExp(
    `^(${numeric})\\.(${numeric})\\.(${numeric})(?:-(${dotted}))?(?:\\+(${dotted}))?$`,
  ).exec(v.trim())
  if (!m) return null
  const pre = m[4] ? m[4].split('.') : []
  // semver 2.0.0: numeric PRERELEASE identifiers must not carry leading
  // zeros (build-metadata identifiers are exempt)
  for (const ident of pre) {
    if (/^[0-9]+$/.test(ident) && ident.length > 1 && ident.startsWith('0')) {
      return null
    }
  }
  return {
    core: [Number(m[1]), Number(m[2]), Number(m[3])],
    pre,
  }
}

/** `a < b` returns negative, `a > b` positive, equal 0 (semver 2.0.0). */
export function compareSemver(a: string, b: string): number {
  const va = parseSemver(a)
  const vb = parseSemver(b)
  if (!va || !vb) {
    // unparsable strings sort last so they never satisfy a minimum
    return va ? 1 : vb ? -1 : 0
  }
  for (let i = 0; i < 3; i++) {
    if (va.core[i] !== vb.core[i]) return va.core[i] - vb.core[i]
  }
  // no prerelease > any prerelease
  if (va.pre.length === 0 && vb.pre.length === 0) return 0
  if (va.pre.length === 0) return 1
  if (vb.pre.length === 0) return -1
  const len = Math.max(va.pre.length, vb.pre.length)
  for (let i = 0; i < len; i++) {
    const x = va.pre[i]
    const y = vb.pre[i]
    if (x === undefined) return -1 // shorter set is lower
    if (y === undefined) return 1
    const xn = /^\d+$/.test(x)
    const yn = /^\d+$/.test(y)
    if (xn && yn) {
      if (Number(x) !== Number(y)) return Number(x) - Number(y)
    } else if (xn)
      return -1 // numeric identifiers are lower
    else if (yn) return 1
    else if (x !== y) return x < y ? -1 : 1
  }
  return 0
}

/**
 * Resolve prisma-guard's installed version the way Node resolves it for the
 * generated artifact: walk UP from the schema's directory, checking
 * `<ancestor>/node_modules/prisma-guard` at each level, and stop at the
 * FIRST hit. Returns null when no ancestor carries an install.
 */
export function resolveInstalledGuardVersion(
  schemaPath: string,
): string | null {
  const schemaDir = path.dirname(path.resolve(schemaPath))
  let dir: string | undefined = schemaDir
  while (dir) {
    const pkgPath = path.join(
      dir,
      'node_modules',
      'prisma-guard',
      'package.json',
    )
    try {
      const version = (
        JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as {
          version?: string
        }
      ).version
      if (typeof version === 'string') return version
    } catch {
      // not installed at this ancestor — keep walking
    }
    const parent = path.dirname(dir)
    dir = parent !== dir ? parent : undefined
  }
  return null
}

export function assertMcpGuardVersion(
  mcp: boolean,
  schemaPath: string,
  resolve: (schemaPath: string) => string | null = resolveInstalledGuardVersion,
): void {
  if (!mcp) return
  const version = resolve(schemaPath)
  if (version === null) {
    throw new Error(
      'mcp=true requires prisma-guard >= ' +
        MCP_MIN_GUARD +
        ', but prisma-guard could not be resolved from the schema project. ' +
        'Install it (npm install prisma-guard@^' +
        MCP_MIN_GUARD +
        ') or turn mcp off.',
    )
  }
  if (compareSemver(version, MCP_MIN_GUARD) < 0) {
    throw new Error(
      'mcp=true requires prisma-guard >= ' +
        MCP_MIN_GUARD +
        ' (MCP tool schemas mirror 1.33 semantics: unique-selector where, ' +
        'operator configs, forced-value merging). Found prisma-guard ' +
        version +
        '. Upgrade it (npm install prisma-guard@^' +
        MCP_MIN_GUARD +
        ') or turn mcp off.',
    )
  }
}
