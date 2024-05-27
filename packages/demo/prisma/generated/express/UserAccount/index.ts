import express, {
  NextFunction,
  RequestHandler,
  Request,
  Response,
} from 'express'
import { ParsedQs } from 'qs'
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
 * Generates an Express router for UserAccount model.
 * @param config Contains optional middleware to enable routes.
 * @param customUrlPrefix Optional custom URL prefix for the routes.
 * @returns {express.Router}
 */
export function UserAccountRouter(config: RouteConfig<RequestHandler>) {
  const router = express.Router()
  const basePath =
    (config.customUrlPrefix || '') +
    (config.addModelPrefix ? '/useraccount' : '')

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
      UserAccountFindFirst as RequestHandler,
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
      UserAccountFindMany as RequestHandler,
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
      UserAccountFindUnique as any,
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
      UserAccountCreate as RequestHandler,
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
      UserAccountCreateMany as RequestHandler,
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
      UserAccountUpdate as RequestHandler,
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
      UserAccountUpdateMany as RequestHandler,
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
      UserAccountUpsert as RequestHandler,
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
      UserAccountDelete as RequestHandler,
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
      UserAccountDeleteMany as RequestHandler,
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
      UserAccountAggregate as RequestHandler,
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
      UserAccountCount as RequestHandler,
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
      UserAccountGroupBy as RequestHandler,
      input,
      output,
    )
    if (after.length) {
      router.use(basePath + '/groupby', ...after)
    }
  }

  return router
}
