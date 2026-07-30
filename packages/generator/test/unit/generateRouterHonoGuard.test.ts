import { describe, it, expect } from 'vitest'
import type { DMMF } from '@prisma/generator-helper'
import { generateHonoRouterFunction } from '../../src/generators/generateRouterHono'

/**
 * Properties of the Hono router this generator EMITS.
 *
 * Output tests rather than unit tests, because both fixes below are about the
 * code that ships to a deployment rather than about a function anything here can
 * call. The emitted text is the artifact; asserting on it is asserting on what
 * runs.
 */

const model = {
  name: 'Article',
  dbName: null,
  schema: null,
  fields: [
    {
      name: 'id',
      kind: 'scalar',
      isList: false,
      isRequired: true,
      isUnique: false,
      isId: true,
      isReadOnly: false,
      hasDefaultValue: false,
      type: 'String',
      isGenerated: false,
      isUpdatedAt: false,
    },
  ],
  primaryKey: null,
  uniqueFields: [],
  uniqueIndexes: [],
  isGenerated: false,
} as unknown as DMMF.Model

const emit = (dropGuard: boolean) =>
  generateHonoRouterFunction({
    model,
    enums: [],
    guardShapesImport: null,
    importStyle: 'esm' as never,
    writeStrategy: 'transaction' as never,
    dropGuard,
  })

describe('guard dropping is decided at generation time, never at runtime', () => {
  /**
   * The emitted router computed
   *
   *     const DROP_GUARD = <flag> || _env.E2E === 'true'
   *
   * so `E2E=true` in a deployed environment downgraded enforcement even when the
   * generator had been told to keep the guard — and the modes are not
   * equivalent: with the guard, the shape goes to prisma-guard; with it dropped,
   * only projection defaults and forced `where` clauses are applied.
   *
   * On an edge runtime that is an ordinary config var. Set on staging, copied
   * forward, marked as security-relevant nowhere.
   */
  it('reads no environment variable when deciding whether to drop the guard', () => {
    for (const dropGuard of [true, false]) {
      const out = emit(dropGuard)
      const line = out.split('\n').find((l) => l.includes('const DROP_GUARD'))

      expect(line, 'DROP_GUARD is no longer emitted').toBeDefined()
      expect(line, `E2E still reachable with dropGuard=${dropGuard}`).not.toContain('E2E')
      expect(line).not.toContain('_env')
    }
  })

  it('emits the generation-time decision verbatim', () => {
    expect(emit(false)).toContain('const DROP_GUARD = false')
    expect(emit(true)).toContain('const DROP_GUARD = true')
  })

  it('mentions E2E nowhere in the emitted router', () => {
    // Belt and braces: no other path may reintroduce it under another name.
    expect(emit(false)).not.toMatch(/\bE2E\b/)
  })
})

describe('variant resolution is settled before any operation hook runs', () => {
  /**
   * The check used to sit after `operationBefore`, so a hook returning a
   * Response — an auth gate, a cache, a short-circuit for a known caller —
   * answered the request before anyone established which guard applied. A cached
   * response served for a request whose variant could not be resolved is a
   * response served under a guard nobody chose.
   */
  const out = emit(false)

  const handlers = [
    { name: 'read', from: 'const handleRead =', to: 'const handleWrite =' },
    { name: 'write', from: 'const handleWrite =', to: 'const opFor =' },
  ]

  for (const { name, from, to } of handlers) {
    it(`the ${name} handler raises a variant failure before its before-hooks`, () => {
      const start = out.indexOf(from)
      expect(start, `${from} not found — this test is checking nothing`).toBeGreaterThan(-1)
      const body = out.slice(start, out.indexOf(to, start))

      const failure = body.indexOf("c.get('guardVariantFailure')")
      const hooks = body.indexOf('runBeforeHooks<TEnv>(opConfig.operationBefore')

      expect(failure, 'no variant failure check in this handler').toBeGreaterThan(-1)
      expect(hooks, 'no operation before-hooks in this handler').toBeGreaterThan(-1)
      expect(failure, `${name}: a hook can answer before the variant is resolved`).toBeLessThan(
        hooks,
      )
    })
  }

  it('still runs variant hooks after resolution, which is the point of them', () => {
    // Resolution moving earlier must not have moved the per-variant hooks with
    // it: those depend on the resolved key.
    const start = out.indexOf('const handleRead =')
    const body = out.slice(start, out.indexOf('const handleWrite =', start))

    expect(body.indexOf("c.get('guardVariantKey')")).toBeGreaterThan(
      body.indexOf("c.get('guardVariantFailure')"),
    )
    expect(body).toContain('variantHooks')
  })
})
