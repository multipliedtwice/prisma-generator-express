const ROUTER_OPERATIONS = [
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'findManyPaginated',
  'count',
  'aggregate',
  'groupBy',
  'create',
  'createMany',
  'createManyAndReturn',
  'update',
  'updateMany',
  'updateManyAndReturn',
  'upsert',
  'delete',
  'deleteMany',
] as const

type RouterOperation = (typeof ROUTER_OPERATIONS)[number]

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

export function generateRouteConfigType(
  modelName: string,
  hookHandlerType: string,
  guardShapesImport: string | null,
): string {
  const m = modelName

  if (!guardShapesImport) {
    return `export type ${m}RouteConfig<TCtx = unknown> = RouteConfig\n`
  }

  const shapeOps = Object.values(ROUTER_OP_TO_SHAPE_OP).filter(
    (v, i, a) => a.indexOf(v) === i,
  )

  const opShapeImports = shapeOps
    .map((op) => `${m}${capitalize(op)}ShapeInput`)
    .join(',\n  ')

  const overrides = ROUTER_OPERATIONS.map((routerOp) => {
    const shapeOp = ROUTER_OP_TO_SHAPE_OP[routerOp]
    const c = capitalize(shapeOp)
    return (
      `  ${routerOp}?: {\n` +
      `    before?: ${hookHandlerType}[]\n` +
      `    after?: ${hookHandlerType}[]\n` +
      `    shape?: ${m}${c}ShapeInput<TCtx>\n` +
      `  }`
    )
  }).join('\n')

  const omitKeys = ROUTER_OPERATIONS.map((k) => `'${k}'`).join('\n  | ')

  return (
    `import type {\n  ${opShapeImports}\n} from '${guardShapesImport}'\n\n` +
    `export type ${m}RouteConfig<TCtx = unknown> = Omit<\n` +
    `  RouteConfig,\n` +
    `  | ${omitKeys}\n` +
    `> & {\n${overrides}\n}\n`
  )
}