import { afterEach, describe, expect, it, vi } from 'vitest'
import { HttpError, mapError } from '../../../src/copy/errorMapper'

const originalNodeEnv = process.env.NODE_ENV

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv
  vi.restoreAllMocks()
})

describe('mapError', () => {
  it('returns an existing HttpError unchanged', () => {
    const error = new HttpError(418, 'teapot')

    expect(mapError(error)).toBe(error)
  })

  it('supports duck-typed status and statusCode errors', () => {
    expect(mapError({ status: 422, message: 'invalid' })).toMatchObject({
      status: 422,
      message: 'invalid',
    })
    expect(mapError({ statusCode: 404 })).toMatchObject({
      status: 404,
      message: 'Internal server error',
    })
  })

  it.each([
    ['ShapeError', 400, 'shape failed'],
    ['CallerError', 400, 'caller failed'],
    ['PolicyError', 403, 'denied'],
  ])('maps %s', (name, status, message) => {
    expect(mapError({ name, message })).toMatchObject({ status, message })
  })

  it('joins Zod issue messages', () => {
    expect(
      mapError({
        name: 'ZodError',
        issues: [{ message: 'first' }, {}, { message: 'second' }],
      }),
    ).toMatchObject({
      status: 400,
      message: 'first; second',
    })
  })

  it('maps known Prisma codes with development detail', () => {
    process.env.NODE_ENV = 'test'

    expect(mapError({ code: 'P2002', message: 'email' })).toMatchObject({
      status: 409,
      message: 'Unique constraint violation: email',
    })
  })

  it('strips details from server-side Prisma errors in production', () => {
    process.env.NODE_ENV = 'production'

    expect(mapError({ code: 'P2024', message: 'database host' })).toMatchObject({
      status: 503,
      message: 'Connection pool timeout',
    })
  })

  it('logs and maps unknown Prisma codes', () => {
    process.env.NODE_ENV = 'test'
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    expect(mapError({ code: 'P2999', message: 'unknown prisma' })).toMatchObject({
      status: 500,
      message: 'unknown prisma',
    })
    expect(warn).toHaveBeenCalledWith(
      '[auto-progressive]',
      'Unmapped Prisma error code:',
      'P2999',
      'unknown prisma',
    )
  })

  it.each([
    ['PrismaClientValidationError', 400, 'invalid'],
    ['PrismaClientKnownRequestError', 400, 'request'],
    ['PrismaClientInitializationError', 503, 'connection'],
    ['PrismaClientRustPanicError', 500, 'panic'],
    ['PrismaClientUnknownRequestError', 500, 'unknown'],
  ])('maps Prisma error class name %s', (name, status, message) => {
    process.env.NODE_ENV = 'test'

    expect(mapError({ name, message })).toMatchObject({ status, message })
  })

  it('hides unhandled errors in production', () => {
    process.env.NODE_ENV = 'production'
    vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(mapError(new Error('secret'))).toMatchObject({
      status: 500,
      message: 'Internal server error',
    })
  })

  it('returns unhandled error detail outside production', () => {
    process.env.NODE_ENV = 'test'
    vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(mapError(new Error('visible'))).toMatchObject({
      status: 500,
      message: 'visible',
    })
  })
})
