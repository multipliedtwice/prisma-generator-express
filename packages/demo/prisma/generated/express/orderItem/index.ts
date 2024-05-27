import express, {
  NextFunction,
  RequestHandler,
  Request,
  Response,
} from 'express'
import { ParsedQs } from 'qs'
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
import {
  createValidatorMiddleware,
  ValidatorOptions,
} from '../createValidatorMiddleware'
import { createOutputValidatorMiddleware } from '../createOutputValidatorMiddleware'
import { RouteConfig, ValidatorConfig } from '../routeConfig'
import { parseQueryParams } from '../ParseQueryParams'

const defaultBeforeAfter = {
  before: [] as RequestHandler[],
  after: [] as RequestHandler[],
  input: undefined,
  output: undefined,
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
      orderItemFindFirst as RequestHandler,
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
      orderItemFindMany as RequestHandler,
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
    setupRoute('/:id', 'get', before, orderItemFindUnique as any, input, output)
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
      orderItemCreate as RequestHandler,
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
      orderItemCreateMany as RequestHandler,
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
      orderItemUpdate as RequestHandler,
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
      orderItemUpdateMany as RequestHandler,
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
      orderItemUpsert as RequestHandler,
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
      orderItemDelete as RequestHandler,
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
      orderItemDeleteMany as RequestHandler,
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
      orderItemAggregate as RequestHandler,
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
      orderItemCount as RequestHandler,
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
      orderItemGroupBy as RequestHandler,
      input,
      output,
    )
    if (after.length) {
      router.use(basePath + '/groupby', ...after)
    }
  }

  return router
}
