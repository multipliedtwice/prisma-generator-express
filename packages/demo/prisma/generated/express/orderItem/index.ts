import express, { RequestHandler } from 'express'
import {
  orderItemFindFirst,
  type FindFirstMiddleware,
} from './orderItemFindFirst'
import { orderItemFindMany, type FindManyMiddleware } from './orderItemFindMany'
import {
  orderItemFindUnique,
  type FindUniqueMiddleware,
} from './orderItemFindUnique'
import { orderItemCreate, type CreateMiddleware } from './orderItemCreate'
import {
  orderItemCreateMany,
  type CreateManyMiddleware,
} from './orderItemCreateMany'
import { orderItemUpdate, type UpdateMiddleware } from './orderItemUpdate'
import {
  orderItemUpdateMany,
  type UpdateManyMiddleware,
} from './orderItemUpdateMany'
import { orderItemUpsert, type UpsertMiddleware } from './orderItemUpsert'
import { orderItemDelete, type DeleteMiddleware } from './orderItemDelete'
import {
  orderItemDeleteMany,
  type DeleteManyMiddleware,
} from './orderItemDeleteMany'
import {
  orderItemAggregate,
  type AggregateMiddleware,
} from './orderItemAggregate'
import { orderItemCount, type CountMiddleware } from './orderItemCount'
import { orderItemGroupBy, type GroupByMiddleware } from './orderItemGroupBy'

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
 * Generates an Express router for orderItem model.
 * @param config Contains optional middleware to enable routes.
 * @returns {express.Router}
 */
export function orderItemRouter(config: RouteConfig) {
  const router = express.Router()

  if (config?.findFirstMiddleware && config?.findFirstMiddleware.length) {
    const middlewares = [...config.findFirstMiddleware, orderItemFindFirst]
    if (config.findFirstNextMiddleware) {
      middlewares.push(...config.findFirstNextMiddleware)
    }
    router.get('/first', ...(middlewares as FindFirstMiddleware[]))
  }

  if (config?.findManyMiddleware && config?.findManyMiddleware.length) {
    const middlewares = [...config.findManyMiddleware, orderItemFindMany]
    if (config.findManyNextMiddleware) {
      middlewares.push(...config.findManyNextMiddleware)
    }
    router.get('/', ...(middlewares as FindManyMiddleware[]))
  }

  if (config?.findUniqueMiddleware && config?.findUniqueMiddleware.length) {
    const middlewares = [...config.findUniqueMiddleware, orderItemFindUnique]
    if (config.findUniqueNextMiddleware) {
      middlewares.push(...config.findUniqueNextMiddleware)
    }
    router.get('/:id', ...(middlewares as FindUniqueMiddleware[]))
  }

  if (config?.createMiddleware && config?.createMiddleware.length) {
    const middlewares = [...config.createMiddleware, orderItemCreate]
    if (config.createNextMiddleware) {
      middlewares.push(...config.createNextMiddleware)
    }
    router.post('/', ...(middlewares as CreateMiddleware[]))
  }

  if (config?.createManyMiddleware && config?.createManyMiddleware.length) {
    const middlewares = [...config.createManyMiddleware, orderItemCreateMany]
    if (config.createManyNextMiddleware) {
      middlewares.push(...config.createManyNextMiddleware)
    }
    router.post('/many', ...(middlewares as CreateManyMiddleware[]))
  }

  if (config?.updateMiddleware && config?.updateMiddleware.length) {
    const middlewares = [...config.updateMiddleware, orderItemUpdate]
    if (config.updateNextMiddleware) {
      middlewares.push(...config.updateNextMiddleware)
    }
    router.put('/', ...(middlewares as UpdateMiddleware[]))
  }

  if (config?.updateManyMiddleware && config?.updateManyMiddleware.length) {
    const middlewares = [...config.updateManyMiddleware, orderItemUpdateMany]
    if (config.updateManyNextMiddleware) {
      middlewares.push(...config.updateManyNextMiddleware)
    }
    router.put('/many', ...(middlewares as UpdateManyMiddleware[]))
  }

  if (config?.upsertMiddleware && config?.upsertMiddleware.length) {
    const middlewares = [...config.upsertMiddleware, orderItemUpsert]
    if (config.upsertNextMiddleware) {
      middlewares.push(...config.upsertNextMiddleware)
    }
    router.patch('/', ...(middlewares as UpsertMiddleware[]))
  }

  if (config?.deleteMiddleware && config?.deleteMiddleware.length) {
    const middlewares = [...config.deleteMiddleware, orderItemDelete]
    if (config.deleteNextMiddleware) {
      middlewares.push(...config.deleteNextMiddleware)
    }
    router.delete('/', ...(middlewares as DeleteMiddleware[]))
  }

  if (config?.deleteManyMiddleware && config?.deleteManyMiddleware.length) {
    const middlewares = [...config.deleteManyMiddleware, orderItemDeleteMany]
    if (config.deleteManyNextMiddleware) {
      middlewares.push(...config.deleteManyNextMiddleware)
    }
    router.delete('/many', ...(middlewares as DeleteManyMiddleware[]))
  }

  if (config?.aggregateMiddleware && config?.aggregateMiddleware.length) {
    const middlewares = [...config.aggregateMiddleware, orderItemAggregate]
    if (config.aggregateNextMiddleware) {
      middlewares.push(...config.aggregateNextMiddleware)
    }
    router.get('/aggregate', ...(middlewares as AggregateMiddleware[]))
  }

  if (config?.countMiddleware && config?.countMiddleware.length) {
    const middlewares = [...config.countMiddleware, orderItemCount]
    if (config.countNextMiddleware) {
      middlewares.push(...config.countNextMiddleware)
    }
    router.get('/count', ...(middlewares as CountMiddleware[]))
  }

  if (config?.groupByMiddleware && config?.groupByMiddleware.length) {
    const middlewares = [...config.groupByMiddleware, orderItemGroupBy]
    if (config.groupByNextMiddleware) {
      middlewares.push(...config.groupByNextMiddleware)
    }
    router.get('/groupby', ...(middlewares as GroupByMiddleware[]))
  }

  return router
}
