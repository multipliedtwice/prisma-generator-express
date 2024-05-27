import { DMMF } from '@prisma/generator-helper'
import { lowercaseFirstLetter } from '../utils/strings'

/**
 * Generates an Express middleware function that handles count queries
 * and includes conditional output validation with Zod.
 * This version dynamically includes the correct type for the arguments based on the Prisma model.
 * @param options - The options containing the model name and the import statement for Prisma types.
 * @returns {string} - The generated middleware function as a string.
 */
export const generateCountFunction = (options: {
  model: DMMF.Model
  prismaImportStatement: string
}): string => {
  const { model, prismaImportStatement } = options
  const modelName = model.name
  const functionName = `${modelName}Count`
  const argsTypeName = `Prisma.${modelName}CountArgs`

  return `
${prismaImportStatement}
import { Request, Response, NextFunction } from 'express';
import { RequestHandler, ParamsDictionary } from 'express-serve-static-core';
import { ParsedQs } from 'qs';
import { ZodTypeAny } from 'zod';

interface CountRequest extends Request {
  prisma: PrismaClient;
  query: Partial<${argsTypeName}> & ParsedQs;
  outputValidation?: ZodTypeAny;
  omitOutputValidation?: boolean;
  locals?: {
    outputValidator?: ZodTypeAny;
  };
}

export type CountMiddleware = RequestHandler<ParamsDictionary, any, {}, ParsedQs>;

export async function ${functionName}(req: CountRequest, res: Response, next: NextFunction) {
  try {
    const outputValidator = req.locals?.outputValidator || req.outputValidation;

    if (!outputValidator && !req.omitOutputValidation) {
      throw new Error('Output validation schema or omission flag must be provided.');
    }

    const result = await req.prisma.${lowercaseFirstLetter(modelName)}.count(req.query as ${argsTypeName});

    if (!req.omitOutputValidation && outputValidator) {
      const validationResult = outputValidator.safeParse(result);
      if (validationResult.success) {
        return res.status(200).json(validationResult.data);
      } else {
        return res.status(400).json({ error: 'Invalid data format', details: validationResult.error });
      }
    } else {
      return res.status(200).json(result);
    }
  } catch (error: unknown) {
    return next(error);
  }
}`
}
