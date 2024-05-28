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

function startsWith(str: string, prefix: string): boolean {
  return str.slice(0, prefix.length) === prefix
}

function every<T>(
  array: T[],
  callback: (value: T, index: number, array: T[]) => boolean,
): boolean {
  for (let i = 0; i < array.length; i++) {
    if (!callback(array[i], i, array)) {
      return false
    }
  }
  return true
}

function isKeyAllowed(key: string, allowedPaths: string[]): boolean {
  return !every(
    allowedPaths,
    (path) =>
      !startsWith(key.replace(/\[\d+\]/g, ''), path.replace(/\[\d+\]/g, '')) &&
      !startsWith(path.replace(/\[\d+\]/g, ''), key.replace(/\[\d+\]/g, '')),
  )
}

export function allow<T extends ZodTypeAny>(
  schema: T,
  allowedPaths: string[],
): ZodEffects<T, any, any> {
  const rootSchema = schema instanceof z.ZodObject ? schema.strict() : undefined

  return rootSchema?.transform((data) => {
    const flatData = flattenObject(data, '', rootSchema)

    const disallowedPaths: string[] = []

    for (const key of Object.keys(flatData)) {
      if (!isKeyAllowed(key, allowedPaths)) {
        disallowedPaths.push(key)
      }
    }

    if (disallowedPaths.length > 0) {
      throw createZodErrorFromPaths(disallowedPaths, 'Field is not allowed:')
    }

    return data
  }) as unknown as ZodEffects<T, any, any>
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
      throw createZodErrorFromPaths(forbiddenMatches, 'Field is forbidden:')
    }
    return data
  }) as ZodEffects<T, any, any>
}

export function flattenObject(
  obj: Record<string, any>,
  prefix = '',
  schema?: ZodObject<any>,
): Record<string, any> {
  const result: Record<string, any> = {}

  function flatten(current: any, prop: string, schema?: ZodObject<any>) {
    if (Object(current) !== current) {
      result[prop] = current
    } else if (Array.isArray(current)) {
      current.forEach((item, index) => {
        flatten(item, `${prop}[]`, schema)
      })
    } else {
      let isEmpty = true
      for (const key in current) {
        if (current.hasOwnProperty(key)) {
          isEmpty = false
          const currentSchema = schema?.shape[key]
          if (
            currentSchema instanceof z.ZodOptional &&
            current[key] === undefined
          ) {
            continue
          }
          flatten(
            current[key],
            prop ? `${prop}.${key}` : key,
            currentSchema instanceof ZodObject ? currentSchema : undefined,
          )
        }
      }
      if (isEmpty) {
        result[prop] = {}
      }
    }
  }

  flatten(obj, prefix, schema)
  return result
}

function createZodErrorFromPaths(
  disallowedPaths: string[],
  errorMessage: string,
): ZodError {
  const errors: ZodIssue[] = []
  for (const path of disallowedPaths) {
    errors.push({
      code: ZodIssueCode.custom,
      message: `${errorMessage} '${path}'`,
      path: path.split('.'),
    })
  }
  return new ZodError(errors)
}
