import express, { RequestHandler } from 'express'
import { ParsedQs } from 'qs'
import { PRODUCT_CATALOGFindFirst } from './PRODUCT_CATALOGFindFirst'
import { PRODUCT_CATALOGFindMany } from './PRODUCT_CATALOGFindMany'
import { PRODUCT_CATALOGFindUnique } from './PRODUCT_CATALOGFindUnique'
import { PRODUCT_CATALOGCreate } from './PRODUCT_CATALOGCreate'
import { PRODUCT_CATALOGCreateMany } from './PRODUCT_CATALOGCreateMany'
import { PRODUCT_CATALOGUpdate } from './PRODUCT_CATALOGUpdate'
import { PRODUCT_CATALOGUpdateMany } from './PRODUCT_CATALOGUpdateMany'
import { PRODUCT_CATALOGUpsert } from './PRODUCT_CATALOGUpsert'
import { PRODUCT_CATALOGDelete } from './PRODUCT_CATALOGDelete'
import { PRODUCT_CATALOGDeleteMany } from './PRODUCT_CATALOGDeleteMany'
import { PRODUCT_CATALOGAggregate } from './PRODUCT_CATALOGAggregate'
import { PRODUCT_CATALOGCount } from './PRODUCT_CATALOGCount'
import { PRODUCT_CATALOGGroupBy } from './PRODUCT_CATALOGGroupBy'
import { RouteConfig } from '../routeConfig'
import { parseQueryParams } from '../ParseQueryParams'

const defaultBeforeAfter = {
  before: [] as RequestHandler[],
  after: [] as RequestHandler[],
}

/**
 * Generates an Express router for PRODUCT_CATALOG model.
 * @param config Contains optional middleware to enable routes.
 * @param customUrlPrefix Optional custom URL prefix for the routes.
 * @returns {express.Router}
 */
export function PRODUCT_CATALOGRouter(config: RouteConfig<RequestHandler>) {
  const router = express.Router()
  const basePath =
    (config.customUrlPrefix || '') +
    (config.addModelPrefix ? '/product_catalog' : '')

  const setupRoute = (
    path: string,
    method:
      | 'all'
      | 'get'
      | 'post'
      | 'put'
      | 'delete'
      | 'patch'
      | 'options'
      | 'head',
    middlewares: RequestHandler[],
    handler: RequestHandler,
  ) => {
    router[method](
      basePath + path,
      (req, res, next) => {
        if (req.query)
          req.query = parseQueryParams(
            req.query as Record<string, string>,
          ) as ParsedQs
        next()
      },
      ...middlewares,
      handler,
    )
  }

  if (config.enableAll || config?.findFirst) {
    const { before = [], after = [] } = config.findFirst || defaultBeforeAfter
    setupRoute(
      '/first',
      'get',
      before,
      PRODUCT_CATALOGFindFirst as RequestHandler,
    )
    if (after.length) {
      router.use(basePath + '/first', ...after)
    }
  }

  if (config.enableAll || config?.findMany) {
    const { before = [], after = [] } = config.findMany || defaultBeforeAfter
    setupRoute('/', 'get', before, PRODUCT_CATALOGFindMany as RequestHandler)
    if (after.length) {
      router.use(basePath + '/', ...after)
    }
  }

  if (config.enableAll || config?.findUnique) {
    const { before = [], after = [] } = config.findUnique || defaultBeforeAfter
    setupRoute('/:id', 'get', before, PRODUCT_CATALOGFindUnique as any)
    if (after.length) {
      router.use(basePath + '/:id', ...after)
    }
  }

  if (config.enableAll || config?.create) {
    const { before = [], after = [] } = config.create || defaultBeforeAfter
    setupRoute('/', 'post', before, PRODUCT_CATALOGCreate as RequestHandler)
    if (after.length) {
      router.use(basePath + '/', ...after)
    }
  }

  if (config.enableAll || config?.createMany) {
    const { before = [], after = [] } = config.createMany || defaultBeforeAfter
    setupRoute(
      '/many',
      'post',
      before,
      PRODUCT_CATALOGCreateMany as RequestHandler,
    )
    if (after.length) {
      router.use(basePath + '/many', ...after)
    }
  }

  if (config.enableAll || config?.update) {
    const { before = [], after = [] } = config.update || defaultBeforeAfter
    setupRoute('/', 'put', before, PRODUCT_CATALOGUpdate as RequestHandler)
    if (after.length) {
      router.use(basePath + '/', ...after)
    }
  }

  if (config.enableAll || config?.updateMany) {
    const { before = [], after = [] } = config.updateMany || defaultBeforeAfter
    setupRoute(
      '/many',
      'put',
      before,
      PRODUCT_CATALOGUpdateMany as RequestHandler,
    )
    if (after.length) {
      router.use(basePath + '/many', ...after)
    }
  }

  if (config.enableAll || config?.upsert) {
    const { before = [], after = [] } = config.upsert || defaultBeforeAfter
    setupRoute('/', 'patch', before, PRODUCT_CATALOGUpsert as RequestHandler)
    if (after.length) {
      router.use(basePath + '/', ...after)
    }
  }

  if (config.enableAll || config?.delete) {
    const { before = [], after = [] } = config.delete || defaultBeforeAfter
    setupRoute('/', 'delete', before, PRODUCT_CATALOGDelete as RequestHandler)
    if (after.length) {
      router.use(basePath + '/', ...after)
    }
  }

  if (config.enableAll || config?.deleteMany) {
    const { before = [], after = [] } = config.deleteMany || defaultBeforeAfter
    setupRoute(
      '/many',
      'delete',
      before,
      PRODUCT_CATALOGDeleteMany as RequestHandler,
    )
    if (after.length) {
      router.use(basePath + '/many', ...after)
    }
  }

  if (config.enableAll || config?.aggregate) {
    const { before = [], after = [] } = config.aggregate || defaultBeforeAfter
    setupRoute(
      '/aggregate',
      'get',
      before,
      PRODUCT_CATALOGAggregate as RequestHandler,
    )
    if (after.length) {
      router.use(basePath + '/aggregate', ...after)
    }
  }

  if (config.enableAll || config?.count) {
    const { before = [], after = [] } = config.count || defaultBeforeAfter
    setupRoute('/count', 'get', before, PRODUCT_CATALOGCount as RequestHandler)
    if (after.length) {
      router.use(basePath + '/count', ...after)
    }
  }

  if (config.enableAll || config?.groupBy) {
    const { before = [], after = [] } = config.groupBy || defaultBeforeAfter
    setupRoute(
      '/groupby',
      'get',
      before,
      PRODUCT_CATALOGGroupBy as RequestHandler,
    )
    if (after.length) {
      router.use(basePath + '/groupby', ...after)
    }
  }

  return router
}
