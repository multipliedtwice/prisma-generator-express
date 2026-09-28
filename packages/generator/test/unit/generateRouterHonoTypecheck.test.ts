import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { DMMF } from '@prisma/generator-helper'
import { generateHonoRouterFunction } from '../../src/generators/generateRouterHono'

/**
 * THE EMITTED HONO ROUTER HAS TO TYPECHECK IN THE PROJECT IT LANDS IN.
 *
 * It did not. Under `strict`, a consumer running `tsc` over the generated
 * directory got fourteen errors per model — in code this generator wrote, not in
 * code they wrote — so the only way to keep a green typecheck was to exclude the
 * generated output from it, which is the one directory most worth checking.
 *
 * Four independent causes, all of them properties of the emitted TEXT, which is
 * why these are output assertions:
 *
 *   1. Internal request state was written on the GENERIC context. Its variables
 *      are `HonoInternalVariables & TEnv['Variables']`, and inside a function
 *      generic over `TEnv` TypeScript cannot know the consumer's half does not
 *      also declare `routeConfig` — so every `c.set` of an internal key is
 *      unassignable.
 *   2. `guardShapeFailure` was set and read without ever being declared.
 *   3. `JsonLike` was self-referential, and passing it through `c.json()` made
 *      Hono's response inference report "excessively deep".
 *   4. The OpenAPI helper was handed a `RouteConfig` from `routeConfig.target`
 *      where it declares the one from `routeConfig`.
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

const emitted = generateHonoRouterFunction({
  model,
  enums: [],
  guardShapesImport: null,
  importStyle: 'esm' as never,
  writeStrategy: 'transaction' as never,
  dropGuard: false,
  pathCase: 'raw' as never,
})

/**
 * Since phase 9 the router delegates orchestration to `routerParts.ts`, copied
 * verbatim into the generated output. The generic-context scope lives there
 * now; both files are the shipped artifact, so both are checked.
 */
const ROUTER_PARTS = readFileSync(
  resolve(__dirname, '../../src/copy/routerParts.ts'),
  'utf8',
)

const ROUTER_BODY = emitted

const INTERNAL_KEYS = [
  'routeConfig',
  'guardCaller',
  'guardVariantFailure',
  'guardVariantKey',
  'guardShape',
  'guardShapeFailure',
  'parsedQuery',
  'body',
]

describe('the emitted Hono router typechecks under strict', () => {
  it('never writes an internal variable on the generically-typed context', () => {
    for (const key of INTERNAL_KEYS) {
      expect(
        ROUTER_BODY.includes(`c.set('${key}'`),
        `internal key "${key}" is set on the generic context`,
      ).toBe(false)
    }
  })

  it('never reads an internal variable on the generically-typed context', () => {
    for (const key of INTERNAL_KEYS) {
      expect(
        ROUTER_BODY.includes(`c.get('${key}'`),
        `internal key "${key}" is read on the generic context`,
      ).toBe(false)
    }
  })

  it('writes internal variables through the internal context shape', () => {
    expect(ROUTER_PARTS).toContain(
      'const vars = c as unknown as HandlerContext',
    )
    expect(ROUTER_PARTS).toContain("vars.set('routeConfig'")
    expect(ROUTER_PARTS).toContain("vars.set('guardShapeFailure'")
  })

  /**
   * A cast that is not a widening is a type ERROR, not a cast: `Context<A>` and
   * `Context<B>` do not overlap enough for `as` on its own.
   */
  it('converts the request context through unknown wherever it converts it at all', () => {
    expect(emitted).not.toMatch(/\bc as HandlerContext\b/)
    expect(ROUTER_PARTS).toContain('c as unknown as HandlerContext')
  })

  it('does not emit a self-referential JSON type', () => {
    const declaration = /type JsonLike =([\s\S]*?)\n\n/.exec(ROUTER_PARTS)
    expect(declaration, 'the shipped runtime declares JsonLike').not.toBeNull()
    expect(declaration?.[1]).not.toContain('JsonLike')
  })

  it('hands the OpenAPI builder the config type that function declares', () => {
    expect(emitted).not.toContain('config as RouteConfig')
    expect(emitted).toContain(
      'config as unknown as Parameters<typeof buildModelOpenApi>[3]',
    )
  })

  /**
   * A FIFTH CAUSE, AND THE ONE THAT IS EASY TO TALK YOURSELF OUT OF.
   *
   * Upstream emits `config.queryBuilder && config.queryBuilder !== false`. In
   * the EMITTED router `config` is `<Model>RouteConfig = RouteConfig<…>` imported
   * from `../routeConfig.target` — the per-target config, built from
   * `copy/routeConfig.hono.ts`, which declares no `queryBuilder` of its own and
   * so leaves it `QueryBuilderConfig`. Comparing that to `false` is
   *
   *     TS2367: This comparison appears to be unintentional because the types
   *             'QueryBuilderConfig' and 'boolean' have no overlap.
   *
   * twice per generated project, under `strict`.
   *
   * `copy/routeConfig.ts` DOES declare `queryBuilder?: QueryBuilderConfig | false`,
   * and reading that file instead is how this rule gets withdrawn by mistake —
   * it is a different type than the one the emitted router imports. The graduated
   * artifact's own typecheck is the authority, and it fails.
   */
  it('does not compare a non-boolean config value to false', () => {
    expect(emitted).not.toContain('config.queryBuilder !== false')
  })
})
