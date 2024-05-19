import { DMMF } from '@prisma/generator-helper'
import { lowercaseFirstLetter } from '../utils/strings'
/**
 * Generates an Express middleware function that handles multiple record retrieval with optional output validation using Zod.
 * This version dynamically includes the correct type for the query parameter based on the Prisma model.
 * @param options - The options containing the model name and the import statement for Prisma types.
 * @returns {string} - The generated middleware function as a string.
 */
export const generateFindManyFunction = (options: {
  model: DMMF.Model
  prismaImportStatement: string
}): string => {
  const { model, prismaImportStatement } = options
  const modelName = model.name
  const functionName = `${modelName}FindMany`
  const queryTypeName = `Prisma.${modelName}FindManyArgs`

  return `
${prismaImportStatement.replace('{ Prisma }', `{ Prisma, ${modelName} }`)}
import { Request, Response, NextFunction } from 'express'
import {
  RequestHandler,
  ParamsDictionary,
} from 'express-serve-static-core'
import { ParsedQs } from 'qs';
import { ZodTypeAny } from 'zod';

export interface FindManyRequest extends Request {
  prisma: PrismaClient;
  query: ${queryTypeName} & ParsedQs;
  outputValidation?: ZodTypeAny;
  omitOutputValidation?: boolean;
  passToNext?: boolean;
  locals: {
    data?: ${modelName}[]
  }
}
export type FindManyMiddleware = RequestHandler<ParamsDictionary, any, any, ${queryTypeName} & ParsedQs, Record<string, any>>

export async function ${functionName}(req: FindManyRequest, res: Response, next: NextFunction) {
  try {
    if (!req.outputValidation && !req.omitOutputValidation) {
      throw new Error('Output validation schema or omission flag must be provided.');
    }

    const data = await req.prisma.${lowercaseFirstLetter(modelName)}.findMany(req.query as ${queryTypeName});
    if (req.passToNext) {
      req.locals.data = data;
      next();
    } else if (!req.omitOutputValidation && req.outputValidation) {
      const validationResult = req.outputValidation.safeParse(data);
      if (validationResult.success) {
        res.status(200).json(validationResult.data);
      } else {
        res.status(400).json({ error: 'Invalid data format', details: validationResult.error });
      }
    } else if (!req.omitOutputValidation) {
      throw new Error('Output validation schema must be provided unless explicitly omitted. Attach omitOutputValidation = true to request to suppress this error.');
    } else {
      res.status(200).json(data);
    }
  } catch (error) {
    console.error('Error in handling request:', error);
    res.status(500).json({ error: error.message });
    next(error);
  }
}`
}
