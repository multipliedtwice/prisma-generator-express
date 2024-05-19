import { DMMF } from '@prisma/generator-helper'
import { lowercaseFirstLetter } from '../utils/strings'
/**
 * Generates an Express middleware function that handles batch deleting records
 * and includes conditional output validation with Zod.
 * This version dynamically includes the correct type for the arguments based on the Prisma model.
 * @param options - The options containing the model name and the import statement for Prisma types.
 * @returns {string} - The generated middleware function as a string.
 */
export const generateDeleteManyFunction = (options: {
  model: DMMF.Model
  prismaImportStatement: string
}): string => {
  const { model, prismaImportStatement } = options
  const modelName = model.name
  const functionName = `${modelName}DeleteMany`
  const argsTypeName = `Prisma.${modelName}DeleteManyArgs`

  return `
${prismaImportStatement}
import { Request, Response, NextFunction } from 'express';
import { RequestHandler, ParamsDictionary } from 'express-serve-static-core';
import { ZodTypeAny } from 'zod';

interface DeleteManyRequest extends Request {
  prisma: PrismaClient;
  body: ${argsTypeName};
  outputValidation?: ZodTypeAny;
  omitOutputValidation?: boolean;
}

export type DeleteManyMiddleware = RequestHandler<ParamsDictionary, any, Prisma.${modelName}DeleteManyArgs, Record<string, any>>;

export async function ${functionName}(req: DeleteManyRequest, res: Response, next: NextFunction) {
  try {
    if (!req.outputValidation && !req.omitOutputValidation) {
      throw new Error('Output validation schema or omission flag must be provided.');
    }

    const result = await req.prisma.${lowercaseFirstLetter(modelName)}.deleteMany(req.body);

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
    console.error('Error in handling batch delete request:', error);
    res.status(500).json({ error: error.message });
    next(error);
  }
}`
}
