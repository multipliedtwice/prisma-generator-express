import { DMMF } from '@prisma/generator-helper'
import { lowercaseFirstLetter } from '../utils/strings'
/**
 * Generates an Express middleware function that handles updating multiple records and includes conditional output validation with Zod.
 * This version dynamically includes the correct type for the arguments based on the Prisma model.
 * @param options - The options containing the model name and the import statement for Prisma types.
 * @returns {string} - The generated middleware function as a string.
 */
export const generateUpdateManyFunction = (options: {
  model: DMMF.Model
  prismaImportStatement: string
}): string => {
  const { model, prismaImportStatement } = options
  const modelName = model.name
  const functionName = `${modelName}UpdateMany`
  const argsTypeName = `Prisma.${modelName}UpdateManyArgs`

  return `
${prismaImportStatement}
import { Request, Response, NextFunction } from 'express';
import { RequestHandler, ParamsDictionary } from 'express-serve-static-core';
import { ZodTypeAny } from 'zod';

interface UpdateManyRequest extends Request {
  prisma: PrismaClient;
  body: ${argsTypeName};
  outputValidation?: ZodTypeAny;
  omitOutputValidation?: boolean;
}

export type UpdateManyMiddleware = RequestHandler<ParamsDictionary, any, ${argsTypeName}, Record<string, any>>

export async function ${functionName}(req: UpdateManyRequest, res: Response, next: NextFunction) {
  try {
    if (!req.outputValidation && !req.omitOutputValidation) {
      throw new Error('Output validation schema or omission flag must be provided.');
    }

    const data = await req.prisma.${lowercaseFirstLetter(modelName)}.updateMany(req.body);

    if (!req.omitOutputValidation && req.outputValidation) {
      const validationResult = req.outputValidation.safeParse(data);
      if (validationResult.success) {
        res.status(200).json({ count: validationResult.data.count });
      } else {
        res.status(400).json({ error: 'Invalid data format', details: validationResult.error });
      }
    } else if (!req.omitOutputValidation) {
      throw new Error('Output validation schema must be provided unless explicitly omitted.');
    } else {
      res.status(200).json({ count: data.count });
    }
  } catch (error) {
    console.error('Error in handling updateMany request:', error);
    res.status(500).json({ error: error.message });
    next(error);
  }
}`
}
