export const LOG_PREFIX = '[auto-progressive]'

export class HttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'HttpError'
    this.status = status
  }
}

const PRISMA_ERROR_MAP: Record<string, { status: number; message: string }> = {
  P2000: { status: 400, message: 'Value too long for column' },
  P2001: { status: 404, message: 'Record not found' },
  P2002: { status: 409, message: 'Unique constraint violation' },
  P2003: { status: 400, message: 'Foreign key constraint failed' },
  P2004: { status: 400, message: 'Constraint failed on the database' },
  P2005: { status: 400, message: 'Invalid field value' },
  P2006: { status: 400, message: 'Invalid value provided' },
  P2007: { status: 400, message: 'Data validation error' },
  P2008: { status: 400, message: 'Failed to parse the query' },
  P2009: { status: 400, message: 'Failed to validate the query' },
  P2010: { status: 500, message: 'Raw query failed' },
  P2011: { status: 400, message: 'Null constraint violation' },
  P2012: { status: 400, message: 'Missing required value' },
  P2013: { status: 400, message: 'Missing required argument' },
  P2014: { status: 400, message: 'Required relation violation' },
  P2015: { status: 404, message: 'Related record not found' },
  P2016: { status: 400, message: 'Query interpretation error' },
  P2017: { status: 400, message: 'Records not connected' },
  P2018: { status: 404, message: 'Required connected record not found' },
  P2019: { status: 400, message: 'Input error' },
  P2020: { status: 400, message: 'Value out of range for the field type' },
  P2021: { status: 500, message: 'Table does not exist in the database' },
  P2022: { status: 500, message: 'Column does not exist in the database' },
  P2023: { status: 500, message: 'Inconsistent column data' },
  P2024: { status: 503, message: 'Connection pool timeout' },
  P2025: { status: 404, message: 'Record not found' },
  P2026: {
    status: 501,
    message: 'Feature not supported by the current database provider',
  },
  P2027: {
    status: 400,
    message: 'Multiple errors occurred during transaction execution',
  },
  P2028: { status: 500, message: 'Transaction API error' },
  P2030: {
    status: 400,
    message: 'Cannot find a fulltext index for the search',
  },
  P2033: { status: 400, message: 'Number out of range for the field type' },
  P2034: { status: 409, message: 'Transaction conflict, please retry' },
}

type ErrorShape = {
  name?: string
  code?: string
  message?: string
  issues?: unknown
  status?: unknown
  statusCode?: unknown
}

function asErrorShape(error: unknown): ErrorShape {
  if (error && typeof error === 'object') return error as ErrorShape
  return {}
}

function isProduction(): boolean {
  return (
    typeof process !== 'undefined' &&
    process.env &&
    process.env.NODE_ENV === 'production'
  )
}

function isHttpStatus(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 400 &&
    value <= 599
  )
}

export function mapError(error: unknown): HttpError {
  if (error instanceof HttpError) return error
  const e = asErrorShape(error)
  const isProd = isProduction()

  const duckStatus = isHttpStatus(e.status)
    ? e.status
    : isHttpStatus(e.statusCode)
      ? e.statusCode
      : null
  if (duckStatus !== null) {
    const detail =
      typeof e.message === 'string' && e.message
        ? e.message
        : 'Internal server error'
    return new HttpError(duckStatus, detail)
  }

  if (e.name === 'ShapeError')
    return new HttpError(400, e.message || 'Shape validation failed')
  if (e.name === 'CallerError')
    return new HttpError(400, e.message || 'Caller validation failed')
  if (e.name === 'PolicyError')
    return new HttpError(403, e.message || 'Policy denied')
  if (e.name === 'ZodError') {
    const issues = e.issues
    const message = Array.isArray(issues)
      ? (issues as Array<{ message?: string }>)
          .map((i) => i.message ?? '')
          .filter(Boolean)
          .join('; ')
      : e.message || 'Validation failed'
    return new HttpError(400, message)
  }
  if (typeof e.code === 'string') {
    const mapped = PRISMA_ERROR_MAP[e.code]
    if (mapped) {
      const detail = e.message
      const shouldStripDetail = isProd && mapped.status >= 500
      return new HttpError(
        mapped.status,
        !shouldStripDetail && detail
          ? mapped.message + ': ' + detail
          : mapped.message,
      )
    }
    if (e.code.startsWith('P')) {
      const msg = e.message || 'Database operation failed'
      console.warn(LOG_PREFIX, 'Unmapped Prisma error code:', e.code, msg)
      return new HttpError(500, isProd ? 'Internal server error' : msg)
    }
  }
  if (typeof e.name === 'string') {
    if (e.name === 'PrismaClientValidationError')
      return new HttpError(400, e.message || 'Invalid query parameters')
    if (e.name === 'PrismaClientKnownRequestError')
      return new HttpError(400, e.message || 'Database request error')
    if (e.name === 'PrismaClientInitializationError') {
      return new HttpError(
        503,
        isProd
          ? 'Service unavailable'
          : e.message || 'Database connection failed',
      )
    }
    if (e.name === 'PrismaClientRustPanicError') {
      return new HttpError(
        500,
        isProd
          ? 'Internal server error'
          : e.message || 'Internal database engine error',
      )
    }
    if (e.name === 'PrismaClientUnknownRequestError') {
      return new HttpError(
        500,
        isProd
          ? 'Internal server error'
          : e.message || 'Unknown database error',
      )
    }
  }
  const msg = error instanceof Error ? error.message : String(error)
  console.error(LOG_PREFIX, 'Unhandled error:', error)
  return new HttpError(
    500,
    isProd ? 'Internal server error' : msg || 'Internal server error',
  )
}
