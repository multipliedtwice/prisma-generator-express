import express, { RequestHandler } from 'express'
import { orderItemFindFirst } from './orderItemFindFirst'
import { orderItemFindMany } from './orderItemFindMany'
import { orderItemFindUnique } from './orderItemFindUnique'
import { orderItemCreate } from './orderItemCreate'
import { orderItemCreateMany } from './orderItemCreateMany'
import { orderItemUpdate } from './orderItemUpdate'
import { orderItemUpdateMany } from './orderItemUpdateMany'
import { orderItemUpsert } from './orderItemUpsert'
import { orderItemDelete } from './orderItemDelete'
import { orderItemDeleteMany } from './orderItemDeleteMany'
import { orderItemAggregate } from './orderItemAggregate'
import { orderItemCount } from './orderItemCount'
import { orderItemGroupBy } from './orderItemGroupBy'
import { RouteConfig } from '../RouteConfig'

const defaultBeforeAfter = {
  before: [] as RequestHandler[],
  after: [] as RequestHandler[],
}

/**
 * Parses a query value to convert strings to their respective types.
 * @param {string} value - The query value to parse.
 * @returns {any} The parsed value.
 */
const parseQueryValue = (value: string) => {
  if (value === 'true') return true
  if (value === 'false') return false
  if (value === 'null') return null
  if (!isNaN(Number(value))) return Number(value)
  return value
}

/**
 * Recursively parses query parameters to convert strings to their respective types.
 * @param {any} params - The query parameters to parse.
 * @returns {any} The parsed query parameters.
 */
const parseQueryParams = (params: any) => {
  const parsedParams: any = {}
  for (const key in params) {
    const value = params[key]
    if (typeof value === 'string') {
      parsedParams[key] = parseQueryValue(value)
    } else if (Array.isArray(value)) {
      parsedParams[key] = value.map(parseQueryValue)
    } else if (typeof value === 'object') {
      parsedParams[key] = parseQueryParams(value)
    } else {
      parsedParams[key] = value
    }
  }
  return parsedParams
}

/**
 * Generates an Express router for orderItem model.
 * @param config Contains optional middleware to enable routes.
 * @param customUrlPrefix Optional custom URL prefix for the routes.
 * @returns {express.Router}
 */
export function orderItemRouter(config: RouteConfig<RequestHandler>) {
  const router = express.Router()
  const basePath =
    (config.customUrlPrefix || '') + (config.addModelPrefix ? '/orderitem' : '')

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
        req.query = parseQueryParams(req.query)
        handler(req, res, next)
      },
      ...middlewares,
    )
  }

  if (config.enableAll || config?.findFirst) {
    const { before = [], after = [] } = config.findFirst || defaultBeforeAfter
    setupRoute('/first', 'get', before, orderItemFindFirst as RequestHandler)
    if (after.length) {
      router.use(basePath + '/first', ...after)
    }
  }

  if (config.enableAll || config?.findMany) {
    const { before = [], after = [] } = config.findMany || defaultBeforeAfter
    setupRoute('/', 'get', before, orderItemFindMany as RequestHandler)
    if (after.length) {
      router.use(basePath + '/', ...after)
    }
  }

  if (config.enableAll || config?.findUnique) {
    const { before = [], after = [] } = config.findUnique || defaultBeforeAfter
    setupRoute('/:id', 'get', before, orderItemFindUnique as any)
    if (after.length) {
      router.use(basePath + '/:id', ...after)
    }
  }

  if (config.enableAll || config?.create) {
    const { before = [], after = [] } = config.create || defaultBeforeAfter
    setupRoute('/', 'post', before, orderItemCreate as RequestHandler)
    if (after.length) {
      router.use(basePath + '/', ...after)
    }
  }

  if (config.enableAll || config?.createMany) {
    const { before = [], after = [] } = config.createMany || defaultBeforeAfter
    setupRoute('/many', 'post', before, orderItemCreateMany as RequestHandler)
    if (after.length) {
      router.use(basePath + '/many', ...after)
    }
  }

  if (config.enableAll || config?.update) {
    const { before = [], after = [] } = config.update || defaultBeforeAfter
    setupRoute('/', 'put', before, orderItemUpdate as RequestHandler)
    if (after.length) {
      router.use(basePath + '/', ...after)
    }
  }

  if (config.enableAll || config?.updateMany) {
    const { before = [], after = [] } = config.updateMany || defaultBeforeAfter
    setupRoute('/many', 'put', before, orderItemUpdateMany as RequestHandler)
    if (after.length) {
      router.use(basePath + '/many', ...after)
    }
  }

  if (config.enableAll || config?.upsert) {
    const { before = [], after = [] } = config.upsert || defaultBeforeAfter
    setupRoute('/', 'patch', before, orderItemUpsert as RequestHandler)
    if (after.length) {
      router.use(basePath + '/', ...after)
    }
  }

  if (config.enableAll || config?.delete) {
    const { before = [], after = [] } = config.delete || defaultBeforeAfter
    setupRoute('/', 'delete', before, orderItemDelete as RequestHandler)
    if (after.length) {
      router.use(basePath + '/', ...after)
    }
  }

  if (config.enableAll || config?.deleteMany) {
    const { before = [], after = [] } = config.deleteMany || defaultBeforeAfter
    setupRoute('/many', 'delete', before, orderItemDeleteMany as RequestHandler)
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
      orderItemAggregate as RequestHandler,
    )
    if (after.length) {
      router.use(basePath + '/aggregate', ...after)
    }
  }

  if (config.enableAll || config?.count) {
    const { before = [], after = [] } = config.count || defaultBeforeAfter
    setupRoute('/count', 'get', before, orderItemCount as RequestHandler)
    if (after.length) {
      router.use(basePath + '/count', ...after)
    }
  }

  if (config.enableAll || config?.groupBy) {
    const { before = [], after = [] } = config.groupBy || defaultBeforeAfter
    setupRoute('/groupby', 'get', before, orderItemGroupBy as RequestHandler)
    if (after.length) {
      router.use(basePath + '/groupby', ...after)
    }
  }

  return router
}
