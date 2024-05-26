import { get } from 'lodash'
import {
  z,
  ZodEffects,
  ZodError,
  ZodIssue,
  ZodIssueCode,
  ZodObject,
  ZodTypeAny,
} from 'zod'

export function allow<T extends z.ZodTypeAny>(
  schema: T,
  allowedPaths: string[],
): ZodEffects<T, any, any> {
  const rootSchema = schema instanceof z.ZodObject ? schema : undefined

  return schema.transform((data) => {
    const flatData = flattenObject(data, '', rootSchema)
    const disallowedPaths: string[] = []

    for (const key of Object.keys(flatData)) {
      if (
        allowedPaths.every(
          (path) => !(key.startsWith(path) || path.startsWith(key)),
        )
      ) {
        disallowedPaths.push(key)
      }
    }

    if (disallowedPaths.length > 0) {
      const errors: ZodIssue[] = []
      for (const path of disallowedPaths) {
        errors.push({
          code: ZodIssueCode.custom,
          message: `Field '${path}' is not allowed.`,
          path: path.split('.'),
        })
      }
      throw new ZodError(errors)
    }
    return data
  }) as ZodEffects<T, any, any>
}

export function forbid<T extends z.ZodTypeAny>(
  schema: T,
  forbiddenPaths: string[],
): ZodEffects<T, any, any> {
  return schema.transform((data) => {
    const forbiddenMatches: string[] = []

    for (const forbiddenPath of forbiddenPaths) {
      const value = get(data, forbiddenPath)

      if (value !== undefined) {
        forbiddenMatches.push(forbiddenPath)
      }
    }

    if (forbiddenMatches.length > 0) {
      const errors: ZodIssue[] = []
      for (const path of forbiddenMatches) {
        errors.push({
          code: ZodIssueCode.custom,
          message: `Field '${path}' is forbidden.`,
          path: [path],
        })
      }
      throw new ZodError(errors)
    }
    return data
  }) as ZodEffects<T, any, any>
}

function isJsonLikeUnion(schemaPart: ZodTypeAny): boolean {
  if (schemaPart instanceof z.ZodOptional) {
    schemaPart = schemaPart.unwrap()
  }
  return (
    schemaPart instanceof z.ZodUnion &&
    schemaPart.options.some((option: ZodTypeAny) => option instanceof z.ZodLazy)
  )
}

export function flattenObject(
  obj: Record<string, any>,
  prefix = '',
  schema?: ZodObject<any>,
): Record<string, any> {
  const result: Record<string, any> = {}

  for (const key of Object.keys(obj)) {
    const pre = prefix.length ? `${prefix}.` : ''
    const currentSchema = schema?.shape[key]

    if (currentSchema instanceof z.ZodOptional && obj[key] === undefined) {
      continue
    }

    if (currentSchema && isJsonLikeUnion(currentSchema)) {
      result[`${pre}${key}`] = obj[key]
    } else if (
      typeof obj[key] === 'object' &&
      obj[key] !== null &&
      currentSchema instanceof ZodObject
    ) {
      Object.assign(
        result,
        flattenObject(obj[key], `${pre}${key}`, currentSchema),
      )
    } else {
      result[`${pre}${key}`] = obj[key]
    }
  }

  return result
}
