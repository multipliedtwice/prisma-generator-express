import { ImportStyle } from '../utils/resolveImportStyle'
import { importExt } from '../utils/importExt'
import type { Target } from '../constants'

const ROUTER_OPERATIONS = [
  'findUnique', 'findUniqueOrThrow', 'findFirst', 'findFirstOrThrow',
  'findMany', 'findManyPaginated', 'count', 'aggregate', 'groupBy',
  'create', 'createMany', 'createManyAndReturn',
  'update', 'updateMany', 'updateManyAndReturn',
  'upsert', 'delete', 'deleteMany',
] as const

type RouterOperation = (typeof ROUTER_OPERATIONS)[number]

const READ_OPERATIONS: ReadonlySet<RouterOperation> = new Set<RouterOperation>([
  'findUnique', 'findUniqueOrThrow', 'findFirst', 'findFirstOrThrow',
  'findMany', 'findManyPaginated', 'count', 'aggregate', 'groupBy',
])

const ROUTER_OP_TO_SHAPE_OP: Record<RouterOperation, string> = {
  findUnique: 'findUnique',
  findUniqueOrThrow: 'findUniqueOrThrow',
  findFirst: 'findFirst',
  findFirstOrThrow: 'findFirstOrThrow',
  findMany: 'findMany',
  findManyPaginated: 'findManyPaginated',
  count: 'count',
  aggregate: 'aggregate',
  groupBy: 'groupBy',
  create: 'create',
  createMany: 'createMany',
  createManyAndReturn: 'createManyAndReturn',
  update: 'update',
  updateMany: 'updateMany',
  updateManyAndReturn: 'updateManyAndReturn',
  upsert: 'upsert',
  delete: 'delete',
  deleteMany: 'deleteMany',
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function requestTypeFor(target: Target): string {
  if (target === 'fastify') return `import('fastify').FastifyRequest`
  if (target === 'hono') return `import('hono').Context`
  return `import('express').Request`
}

export function generateRouteConfigType(
  modelName: string,
  hookHandlerType: string,
  guardShapesImport: string | null,
  importStyle: ImportStyle,
  target: Target,
): string {
  const ext = importExt(importStyle)
  const m = modelName
  const supportsProgressive = target === 'express'
  const requestType = requestTypeFor(target)

  const progressiveTypeImport = supportsProgressive
    ? `import type { ProgressiveVariantConfig, ProgressiveStage } from '../routeConfig.target${ext}'\n\n`
    : ''

  if (!guardShapesImport) {
    return progressiveTypeImport + `export type ${m}RouteConfig<TCtx = unknown> = RouteConfig<Record<string, unknown>, TCtx>\n`
  }

  const shapeOps = Object.values(ROUTER_OP_TO_SHAPE_OP).filter((v, i, a) => a.indexOf(v) === i)
  const opShapeImports = shapeOps.map((op) => `${m}${capitalize(op)}ShapeInput`).join(',\n  ')

  const overrides = ROUTER_OPERATIONS.map((routerOp) => {
    const shapeOp = ROUTER_OP_TO_SHAPE_OP[routerOp]
    const c = capitalize(shapeOp)
    const isRead = READ_OPERATIONS.has(routerOp)
    const lines = [
      `    before?: ${hookHandlerType}[]`,
      `    after?: ${hookHandlerType}[]`,
      `    shape?: ${m}${c}ShapeInput<TCtx>`,
    ]
    if (isRead && supportsProgressive) {
      lines.push(`    progressive?: Record<string, ProgressiveVariantConfig>`)
      lines.push(`    progressiveStages?: Record<string, ProgressiveStage<TCtx>>`)
    }
    return `  ${routerOp}?: {\n${lines.join('\n')}\n  }`
  }).join('\n')

  const omitKeys = ROUTER_OPERATIONS.map((k) => `'${k}'`).join('\n  | ')

  return (
    progressiveTypeImport +
    `import type {\n  ${opShapeImports}\n} from '${guardShapesImport}${ext}'\n\n` +
    `export type ${m}RouteConfig<TCtx = unknown> = Omit<\n` +
    `  RouteConfig<Record<string, unknown>, TCtx>,\n` +
    `  | ${omitKeys}\n` +
    `  | 'resolveContext'\n` +
    `> & {\n` +
    `  resolveContext?: (request: ${requestType}) => TCtx | Promise<TCtx>\n` +
    `${overrides}\n}\n`
  )
}