import { describe, expect, it, vi } from 'vitest'
import { HttpError } from '../../../src/copy/errorMapper'
import {
  countFromMaterializedView,
  quoteIdent,
} from '../../../src/copy/materializedCount'

describe('quoteIdent', () => {
  it('quotes valid SQL identifiers', () => {
    expect(quoteIdent('daily_totals')).toBe('"daily_totals"')
    expect(quoteIdent('_private2')).toBe('"_private2"')
  })

  it.each(['bad-name', '1table', 'schema.table', 'name"'])(
    'rejects invalid identifier %s',
    (name) => {
      expect(() => quoteIdent(name)).toThrowError(HttpError)
      expect(() => quoteIdent(name)).toThrow('invalid identifier: ' + name)
    },
  )
})

describe('countFromMaterializedView', () => {
  it('queries a schema-qualified source with parameterized filters', async () => {
    const query = vi.fn(async () => [{ total: '42.9' }])

    const result = await countFromMaterializedView(
      { $queryRawUnsafe: query },
      {
        type: 'materializedView',
        schema: 'analytics',
        relation: 'user_totals',
        column: 'row_count',
        where: {
          tenant_id: 7,
          deleted_at: null,
          status: 'active',
        },
      },
    )

    expect(result).toBe(42)
    expect(query).toHaveBeenCalledWith(
      'SELECT "row_count" AS "total" FROM "analytics"."user_totals" WHERE "tenant_id" = $1 AND "deleted_at" IS NULL AND "status" = $2 LIMIT 1',
      7,
      'active',
    )
  })

  it('uses the default total column and no where clause', async () => {
    const query = vi.fn(async () => [{ total: 5n }])

    await expect(
      countFromMaterializedView(
        { $queryRawUnsafe: query },
        { type: 'materializedView', relation: 'totals' },
      ),
    ).resolves.toBe(5)

    expect(query).toHaveBeenCalledWith(
      'SELECT "total" AS "total" FROM "totals" LIMIT 1',
    )
  })

  it('rejects clients without raw-query support', async () => {
    await expect(
      countFromMaterializedView(
        {},
        { type: 'materializedView', relation: 'totals' },
      ),
    ).rejects.toMatchObject({
      status: 500,
      message:
        'Materialized count source requires $queryRawUnsafe on the Prisma client',
    })
  })

  it.each([[[]], [[{ total: undefined }]], [[{ total: 'not-a-number' }]]])(
    'rejects a non-numeric result %#',
    async (rows) => {
      await expect(
        countFromMaterializedView(
          { $queryRawUnsafe: vi.fn(async () => rows) },
          { type: 'materializedView', relation: 'totals' },
        ),
      ).rejects.toMatchObject({
        status: 500,
        message: 'Materialized count source did not return a numeric total',
      })
    },
  )
})
