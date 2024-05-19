import { DMMF } from '@prisma/generator-helper'
import { lowercaseFirstLetter } from '../utils/strings'
/**
 * Generates an Express middleware function that handles the creation of multiple records and includes conditional output validation with Zod.
 * This version dynamically includes the correct type for the arguments based on the Prisma model.
 * @param options - The options containing the model name and the import statement for Prisma types.
 * @returns {string} - The generated middleware function as a string.
 */
export const generateCreateManyFunction = (options: {
  model: DMMF.Model
  prismaImportStatement: string
}): string => {
  const { model, prismaImportStatement } = options
  const modelName = model.name
  const functionName = `${modelName}CreateMany`
  const argsTypeName = `Prisma.${modelName}CreateManyArgs`

  return `
${prismaImportStatement}
import { Request, Response, NextFunction } from 'express';
import { RequestHandler, ParamsDictionary } from 'express-serve-static-core';
import { ZodTypeAny } from 'zod';

interface CreateManyRequest extends Request {
  prisma: PrismaClient;
  body: ${argsTypeName};
  outputValidation?: ZodTypeAny;
  omitOutputValidation?: boolean;
}

export type CreateManyMiddleware = RequestHandler<ParamsDictionary, any, ${argsTypeName}, Record<string, any>>

export async function ${functionName}(req: CreateManyRequest, res: Response, next: NextFunction) {
  try {
    if (!req.outputValidation && !req.omitOutputValidation) {
      throw new Error('Output validation schema or omission flag must be provided.');
    }

    const data = await req.prisma.${lowercaseFirstLetter(modelName)}.createMany(req.body);
    if (!req.omitOutputValidation && req.outputValidation) {
      const validationResult = req.outputValidation.safeParse(data);
      if (validationResult.success) {
        res.status(201).json(validationResult.data);
      } else {
        res.status(400).json({ error: 'Invalid data format', details: validationResult.error });
      }
    } else if (!req.omitOutputValidation) {
      throw new Error('Output validation schema must be provided unless explicitly omitted.');
    } else {
      res.status(201).json(data);
    }
  } catch (error) {
    console.error('Error in handling createMany request:', error);
    res.status(500).json({ error: error.message });
    next(error);
  }
}`
}
