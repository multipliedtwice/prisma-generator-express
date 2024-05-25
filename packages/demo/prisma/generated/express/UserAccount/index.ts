import express, { RequestHandler } from 'express'
import { UserAccountFindFirst } from './UserAccountFindFirst'
import { UserAccountFindMany } from './UserAccountFindMany'
import { UserAccountFindUnique } from './UserAccountFindUnique'
import { UserAccountCreate } from './UserAccountCreate'
import { UserAccountCreateMany } from './UserAccountCreateMany'
import { UserAccountUpdate } from './UserAccountUpdate'
import { UserAccountUpdateMany } from './UserAccountUpdateMany'
import { UserAccountUpsert } from './UserAccountUpsert'
import { UserAccountDelete } from './UserAccountDelete'
import { UserAccountDeleteMany } from './UserAccountDeleteMany'
import { UserAccountAggregate } from './UserAccountAggregate'
import { UserAccountCount } from './UserAccountCount'
import { UserAccountGroupBy } from './UserAccountGroupBy'
import { RouteConfig } from '../RouteConfig'

const defaultBeforeAfter = {
  before: [] as RequestHandler[],
  after: [] as RequestHandler[],
}

/**
 * Generates an Express router for UserAccount model.
 * @param config Contains optional middleware to enable routes.
 * @param customUrlPrefix Optional custom URL prefix for the routes.
 * @returns {express.Router}
 */
export function UserAccountRouter(
  config: RouteConfig<RequestHandler>,
  customUrlPrefix = '',
) {
  const router = express.Router()
  const basePath =
    customUrlPrefix + (config.addModelPrefix ? '/useraccount' : '')

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
    setupRoute('/first', 'get', before, UserAccountFindFirst as RequestHandler)
    if (after.length) {
      router.use(basePath + '/first', ...after)
    }
  }

  if (config.enableAll || config?.findMany) {
    const { before = [], after = [] } = config.findMany || defaultBeforeAfter
    setupRoute('/', 'get', before, UserAccountFindMany as RequestHandler)
    if (after.length) {
      router.use(basePath + '/', ...after)
    }
  }

  if (config.enableAll || config?.findUnique) {
    const { before = [], after = [] } = config.findUnique || defaultBeforeAfter
    setupRoute('/:id', 'get', before, UserAccountFindUnique as any)
    if (after.length) {
      router.use(basePath + '/:id', ...after)
    }
  }

  if (config.enableAll || config?.create) {
    const { before = [], after = [] } = config.create || defaultBeforeAfter
    setupRoute('/', 'post', before, UserAccountCreate as RequestHandler)
    if (after.length) {
      router.use(basePath + '/', ...after)
    }
  }

  if (config.enableAll || config?.createMany) {
    const { before = [], after = [] } = config.createMany || defaultBeforeAfter
    setupRoute('/many', 'post', before, UserAccountCreateMany as RequestHandler)
    if (after.length) {
      router.use(basePath + '/many', ...after)
    }
  }

  if (config.enableAll || config?.update) {
    const { before = [], after = [] } = config.update || defaultBeforeAfter
    setupRoute('/', 'put', before, UserAccountUpdate as RequestHandler)
    if (after.length) {
      router.use(basePath + '/', ...after)
    }
  }

  if (config.enableAll || config?.updateMany) {
    const { before = [], after = [] } = config.updateMany || defaultBeforeAfter
    setupRoute('/many', 'put', before, UserAccountUpdateMany as RequestHandler)
    if (after.length) {
      router.use(basePath + '/many', ...after)
    }
  }

  if (config.enableAll || config?.upsert) {
    const { before = [], after = [] } = config.upsert || defaultBeforeAfter
    setupRoute('/', 'patch', before, UserAccountUpsert as RequestHandler)
    if (after.length) {
      router.use(basePath + '/', ...after)
    }
  }

  if (config.enableAll || config?.delete) {
    const { before = [], after = [] } = config.delete || defaultBeforeAfter
    setupRoute('/', 'delete', before, UserAccountDelete as RequestHandler)
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
      UserAccountDeleteMany as RequestHandler,
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
      UserAccountAggregate as RequestHandler,
    )
    if (after.length) {
      router.use(basePath + '/aggregate', ...after)
    }
  }

  if (config.enableAll || config?.count) {
    const { before = [], after = [] } = config.count || defaultBeforeAfter
    setupRoute('/count', 'get', before, UserAccountCount as RequestHandler)
    if (after.length) {
      router.use(basePath + '/count', ...after)
    }
  }

  if (config.enableAll || config?.groupBy) {
    const { before = [], after = [] } = config.groupBy || defaultBeforeAfter
    setupRoute('/groupby', 'get', before, UserAccountGroupBy as RequestHandler)
    if (after.length) {
      router.use(basePath + '/groupby', ...after)
    }
  }

  return router
}