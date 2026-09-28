import type { DMMF } from '@prisma/generator-helper'
import { generateRouteConfigType } from './generateRouteConfigType'
import type { ImportStyle } from '../utils/resolveImportStyle'
import { importExt } from '../utils/importExt'
import type { WriteStrategy } from '../constants'
import { modelPathSegment, type PathCase } from '../utils/pathCasing'
import { OPERATION_METADATA } from '../copy/operationDefinitions'

function opKindFor(opName: string): string {
  switch (opName) {
    case 'findUnique':
    case 'findUniqueOrThrow':
      return 'readUnique'
    case 'findMany':
    case 'findFirst':
    case 'findFirstOrThrow':
    case 'findManyPaginated':
    case 'count':
    case 'aggregate':
    case 'groupBy':
      return 'read'
    case 'create':
      return 'create'
    case 'createMany':
    case 'createManyAndReturn':
      return 'createMany'
    case 'update':
      return 'update'
    case 'updateMany':
    case 'updateManyAndReturn':
      return 'updateMany'
    case 'upsert':
      return 'upsert'
    case 'delete':
      return 'delete'
    case 'deleteMany':
      return 'deleteMany'
    default:
      return 'noop'
  }
}

/**
 * The phase 9 static assembly boundary, emitted side: one named factory per
 * operation, each returning a Hono sub-app with exactly that route. A consumer
 * imports only the parts it serves; everything not imported is absent from the
 * bundle — which `enableAll` at runtime can never do, because route
 * configuration is runtime data. Heavy features are referenced only by their
 * own parts (`userOpenApi` is the sole static referencer of the OpenAPI
 * renderer and `yaml`).
 */
export function generateHonoRouterParts({
  model,
  enums,
  guardShapesImport,
  clientImport,
  importStyle,
  writeStrategy,
  dropGuard,
  pathCase,
}: {
  model: DMMF.Model
  enums: DMMF.DatamodelEnum[]
  guardShapesImport: string | null
  clientImport?: string
  importStyle: ImportStyle
  writeStrategy: WriteStrategy
  dropGuard: boolean
  pathCase: PathCase
}): string {
  const ext = importExt(importStyle)
  const modelName = model.name
  const modelSegment = modelPathSegment(modelName, pathCase)
  const lower = modelName.charAt(0).toLowerCase() + modelName.slice(1)
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

  const handlerImports = OPERATION_METADATA.map(
    (m) => `  ${modelName}${cap(m.name)},`,
  ).join('\n')

  const readOps = OPERATION_METADATA.filter((m) => m.kind === 'read')
  const writeOps = OPERATION_METADATA.filter(
    (m) => m.kind === 'write' || m.kind === 'batch',
  ).filter((m) => m.name !== 'updateEach')

  const pathExpr = (suffix: string) =>
    !suffix ? `setup.basePath || '/'` : `\`\${setup.basePath}${suffix}\``

  const readFactories = readOps
    .map((meta) => {
      const fn = `${lower}${cap(meta.name)}`
      const handler = `${modelName}${cap(meta.name)}`
      const opKind = opKindFor(meta.name)
      const pathValue = pathExpr(meta.pathSuffix)
      const postPathValue =
        meta.name === 'findMany'
          ? `setup.basePath ? \`\${setup.basePath}/read\` : '/read'`
          : pathExpr(meta.pathSuffix)
      return `
export function ${fn}<TCtx = unknown, TPrisma extends PrismaClientLike = PrismaClientLike, TEnv extends HonoEnvBase = HonoEnvBase>(config: ${modelName}RouteConfig<TCtx, TPrisma, TEnv> = {}): Hono<GeneratedHonoEnv<TEnv>> {
  const setup = ${lower}PartsSetup(config)
  const opConfig = setup.opFor('${meta.configKey}')
  const app = new Hono<GeneratedHonoEnv<TEnv>>()
  app.get(${pathValue}, createReadRoute<TCtx, TPrisma, TEnv>({ config, opConfig, opKind: '${opKind}', handler: ${handler}, parse: 'query', dropGuard: setup.dropGuard, settleBeforeHooks: setup.settleBeforeHooks }))
  return app
}

export function ${fn}PostRead<TCtx = unknown, TPrisma extends PrismaClientLike = PrismaClientLike, TEnv extends HonoEnvBase = HonoEnvBase>(config: ${modelName}RouteConfig<TCtx, TPrisma, TEnv> = {}): Hono<GeneratedHonoEnv<TEnv>> {
  const setup = ${lower}PartsSetup(config)
  const opConfig = setup.opFor('${meta.configKey}')
  const app = new Hono<GeneratedHonoEnv<TEnv>>()
  app.post(${postPathValue}, createReadRoute<TCtx, TPrisma, TEnv>({ config, opConfig, opKind: '${opKind}', handler: ${handler}, parse: 'body', dropGuard: setup.dropGuard, settleBeforeHooks: setup.settleBeforeHooks }))
  return app
}
`
    })
    .join('\n')

  const writeFactories = writeOps
    .map((meta) => {
      const fn = `${lower}${cap(meta.name)}`
      const handler = `${modelName}${cap(meta.name)}`
      const opKind = opKindFor(meta.name)
      const pathValue = pathExpr(meta.pathSuffix)
      return `
export function ${fn}<TCtx = unknown, TPrisma extends PrismaClientLike = PrismaClientLike, TEnv extends HonoEnvBase = HonoEnvBase>(config: ${modelName}RouteConfig<TCtx, TPrisma, TEnv> = {}): Hono<GeneratedHonoEnv<TEnv>> {
  const setup = ${lower}PartsSetup(config)
  const opConfig = setup.opFor('${meta.configKey}')
  const app = new Hono<GeneratedHonoEnv<TEnv>>()
  app.${meta.method}(${pathValue}, createWriteRoute<TCtx, TPrisma, TEnv>({ config, opConfig, opKind: '${opKind}', handler: ${handler}, dropGuard: setup.dropGuard, settleBeforeHooks: setup.settleBeforeHooks }))
  return app
}
`
    })
    .join('\n')

  return `import { Hono } from 'hono'
import {
${handlerImports}
} from './${modelName}Handlers${ext}'
import type {
  RouteConfig,
  HonoEnvBase,
  GeneratedHonoEnv,
  HonoBeforeHook,
  HonoAfterHook,
  PaginationConfig,
  PrismaClientLike,
} from '../routeConfig.target${ext}'
import { normalizePrefix, getEnv, resolveDropGuardEnv } from '../misc${ext}'
import {
  resolveGuardPolicy,
  validateCountSourceWhere,
  warnIfUnguardedRoutes,
} from '../routeConfig${ext}'
import {
  createReadRoute,
  createWriteRoute,
  createUpdateEachRoute,
  opConfigFor,
  normalizeHonoOperation,
  type HonoOpConfig,
} from '../routerParts${ext}'
import { MODEL_FIELDS, MODEL_ENUMS } from './${modelName}Metadata${ext}'

${generateRouteConfigType(modelName, 'HonoBeforeHook', guardShapesImport, importStyle, 'hono', clientImport)}

// Fixed at generation time, identical to the legacy router factory.
const DROP_GUARD = ${dropGuard}

// No module-level side effects: this file must be tree-shakeable, so unused
// per-op exports — and everything only they reference, down to the OpenAPI
// renderer and yaml — drop out of a bundler's output. The environment is read
// inside the functions that need it.

function ${lower}PartsSetup<TCtx = unknown, TPrisma extends PrismaClientLike = PrismaClientLike, TEnv extends HonoEnvBase = HonoEnvBase>(config: ${modelName}RouteConfig<TCtx, TPrisma, TEnv>) {
  validateCountSourceWhere(config.pagination?.countSource, '${modelName} pagination')
  validateCountSourceWhere(
    (config.findManyPaginated && typeof config.findManyPaginated === 'object' ? config.findManyPaginated : undefined)?.pagination?.countSource,
    '${modelName} findManyPaginated pagination',
  )

  const isEnabled = (value: unknown): boolean => value !== false && !!(config.enableAll || value)
  warnIfUnguardedRoutes('${modelName}', ['findMany', 'findUnique', 'findUniqueOrThrow', 'findFirst', 'findFirstOrThrow', 'findManyPaginated', 'count', 'aggregate', 'groupBy', 'create', 'createMany', 'createManyAndReturn', 'update', 'updateMany', 'updateManyAndReturn', 'upsert', 'delete', 'deleteMany'], config, isEnabled)

  const customPrefix = normalizePrefix(config.customUrlPrefix || '')
  const modelPrefix = config.addModelPrefix !== false ? '/${modelSegment}' : ''
  const basePath = customPrefix + modelPrefix

  const POLICY = resolveGuardPolicy(config)
  const dropGuard =
    DROP_GUARD || (POLICY.allowE2EGuardBypass && resolveDropGuardEnv(getEnv()))
  const settleBeforeHooks = POLICY.guardResolutionOrder === 'before-hooks'

  const opFor = <K extends keyof ${modelName}RouteConfig<TCtx, TPrisma, TEnv>>(
    key: K,
  ): HonoOpConfig<TEnv> => {
    const raw = config[key] as unknown as Parameters<typeof normalizeHonoOperation<TEnv>>[0]
    return opConfigFor<TEnv>(raw, '${modelName}.' + String(key), POLICY)
  }

  return { basePath, POLICY, dropGuard, settleBeforeHooks, opFor }
}
${readFactories}
${writeFactories}
export function ${lower}UpdateEach<TCtx = unknown, TPrisma extends PrismaClientLike = PrismaClientLike, TEnv extends HonoEnvBase = HonoEnvBase>(config: ${modelName}RouteConfig<TCtx, TPrisma, TEnv> = {}): Hono<GeneratedHonoEnv<TEnv>> {
  const setup = ${lower}PartsSetup(config)
  if (!setup.POLICY.enableUpdateEach) {
    throw new Error(
      '${modelName}.updateEach: enableUpdateEach is false, so this part ' +
      'is not available. It bypasses guard shapes entirely, so there is no ' +
      'configuration that makes it safe to expose.',
    )
  }
  const raw = config.updateEach as unknown as Parameters<typeof normalizeHonoOperation<TEnv>>[0]
  const opConfig = normalizeHonoOperation<TEnv>(raw)
  const app = new Hono<GeneratedHonoEnv<TEnv>>()
  app.post(setup.basePath ? \`\${setup.basePath}/each\` : '/each', createUpdateEachRoute<TCtx, TPrisma, TEnv>({ config, opConfig, handler: ${modelName}UpdateEach, dropGuard: setup.dropGuard }))
  return app
}

`
}
