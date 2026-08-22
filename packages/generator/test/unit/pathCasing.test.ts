import { describe, it, expect } from 'vitest'
import {
  modelPathSegment,
  parsePathCase,
  toKebabCase,
} from '../../src/utils/pathCasing'

describe('parsePathCase', () => {
  it('defaults to lower', () => {
    expect(parsePathCase(undefined)).toBe('lower')
  })

  it('accepts the three modes case-insensitively', () => {
    expect(parsePathCase('KEBAB')).toBe('kebab')
    expect(parsePathCase('Raw')).toBe('raw')
    expect(parsePathCase('lower')).toBe('lower')
  })

  it('rejects unknown values', () => {
    expect(() => parsePathCase('camel')).toThrow(/Invalid pathCase/)
    expect(() => parsePathCase('')).toThrow(/Invalid pathCase/)
  })
})

describe('toKebabCase', () => {
  it('splits camel boundaries', () => {
    expect(toKebabCase('BlogPost')).toBe('blog-post')
    expect(toKebabCase('apiKey')).toBe('api-key')
  })

  it('handles acronym runs followed by a word', () => {
    expect(toKebabCase('HTTPResponse')).toBe('http-response')
  })

  it('preserves underscores and digits', () => {
    expect(toKebabCase('INVOICE_RECORDS')).toBe('invoice_records')
    expect(toKebabCase('User2Factor')).toBe('user2-factor')
  })
})

describe('modelPathSegment', () => {
  const cases: Array<[string, string, string, string]> = [
    // [model, lower, kebab, raw]
    ['User', 'user', 'user', 'User'],
    ['BlogPost', 'blogpost', 'blog-post', 'BlogPost'],
    ['OrderItem', 'orderitem', 'order-item', 'OrderItem'],
    [
      'INVOICE_RECORDS',
      'invoice_records',
      'invoice_records',
      'INVOICE_RECORDS',
    ],
    ['apiKey', 'apikey', 'api-key', 'apiKey'],
  ]

  it.each(cases)(
    '%s → lower=%s kebab=%s raw=%s',
    (model, lower, kebab, raw) => {
      expect(modelPathSegment(model, 'lower')).toBe(lower)
      expect(modelPathSegment(model, 'kebab')).toBe(kebab)
      expect(modelPathSegment(model, 'raw')).toBe(raw)
    },
  )
})
