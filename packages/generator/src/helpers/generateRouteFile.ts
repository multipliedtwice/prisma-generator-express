import { DMMF } from '@prisma/generator-helper'

export function generateRouterFunction({
  model,
}: {
  model: DMMF.Model
}): string {
  const modelName = model.name
  const routerFunctionName = `${modelName}Router`

  return `
import express, { RequestHandler } from 'express';
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
import { RouteConfig } from "../RouteConfig";

const defaultBeforeAfter = {
  before: [] as RequestHandler[],
  after: [] as RequestHandler[],
};

/**
 * Generates an Express router for ${modelName} model.
 * @param config Contains optional middleware to enable routes.
 * @param customUrlPrefix Optional custom URL prefix for the routes.
 * @returns {express.Router}
 */
export function ${routerFunctionName}(config: RouteConfig<RequestHandler>) {
  const router = express.Router();
  const basePath = config.customUrlPrefix + (config.addModelPrefix ? '/${modelName.toLowerCase()}' : '');

  const setupRoute = (
    path: string,
    method: "all" | "get" | "post" | "put" | "delete" | "patch" | "options" | "head",
    middlewares: RequestHandler[],
    handler: RequestHandler
  ) => {
    router[method](basePath + path, ...middlewares, handler);
  };

  if (config.enableAll || config?.findFirst) {
    const { before = [], after = [] } = config.findFirst || defaultBeforeAfter;
    setupRoute('/first', 'get', before, ${modelName}FindFirst as RequestHandler);
    if (after.length) {
      router.use(basePath + '/first', ...after);
    }
  }

  if (config.enableAll || config?.findMany) {
    const { before = [], after = [] } = config.findMany || defaultBeforeAfter;
    setupRoute('/', 'get', before, ${modelName}FindMany as RequestHandler);
    if (after.length) {
      router.use(basePath + '/', ...after);
    }
  }

  if (config.enableAll || config?.findUnique) {
    const { before = [], after = [] } = config.findUnique || defaultBeforeAfter;
    setupRoute('/:id', 'get', before, ${modelName}FindUnique as any);
    if (after.length) {
      router.use(basePath + '/:id', ...after);
    }
  }

  if (config.enableAll || config?.create) {
    const { before = [], after = [] } = config.create || defaultBeforeAfter;
    setupRoute('/', 'post', before, ${modelName}Create as RequestHandler);
    if (after.length) {
      router.use(basePath + '/', ...after);
    }
  }

  if (config.enableAll || config?.createMany) {
    const { before = [], after = [] } = config.createMany || defaultBeforeAfter;
    setupRoute('/many', 'post', before, ${modelName}CreateMany as RequestHandler);
    if (after.length) {
      router.use(basePath + '/many', ...after);
    }
  }

  if (config.enableAll || config?.update) {
    const { before = [], after = [] } = config.update || defaultBeforeAfter;
    setupRoute('/', 'put', before, ${modelName}Update as RequestHandler);
    if (after.length) {
      router.use(basePath + '/', ...after);
    }
  }

  if (config.enableAll || config?.updateMany) {
    const { before = [], after = [] } = config.updateMany || defaultBeforeAfter;
    setupRoute('/many', 'put', before, ${modelName}UpdateMany as RequestHandler);
    if (after.length) {
      router.use(basePath + '/many', ...after);
    }
  }

  if (config.enableAll || config?.upsert) {
    const { before = [], after = [] } = config.upsert || defaultBeforeAfter;
    setupRoute('/', 'patch', before, ${modelName}Upsert as RequestHandler);
    if (after.length) {
      router.use(basePath + '/', ...after);
    }
  }

  if (config.enableAll || config?.delete) {
    const { before = [], after = [] } = config.delete || defaultBeforeAfter;
    setupRoute('/', 'delete', before, ${modelName}Delete as RequestHandler);
    if (after.length) {
      router.use(basePath + '/', ...after);
    }
  }

  if (config.enableAll || config?.deleteMany) {
    const { before = [], after = [] } = config.deleteMany || defaultBeforeAfter;
    setupRoute('/many', 'delete', before, ${modelName}DeleteMany as RequestHandler);
    if (after.length) {
      router.use(basePath + '/many', ...after);
    }
  }

  if (config.enableAll || config?.aggregate) {
    const { before = [], after = [] } = config.aggregate || defaultBeforeAfter;
    setupRoute('/aggregate', 'get', before, ${modelName}Aggregate as RequestHandler);
    if (after.length) {
      router.use(basePath + '/aggregate', ...after);
    }
  }

  if (config.enableAll || config?.count) {
    const { before = [], after = [] } = config.count || defaultBeforeAfter;
    setupRoute('/count', 'get', before, ${modelName}Count as RequestHandler);
    if (after.length) {
      router.use(basePath + '/count', ...after);
    }
  }

  if (config.enableAll || config?.groupBy) {
    const { before = [], after = [] } = config.groupBy || defaultBeforeAfter;
    setupRoute('/groupby', 'get', before, ${modelName}GroupBy as RequestHandler);
    if (after.length) {
      router.use(basePath + '/groupby', ...after);
    }
  }

  return router;
}
`
}
