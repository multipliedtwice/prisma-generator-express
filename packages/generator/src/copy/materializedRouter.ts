import express from 'express'
import type {
  NextFunction,
  Request,
  RequestHandler,
  Response,
  Router,
} from 'express'
import { HttpError, mapError, transformResult } from './operationRuntime'

type SortDirection = 'asc' | 'desc'
type NullsOrder = 'first' | 'last'

type OrderByDef =
  | string
  | { field: string; direction?: SortDirection; nulls?: NullsOrder }

type ViewDef = {
  relation: string
  schema?: string
  defaultLimit?: number
  maxLimit?: number
  orderBy?: OrderByDef
  allowedOrderBy?: string[]
  authorize?: (
    req: Request,
    viewName: string,
    def: ViewDef,
  ) => void | Promise<void>
}

type PrismaRawClient = {
  $queryRawUnsafe: <T = unknown>(
    sql: string,
    ...values: unknown[]
  ) => Promise<T>
}

type MaterializedRouterOptions = {
  prisma: PrismaRawClient
  views: Record<string, ViewDef>
  basePath?: string
  defaultLimit?: number
  maxLimit?: number
  before?: RequestHandler[]
  after?: RequestHandler[]
}

const IDENT_RE = /^[A-Za-z_][A-Za-z0-9_]*$/

export const forbidden = (message: string): HttpError => new HttpError(403, message)

const quoteIdent = (name: string): string => {
  if (!IDENT_RE.test(name))
    throw new HttpError(400, 'invalid identifier: ' + name)
  return '"' + name.replace(/"/g, '""') + '"'
}

const normalizeBasePath = (value?: string): string => {
  if (!value || value === '/') return ''
  const prefixed = value.startsWith('/') ? value : '/' + value
  return prefixed.replace(/\/+$/, '')
}

const buildFqn = (def: ViewDef): string =>
  def.schema
    ? quoteIdent(def.schema) + '.' + quoteIdent(def.relation)
    : quoteIdent(def.relation)

const clampInt = (
  v: unknown,
  fallback: number,
  min: number,
  max: number,
): number => {
  const n = Number(v ?? fallback)
  if (!Number.isFinite(n)) return fallback
  return Math.min(Math.max(Math.trunc(n), min), max)
}

const normalizeDirection = (value: unknown): 'ASC' | 'DESC' => {
  if (value === undefined || value === 'asc' || value === 'ASC') return 'ASC'
  if (value === 'desc' || value === 'DESC') return 'DESC'
  throw new HttpError(400, 'invalid sort direction')
}

const normalizeNulls = (
  value: unknown,
): '' | ' NULLS FIRST' | ' NULLS LAST' => {
  if (value === undefined) return ''
  if (value === 'first' || value === 'FIRST') return ' NULLS FIRST'
  if (value === 'last' || value === 'LAST') return ' NULLS LAST'
  throw new HttpError(400, 'invalid nulls order')
}

const buildOrderBy = (orderBy?: OrderByDef): string => {
  if (!orderBy) return ''
  if (typeof orderBy === 'string') return ' ORDER BY ' + quoteIdent(orderBy)
  return (
    ' ORDER BY ' +
    quoteIdent(orderBy.field) +
    ' ' +
    normalizeDirection(orderBy.direction) +
    normalizeNulls(orderBy.nulls)
  )
}

const parseOrderByParam = (raw: unknown): OrderByDef | undefined => {
  if (raw === undefined || raw === null || raw === '') return undefined
  if (typeof raw !== 'string') return undefined
  if (raw.startsWith('{') || raw.startsWith('[')) {
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      throw new HttpError(400, 'invalid orderBy JSON')
    }
    if (typeof parsed === 'string') return parsed
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const keys = Object.keys(parsed as Record<string, unknown>)
      if (keys.length === 0) return undefined
      const field = keys[0]
      const dirRaw = (parsed as Record<string, unknown>)[field]
      if (dirRaw === 'asc' || dirRaw === 'desc')
        return { field, direction: dirRaw }
      if (dirRaw && typeof dirRaw === 'object') {
        const sort = (dirRaw as { sort?: unknown }).sort
        const nulls = (dirRaw as { nulls?: unknown }).nulls
        const direction = sort === 'asc' || sort === 'desc' ? sort : undefined
        const nullsOrder =
          nulls === 'first' || nulls === 'last' ? nulls : undefined
        return { field, direction, nulls: nullsOrder }
      }
      return { field }
    }
    throw new HttpError(400, 'invalid orderBy shape')
  }
  return raw
}

const enforceAllowlist = (orderBy: OrderByDef, allowed?: string[]): void => {
  if (!allowed) return
  const field = typeof orderBy === 'string' ? orderBy : orderBy.field
  if (!allowed.includes(field)) {
    throw new HttpError(400, 'orderBy field not allowed: ' + field)
  }
}

const validateViewIdentifier = (
  viewName: string,
  fieldName: string,
  value: string,
): void => {
  if (!IDENT_RE.test(value)) {
    throw new Error(
      'materializedViewsRouter: invalid ' + fieldName + ' identifier for view "' +
      viewName + '": ' + value,
    )
  }
}

const validateViewConfig = (viewName: string, def: ViewDef): void => {
  validateViewIdentifier(viewName, 'relation', def.relation)
  if (def.schema) validateViewIdentifier(viewName, 'schema', def.schema)
  const ob = def.orderBy
  if (typeof ob === 'string') validateViewIdentifier(viewName, 'orderBy', ob)
  else if (ob) validateViewIdentifier(viewName, 'orderBy.field', ob.field)
  if (def.allowedOrderBy) {
    for (const field of def.allowedOrderBy) {
      validateViewIdentifier(viewName, 'allowedOrderBy[]', field)
    }
  }
  if (!def.allowedOrderBy && !def.orderBy) {
    console.warn(
      '[materializedViewsRouter] view "' + viewName +
      '" has neither `orderBy` nor `allowedOrderBy` set. ' +
      'Clients can sort by any valid identifier, which may cause full table scans.',
    )
  }
}

export const materializedViewsRouter = (
  opts: MaterializedRouterOptions,
): Router => {
  for (const [name, def] of Object.entries(opts.views)) {
    validateViewConfig(name, def)
  }

  const router = express.Router()
  const basePath = normalizeBasePath(opts.basePath)
  const defaultLimit = opts.defaultLimit ?? 50
  const maxLimit = opts.maxLimit ?? 1000
  const before = opts.before ?? []
  const after = opts.after ?? []

  router.get(
    basePath + '/:viewName',
    ...before,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const viewName = req.params.viewName
        const def = opts.views[viewName]
        if (!def) throw new HttpError(404, 'unknown view')
        if (def.authorize) await def.authorize(req, viewName, def)

        const take = clampInt(
          req.query.take,
          def.defaultLimit ?? defaultLimit,
          1,
          def.maxLimit ?? maxLimit,
        )
        const skip = clampInt(req.query.skip, 0, 0, Number.MAX_SAFE_INTEGER)

        const queryOrderBy = parseOrderByParam(req.query.orderBy)
        if (queryOrderBy) enforceAllowlist(queryOrderBy, def.allowedOrderBy)
        const effectiveOrderBy = queryOrderBy ?? def.orderBy

        if (skip > 0 && !effectiveOrderBy) {
          throw new HttpError(
            400,
            'skip requires orderBy for deterministic pagination',
          )
        }

        const sql =
          'SELECT * FROM ' +
          buildFqn(def) +
          buildOrderBy(effectiveOrderBy) +
          ' LIMIT $1 OFFSET $2'

        const rows = await opts.prisma.$queryRawUnsafe<unknown[]>(
          sql,
          take,
          skip,
        )
        res.locals.data = transformResult(rows)
        next()
      } catch (err) {
        next(mapError(err))
      }
    },
    ...after,
    (_req: Request, res: Response) => {
      res.json(res.locals.data)
    },
  )

  router.use(
    (err: unknown, _req: Request, res: Response, next: NextFunction) => {
      const httpError =
        err instanceof HttpError
          ? err
          : err &&
              typeof err === 'object' &&
              typeof (err as { status?: number }).status === 'number'
            ? new HttpError(
                (err as { status: number }).status,
                (err as { message?: string }).message ||
                  'Internal server error',
              )
            : mapError(err)

      if (!res.headersSent) {
        return res.status(httpError.status).json({ message: httpError.message })
      }

      next(err)
    },
  )

  return router
}