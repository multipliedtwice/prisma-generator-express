import { describe, expect, it } from 'vitest'
import { planAutoInclude } from '../../../src/copy/autoIncludePlanner'
import { models } from './autoIncludeFixtures'

describe('planAutoInclude', () => {
  it('returns the original args when there is no projection', () => {
    const args = { where: { active: true }, take: 10 }

    expect(
      planAutoInclude({ rootModelName: 'User', models, args }),
    ).toEqual({
      rootArgs: args,
      stages: [],
      internalFieldPaths: [],
    })
  })

  it('splits a selected relation and injects the parent link field', () => {
    const plan = planAutoInclude({
      rootModelName: 'User',
      models,
      args: {
        where: { active: true },
        select: {
          name: true,
          posts: {
            where: { published: true },
            orderBy: { id: 'desc' },
            select: { title: true },
          },
        },
      },
    })

    expect(plan.rootArgs).toEqual({
      where: { active: true },
      select: { name: true, id: true },
    })
    expect(plan.internalFieldPaths).toEqual(['id'])
    expect(plan.stages).toHaveLength(1)
    expect(plan.stages[0]).toMatchObject({
      relationPath: 'posts',
      parentPath: '',
      relationName: 'posts',
      stageArgs: {
        where: { published: true },
        orderBy: { id: 'desc' },
        select: { title: true },
      },
      depth: 1,
    })
  })

  it('strips relation-only include from the root query', () => {
    const plan = planAutoInclude({
      rootModelName: 'User',
      models,
      args: { include: { posts: true } },
    })

    expect(plan.rootArgs).toEqual({})
    expect(plan.stages).toHaveLength(1)
    expect(plan.stages[0].stageArgs).toEqual({})
  })

  it('keeps non-relation include entries after relation stripping', () => {
    const plan = planAutoInclude({
      rootModelName: 'User',
      models,
      args: { include: { synthetic: true, posts: true } },
    })

    expect(plan.rootArgs).toEqual({ include: { synthetic: true } })
  })

  it('creates nested stages and injects link fields at each scope', () => {
    const plan = planAutoInclude({
      rootModelName: 'User',
      models,
      args: {
        select: {
          name: true,
          posts: {
            select: {
              title: true,
              author: { select: { name: true } },
            },
          },
        },
      },
    })

    expect(plan.rootArgs).toEqual({ select: { name: true, id: true } })
    expect(plan.internalFieldPaths).toEqual(['id', 'posts.userId'])
    expect(plan.stages).toHaveLength(2)
    expect(plan.stages[0]).toMatchObject({
      relationPath: 'posts',
      parentPath: '',
      stageArgs: { select: { title: true, userId: true } },
      depth: 1,
    })
    expect(plan.stages[1]).toMatchObject({
      relationPath: 'posts.author',
      parentPath: 'posts',
      stageArgs: { select: { name: true } },
      depth: 2,
    })
  })

  it('preserves false relation selections without creating a stage', () => {
    const plan = planAutoInclude({
      rootModelName: 'User',
      models,
      args: { select: { name: true, posts: false } },
    })

    expect(plan).toEqual({
      rootArgs: { select: { name: true, posts: false } },
      stages: [],
      internalFieldPaths: [],
    })
  })

  it.each([
    {
      label: 'select and include at the same level',
      args: { select: { id: true }, include: { posts: true } },
      reason: 'select+include at same level',
    },
    {
      label: 'select and omit at the same level',
      args: { select: { id: true }, omit: { name: true } },
      reason: 'select+omit at same level',
    },
    {
      label: '_count projection',
      args: { select: { _count: true } },
      reason: '_count not supported in MVP',
    },
    {
      label: 'relation filter',
      args: { where: { posts: { some: { published: true } } }, select: { id: true } },
      reason: 'relation used in where/orderBy/cursor is not supported in MVP',
    },
    {
      label: 'implicit many-to-many relation',
      args: { include: { groups: true } },
      reason: 'implicit many-to-many not supported in MVP',
    },
    {
      label: 'omitted parent link field',
      args: { omit: { id: true }, include: { posts: true } },
      reason: 'required parent link field omitted: root.id',
    },
    {
      label: 'unsupported to-one argument',
      args: { include: { profile: { where: { id: 1 } } } },
      reason: 'unsupported arg "where" for to-one relation profile',
    },
    {
      label: 'invalid relation projection',
      args: { include: { posts: [] } },
      reason: 'invalid relation projection value for posts (expected true or plain object)',
    },
  ])('falls back atomically for $label', ({ args, reason }) => {
    const plan = planAutoInclude({ rootModelName: 'User', models, args })

    expect(plan).toEqual({
      rootArgs: args,
      stages: [],
      internalFieldPaths: [],
      unsupportedReason: 'auto-progressive fallback: ' + reason,
    })
  })

  it('rejects nested relation references inside stage filters', () => {
    const args = {
      include: {
        posts: {
          where: { author: { is: { name: 'A' } } },
        },
      },
    }

    expect(
      planAutoInclude({ rootModelName: 'User', models, args }),
    ).toEqual({
      rootArgs: args,
      stages: [],
      internalFieldPaths: [],
      unsupportedReason:
        'auto-progressive fallback: nested relation used in where/orderBy/cursor for posts is not supported in MVP',
    })
  })

  it('enforces maxDepth for nested projections', () => {
    const args = {
      select: {
        posts: {
          select: {
            author: { select: { name: true } },
          },
        },
      },
    }

    expect(
      planAutoInclude({
        rootModelName: 'User',
        models,
        args,
        maxDepth: 1,
      }).unsupportedReason,
    ).toBe('auto-progressive fallback: nested depth reached maxDepth=1')
  })

  it('enforces maxStages without returning a partial plan', () => {
    const args = { include: { posts: true, profile: true } }
    const plan = planAutoInclude({
      rootModelName: 'User',
      models,
      args,
      maxStages: 1,
    })

    expect(plan).toEqual({
      rootArgs: args,
      stages: [],
      internalFieldPaths: [],
      unsupportedReason: 'auto-progressive fallback: stages reached maxStages=1',
    })
  })

  it('rejects missing target model metadata', () => {
    const incompleteModels = {
      ...models,
      User: {
        ...models.User,
        relations: {
          ...models.User.relations,
          missing: {
            ...models.User.relations.profile,
            name: 'missing',
            type: 'Missing',
          },
        },
      },
    }
    const args = { include: { missing: true } }

    expect(
      planAutoInclude({
        rootModelName: 'User',
        models: incompleteModels,
        args,
      }).unsupportedReason,
    ).toBe(
      'auto-progressive fallback: target model Missing not in relation metadata for missing',
    )
  })
})
