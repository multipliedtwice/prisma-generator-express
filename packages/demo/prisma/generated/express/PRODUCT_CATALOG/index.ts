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
import { createValidatorMiddleware } from '../createValidatorMiddleware'
import { RouteConfig, ValidatorConfig } from '../routeConfig'
import { parseQueryParams } from '../parseQueryParams'

const defaultBeforeAfter = {
  before: [] as RequestHandler[],
  after: [] as RequestHandler[],
  input: undefined,
  output: undefined,
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
    inputValidator?: ValidatorConfig,
    outputValidator?: ValidatorConfig,
  ) => {
    const middlewaresWithValidators: RequestHandler[] = [
      (req, res, next) => {
        if (req.query) {
          req.query = parseQueryParams(
            req.query as Record<string, string>,
          ) as ParsedQs
        }
        next()
      },
      ...middlewares,
    ]

    if (inputValidator) {
      middlewaresWithValidators.push(
        createValidatorMiddleware({
          schema: inputValidator.schema,
          allowedPaths: inputValidator.allow,
          forbiddenPaths: inputValidator.forbid,
          target: method === 'get' ? 'query' : 'body',
        }),
      )
    }

    middlewaresWithValidators.push((req, res, next) => {
      res.locals.outputValidator = outputValidator
      next()
    })

    middlewaresWithValidators.push(handler)

    router[method](basePath + path, ...middlewaresWithValidators)
  }

  if (config.enableAll || config?.findFirst) {
    const {
      before = [],
      after = [],
      input,
      output,
    } = config.findFirst || defaultBeforeAfter
    setupRoute(
      '/first',
      'get',
      before,
      PRODUCT_CATALOGFindFirst as RequestHandler,
      input,
      output,
    )
    if (after.length) {
      router.use(basePath + '/first', ...after)
    }
  }

  if (config.enableAll || config?.findMany) {
    const {
      before = [],
      after = [],
      input,
      output,
    } = config.findMany || defaultBeforeAfter
    setupRoute(
      '/',
      'get',
      before,
      PRODUCT_CATALOGFindMany as RequestHandler,
      input,
      output,
    )
    if (after.length) {
      router.use(basePath + '/', ...after)
    }
  }

  if (config.enableAll || config?.findUnique) {
    const {
      before = [],
      after = [],
      input,
      output,
    } = config.findUnique || defaultBeforeAfter
    setupRoute(
      '/:id',
      'get',
      before,
      PRODUCT_CATALOGFindUnique as any,
      input,
      output,
    )
    if (after.length) {
      router.use(basePath + '/:id', ...after)
    }
  }

  if (config.enableAll || config?.create) {
    const {
      before = [],
      after = [],
      input,
      output,
    } = config.create || defaultBeforeAfter
    setupRoute(
      '/',
      'post',
      before,
      PRODUCT_CATALOGCreate as RequestHandler,
      input,
      output,
    )
    if (after.length) {
      router.use(basePath + '/', ...after)
    }
  }

  if (config.enableAll || config?.createMany) {
    const {
      before = [],
      after = [],
      input,
      output,
    } = config.createMany || defaultBeforeAfter
    setupRoute(
      '/many',
      'post',
      before,
      PRODUCT_CATALOGCreateMany as RequestHandler,
      input,
      output,
    )
    if (after.length) {
      router.use(basePath + '/many', ...after)
    }
  }

  if (config.enableAll || config?.update) {
    const {
      before = [],
      after = [],
      input,
      output,
    } = config.update || defaultBeforeAfter
    setupRoute(
      '/',
      'put',
      before,
      PRODUCT_CATALOGUpdate as RequestHandler,
      input,
      output,
    )
    if (after.length) {
      router.use(basePath + '/', ...after)
    }
  }

  if (config.enableAll || config?.updateMany) {
    const {
      before = [],
      after = [],
      input,
      output,
    } = config.updateMany || defaultBeforeAfter
    setupRoute(
      '/many',
      'put',
      before,
      PRODUCT_CATALOGUpdateMany as RequestHandler,
      input,
      output,
    )
    if (after.length) {
      router.use(basePath + '/many', ...after)
    }
  }

  if (config.enableAll || config?.upsert) {
    const {
      before = [],
      after = [],
      input,
      output,
    } = config.upsert || defaultBeforeAfter
    setupRoute(
      '/',
      'patch',
      before,
      PRODUCT_CATALOGUpsert as RequestHandler,
      input,
      output,
    )
    if (after.length) {
      router.use(basePath + '/', ...after)
    }
  }

  if (config.enableAll || config?.delete) {
    const {
      before = [],
      after = [],
      input,
      output,
    } = config.delete || defaultBeforeAfter
    setupRoute(
      '/',
      'delete',
      before,
      PRODUCT_CATALOGDelete as RequestHandler,
      input,
      output,
    )
    if (after.length) {
      router.use(basePath + '/', ...after)
    }
  }

  if (config.enableAll || config?.deleteMany) {
    const {
      before = [],
      after = [],
      input,
      output,
    } = config.deleteMany || defaultBeforeAfter
    setupRoute(
      '/many',
      'delete',
      before,
      PRODUCT_CATALOGDeleteMany as RequestHandler,
      input,
      output,
    )
    if (after.length) {
      router.use(basePath + '/many', ...after)
    }
  }

  if (config.enableAll || config?.aggregate) {
    const {
      before = [],
      after = [],
      input,
      output,
    } = config.aggregate || defaultBeforeAfter
    setupRoute(
      '/aggregate',
      'get',
      before,
      PRODUCT_CATALOGAggregate as RequestHandler,
      input,
      output,
    )
    if (after.length) {
      router.use(basePath + '/aggregate', ...after)
    }
  }

  if (config.enableAll || config?.count) {
    const {
      before = [],
      after = [],
      input,
      output,
    } = config.count || defaultBeforeAfter
    setupRoute(
      '/count',
      'get',
      before,
      PRODUCT_CATALOGCount as RequestHandler,
      input,
      output,
    )
    if (after.length) {
      router.use(basePath + '/count', ...after)
    }
  }

  if (config.enableAll || config?.groupBy) {
    const {
      before = [],
      after = [],
      input,
      output,
    } = config.groupBy || defaultBeforeAfter
    setupRoute(
      '/groupby',
      'get',
      before,
      PRODUCT_CATALOGGroupBy as RequestHandler,
      input,
      output,
    )
    if (after.length) {
      router.use(basePath + '/groupby', ...after)
    }
  }

  return router
}
