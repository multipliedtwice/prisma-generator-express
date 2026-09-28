import { describe, it, expect, afterAll } from 'vitest'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  ARTICLE_MODEL,
  importEmittedRouter,
  writeEmittedRouterProject,
} from './emittedRouterProject'

/**
 * Regression: the legacy Hono router factory must keep registering the
 * materialized-count feature module on import, so an existing Hono
 * `countSource: 'materializedView'` pagination keeps working exactly as it
 * did before the phase 9 boundary. The per-op parts boundary is the opt-in
 * path that omits the module — the legacy factory is not.
 */

const cleanups: Array<() => Promise<void>> = []
afterAll(async () => {
  for (const cleanup of cleanups) await cleanup()
})

describe('legacy Hono router keeps materialized-view counting working', () => {
  it('importing the emitted router registers the counter, and mat-view counting runs', async () => {
    const project = await writeEmittedRouterProject({
      target: 'hono',
      model: ARTICLE_MODEL,
    })
    cleanups.push(project.cleanup)

    // importing the emitted router registers the real counter — in the
    // emitted project's OWN module graph (the copied pagination instance)
    await importEmittedRouter(project.routerPath)
    const emitted = (await import(
      pathToFileURL(resolve(dirname(project.routerPath), '../pagination.ts'))
        .href
    )) as {
      countForPagination: (
        delegate: unknown,
        query: Record<string, unknown>,
        shape: unknown,
        caller: string | undefined,
        distinctCountLimit: number | undefined,
        countSource: unknown,
        rawClient: unknown,
      ) => Promise<number>
    }

    const rawQuery = vi_(async () => [{ total: 123 }])
    const delegate = {
      count: async () => {
        throw new Error('delegate count must not be used for mat-view source')
      },
    }

    await expect(
      emitted.countForPagination(
        delegate,
        {},
        undefined,
        undefined,
        undefined,
        { type: 'materializedView', relation: 'totals' },
        { $queryRawUnsafe: rawQuery.fn },
      ),
    ).resolves.toBe(123)

    expect(rawQuery.calls).toBe(1)
  })
})

function vi_<T>(fn: (args: unknown) => Promise<T>): {
  fn: (args: unknown) => Promise<T>
  calls: number
} {
  let calls = 0
  return {
    fn: async (args: unknown) => {
      calls++
      return fn(args)
    },
    get calls() {
      return calls
    },
  }
}
