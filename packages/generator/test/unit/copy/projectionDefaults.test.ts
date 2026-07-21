import { describe, expect, it, vi } from 'vitest'
import { applyDroppedGuard } from '../../../src/copy/projectionDefaults'

const FORCED_MARKER = Symbol.for('prisma-guard.forced')

const forced = (value: unknown): Record<PropertyKey, unknown> => ({
  [FORCED_MARKER]: true,
  value,
})

const run = async (
  shape: unknown,
  resolvedKey: string | undefined,
  opKind: Parameters<typeof applyDroppedGuard>[3],
  targets: Parameters<typeof applyDroppedGuard>[4] = {},
  resolveContext?: () => unknown | Promise<unknown>,
) => {
  const createdRead: Record<string, unknown> = {}
  const createdWrite: Record<string, unknown> = {}
  const ensureReadTarget = vi.fn(() => createdRead)
  const ensureWriteTarget = vi.fn(() => createdWrite)

  await applyDroppedGuard(
    shape,
    resolvedKey,
    resolveContext,
    opKind,
    targets,
    ensureReadTarget,
    ensureWriteTarget,
  )

  return {
    createdRead,
    createdWrite,
    ensureReadTarget,
    ensureWriteTarget,
  }
}

describe('applyDroppedGuard', () => {
  it('applies a default read projection from a direct shape', async () => {
    const result = await run(
      {
        select: {
          id: true,
          posts: { select: { title: true } },
          _count: { select: { posts: true } },
          ignored: false,
        },
      },
      undefined,
      'read',
    )

    expect(result.createdRead).toEqual({
      select: {
        id: true,
        posts: { select: { title: true } },
        _count: { select: { posts: true } },
      },
    })
    expect(result.ensureReadTarget).toHaveBeenCalledOnce()
    expect(result.ensureWriteTarget).not.toHaveBeenCalled()
  })

  it('does not replace a client projection', async () => {
    const readQuery = { select: { email: true } }

    await run(
      { select: { id: true } },
      undefined,
      'read',
      { readQuery },
    )

    expect(readQuery).toEqual({ select: { email: true } })
  })

  it('resolves a named shape by the pre-resolved key', async () => {
    const result = await run(
      {
        admin: { select: { id: true } },
        user: { select: { name: true } },
      },
      'user',
      'read',
    )

    expect(result.createdRead).toEqual({ select: { name: true } })
  })

  it('resolves an async shape function with context', async () => {
    const shape = vi.fn((ctx: unknown) => ({
      where: { tenantId: forced(ctx) },
    }))
    const resolveContext = vi.fn(async () => 7)

    const result = await run(
      shape,
      undefined,
      'read',
      {},
      resolveContext,
    )

    expect(result.createdRead).toEqual({ where: { tenantId: 7 } })
    expect(shape).toHaveBeenCalledWith(7)
    expect(resolveContext).toHaveBeenCalledOnce()
  })

  it('ignores a shape function when no context resolver exists', async () => {
    const result = await run(
      () => ({ select: { id: true } }),
      undefined,
      'read',
    )

    expect(result.ensureReadTarget).not.toHaveBeenCalled()
  })

  it('merges forced read filters without discarding client filters', async () => {
    const readQuery = {
      where: { status: 'active', tenantId: 8 },
    }

    await run(
      {
        where: {
          tenantId: forced(7),
          score: { gte: forced(10) },
        },
      },
      undefined,
      'read',
      { readQuery },
    )

    expect(readQuery).toEqual({
      where: {
        AND: [
          { status: 'active', tenantId: 8 },
          { tenantId: 7, score: { gte: 10 } },
        ],
      },
    })
  })

  it('overrides conflicting forced fields for unique reads', async () => {
    const readQuery = { where: { id: 1, tenantId: 8 } }

    await run(
      { where: { tenantId: forced(7) } },
      undefined,
      'readUnique',
      { readQuery },
    )

    expect(readQuery).toEqual({ where: { id: 1, tenantId: 7 } })
  })

  it('merges forced relation filters recursively', async () => {
    const readQuery = {
      where: {
        posts: {
          some: { published: true },
        },
      },
    }

    await run(
      {
        where: {
          posts: {
            some: { tenantId: forced(7) },
          },
        },
      },
      undefined,
      'read',
      { readQuery },
    )

    expect(readQuery).toEqual({
      where: {
        posts: {
          some: {
            AND: [{ published: true }, { tenantId: 7 }],
          },
        },
      },
    })
  })

  it('merges forced data into every createMany item', async () => {
    const writeBody = {
      data: [{ name: 'A' }, { name: 'B', tenantId: 8 }],
    }

    await run(
      {
        data: {
          tenantId: forced(7),
          status: 'active',
          clientValue: true,
          resolver: () => 1,
          nested: { create: true },
        },
      },
      undefined,
      'createMany',
      { writeBody },
    )

    expect(writeBody).toEqual({
      data: [
        { name: 'A', tenantId: 7, status: 'active' },
        { name: 'B', tenantId: 7, status: 'active' },
      ],
    })
  })

  it('applies forced where and data to updates', async () => {
    const writeBody = {
      where: { id: 1 },
      data: { name: 'updated', tenantId: 8 },
    }

    await run(
      {
        where: { tenantId: forced(7) },
        data: { tenantId: forced(7), updatedBy: 'system' },
      },
      undefined,
      'update',
      { writeBody },
    )

    expect(writeBody).toEqual({
      where: { id: 1, tenantId: 7 },
      data: { name: 'updated', tenantId: 7, updatedBy: 'system' },
    })
  })

  it('applies independent forced create and update data for upsert', async () => {
    const writeBody = {
      where: { id: 1 },
      create: { name: 'new' },
      update: { name: 'existing' },
    }

    await run(
      {
        where: { tenantId: forced(7) },
        create: { tenantId: forced(7), status: 'new' },
        update: { tenantId: forced(7), status: 'existing' },
      },
      undefined,
      'upsert',
      { writeBody },
    )

    expect(writeBody).toEqual({
      where: { id: 1, tenantId: 7 },
      create: { name: 'new', tenantId: 7, status: 'new' },
      update: { name: 'existing', tenantId: 7, status: 'existing' },
    })
  })

  it('does not create targets for noop or ineffective shapes', async () => {
    const noop = await run({ select: { id: true } }, undefined, 'noop')
    const ineffective = await run(
      { data: { allowed: true, nested: {} } },
      undefined,
      'create',
    )

    expect(noop.ensureReadTarget).not.toHaveBeenCalled()
    expect(noop.ensureWriteTarget).not.toHaveBeenCalled()
    expect(ineffective.ensureWriteTarget).not.toHaveBeenCalled()
  })
})
