import { DMMF } from '@prisma/generator-helper'

export function generateRouterFunction({
  model,
}: {
  model: DMMF.Model
}): string {
  const modelName = model.name
  const routerFunctionName = `${modelName}Router`

  return `import express, {
  NextFunction,
  RequestHandler,
  Request,
  Response,
} from 'express'
import { ParsedQs } from 'qs'
import { ${modelName}FindFirst } from './${modelName}FindFirst';
import { ${modelName}FindMany } from './${modelName}FindMany';
import { ${modelName}FindUnique } from './${modelName}FindUnique';
import { ${modelName}Create } from './${modelName}Create';
import { ${modelName}CreateMany } from './${modelName}CreateMany';
import { ${modelName}Update } from './${modelName}Update';
import { ${modelName}UpdateMany } from './${modelName}UpdateMany';
import { ${modelName}Upsert } from './${modelName}Upsert';
import { ${modelName}Delete } from './${modelName}Delete';
import { ${modelName}DeleteMany } from './${modelName}DeleteMany';
import { ${modelName}Aggregate } from './${modelName}Aggregate';
import { ${modelName}Count } from './${modelName}Count';
import { ${modelName}GroupBy } from './${modelName}GroupBy';
import { createValidatorMiddleware, ValidatorOptions } from '../createValidatorMiddleware'
import { createOutputValidatorMiddleware } from '../createOutputValidatorMiddleware'
import { RouteConfig, ValidatorConfig } from '../routeConfig'
import { parseQueryParams } from "../ParseQueryParams";

const defaultBeforeAfter = {
  before: [] as RequestHandler[],
  after: [] as RequestHandler[],
  input: undefined,
  output: undefined,
};

/**
 * Generates an Express router for ${modelName} model.
 * @param config Contains optional middleware to enable routes.
 * @param customUrlPrefix Optional custom URL prefix for the routes.
 * @returns {express.Router}
 */
export function ${routerFunctionName}(config: RouteConfig<RequestHandler>) {
  const router = express.Router();
  const basePath = (config.customUrlPrefix || '') + (config.addModelPrefix ? '/${modelName.toLowerCase()}' : '');

  const setupRoute = (
    path: string,
    method: "all" | "get" | "post" | "put" | "delete" | "patch" | "options" | "head",
    middlewares: RequestHandler[],
    handler: RequestHandler,
    inputValidator?: ValidatorConfig,
    outputValidator?: ValidatorConfig
  ) => {
    const middlewaresWithValidators: RequestHandler[] = [
      (req, res, next) => {
        if (req.query) {
          req.query = parseQueryParams(req.query as Record<string, string>) as ParsedQs;
        }
        next();
      },
      ...middlewares
    ];
  
    if (inputValidator) {
      middlewaresWithValidators.push(createValidatorMiddleware({
        schema: inputValidator.schema,
        allowedPaths: inputValidator.allow,
        forbiddenPaths: inputValidator.forbid,
        target: method === 'get' ? 'query' : 'body',
      }));
    }
  
    middlewaresWithValidators.push((req, res, next) => {
      res.locals.outputValidator = outputValidator;
      next();
    });
  
    middlewaresWithValidators.push(handler);
  
    router[method](basePath + path, ...middlewaresWithValidators);
  };


  if (config.enableAll || config?.findFirst) {
    const { before = [], after = [], input, output } = config.findFirst || defaultBeforeAfter;
    setupRoute('/first', 'get', before, ${modelName}FindFirst as RequestHandler, input, output);
    if (after.length) {
      router.use(basePath + '/first', ...after);
    }
  }

  if (config.enableAll || config?.findMany) {
    const { before = [], after = [], input, output } = config.findMany || defaultBeforeAfter;
    setupRoute('/', 'get', before, ${modelName}FindMany as RequestHandler, input, output);
    if (after.length) {
      router.use(basePath + '/', ...after);
    }
  }

  if (config.enableAll || config?.findUnique) {
    const { before = [], after = [], input, output } = config.findUnique || defaultBeforeAfter;
    setupRoute('/:id', 'get', before, ${modelName}FindUnique as any, input, output);
    if (after.length) {
      router.use(basePath + '/:id', ...after);
    }
  }

  if (config.enableAll || config?.create) {
    const { before = [], after = [], input, output } = config.create || defaultBeforeAfter;
    setupRoute('/', 'post', before, ${modelName}Create as RequestHandler, input, output);
    if (after.length) {
      router.use(basePath + '/', ...after);
    }
  }

  if (config.enableAll || config?.createMany) {
    const { before = [], after = [], input, output } = config.createMany || defaultBeforeAfter;
    setupRoute('/many', 'post', before, ${modelName}CreateMany as RequestHandler, input, output);
    if (after.length) {
      router.use(basePath + '/many', ...after);
    }
  }

  if (config.enableAll || config?.update) {
    const { before = [], after = [], input, output } = config.update || defaultBeforeAfter;
    setupRoute('/', 'put', before, ${modelName}Update as RequestHandler, input, output);
    if (after.length) {
      router.use(basePath + '/', ...after);
    }
  }

  if (config.enableAll || config?.updateMany) {
    const { before = [], after = [], input, output } = config.updateMany || defaultBeforeAfter;
    setupRoute('/many', 'put', before, ${modelName}UpdateMany as RequestHandler, input, output);
    if (after.length) {
      router.use(basePath + '/many', ...after);
    }
  }

  if (config.enableAll || config?.upsert) {
    const { before = [], after = [], input, output } = config.upsert || defaultBeforeAfter;
    setupRoute('/', 'patch', before, ${modelName}Upsert as RequestHandler, input, output);
    if (after.length) {
      router.use(basePath + '/', ...after);
    }
  }

  if (config.enableAll || config?.delete) {
    const { before = [], after = [], input, output } = config.delete || defaultBeforeAfter;
    setupRoute('/', 'delete', before, ${modelName}Delete as RequestHandler, input, output);
    if (after.length) {
      router.use(basePath + '/', ...after);
    }
  }

  if (config.enableAll || config?.deleteMany) {
    const { before = [], after = [], input, output } = config.deleteMany || defaultBeforeAfter;
    setupRoute('/many', 'delete', before, ${modelName}DeleteMany as RequestHandler, input, output);
    if (after.length) {
      router.use(basePath + '/many', ...after);
    }
  }

  if (config.enableAll || config?.aggregate) {
    const { before = [], after = [], input, output } = config.aggregate || defaultBeforeAfter;
    setupRoute('/aggregate', 'get', before, ${modelName}Aggregate as RequestHandler, input, output);
    if (after.length) {
      router.use(basePath + '/aggregate', ...after);
    }
  }

  if (config.enableAll || config?.count) {
    const { before = [], after = [], input, output } = config.count || defaultBeforeAfter;
    setupRoute('/count', 'get', before, ${modelName}Count as RequestHandler, input, output);
    if (after.length) {
      router.use(basePath + '/count', ...after);
    }
  }

  if (config.enableAll || config?.groupBy) {
    const { before = [], after = [], input, output } = config.groupBy || defaultBeforeAfter;
    setupRoute('/groupby', 'get', before, ${modelName}GroupBy as RequestHandler, input, output);
    if (after.length) {
      router.use(basePath + '/groupby', ...after);
    }
  }

  return router;
}
`
}
