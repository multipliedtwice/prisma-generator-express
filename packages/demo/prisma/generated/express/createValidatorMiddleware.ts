import { Request, Response, NextFunction } from 'express'
import { ZodSchema } from 'zod'
import { allow, forbid } from './transformZod'

export interface ValidatorOptions {
  schema: ZodSchema<any>
  allowedPaths?: string[]
  forbiddenPaths?: string[]
  target?: 'body' | 'query'
}

/**
 * Creates a middleware for validating request data using a Zod schema.
 * @param {ValidatorOptions} options - The validation options.
 * @param {ZodSchema<any>} options.schema - The Zod schema to validate the request data.
 * @param {string[]} [options.allowedPaths] - Paths that are allowed in the request data. For example [`where.user.id`, `select.id`]
 * @param {string[]} [options.forbiddenPaths] - Paths that are forbidden in the request data.
 * @param {'body' | 'query'} [options.target='body'] - The part of the request to validate ('body' or 'query').
 * @returns {function} Express middleware function.
 */
export function createValidatorMiddleware({
  schema,
  allowedPaths,
  forbiddenPaths,
  target = 'body',
}: ValidatorOptions) {
  if (allowedPaths) {
    schema = allow(schema, allowedPaths)
  }

  if (forbiddenPaths) {
    schema = forbid(schema, forbiddenPaths)
  }

  return (req: Request, res: Response, next: NextFunction) => {
    let validationResult

    if (target === 'query') {
      validationResult = schema.safeParse(req.query)
    } else {
      validationResult = schema.safeParse(req.body)
    }

    if (!validationResult.success) {
      const errors = validationResult.error.errors
      return next({
        status: 400,
        message: 'Validation failed',
        errors,
      })
    }

    next()
  }
}

export function sanitizePrefix(prefix: string): string {
  return prefix.replace(/\/+$/, '')
}
