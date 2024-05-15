import express, { RequestHandler } from 'express'
import { UserFindFirst, type FindFirstMiddleware } from './UserFindFirst'
import { UserFindMany, type FindManyMiddleware } from './UserFindMany'
import { UserFindUnique, type FindUniqueMiddleware } from './UserFindUnique'
import { UserCreate, type CreateMiddleware } from './UserCreate'
import { UserCreateMany, type CreateManyMiddleware } from './UserCreateMany'
import { UserUpdate, type UpdateMiddleware } from './UserUpdate'
import { UserUpdateMany, type UpdateManyMiddleware } from './UserUpdateMany'
import { UserUpsert, type UpsertMiddleware } from './UserUpsert'
import { UserDelete, type DeleteMiddleware } from './UserDelete'
import { UserDeleteMany, type DeleteManyMiddleware } from './UserDeleteMany'
import { UserAggregate, type AggregateMiddleware } from './UserAggregate'
import { UserCount, type CountMiddleware } from './UserCount'
import { UserGroupBy, type GroupByMiddleware } from './UserGroupBy'

interface RouteConfig {
  findFirstMiddleware?: FindFirstMiddleware[]
  findFirstNextMiddleware?: RequestHandler[]

  findManyMiddleware?: FindManyMiddleware[]
  findManyNextMiddleware?: RequestHandler[]

  findUniqueMiddleware?: FindUniqueMiddleware[]
  findUniqueNextMiddleware?: RequestHandler[]

  createMiddleware?: CreateMiddleware[]
  createNextMiddleware?: RequestHandler[]

  createManyMiddleware?: CreateManyMiddleware[]
  createManyNextMiddleware?: RequestHandler[]

  updateMiddleware?: UpdateMiddleware[]
  updateNextMiddleware?: RequestHandler[]

  updateManyMiddleware?: UpdateManyMiddleware[]
  updateManyNextMiddleware?: RequestHandler[]

  upsertMiddleware?: UpsertMiddleware[]
  upsertNextMiddleware?: RequestHandler[]

  deleteMiddleware?: DeleteMiddleware[]
  deleteNextMiddleware?: RequestHandler[]

  deleteManyMiddleware?: DeleteManyMiddleware[]
  deleteManyNextMiddleware?: RequestHandler[]

  aggregateMiddleware?: AggregateMiddleware[]
  aggregateNextMiddleware?: RequestHandler[]

  countMiddleware?: CountMiddleware[]
  countNextMiddleware?: RequestHandler[]

  groupByMiddleware?: GroupByMiddleware[]
  groupByNextMiddleware?: RequestHandler[]
}

/**
 * Generates an Express router for User model.
 * @param config Contains optional middleware to enable routes.
 * @returns {express.Router}
 */
export function UserRouter(config: RouteConfig) {
  const router = express.Router()

  if (config?.findFirstMiddleware && config?.findFirstMiddleware.length) {
    const middlewares = [...config.findFirstMiddleware, UserFindFirst]
    if (config.findFirstNextMiddleware) {
      middlewares.push(...config.findFirstNextMiddleware)
    }
    router.get('/first', ...middlewares)
  }

  if (config?.findManyMiddleware && config?.findManyMiddleware.length) {
    const middlewares = [...config.findManyMiddleware, UserFindMany]
    if (config.findManyNextMiddleware) {
      middlewares.push(...config.findManyNextMiddleware)
    }
    router.get('/', ...middlewares)
  }

  if (config?.findUniqueMiddleware && config?.findUniqueMiddleware.length) {
    const middlewares = [...config.findUniqueMiddleware, UserFindUnique]
    if (config.findUniqueNextMiddleware) {
      middlewares.push(...config.findUniqueNextMiddleware)
    }
    router.get('/:id', ...middlewares)
  }

  if (config?.createMiddleware && config?.createMiddleware.length) {
    const middlewares = [...config.createMiddleware, UserCreate]
    if (config.createNextMiddleware) {
      middlewares.push(...config.createNextMiddleware)
    }
    router.post('/', ...middlewares)
  }

  if (config?.createManyMiddleware && config?.createManyMiddleware.length) {
    const middlewares = [...config.createManyMiddleware, UserCreateMany]
    if (config.createManyNextMiddleware) {
      middlewares.push(...config.createManyNextMiddleware)
    }
    router.post('/many', ...middlewares)
  }

  if (config?.updateMiddleware && config?.updateMiddleware.length) {
    const middlewares = [...config.updateMiddleware, UserUpdate]
    if (config.updateNextMiddleware) {
      middlewares.push(...config.updateNextMiddleware)
    }
    router.put('/', ...middlewares)
  }

  if (config?.updateManyMiddleware && config?.updateManyMiddleware.length) {
    const middlewares = [...config.updateManyMiddleware, UserUpdateMany]
    if (config.updateManyNextMiddleware) {
      middlewares.push(...config.updateManyNextMiddleware)
    }
    router.put('/many', ...middlewares)
  }

  if (config?.upsertMiddleware && config?.upsertMiddleware.length) {
    const middlewares = [...config.upsertMiddleware, UserUpsert]
    if (config.upsertNextMiddleware) {
      middlewares.push(...config.upsertNextMiddleware)
    }
    router.patch('/', ...middlewares)
  }

  if (config?.deleteMiddleware && config?.deleteMiddleware.length) {
    const middlewares = [...config.deleteMiddleware, UserDelete]
    if (config.deleteNextMiddleware) {
      middlewares.push(...config.deleteNextMiddleware)
    }
    router.delete('/', ...middlewares)
  }

  if (config?.deleteManyMiddleware && config?.deleteManyMiddleware.length) {
    const middlewares = [...config.deleteManyMiddleware, UserDeleteMany]
    if (config.deleteManyNextMiddleware) {
      middlewares.push(...config.deleteManyNextMiddleware)
    }
    router.delete('/many', ...middlewares)
  }

  if (config?.aggregateMiddleware && config?.aggregateMiddleware.length) {
    const middlewares = [...config.aggregateMiddleware, UserAggregate]
    if (config.aggregateNextMiddleware) {
      middlewares.push(...config.aggregateNextMiddleware)
    }
    router.get('/aggregate', ...middlewares)
  }

  if (config?.countMiddleware && config?.countMiddleware.length) {
    const middlewares = [...config.countMiddleware, UserCount]
    if (config.countNextMiddleware) {
      middlewares.push(...config.countNextMiddleware)
    }
    router.get('/count', ...middlewares)
  }

  if (config?.groupByMiddleware && config?.groupByMiddleware.length) {
    const middlewares = [...config.groupByMiddleware, UserGroupBy]
    if (config.groupByNextMiddleware) {
      middlewares.push(...config.groupByNextMiddleware)
    }
    router.get('/groupby', ...middlewares)
  }

  return router
}
