import { DMMF } from '@prisma/generator-helper'

/**
 * Generates an Express middleware function that includes conditional output validation with Zod.
 * This version dynamically includes the correct type for the query parameter based on the Prisma model.
 * @param options - The options containing the model name and the import statement for Prisma types.
 * @returns {string} - The generated middleware function as a string.
 */
export const generateFindUniqueFunction = (options: {
  model: DMMF.Model
  prismaImportStatement: string
}): string => {
  const { model, prismaImportStatement } = options
  const modelName = model.name
  const functionName = `${modelName}FindUnique`
  const queryTypeName = `Prisma.${modelName}WhereUniqueInput`

  return `
${prismaImportStatement}
import { Request, Response, NextFunction } from 'express';
import { ParsedQs } from 'qs';
import { PrismaClient } from '@prisma/client'
import { ZodTypeAny } from 'zod';

interface PrismaRequest extends Request {
  prisma: PrismaClient;
  query: ${queryTypeName} & ParsedQs;
  outputValidation?: ZodTypeAny;
  omitOutputValidation?: boolean;
}

export async function ${functionName}(req: PrismaRequest, res: Response, next: NextFunction) {
  try {
    if (req.outputValidation === undefined && req.omitOutputValidation === undefined) {
      throw new Error('Output validation schema or omission flag must be provided.');
    }

    const data = await req.prisma.${modelName.toLowerCase()}.findUnique(req.query);
    if (!req.omitOutputValidation && req.outputValidation) {
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
