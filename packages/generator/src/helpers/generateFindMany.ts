import { DMMF } from '@prisma/generator-helper'
import { toPascalCase } from '../utils/strings'
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
  passToNext?: boolean;
  locals?: {
    data?: ${modelName}[]
    outputValidator?: ZodTypeAny;
  }
}
export type FindManyMiddleware = RequestHandler<ParamsDictionary, any, any, ${queryTypeName} & ParsedQs, Record<string, any>>

export async function ${functionName}(req: FindManyRequest, res: Response, next: NextFunction) {
  try {
    const outputValidator = req.locals?.outputValidator || req.outputValidation;

    const data = await req.prisma.${toPascalCase(modelName)}.findMany(req.query as ${queryTypeName});
    if (req.passToNext) {
      if (req.locals) req.locals.data = data;
      next();
    } else if (outputValidator) {
      const validationResult = outputValidator.safeParse(data);
      if (validationResult.success) {
        return res.status(200).json(validationResult.data);
      } else {
        return res.status(400).json({ error: 'Invalid data format', details: validationResult.error });
      }
    } else {
      return res.status(200).json(data);
    }
  } catch(error: unknown) {
    next(error)
  }
}`
}
