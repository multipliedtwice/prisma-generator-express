import { DMMF } from '@prisma/generator-helper'
import { lowercaseFirstLetter } from '../utils/strings'
import { PrismaClient, Prisma } from '@prisma/client'

/**
 * Generates an Express middleware function that handles groupBy queries
 * and includes conditional output validation with Zod.
 * This version dynamically includes the correct type for the arguments based on the Prisma model.
 * @param options - The options containing the model name and the import statement for Prisma types.
 * @returns {string} - The generated middleware function as a string.
 */
export const generateGroupByFunction = (options: {
  model: DMMF.Model
  prismaImportStatement: string
}): string => {
  const { model, prismaImportStatement } = options
  const modelName = model.name
  const functionName = `${modelName}GroupBy`
  const argsTypeName = `Prisma.${modelName}GroupByArgs`

  return `
${prismaImportStatement}
import { Request, Response, NextFunction } from 'express';
import { RequestHandler, ParamsDictionary } from 'express-serve-static-core';
import { ParsedQs } from 'qs';
import { ZodTypeAny } from 'zod';

interface GroupByRequest extends Request {
  prisma: PrismaClient;
  query: Partial<${argsTypeName}> & ParsedQs;
  outputValidation?: ZodTypeAny;
  omitOutputValidation?: boolean;
}

export type GroupByMiddleware = RequestHandler<ParamsDictionary, any, {}, ParsedQs>;

export async function ${functionName}(req: GroupByRequest, res: Response, next: NextFunction) {
  try {
    if (!req.outputValidation && !req.omitOutputValidation) {
      throw new Error('Output validation schema or omission flag must be provided.');
    }

    // @ts-ignore
    const result = await req.prisma.${lowercaseFirstLetter(modelName)}.groupBy(req.query);

    if (!req.omitOutputValidation && req.outputValidation) {
      const validationResult = req.outputValidation.safeParse(result);
      if (validationResult.success) {
        res.status(200).json(validationResult.data);
      } else {
        res.status(400).json({ error: 'Invalid data format', details: validationResult.error });
      }
    } else {
      res.status(200).json(result);
    }
  } catch (error) {
    console.error('Error in handling groupBy request:', error);
    res.status(500).json({ error: error.message });
    next(error);
  }
}`
}
