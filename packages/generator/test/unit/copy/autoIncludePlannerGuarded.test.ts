import { describe, expect, it } from 'vitest'
import { planGuardedAutoInclude } from '../../../src/copy/autoIncludePlannerGuarded'
import { models } from './autoIncludeFixtures'

describe('planGuardedAutoInclude', () => {
  it('returns unchanged inputs when either side has no select projection', () => {
    const effectiveReadBody = { where: { active: true } }
    const shape = { where: { tenantId: true } }

    expect(
      planGuardedAutoInclude({
        rootModelName: 'User',
        models,
        effectiveReadBody,
        shape,
      }),
    ).toEqual({
      rootArgs: effectiveReadBody,
      rootShape: shape,
      stages: [],
      internalFieldPaths: [],
    })
  })

  it('splits a guarded relation and injects parent and child link fields', () => {
    const plan = planGuardedAutoInclude({
      rootModelName: 'User',
      models,
      effectiveReadBody: {
        where: { active: true },
        select: {
          name: true,
          posts: {
            where: { published: true },
            select: { title: true },
          },
        },
      },
      shape: {
        where: { tenantId: true },
        select: {
          name: true,
          posts: {
            where: { published: true },
            select: { title: true },
          },
        },
      },
    })

    expect(plan.rootArgs).toEqual({
      where: { active: true },
      select: { name: true, id: true },
    })
    expect(plan.rootShape).toEqual({
      where: { tenantId: true },
      select: { name: true, id: true },
    })
    expect(plan.internalFieldPaths).toEqual(['id', 'posts.userId'])
    expect(plan.stages).toHaveLength(1)
    expect(plan.stages[0]).toMatchObject({
      relationPath: 'posts',
      parentPath: '',
      relationName: 'posts',
      stageArgs: {
        where: { published: true },
        select: { title: true, userId: true },
      },
      stageShape: {
        where: {
          published: true,
          userId: { in: true },
        },
        select: { title: true, userId: true },
      },
      depth: 1,
    })
  })

  it('does not expose an already public parent or child link field as internal', () => {
    const plan = planGuardedAutoInclude({
      rootModelName: 'User',
      models,
      effectiveReadBody: {
        select: {
          id: true,
          posts: { select: { title: true, userId: true } },
        },
      },
      shape: {
        select: {
          id: true,
          posts: { select: { title: true, userId: true } },
        },
      },
    })

    expect(plan.internalFieldPaths).toEqual([])
  })

  it('preserves false relation selections without creating a stage', () => {
    const plan = planGuardedAutoInclude({
      rootModelName: 'User',
      models,
      effectiveReadBody: { select: { name: true, posts: false } },
      shape: { select: { name: true, posts: false } },
    })

    expect(plan).toEqual({
      rootArgs: { select: { name: true, posts: false } },
      rootShape: { select: { name: true, posts: false } },
      stages: [],
      internalFieldPaths: [],
    })
  })

  it.each([
    {
      label: 'root body include',
      body: { include: { posts: true } },
      shape: { select: { posts: true } },
      reason: 'root body uses include (guarded MVP supports select only)',
    },
    {
      label: 'root shape omit',
      body: { select: { posts: true } },
      shape: { omit: { name: true } },
      reason: 'root shape uses omit (guarded MVP supports select only)',
    },
    {
      label: 'body count',
      body: { select: { posts: { select: { _count: true } } } },
      shape: { select: { posts: { select: { title: true } } } },
      reason: '_count in root body not supported in guarded MVP',
    },
    {
      label: 'shape count',
      body: { select: { posts: true } },
      shape: { select: { posts: { select: { _count: true } } } },
      reason: '_count in root shape not supported in guarded MVP',
    },
    {
      label: 'non-plain body where',
      body: { where: 'invalid', select: { posts: true } },
      shape: { select: { posts: true } },
      reason: 'root body where must be a plain object',
    },
    {
      label: 'root relation filter',
      body: { where: { posts: { some: {} } }, select: { posts: true } },
      shape: { select: { posts: true } },
      reason: 'root body where/orderBy/cursor relation ref not supported',
    },
    {
      label: 'body relation absent from shape',
      body: { select: { posts: true } },
      shape: { select: { name: true } },
      reason: 'body projects relation "posts" not present in guard shape at root',
    },
    {
      label: 'implicit many-to-many relation',
      body: { select: { groups: true } },
      shape: { select: { groups: true } },
      reason: 'implicit many-to-many not supported in guarded MVP',
    },
    {
      label: 'invalid body relation projection',
      body: { select: { posts: [] } },
      shape: { select: { posts: true } },
      reason: 'invalid relation projection body for posts',
    },
    {
      label: 'invalid shape relation projection',
      body: { select: { posts: true } },
      shape: { select: { posts: [] } },
      reason: 'invalid relation projection shape for posts',
    },
    {
      label: 'unsupported body argument',
      body: { select: { profile: { where: { id: 1 } } } },
      shape: { select: { profile: true } },
      reason: 'unsupported body arg "where" for to-one relation profile',
    },
    {
      label: 'stage body include',
      body: { select: { posts: { include: { author: true } } } },
      shape: { select: { posts: true } },
      reason: 'stage body uses include for posts (guarded MVP supports select only)',
    },
    {
      label: 'stage shape omit',
      body: { select: { posts: true } },
      shape: { select: { posts: { omit: { title: true } } } },
      reason: 'stage shape uses omit for posts (guarded MVP supports select only)',
    },
    {
      label: 'stage relation orderBy',
      body: { select: { posts: { orderBy: { author: { name: 'asc' } } } } },
      shape: { select: { posts: true } },
      reason: 'stage body orderBy/cursor relation ref not supported for posts',
    },
    {
      label: 'body child FK collision',
      body: { select: { posts: { where: { OR: [{ userId: 1 }] } } } },
      shape: { select: { posts: true } },
      reason: 'FK collision: stage body where for posts already mentions child link field "userId"',
    },
    {
      label: 'shape child FK collision',
      body: { select: { posts: true } },
      shape: { select: { posts: { where: { userId: true } } } },
      reason: 'FK collision: stage shape where for posts already mentions child link field "userId"',
    },
  ])('falls back atomically for $label', ({ body, shape, reason }) => {
    const plan = planGuardedAutoInclude({
      rootModelName: 'User',
      models,
      effectiveReadBody: body,
      shape,
    })

    expect(plan).toEqual({
      rootArgs: body,
      rootShape: shape,
      stages: [],
      internalFieldPaths: [],
      unsupportedReason: 'guarded auto-progressive fallback: ' + reason,
    })
  })

  it('rejects composite guarded links', () => {
    const compositeModels = {
      ...models,
      User: {
        ...models.User,
        relations: {
          ...models.User.relations,
          posts: {
            ...models.User.relations.posts,
            parentLinkFields: ['id', 'profileId'],
            childLinkFields: ['userId', 'profileId'],
          },
        },
      },
    }

    const plan = planGuardedAutoInclude({
      rootModelName: 'User',
      models: compositeModels,
      effectiveReadBody: { select: { posts: true } },
      shape: { select: { posts: true } },
    })

    expect(plan.unsupportedReason).toBe(
      'guarded auto-progressive fallback: composite link fields not supported for guarded stage posts',
    )
  })

  it('enforces maxStages without returning a partial plan', () => {
    const body = { select: { posts: true, profile: true } }
    const shape = { select: { posts: true, profile: true } }
    const plan = planGuardedAutoInclude({
      rootModelName: 'User',
      models,
      effectiveReadBody: body,
      shape,
      maxStages: 1,
    })

    expect(plan).toEqual({
      rootArgs: body,
      rootShape: shape,
      stages: [],
      internalFieldPaths: [],
      unsupportedReason:
        'guarded auto-progressive fallback: stages reached maxStages=1',
    })
  })
})
