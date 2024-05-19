import express, { RequestHandler } from 'express'
import {
  INVOICE_RECORDSFindFirst,
  type FindFirstMiddleware,
} from './INVOICE_RECORDSFindFirst'
import {
  INVOICE_RECORDSFindMany,
  type FindManyMiddleware,
} from './INVOICE_RECORDSFindMany'
import {
  INVOICE_RECORDSFindUnique,
  type FindUniqueMiddleware,
} from './INVOICE_RECORDSFindUnique'
import {
  INVOICE_RECORDSCreate,
  type CreateMiddleware,
} from './INVOICE_RECORDSCreate'
import {
  INVOICE_RECORDSCreateMany,
  type CreateManyMiddleware,
} from './INVOICE_RECORDSCreateMany'
import {
  INVOICE_RECORDSUpdate,
  type UpdateMiddleware,
} from './INVOICE_RECORDSUpdate'
import {
  INVOICE_RECORDSUpdateMany,
  type UpdateManyMiddleware,
} from './INVOICE_RECORDSUpdateMany'
import {
  INVOICE_RECORDSUpsert,
  type UpsertMiddleware,
} from './INVOICE_RECORDSUpsert'
import {
  INVOICE_RECORDSDelete,
  type DeleteMiddleware,
} from './INVOICE_RECORDSDelete'
import {
  INVOICE_RECORDSDeleteMany,
  type DeleteManyMiddleware,
} from './INVOICE_RECORDSDeleteMany'
import {
  INVOICE_RECORDSAggregate,
  type AggregateMiddleware,
} from './INVOICE_RECORDSAggregate'
import {
  INVOICE_RECORDSCount,
  type CountMiddleware,
} from './INVOICE_RECORDSCount'
import {
  INVOICE_RECORDSGroupBy,
  type GroupByMiddleware,
} from './INVOICE_RECORDSGroupBy'

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
 * Generates an Express router for INVOICE_RECORDS model.
 * @param config Contains optional middleware to enable routes.
 * @returns {express.Router}
 */
export function INVOICE_RECORDSRouter(config: RouteConfig) {
  const router = express.Router()

  if (config?.findFirstMiddleware && config?.findFirstMiddleware.length) {
    const middlewares = [
      ...config.findFirstMiddleware,
      INVOICE_RECORDSFindFirst,
    ]
    if (config.findFirstNextMiddleware) {
      middlewares.push(...config.findFirstNextMiddleware)
    }
    router.get('/first', ...(middlewares as FindFirstMiddleware[]))
  }

  if (config?.findManyMiddleware && config?.findManyMiddleware.length) {
    const middlewares = [...config.findManyMiddleware, INVOICE_RECORDSFindMany]
    if (config.findManyNextMiddleware) {
      middlewares.push(...config.findManyNextMiddleware)
    }
    router.get('/', ...(middlewares as FindManyMiddleware[]))
  }

  if (config?.findUniqueMiddleware && config?.findUniqueMiddleware.length) {
    const middlewares = [
      ...config.findUniqueMiddleware,
      INVOICE_RECORDSFindUnique,
    ]
    if (config.findUniqueNextMiddleware) {
      middlewares.push(...config.findUniqueNextMiddleware)
    }
    router.get('/:id', ...(middlewares as FindUniqueMiddleware[]))
  }

  if (config?.createMiddleware && config?.createMiddleware.length) {
    const middlewares = [...config.createMiddleware, INVOICE_RECORDSCreate]
    if (config.createNextMiddleware) {
      middlewares.push(...config.createNextMiddleware)
    }
    router.post('/', ...(middlewares as CreateMiddleware[]))
  }

  if (config?.createManyMiddleware && config?.createManyMiddleware.length) {
    const middlewares = [
      ...config.createManyMiddleware,
      INVOICE_RECORDSCreateMany,
    ]
    if (config.createManyNextMiddleware) {
      middlewares.push(...config.createManyNextMiddleware)
    }
    router.post('/many', ...(middlewares as CreateManyMiddleware[]))
  }

  if (config?.updateMiddleware && config?.updateMiddleware.length) {
    const middlewares = [...config.updateMiddleware, INVOICE_RECORDSUpdate]
    if (config.updateNextMiddleware) {
      middlewares.push(...config.updateNextMiddleware)
    }
    router.put('/', ...(middlewares as UpdateMiddleware[]))
  }

  if (config?.updateManyMiddleware && config?.updateManyMiddleware.length) {
    const middlewares = [
      ...config.updateManyMiddleware,
      INVOICE_RECORDSUpdateMany,
    ]
    if (config.updateManyNextMiddleware) {
      middlewares.push(...config.updateManyNextMiddleware)
    }
    router.put('/many', ...(middlewares as UpdateManyMiddleware[]))
  }

  if (config?.upsertMiddleware && config?.upsertMiddleware.length) {
    const middlewares = [...config.upsertMiddleware, INVOICE_RECORDSUpsert]
    if (config.upsertNextMiddleware) {
      middlewares.push(...config.upsertNextMiddleware)
    }
    router.patch('/', ...(middlewares as UpsertMiddleware[]))
  }

  if (config?.deleteMiddleware && config?.deleteMiddleware.length) {
    const middlewares = [...config.deleteMiddleware, INVOICE_RECORDSDelete]
    if (config.deleteNextMiddleware) {
      middlewares.push(...config.deleteNextMiddleware)
    }
    router.delete('/', ...(middlewares as DeleteMiddleware[]))
  }

  if (config?.deleteManyMiddleware && config?.deleteManyMiddleware.length) {
    const middlewares = [
      ...config.deleteManyMiddleware,
      INVOICE_RECORDSDeleteMany,
    ]
    if (config.deleteManyNextMiddleware) {
      middlewares.push(...config.deleteManyNextMiddleware)
    }
    router.delete('/many', ...(middlewares as DeleteManyMiddleware[]))
  }

  if (config?.aggregateMiddleware && config?.aggregateMiddleware.length) {
    const middlewares = [
      ...config.aggregateMiddleware,
      INVOICE_RECORDSAggregate,
    ]
    if (config.aggregateNextMiddleware) {
      middlewares.push(...config.aggregateNextMiddleware)
    }
    router.get('/aggregate', ...(middlewares as AggregateMiddleware[]))
  }

  if (config?.countMiddleware && config?.countMiddleware.length) {
    const middlewares = [...config.countMiddleware, INVOICE_RECORDSCount]
    if (config.countNextMiddleware) {
      middlewares.push(...config.countNextMiddleware)
    }
    router.get('/count', ...(middlewares as CountMiddleware[]))
  }

  if (config?.groupByMiddleware && config?.groupByMiddleware.length) {
    const middlewares = [...config.groupByMiddleware, INVOICE_RECORDSGroupBy]
    if (config.groupByNextMiddleware) {
      middlewares.push(...config.groupByNextMiddleware)
    }
    router.get('/groupby', ...(middlewares as GroupByMiddleware[]))
  }

  return router
}
