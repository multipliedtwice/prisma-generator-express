import express, { RequestHandler } from 'express'
import {
  PRODUCT_CATALOGFindFirst,
  type FindFirstMiddleware,
} from './PRODUCT_CATALOGFindFirst'
import {
  PRODUCT_CATALOGFindMany,
  type FindManyMiddleware,
} from './PRODUCT_CATALOGFindMany'
import {
  PRODUCT_CATALOGFindUnique,
  type FindUniqueMiddleware,
} from './PRODUCT_CATALOGFindUnique'
import {
  PRODUCT_CATALOGCreate,
  type CreateMiddleware,
} from './PRODUCT_CATALOGCreate'
import {
  PRODUCT_CATALOGCreateMany,
  type CreateManyMiddleware,
} from './PRODUCT_CATALOGCreateMany'
import {
  PRODUCT_CATALOGUpdate,
  type UpdateMiddleware,
} from './PRODUCT_CATALOGUpdate'
import {
  PRODUCT_CATALOGUpdateMany,
  type UpdateManyMiddleware,
} from './PRODUCT_CATALOGUpdateMany'
import {
  PRODUCT_CATALOGUpsert,
  type UpsertMiddleware,
} from './PRODUCT_CATALOGUpsert'
import {
  PRODUCT_CATALOGDelete,
  type DeleteMiddleware,
} from './PRODUCT_CATALOGDelete'
import {
  PRODUCT_CATALOGDeleteMany,
  type DeleteManyMiddleware,
} from './PRODUCT_CATALOGDeleteMany'
import {
  PRODUCT_CATALOGAggregate,
  type AggregateMiddleware,
} from './PRODUCT_CATALOGAggregate'
import {
  PRODUCT_CATALOGCount,
  type CountMiddleware,
} from './PRODUCT_CATALOGCount'
import {
  PRODUCT_CATALOGGroupBy,
  type GroupByMiddleware,
} from './PRODUCT_CATALOGGroupBy'

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
 * Generates an Express router for PRODUCT_CATALOG model.
 * @param config Contains optional middleware to enable routes.
 * @returns {express.Router}
 */
export function PRODUCT_CATALOGRouter(config: RouteConfig) {
  const router = express.Router()

  if (config?.findFirstMiddleware && config?.findFirstMiddleware.length) {
    const middlewares = [
      ...config.findFirstMiddleware,
      PRODUCT_CATALOGFindFirst,
    ]
    if (config.findFirstNextMiddleware) {
      middlewares.push(...config.findFirstNextMiddleware)
    }
    router.get('/first', ...(middlewares as FindFirstMiddleware[]))
  }

  if (config?.findManyMiddleware && config?.findManyMiddleware.length) {
    const middlewares = [...config.findManyMiddleware, PRODUCT_CATALOGFindMany]
    if (config.findManyNextMiddleware) {
      middlewares.push(...config.findManyNextMiddleware)
    }
    router.get('/', ...(middlewares as FindManyMiddleware[]))
  }

  if (config?.findUniqueMiddleware && config?.findUniqueMiddleware.length) {
    const middlewares = [
      ...config.findUniqueMiddleware,
      PRODUCT_CATALOGFindUnique,
    ]
    if (config.findUniqueNextMiddleware) {
      middlewares.push(...config.findUniqueNextMiddleware)
    }
    router.get('/:id', ...(middlewares as FindUniqueMiddleware[]))
  }

  if (config?.createMiddleware && config?.createMiddleware.length) {
    const middlewares = [...config.createMiddleware, PRODUCT_CATALOGCreate]
    if (config.createNextMiddleware) {
      middlewares.push(...config.createNextMiddleware)
    }
    router.post('/', ...(middlewares as CreateMiddleware[]))
  }

  if (config?.createManyMiddleware && config?.createManyMiddleware.length) {
    const middlewares = [
      ...config.createManyMiddleware,
      PRODUCT_CATALOGCreateMany,
    ]
    if (config.createManyNextMiddleware) {
      middlewares.push(...config.createManyNextMiddleware)
    }
    router.post('/many', ...(middlewares as CreateManyMiddleware[]))
  }

  if (config?.updateMiddleware && config?.updateMiddleware.length) {
    const middlewares = [...config.updateMiddleware, PRODUCT_CATALOGUpdate]
    if (config.updateNextMiddleware) {
      middlewares.push(...config.updateNextMiddleware)
    }
    router.put('/', ...(middlewares as UpdateMiddleware[]))
  }

  if (config?.updateManyMiddleware && config?.updateManyMiddleware.length) {
    const middlewares = [
      ...config.updateManyMiddleware,
      PRODUCT_CATALOGUpdateMany,
    ]
    if (config.updateManyNextMiddleware) {
      middlewares.push(...config.updateManyNextMiddleware)
    }
    router.put('/many', ...(middlewares as UpdateManyMiddleware[]))
  }

  if (config?.upsertMiddleware && config?.upsertMiddleware.length) {
    const middlewares = [...config.upsertMiddleware, PRODUCT_CATALOGUpsert]
    if (config.upsertNextMiddleware) {
      middlewares.push(...config.upsertNextMiddleware)
    }
    router.patch('/', ...(middlewares as UpsertMiddleware[]))
  }

  if (config?.deleteMiddleware && config?.deleteMiddleware.length) {
    const middlewares = [...config.deleteMiddleware, PRODUCT_CATALOGDelete]
    if (config.deleteNextMiddleware) {
      middlewares.push(...config.deleteNextMiddleware)
    }
    router.delete('/', ...(middlewares as DeleteMiddleware[]))
  }

  if (config?.deleteManyMiddleware && config?.deleteManyMiddleware.length) {
    const middlewares = [
      ...config.deleteManyMiddleware,
      PRODUCT_CATALOGDeleteMany,
    ]
    if (config.deleteManyNextMiddleware) {
      middlewares.push(...config.deleteManyNextMiddleware)
    }
    router.delete('/many', ...(middlewares as DeleteManyMiddleware[]))
  }

  if (config?.aggregateMiddleware && config?.aggregateMiddleware.length) {
    const middlewares = [
      ...config.aggregateMiddleware,
      PRODUCT_CATALOGAggregate,
    ]
    if (config.aggregateNextMiddleware) {
      middlewares.push(...config.aggregateNextMiddleware)
    }
    router.get('/aggregate', ...(middlewares as AggregateMiddleware[]))
  }

  if (config?.countMiddleware && config?.countMiddleware.length) {
    const middlewares = [...config.countMiddleware, PRODUCT_CATALOGCount]
    if (config.countNextMiddleware) {
      middlewares.push(...config.countNextMiddleware)
    }
    router.get('/count', ...(middlewares as CountMiddleware[]))
  }

  if (config?.groupByMiddleware && config?.groupByMiddleware.length) {
    const middlewares = [...config.groupByMiddleware, PRODUCT_CATALOGGroupBy]
    if (config.groupByNextMiddleware) {
      middlewares.push(...config.groupByNextMiddleware)
    }
    router.get('/groupby', ...(middlewares as GroupByMiddleware[]))
  }

  return router
}
