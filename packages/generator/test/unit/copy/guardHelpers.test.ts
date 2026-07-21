import { describe, expect, it, vi } from 'vitest'
import { HttpError } from '../../../src/copy/errorMapper'
import {
  assertGuard,
  buildCountShape,
  type PrismaDelegateLike,
} from '../../../src/copy/guardHelpers'

describe('assertGuard', () => {
  it('accepts delegates with a guard function', () => {
    const delegate = {
      count: vi.fn(),
      findMany: vi.fn(),
      guard: vi.fn(),
    }

    expect(() => assertGuard(delegate)).not.toThrow()
  })

  it('throws an HttpError when prisma-guard is unavailable', () => {
    const delegate: PrismaDelegateLike = {
      count: vi.fn(),
      findMany: vi.fn(),
    }

    expect(() => assertGuard(delegate)).toThrowError(HttpError)
    expect(() => assertGuard(delegate)).toThrow(
      'Guard shapes require prisma-guard extension on PrismaClient.',
    )
  })
})

describe('buildCountShape', () => {
  it('keeps only where from a direct shape', () => {
    expect(
      buildCountShape({
        where: { tenantId: true },
        select: { id: true },
        take: 10,
      }),
    ).toEqual({ where: { tenantId: true } })
  })

  it('treats an empty object as a direct shape', () => {
    expect(buildCountShape({})).toEqual({})
  })

  it('wraps a direct shape function and preserves its arguments', () => {
    const source = vi.fn((ctx: unknown, input: unknown) => ({
      where: { ctx, input },
      select: { id: true },
    }))
    const result = buildCountShape(source)

    expect(typeof result).toBe('function')
    expect((result as (...args: unknown[]) => unknown)('ctx', 'input')).toEqual({
      where: { ctx: 'ctx', input: 'input' },
    })
    expect(source).toHaveBeenCalledWith('ctx', 'input')
  })

  it('converts named object and function variants independently', () => {
    const dynamic = vi.fn((ctx: unknown) => ({
      where: { ownerId: ctx },
      include: { posts: true },
    }))
    const shape = buildCountShape({
      admin: {
        where: { active: true },
        select: { id: true },
      },
      user: dynamic,
      disabled: false,
    }) as Record<string, unknown>

    expect(shape.admin).toEqual({ where: { active: true } })
    expect((shape.user as (ctx: unknown) => unknown)(7)).toEqual({
      where: { ownerId: 7 },
    })
    expect(shape.disabled).toBe(false)
  })
})
