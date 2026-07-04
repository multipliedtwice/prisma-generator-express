import { HttpError } from './errorMapper'
import type { PaginationCountSource } from './routeConfig'

export const IDENT_RE = /^[A-Za-z_][A-Za-z0-9_]*$/

type PrismaRawClient = {
  $queryRawUnsafe?: <T = unknown>(sql: string, ...values: unknown[]) => Promise<T>
}

export function quoteIdent(name: string): string {
  if (!IDENT_RE.test(name)) {
    throw new HttpError(400, 'invalid identifier: ' + name)
  }
  return '"' + name.replace(/"/g, '""') + '"'
}

function buildMaterializedCountFqn(
  source: Extract<PaginationCountSource, { type: 'materializedView' }>,
): string {
  return source.schema
    ? quoteIdent(source.schema) + '.' + quoteIdent(source.relation)
    : quoteIdent(source.relation)
}

function buildMaterializedCountWhere(
  where: Record<string, unknown> | undefined,
): { sql: string; values: unknown[] } {
  if (!where || Object.keys(where).length === 0) {
    return { sql: '', values: [] }
  }
  const values: unknown[] = []
  const clauses: string[] = []
  for (const [key, value] of Object.entries(where)) {
    if (value === null) {
      clauses.push(quoteIdent(key) + ' IS NULL')
      continue
    }
    values.push(value)
    clauses.push(quoteIdent(key) + ' = $' + values.length)
  }
  return { sql: ' WHERE ' + clauses.join(' AND '), values }
}

export async function countFromMaterializedView(
  client: unknown,
  source: Extract<PaginationCountSource, { type: 'materializedView' }>,
): Promise<number> {
  const raw = client as PrismaRawClient
  if (typeof raw.$queryRawUnsafe !== 'function') {
    throw new HttpError(500, 'Materialized count source requires $queryRawUnsafe on the Prisma client')
  }
  const column = source.column ?? 'total'
  const where = buildMaterializedCountWhere(source.where)
  const sql =
    'SELECT ' +
    quoteIdent(column) +
    ' AS "total" FROM ' +
    buildMaterializedCountFqn(source) +
    where.sql +
    ' LIMIT 1'
  const rows = await raw.$queryRawUnsafe<Array<{ total: unknown }>>(sql, ...where.values)
  const value = rows[0]?.total
  const total = Number(value)
  if (!Number.isFinite(total)) {
    throw new HttpError(500, 'Materialized count source did not return a numeric total')
  }
  return Math.trunc(total)
}