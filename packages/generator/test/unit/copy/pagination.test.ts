import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  applyPaginationLimits,
  countForPagination,
  mergePaginationConfig,
  normalizeDistinct,
} from '../../../src/copy/pagination'
import type { PrismaDelegateLike } from '../../../src/copy/guardHelpers'

const createDelegate = (): PrismaDelegateLike => ({
  count: vi.fn(async () => 12),
  findMany: vi.fn(async () => []),
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('applyPaginationLimits', () => {
  it('returns the same query when no config exists', () => {
    const query = { where: { active: true } }

    expect(applyPaginationLimits(query)).toBe(query)
  })

  it('applies defaultLimit only to unguarded queries without take', () => {
    expect(applyPaginationLimits({}, { defaultLimit: 25 })).toEqual({ take: 25 })
    expect(
      applyPaginationLimits({}, { defaultLimit: 25 }, true),
    ).toEqual({})
    expect(
      applyPaginationLimits({ take: 5 }, { defaultLimit: 25 }),
    ).toEqual({ take: 5 })
  })

  it('clamps positive and negative take values to maxLimit', () => {
    expect(
      applyPaginationLimits({ take: 100 }, { maxLimit: 20 }),
    ).toEqual({ take: 20 })
    expect(
      applyPaginationLimits({ take: -100 }, { maxLimit: 20 }),
    ).toEqual({ take: -20 })
    expect(
      applyPaginationLimits({ take: '12' }, { maxLimit: 20 }),
    ).toEqual({ take: 12 })
  })

  it.each([
    ['NaN', 'Invalid take: must be a finite number'],
    [Infinity, 'Invalid take: must be a finite number'],
    [1.5, 'Invalid take: must be an integer'],
  ])('rejects invalid take %s', (take, message) => {
    expect(() =>
      applyPaginationLimits({ take }, { maxLimit: 20 }),
    ).toThrow(message)
  })
})

describe('mergePaginationConfig', () => {
  it('returns undefined when both configs are absent', () => {
    expect(mergePaginationConfig(undefined, undefined)).toBeUndefined()
  })

  it('merges scalar pagination settings', () => {
    expect(
      mergePaginationConfig(
        { defaultLimit: 10, maxLimit: 100 },
        { defaultLimit: 20 },
      ),
    ).toEqual({ defaultLimit: 20, maxLimit: 100 })
  })

  it('merges materialized count source fields', () => {
    expect(
      mergePaginationConfig(
        {
          countSource: {
            type: 'materializedView',
            schema: 'analytics',
            relation: 'totals',
            column: 'total',
          },
        },
        {
          countSource: {
            type: 'materializedView',
            relation: 'tenant_totals',
          },
        },
      ),
    ).toEqual({
      countSource: {
        type: 'materializedView',
        schema: 'analytics',
        relation: 'tenant_totals',
        column: 'total',
      },
    })
  })

  it('resets a materialized source to delegate counting', () => {
    expect(
      mergePaginationConfig(
        {
          countSource: {
            type: 'materializedView',
            relation: 'totals',
          },
        },
        { countSource: { type: 'delegate' } },
      ),
    ).toEqual({ countSource: { type: 'delegate' } })
  })
})

describe('normalizeDistinct', () => {
  it('normalizes strings and filters non-string array values', () => {
    expect(normalizeDistinct('email')).toEqual(['email'])
    expect(normalizeDistinct(['email', 1, 'tenantId', null])).toEqual([
      'email',
      'tenantId',
    ])
    expect(normalizeDistinct(undefined)).toEqual([])
  })
})

describe('countForPagination', () => {
  it('uses delegate.count with only the where clause', async () => {
    const delegate = createDelegate()

    await expect(
      countForPagination(delegate, {
        where: { active: true },
        orderBy: { id: 'desc' },
        take: 10,
      }, undefined, undefined),
    ).resolves.toBe(12)

    expect(delegate.count).toHaveBeenCalledWith({
      where: { active: true },
    })
  })

  it('uses a guarded count shape and forwards the caller', async () => {
    const guardedCount = vi.fn(async () => 8)
    const guard = vi.fn(() => ({
      count: guardedCount,
      findMany: vi.fn(),
    }))
    const delegate: PrismaDelegateLike = {
      count: vi.fn(),
      findMany: vi.fn(),
      guard,
    }

    await expect(
      countForPagination(
        delegate,
        { where: { active: true } },
        { where: { tenantId: true }, select: { id: true } },
        'users/:id',
      ),
    ).resolves.toBe(8)

    expect(guard).toHaveBeenCalledWith(
      { where: { tenantId: true } },
      'users/:id',
    )
    expect(guardedCount).toHaveBeenCalledWith({
      where: { active: true },
    })
  })

  it('counts unguarded distinct rows with a bounded findMany query', async () => {
    const delegate = createDelegate()
    vi.mocked(delegate.findMany).mockResolvedValue([
      { email: 'a@example.com' },
      { email: 'b@example.com' },
    ])

    await expect(
      countForPagination(
        delegate,
        { where: { active: true }, distinct: ['email', 'tenantId'] },
        undefined,
        undefined,
        100,
      ),
    ).resolves.toBe(2)

    expect(delegate.findMany).toHaveBeenCalledWith({
      where: { active: true },
      distinct: ['email', 'tenantId'],
      select: { email: true },
      take: 101,
    })
    expect(delegate.count).not.toHaveBeenCalled()
  })

  it('falls back to delegate.count when distinct results exceed the limit', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const delegate = createDelegate()
    vi.mocked(delegate.findMany).mockResolvedValue([{}, {}, {}])

    await expect(
      countForPagination(
        delegate,
        { distinct: 'email' },
        undefined,
        undefined,
        2,
      ),
    ).resolves.toBe(12)

    expect(warn).toHaveBeenCalledWith(
      '[auto-progressive]',
      'Distinct count exceeds 2, falling back to approximate total',
    )
    expect(delegate.count).toHaveBeenCalledWith({})
  })

  it('uses guarded count directly when distinct and a shape are present', async () => {
    const guardedCount = vi.fn(async () => 6)
    const delegate: PrismaDelegateLike = {
      count: vi.fn(),
      findMany: vi.fn(),
      guard: vi.fn(() => ({
        count: guardedCount,
        findMany: vi.fn(),
      })),
    }

    await expect(
      countForPagination(
        delegate,
        { distinct: 'email' },
        { where: { tenantId: true } },
        'caller',
      ),
    ).resolves.toBe(6)

    expect(delegate.findMany).not.toHaveBeenCalled()
  })

  it('uses a materialized count only for unguarded unfiltered non-distinct queries', async () => {
    const rawQuery = vi.fn(async () => [{ total: 99 }])
    const delegate = createDelegate()

    await expect(
      countForPagination(
        delegate,
        {},
        undefined,
        undefined,
        undefined,
        { type: 'materializedView', relation: 'totals' },
        { $queryRawUnsafe: rawQuery },
      ),
    ).resolves.toBe(99)

    expect(rawQuery).toHaveBeenCalledOnce()
    expect(delegate.count).not.toHaveBeenCalled()
  })

  it.each([
    [{ where: { active: true } }, undefined],
    [{ distinct: 'email' }, undefined],
    [{}, { where: { tenantId: true } }],
  ])(
    'does not use a materialized source when query or guard conditions make it unsafe',
    async (query, shape) => {
      const rawQuery = vi.fn(async () => [{ total: 99 }])
      const guardedCount = vi.fn(async () => 12)
      const delegate: PrismaDelegateLike = {
        count: vi.fn(async () => 12),
        findMany: vi.fn(async () => []),
        guard: vi.fn(() => ({
          count: guardedCount,
          findMany: vi.fn(),
        })),
      }

      await countForPagination(
        delegate,
        query,
        shape,
        undefined,
        undefined,
        { type: 'materializedView', relation: 'totals' },
        { $queryRawUnsafe: rawQuery },
      )

      expect(rawQuery).not.toHaveBeenCalled()
    },
  )
})
