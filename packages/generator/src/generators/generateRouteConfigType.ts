import type { ImportStyle } from '../utils/resolveImportStyle'
import { importExt } from '../utils/importExt'
import type { Target } from '../constants'
import {
  OPERATION_METADATA,
  READ_OPERATION_NAMES,
} from '../copy/operationDefinitions'

const ROUTER_OPERATIONS = OPERATION_METADATA.filter(
  (m) => m.name !== 'updateEach',
).map((m) => m.name)

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

function requestTypeFor(target: Target): string {
  if (target === 'fastify') return `import('fastify').FastifyRequest`
  if (target === 'hono') return `import('hono').Context<GeneratedHonoEnv<TEnv>>`
  return `import('express').Request`
}

function configGenericsFor(target: Target): string {
  if (target === 'hono') {
    return `<TCtx = unknown, TPrisma extends PrismaClientLike = PrismaClientLike, TEnv extends { Variables: Record<string, unknown> } = { Variables: Record<string, unknown> }>`
  }
  return `<TCtx = unknown, TPrisma extends PrismaClientLike = PrismaClientLike>`
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

function beforeHookRef(target: Target, hookHandlerType: string): string {
  if (target === 'hono') return `HonoBeforeHook<TEnv>`
  return hookHandlerType
}

function afterHookRef(target: Target, hookHandlerType: string): string {
  if (target === 'hono') return `HonoAfterHook<TEnv>`
  return hookHandlerType
}

export function generateRouteConfigType(
  modelName: string,
  hookHandlerType: string,
  guardShapesImport: string | null,
  importStyle: ImportStyle,
  target: Target,
  clientImport?: string,
): string {
  const ext = importExt(importStyle)
  const m = modelName
  const supportsProgressive = target === 'express'

  const generics = configGenericsFor(target)
  const baseConfig = routeConfigBaseFor(target)
  const beforeRef = beforeHookRef(target, hookHandlerType)
  const afterRef = afterHookRef(target, hookHandlerType)
  const requestType = requestTypeFor(target)

  const clientPath = clientImport ? `${clientImport}${ext}` : '@prisma/client'
  const delegate = `${m.charAt(0).toLowerCase() + m.slice(1)}`
  const modelDelegate = clientImport ? `PrismaClient['${delegate}']` : `(TPrisma extends Record<'${delegate}', infer D> ? D : never)`
  const overrideImports = `import type { Prisma${clientImport ? ', PrismaClient' : ''} } from '${clientPath}'\nimport type { OperationOverride } from '../operationRuntime${ext}'\n`
  const overrideType = (op: string) => {
    const method = op === 'findManyPaginated' ? 'findMany' : op
    const args = `Prisma.Args<${modelDelegate}, '${method}'>`
    const result = `Prisma.Result<${modelDelegate}, ${args}, '${method}'>`
    const output = op === 'findManyPaginated' ? `{ data: ${result}; total: number; hasMore: boolean }` : result
    const methods = op === 'findManyPaginated' ? "'findMany' | 'count'" : `'${method}'`
    return `OperationOverride<${args}, ${output}, TCtx, Readonly<{ ${delegate}: Pick<${modelDelegate}, Extract<keyof ${modelDelegate}, ${methods}>> }>>`
  }
  const typeImports = supportsProgressive
    ? `import type { ProgressiveVariantConfig, ProgressiveStage } from '../routeConfig.target${ext}'\n`
    : ''

  if (!guardShapesImport) {
    return (
      overrideImports + typeImports + `export type ${m}RouteConfig${generics} = Omit<${baseConfig}, ${ROUTER_OPERATIONS.map((op) => `'${op}'`).join(' | ')}> & {\n${ROUTER_OPERATIONS.map((op) => `  ${op}?: (Omit<Exclude<${baseConfig}['${op}'], false | undefined>, 'override'> & { override?: ${overrideType(op)} }) | false`).join('\n')}\n}\n`
    )
  }

  const shapeOps = Array.from(new Set(ROUTER_OPERATIONS))
  const opShapeImports = shapeOps
    .flatMap((op) => {
      const prefix = `${m}${capitalize(op)}Shape`
      return [prefix, `${prefix}Input`]
    })
    .join(',\n  ')

  const shapeOrFnAliases = shapeOps
    .map((op) => {
      const prefix = `${m}${capitalize(op)}Shape`
      return (
        `type ${prefix}OrFn<TCtx = unknown> =\n` +
        `  | ${prefix}\n` +
        `  | ((ctx: TCtx) => ${prefix})`
      )
    })
    .join('\n\n')

  const overrides = ROUTER_OPERATIONS.map((routerOp) => {
    const c = capitalize(routerOp)
    const isRead = READ_OPERATION_NAMES.has(routerOp)
    const commonLines = [
      `    override?: ${overrideType(routerOp)}`,
      `    authorize?: ${beforeRef}`,
      `    before?: ${beforeRef}[]`,
      `    after?: ${afterRef}[]`,
      `    pagination?: Partial<PaginationConfig>`,
    ]

    if (isRead && supportsProgressive) {
      commonLines.push(
        `    progressive?: Record<string, ProgressiveVariantConfig>`,
      )
      commonLines.push(
        `    progressiveStages?: Record<string, ProgressiveStage<TCtx, TPrisma>>`,
      )
    }

    const commonConfig = `{\n${commonLines.join('\n')}\n  }`
    const variantsConfig =
      `Record<string, {\n` +
      `      shape: ${m}${c}ShapeOrFn<TCtx>\n` +
      `      before?: ${beforeRef}[]\n` +
      `      after?: ${afterRef}[]\n` +
      `    }>`

    // Only consulted when `requireDefaultVariantOptIn` is on; inert otherwise.
    // Emitted so a TypeScript consumer who opts in can confirm a `default`
    // variant without a cast — 1.64.2 demanded it and never added it to the type.
    const allowDefault = `    allowDefaultVariant?: boolean`

    return (
      `  ${routerOp}?: (${commonConfig} & (\n` +
      `    | { shape?: ${m}${c}ShapeInput<TCtx>; variants?: never }\n` +
      `    | { shape?: never; variants: ${variantsConfig}\n${allowDefault} }\n` +
      `  )) | false`
    )
  }).join('\n')

  const omitKeys = ROUTER_OPERATIONS.map((k) => `'${k}'`).join('\n  | ')

  return (
    overrideImports + typeImports +
    `import type {\n  ${opShapeImports}\n} from '${guardShapesImport}${ext}'\n\n` +
    `${shapeOrFnAliases}\n\n` +
    `export type ${m}RouteConfig${generics} = Omit<\n` +
    `  ${baseConfig},\n` +
    `  | ${omitKeys}\n` +
    `  | 'resolveContext'\n` +
    `> & {\n` +
    `  resolveContext?: (request: ${requestType}) => TCtx | Promise<TCtx>\n` +
    `${overrides}\n}\n`
  )
}
