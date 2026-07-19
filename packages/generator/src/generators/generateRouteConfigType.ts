import { ImportStyle } from '../utils/resolveImportStyle'
import { importExt } from '../utils/importExt'
import type { Target } from '../constants'
import { OPERATION_METADATA, READ_OPERATION_NAMES } from '../copy/operationDefinitions'

const ROUTER_OPERATIONS = OPERATION_METADATA
  .filter((m) => m.name !== 'updateEach')
  .map((m) => m.name)

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
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
): string {
  const ext = importExt(importStyle)
  const m = modelName
  const supportsProgressive = target === 'express'

  const generics = configGenericsFor(target)
  const baseConfig = routeConfigBaseFor(target)
  const beforeRef = beforeHookRef(target, hookHandlerType)
  const afterRef = afterHookRef(target, hookHandlerType)
  const requestType = requestTypeFor(target)

  const progressiveTypeImport = supportsProgressive
    ? `import type { ProgressiveVariantConfig, ProgressiveStage } from '../routeConfig.target${ext}'\n`
    : ''

  if (!guardShapesImport) {
    return (
      progressiveTypeImport +
      `export type ${m}RouteConfig${generics} = ${baseConfig}\n`
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

    return (
      `  ${routerOp}?: (${commonConfig} & (\n` +
      `    | { shape?: ${m}${c}ShapeInput<TCtx>; variants?: never }\n` +
      `    | { shape?: never; variants: ${variantsConfig} }\n` +
      `  )) | false`
    )
  }).join('\n')

  const omitKeys = ROUTER_OPERATIONS.map((k) => `'${k}'`).join('\n  | ')

  return (
    progressiveTypeImport +
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