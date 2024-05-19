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
import { ${modelName}FindFirst, type FindFirstMiddleware } from './${modelName}FindFirst';
import { ${modelName}FindMany, type FindManyMiddleware } from './${modelName}FindMany';
import { ${modelName}FindUnique, type FindUniqueMiddleware } from './${modelName}FindUnique';
import { ${modelName}Create, type CreateMiddleware } from './${modelName}Create';
import { ${modelName}CreateMany, type CreateManyMiddleware } from './${modelName}CreateMany';
import { ${modelName}Update, type UpdateMiddleware } from './${modelName}Update';
import { ${modelName}UpdateMany, type UpdateManyMiddleware } from './${modelName}UpdateMany';
import { ${modelName}Upsert, type UpsertMiddleware } from './${modelName}Upsert';
import { ${modelName}Delete, type DeleteMiddleware } from './${modelName}Delete';
import { ${modelName}DeleteMany, type DeleteManyMiddleware } from './${modelName}DeleteMany';
import { ${modelName}Aggregate, type AggregateMiddleware } from './${modelName}Aggregate';
import { ${modelName}Count, type CountMiddleware } from './${modelName}Count';
import { ${modelName}GroupBy, type GroupByMiddleware } from './${modelName}GroupBy';

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
 * Generates an Express router for ${modelName} model.
 * @param config Contains optional middleware to enable routes.
 * @returns {express.Router}
 */
export function ${routerFunctionName}(config: RouteConfig) {
  const router = express.Router();
  
  if (config?.findFirstMiddleware && config?.findFirstMiddleware.length) {
    const middlewares = [...config.findFirstMiddleware, ${modelName}FindFirst]
    if (config.findFirstNextMiddleware) {
      middlewares.push(...config.findFirstNextMiddleware);
    }
    router.get('/first', ...middlewares as FindFirstMiddleware[]);
  }

  if (config?.findManyMiddleware && config?.findManyMiddleware.length) {
    const middlewares = [...config.findManyMiddleware, ${modelName}FindMany]
    if (config.findManyNextMiddleware) {
      middlewares.push(...config.findManyNextMiddleware);
    }
    router.get('/', ...middlewares as FindManyMiddleware[]);
  }

  if (config?.findUniqueMiddleware && config?.findUniqueMiddleware.length) {
    const middlewares = [...config.findUniqueMiddleware, ${modelName}FindUnique]
    if (config.findUniqueNextMiddleware) {
      middlewares.push(...config.findUniqueNextMiddleware);
    }
    router.get('/:id', ...middlewares as FindUniqueMiddleware[]);
  }

  if (config?.createMiddleware && config?.createMiddleware.length) {
    const middlewares = [...config.createMiddleware, ${modelName}Create]
    if (config.createNextMiddleware) {
      middlewares.push(...config.createNextMiddleware);
    }
    router.post('/', ...middlewares as CreateMiddleware[]);
  }

  if (config?.createManyMiddleware && config?.createManyMiddleware.length) {
    const middlewares = [...config.createManyMiddleware, ${modelName}CreateMany]
    if (config.createManyNextMiddleware) {
      middlewares.push(...config.createManyNextMiddleware);
    }
    router.post('/many', ...middlewares as CreateManyMiddleware[]);
  }

  if (config?.updateMiddleware && config?.updateMiddleware.length) {
    const middlewares = [...config.updateMiddleware, ${modelName}Update]
    if (config.updateNextMiddleware) {
      middlewares.push(...config.updateNextMiddleware);
    }
    router.put('/', ...middlewares as UpdateMiddleware[]);
  }

  if (config?.updateManyMiddleware && config?.updateManyMiddleware.length) {
    const middlewares = [...config.updateManyMiddleware, ${modelName}UpdateMany]
    if (config.updateManyNextMiddleware) {
      middlewares.push(...config.updateManyNextMiddleware);
    }
    router.put('/many', ...middlewares as UpdateManyMiddleware[]);
  }

  if (config?.upsertMiddleware && config?.upsertMiddleware.length) {
    const middlewares = [...config.upsertMiddleware, ${modelName}Upsert]
    if (config.upsertNextMiddleware) {
      middlewares.push(...config.upsertNextMiddleware);
    }
    router.patch('/', ...middlewares as UpsertMiddleware[]);
  }

  if (config?.deleteMiddleware && config?.deleteMiddleware.length) {
    const middlewares = [...config.deleteMiddleware, ${modelName}Delete]
    if (config.deleteNextMiddleware) {
      middlewares.push(...config.deleteNextMiddleware);
    }
    router.delete('/', ...middlewares as DeleteMiddleware[]);
  }

  if (config?.deleteManyMiddleware && config?.deleteManyMiddleware.length) {
    const middlewares = [...config.deleteManyMiddleware, ${modelName}DeleteMany]
    if (config.deleteManyNextMiddleware) {
      middlewares.push(...config.deleteManyNextMiddleware);
    }
    router.delete('/many', ...middlewares as DeleteManyMiddleware[]);
  }

  if (config?.aggregateMiddleware && config?.aggregateMiddleware.length) {
    const middlewares = [...config.aggregateMiddleware, ${modelName}Aggregate]
    if (config.aggregateNextMiddleware) {
      middlewares.push(...config.aggregateNextMiddleware);
    }
    router.get('/aggregate', ...middlewares as AggregateMiddleware[]);
  }

  if (config?.countMiddleware && config?.countMiddleware.length) {
    const middlewares = [...config.countMiddleware, ${modelName}Count]
    if (config.countNextMiddleware) {
      middlewares.push(...config.countNextMiddleware);
    }
    router.get('/count', ...middlewares as CountMiddleware[]);
  }

  if (config?.groupByMiddleware && config?.groupByMiddleware.length) {
    const middlewares = [...config.groupByMiddleware, ${modelName}GroupBy]
    if (config.groupByNextMiddleware) {
      middlewares.push(...config.groupByNextMiddleware);
    }
    router.get('/groupby', ...middlewares as GroupByMiddleware[]);
  }

  return router;
}
`
}
