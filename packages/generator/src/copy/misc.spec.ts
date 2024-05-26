import { isJsonString, safeJSONparse, isObject } from './misc'

describe('misc.ts', () => {
  describe('isJsonString', () => {
    it('should return true for valid JSON string', () => {
      expect(isJsonString('{"name":"John"}')).toBe(true)
    })

    it('should return false for invalid JSON string', () => {
      expect(isJsonString('{"name": "John"')).toBe(false) // Missing closing brace
    })

    it('should return false for non-string input', () => {
      expect(isJsonString(123)).toBe(false)
      expect(isJsonString({ name: 'John' })).toBe(false)
      expect(isJsonString(null)).toBe(false)
      expect(isJsonString(undefined)).toBe(false)
    })
  })
  describe('safeJSONparse', () => {
    it('should parse valid JSON string', () => {
      expect(safeJSONparse('{"name":"John"}')).toEqual({ name: 'John' })
    })

    it('should return false for string "false"', () => {
      expect(safeJSONparse('false')).toBe(false)
    })

    it('should return undefined for string "undefined"', () => {
      expect(safeJSONparse('undefined')).toBeUndefined()
    })

    it('should return null for string "null"', () => {
      expect(safeJSONparse('null')).toBeNull()
    })

    it('should return original data for non-JSON string', () => {
      expect(safeJSONparse('Hello World')).toBe('Hello World')
    })

    it('should return original data for non-string input', () => {
      expect(safeJSONparse(123)).toBe(123)
      expect(safeJSONparse({ name: 'John' })).toEqual({ name: 'John' })
      expect(safeJSONparse(null)).toBe(null)
      expect(safeJSONparse(undefined)).toBe(undefined)
    })
  })
  describe('isObject', () => {
    it('should return true for objects', () => {
      expect(isObject({})).toBe(true)
      expect(isObject({ name: 'John' })).toBe(true)
    })

    it('should return false for non-objects', () => {
      expect(isObject('Hello World')).toBe(false)
      expect(isObject(123)).toBe(false)
      expect(isObject(null)).toBe(false)
      expect(isObject(undefined)).toBe(false)
      expect(isObject([])).toBe(false) // Arrays are not considered objects in this context
    })
  })
})
