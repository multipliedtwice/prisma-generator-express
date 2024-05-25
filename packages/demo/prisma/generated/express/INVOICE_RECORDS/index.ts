import express, { RequestHandler } from 'express'
import { INVOICE_RECORDSFindFirst } from './INVOICE_RECORDSFindFirst'
import { INVOICE_RECORDSFindMany } from './INVOICE_RECORDSFindMany'
import { INVOICE_RECORDSFindUnique } from './INVOICE_RECORDSFindUnique'
import { INVOICE_RECORDSCreate } from './INVOICE_RECORDSCreate'
import { INVOICE_RECORDSCreateMany } from './INVOICE_RECORDSCreateMany'
import { INVOICE_RECORDSUpdate } from './INVOICE_RECORDSUpdate'
import { INVOICE_RECORDSUpdateMany } from './INVOICE_RECORDSUpdateMany'
import { INVOICE_RECORDSUpsert } from './INVOICE_RECORDSUpsert'
import { INVOICE_RECORDSDelete } from './INVOICE_RECORDSDelete'
import { INVOICE_RECORDSDeleteMany } from './INVOICE_RECORDSDeleteMany'
import { INVOICE_RECORDSAggregate } from './INVOICE_RECORDSAggregate'
import { INVOICE_RECORDSCount } from './INVOICE_RECORDSCount'
import { INVOICE_RECORDSGroupBy } from './INVOICE_RECORDSGroupBy'
import { RouteConfig } from '../RouteConfig'

const defaultBeforeAfter = {
  before: [] as RequestHandler[],
  after: [] as RequestHandler[],
}

/**
 * Generates an Express router for INVOICE_RECORDS model.
 * @param config Contains optional middleware to enable routes.
 * @param customUrlPrefix Optional custom URL prefix for the routes.
 * @returns {express.Router}
 */
export function INVOICE_RECORDSRouter(
  config: RouteConfig<RequestHandler>,
  customUrlPrefix = '',
) {
  const router = express.Router()
  const basePath =
    customUrlPrefix + (config.addModelPrefix ? '/invoice_records' : '')

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
    router[method](basePath + path, ...middlewares, handler)
  }

  if (config.enableAll || config?.findFirst) {
    const { before = [], after = [] } = config.findFirst || defaultBeforeAfter
    setupRoute(
      '/first',
      'get',
      before,
      INVOICE_RECORDSFindFirst as RequestHandler,
    )
    if (after.length) {
      router.use(basePath + '/first', ...after)
    }
  }

  if (config.enableAll || config?.findMany) {
    const { before = [], after = [] } = config.findMany || defaultBeforeAfter
    setupRoute('/', 'get', before, INVOICE_RECORDSFindMany as RequestHandler)
    if (after.length) {
      router.use(basePath + '/', ...after)
    }
  }

  if (config.enableAll || config?.findUnique) {
    const { before = [], after = [] } = config.findUnique || defaultBeforeAfter
    setupRoute('/:id', 'get', before, INVOICE_RECORDSFindUnique as any)
    if (after.length) {
      router.use(basePath + '/:id', ...after)
    }
  }

  if (config.enableAll || config?.create) {
    const { before = [], after = [] } = config.create || defaultBeforeAfter
    setupRoute('/', 'post', before, INVOICE_RECORDSCreate as RequestHandler)
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
      INVOICE_RECORDSCreateMany as RequestHandler,
    )
    if (after.length) {
      router.use(basePath + '/many', ...after)
    }
  }

  if (config.enableAll || config?.update) {
    const { before = [], after = [] } = config.update || defaultBeforeAfter
    setupRoute('/', 'put', before, INVOICE_RECORDSUpdate as RequestHandler)
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
      INVOICE_RECORDSUpdateMany as RequestHandler,
    )
    if (after.length) {
      router.use(basePath + '/many', ...after)
    }
  }

  if (config.enableAll || config?.upsert) {
    const { before = [], after = [] } = config.upsert || defaultBeforeAfter
    setupRoute('/', 'patch', before, INVOICE_RECORDSUpsert as RequestHandler)
    if (after.length) {
      router.use(basePath + '/', ...after)
    }
  }

  if (config.enableAll || config?.delete) {
    const { before = [], after = [] } = config.delete || defaultBeforeAfter
    setupRoute('/', 'delete', before, INVOICE_RECORDSDelete as RequestHandler)
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
      INVOICE_RECORDSDeleteMany as RequestHandler,
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
      INVOICE_RECORDSAggregate as RequestHandler,
    )
    if (after.length) {
      router.use(basePath + '/aggregate', ...after)
    }
  }

  if (config.enableAll || config?.count) {
    const { before = [], after = [] } = config.count || defaultBeforeAfter
    setupRoute('/count', 'get', before, INVOICE_RECORDSCount as RequestHandler)
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
      INVOICE_RECORDSGroupBy as RequestHandler,
    )
    if (after.length) {
      router.use(basePath + '/groupby', ...after)
    }
  }

  return router
}
