import { ImportStyle } from '../utils/resolveImportStyle'
import { importExt } from '../utils/importExt'
import type { Target } from '../constants'
import { capitalize } from '../utils/strings'

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


function requestTypeFor(target: Target): string {
  if (target === 'fastify') return `import('fastify').FastifyRequest`
  if (target === 'hono') return `import('hono').Context<TEnv>`
  return `import('express').Request`
}

function configGenericsFor(target: Target): string {
  if (target === 'hono') {
    return `<TCtx = unknown, TPrisma = any, TEnv extends { Variables: Record<string, unknown> } = { Variables: Record<string, unknown> }>`
  }
  return `<TCtx = unknown, TPrisma = any>`
}

function routeConfigBaseFor(target: Target): string {
  if (target === 'hono') {
    return `RouteConfig<Record<string, unknown>, TCtx, TEnv>`
  }
  if (target === 'express') {
    return `RouteConfig<Record<string, unknown>, TCtx, TPrisma>`
  }
  return `RouteConfig<Record<string, unknown>, TCtx>`
}

function hookHandlerTypeRef(target: Target, hookHandlerType: string): string {
  if (target === 'hono') return `${hookHandlerType}<TEnv>`
  return hookHandlerType
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

  const generics = configGenericsFor(target)
  const baseConfig = routeConfigBaseFor(target)
  const hookRef = hookHandlerTypeRef(target, hookHandlerType)
  const requestType = requestTypeFor(target)

  const progressiveTypeImport = supportsProgressive
    ? `import type { ProgressiveVariantConfig, ProgressiveStage } from '../routeConfig.target${ext}'\n\n`
    : ''

  if (!guardShapesImport) {
    return progressiveTypeImport + `export type ${m}RouteConfig${generics} = ${baseConfig}\n`
  }

  const shapeOps = Object.values(ROUTER_OP_TO_SHAPE_OP).filter((v, i, a) => a.indexOf(v) === i)
  const opShapeImports = shapeOps.map((op) => `${m}${capitalize(op)}ShapeInput`).join(',\n  ')

  const overrides = ROUTER_OPERATIONS.map((routerOp) => {
    const shapeOp = ROUTER_OP_TO_SHAPE_OP[routerOp]
    const c = capitalize(shapeOp)
    const isRead = READ_OPERATIONS.has(routerOp)
    const lines = [
      `    before?: ${hookRef}[]`,
      `    after?: ${hookRef}[]`,
      `    shape?: ${m}${c}ShapeInput<TCtx>`,
    ]
    if (isRead && supportsProgressive) {
      lines.push(`    progressive?: Record<string, ProgressiveVariantConfig>`)
      lines.push(`    progressiveStages?: Record<string, ProgressiveStage<TCtx, TPrisma>>`)
    }
    return `  ${routerOp}?: {\n${lines.join('\n')}\n  }`
  }).join('\n')

  const omitKeys = ROUTER_OPERATIONS.map((k) => `'${k}'`).join('\n  | ')

  return (
    progressiveTypeImport +
    `import type {\n  ${opShapeImports}\n} from '${guardShapesImport}${ext}'\n\n` +
    `export type ${m}RouteConfig${generics} = Omit<\n` +
    `  ${baseConfig},\n` +
    `  | ${omitKeys}\n` +
    `  | 'resolveContext'\n` +
    `> & {\n` +
    `  resolveContext?: (request: ${requestType}) => TCtx | Promise<TCtx>\n` +
    `${overrides}\n}\n`
  )
}