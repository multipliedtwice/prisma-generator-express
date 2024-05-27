import { NextFunction } from 'express'
import { allow, forbid } from './transformZod'
import { ValidatorOptions } from './createValidatorMiddleware'

/**
 * Creates a middleware for validating response data using a Zod schema.
 * @param {ValidatorOptions} options - The validation options.
 * @param {ZodSchema<any>} options.schema - The Zod schema to validate the response data.
 * @param {string[]} [options.allowedPaths] - Paths that are allowed in the response data.
 * @param {string[]} [options.forbiddenPaths] - Paths that are forbidden in the response data.
 * @returns {function} Express middleware function.
 */
export function createOutputValidatorMiddleware({
  schema,
  allowedPaths,
  forbiddenPaths,
}: ValidatorOptions) {
  if (allowedPaths) {
    schema = allow(schema, allowedPaths)
  }

  if (forbiddenPaths) {
    schema = forbid(schema, forbiddenPaths)
  }

  return (req: Request, res: Response, next: NextFunction) => {
    const originalSend = res.send

    res.send = function (data) {
      const validationResult = schema.safeParse(data)
      if (!validationResult.success) {
        const errors = validationResult.error.errors
        return next({
          status: 400,
          message: 'Output validation failed',
          errors,
        })
      }
      return originalSend.call(this, data)
    }

    next()
  }
}
