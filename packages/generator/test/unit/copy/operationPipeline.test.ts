import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  routeOperation,
  prepareGuardOperation,
  settleStage,
  classifyError,
  memoizeContext,
  executeOperation,
  type ArgsChannel,
} from '../../../src/copy/operationPipeline'
import { HttpError } from '../../../src/copy/errorMapper'
import type { DMMF } from '@prisma/generator-helper'
import { generateRouterFunction } from '../../../src/generators/generateRouter'
import { generateFastifyRouterFunction } from '../../../src/generators/generateRouterFastify'
import { generateHonoRouterFunction } from '../../../src/generators/generateRouterHono'

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
    {
      name: 'site_id',
      kind: 'scalar',
      isList: false,
      isRequired: true,
      isUnique: false,
      isId: false,
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

function channel(holder: { value?: Record<string, unknown> }): ArgsChannel {
  return {
    read: () => holder.value,
    write: (next) => {
      holder.value = next
    },
  }
}

describe('route', () => {
  it('is synchronous', () => {
    const result = routeOperation({
      guardRouting: { kind: 'single' },
      caller: undefined,
    })
    expect(result).toEqual({
      ok: true,
      variantKey: undefined,
      caller: undefined,
    })
  })

  it('classifies a variant failure as 400', () => {
    const result = routeOperation({
      guardRouting: { kind: 'named', keys: ['a', 'b'] },
      caller: 'zzz',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.failure).toBeInstanceOf(HttpError)
      expect(result.failure.status).toBe(400)
    }
  })

  it('keeps the caller as a routing key only', () => {
    const result = routeOperation({
      guardRouting: { kind: 'named', keys: ['a'] },
      caller: 'a',
    })
    expect(result).toEqual({ ok: true, variantKey: 'a', caller: 'a' })
  })
})

describe('settle', () => {
  it('rethrows the same classified failure without reclassification', () => {
    const failure = new HttpError(418, 'original')
    expect(() => settleStage({ ok: false, failure })).toThrow(failure)
    expect(() => settleStage({ ok: false, failure })).toThrow(HttpError)
  })

  it('passes successful results through', () => {
    expect(() => settleStage({ ok: true, guardShape: undefined })).not.toThrow()
  })
})

describe('prepareGuard', () => {
  const routed = { ok: true, variantKey: undefined, caller: undefined } as const

  it('classifies a resolved-shape failure as 500', async () => {
    const result = await prepareGuardOperation(routed, {
      guardShape: (() => undefined) as unknown as Record<string, unknown>,
      opKind: 'read',
      policy: { dropGuard: false, validateResolvedShapes: true },
      getContext: () => undefined,
      args: channel({}),
      writeArgs: channel({}),
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.failure.status).toBe(500)
      expect(result.failure.message).toContain(
        'guard shape could not be resolved',
      )
    }
  })

  it('passes the raw shape through when nothing asks for resolution', async () => {
    const guardShape = { take: 10 }
    const result = await prepareGuardOperation(routed, {
      guardShape,
      opKind: 'read',
      policy: { dropGuard: false, validateResolvedShapes: false },
      getContext: () => undefined,
      args: channel({}),
      writeArgs: channel({}),
    })
    expect(result).toEqual({ ok: true, guardShape })
  })

  it('writes dropped-guard transforms through the argument channel', async () => {
    const holder: { value?: Record<string, unknown> } = {}
    // The dropped path applies projection defaults and FORCED where values;
    // a forced value is the prisma-guard marker wrapper, not a plain scalar.
    const forcedSiteId = {
      [Symbol.for('prisma-guard.forced')]: true,
      value: 'site-x',
    }
    await prepareGuardOperation(routed, {
      guardShape: { where: { site_id: forcedSiteId } },
      opKind: 'read',
      policy: { dropGuard: true, validateResolvedShapes: false },
      getContext: undefined,
      args: channel(holder),
      writeArgs: channel({}),
    })
    expect(holder.value).toEqual({ where: { site_id: 'site-x' } })
  })
})

describe('execute', () => {
  it('reads the argument channel at call time, so guard writes survive', async () => {
    const holder: { value?: Record<string, unknown> } = {}
    const seen: unknown[] = []
    await executeOperation(
      { variantKey: undefined, caller: 'c' },
      { guardShape: { take: 5 } },
      {
        core: async (ctx) => {
          seen.push(ctx.parsedQuery)
          return 'done'
        },
        args: channel(holder),
        prisma: {},
        getContext: undefined,
      },
    )
    // nothing written yet: empty read
    expect(seen[0]).toEqual({})
    holder.value = { where: { site_id: 'x' } }
    await executeOperation(
      { variantKey: undefined, caller: 'c' },
      { guardShape: undefined },
      {
        core: async (ctx) => {
          seen.push(ctx.parsedQuery)
          return 'done'
        },
        args: channel(holder),
        prisma: {},
        getContext: undefined,
      },
    )
    expect(seen[1]).toEqual({ where: { site_id: 'x' } })
  })
})

describe('context memoization', () => {
  it('resolves at most once', async () => {
    let calls = 0
    const getContext = memoizeContext(() => {
      calls++
      return { tenant: 'a' }
    })
    await getContext()
    await getContext()
    await getContext()
    expect(calls).toBe(1)
  })
})

describe('classifyError', () => {
  it('is the shared classification', () => {
    const classified = classifyError(new HttpError(404, 'nope'))
    expect(classified).toBeInstanceOf(HttpError)
    expect(classified.status).toBe(404)
  })
})

describe('all three routers call the same stages', () => {
  const shared = {
    model,
    enums: [] as DMMF.DatamodelEnum[],
    guardShapesImport: null,
    importStyle: 'esm' as never,
    writeStrategy: 'regular' as never,
    findManyPaginatedMode: 'transaction' as never,
    pathCase: 'raw' as never,
    dropGuard: false,
  }
  const outputs = {
    express: generateRouterFunction(shared),
    fastify: generateFastifyRouterFunction(shared),
    hono: generateHonoRouterFunction(shared),
  }

  const routerPartsSource = readFileSync(
    resolve(__dirname, '../../../src/copy/routerParts.ts'),
    'utf8',
  )

  for (const [target, out] of Object.entries(outputs)) {
    // The Hono emitter delegates orchestration to the shipped routerParts
    // runtime, copied verbatim into the generated output; both are the
    // artifact, so both are in scope for these assertions.
    const scope = target === 'hono' ? out + routerPartsSource : out
    it(`${target}: routes and prepares the guard through the shared stages`, () => {
      expect(scope).toContain('routeOperation({')
      expect(scope).toContain('prepareGuardOperation(routed, {')
    })
    it(`${target}: settles stored failures through settleStage`, () => {
      expect(scope).toContain('settleStage(')
    })
    it(`${target}: classifies errors through classifyError or mapError`, () => {
      expect(/classifyError\(|mapError\(/.test(scope)).toBe(true)
    })
  }

  it('the Hono before-hooks / after-hooks settle placement is preserved', () => {
    const body = routerPartsSource.slice(
      routerPartsSource.indexOf('export function createReadRoute'),
    )
    const hooks = body.indexOf('input.opConfig.operationBefore')
    expect(
      body.indexOf('if (input.settleBeforeHooks) settleGuard(c)'),
    ).toBeLessThan(hooks)
    expect(
      body.indexOf('if (!input.settleBeforeHooks) settleGuard(c)'),
    ).toBeGreaterThan(hooks)
  })
})
