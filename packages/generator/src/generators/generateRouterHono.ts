import type { DMMF } from '@prisma/generator-helper'
import { generateRouteConfigType } from './generateRouteConfigType'
import type { ImportStyle } from '../utils/resolveImportStyle'
import { importExt } from '../utils/importExt'
import type { WriteStrategy } from '../constants'
import { modelPathSegment, type PathCase } from '../utils/pathCasing'
import { OPERATION_METADATA } from '../copy/operationDefinitions'

function pathExpr(suffix: string): string {
  if (!suffix) return `basePath || '/'`
  return `\`\${basePath}${suffix}\``
}

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

function emitReadOp(
  meta: (typeof OPERATION_METADATA)[number],
  modelName: string,
): string {
  const c = meta.name.charAt(0).toUpperCase() + meta.name.slice(1)
  const handlerName = `${modelName}${c}`
  const pathValue = pathExpr(meta.pathSuffix)
  const opKind = opKindFor(meta.name)

  const postReadLine = meta.supportsPostRead
    ? meta.name === 'findMany'
      ? `    if (resolvePostReadsEnabled(config.disablePostReads, opConfig.disablePostReads)) {
      const postPath = basePath ? \`\${basePath}/read\` : '/read'
      app.post(postPath, createReadRoute<TCtx, TPrisma, TEnv>({ config, opConfig, opKind: '${opKind}', handler: ${handlerName}, parse: 'body', dropGuard, settleBeforeHooks: SETTLE_BEFORE_HOOKS }))
    }`
      : `    if (resolvePostReadsEnabled(config.disablePostReads, opConfig.disablePostReads)) app.post(path, createReadRoute<TCtx, TPrisma, TEnv>({ config, opConfig, opKind: '${opKind}', handler: ${handlerName}, parse: 'body', dropGuard, settleBeforeHooks: SETTLE_BEFORE_HOOKS }))`
    : ''

  return `  if (isEnabled(config.${meta.configKey})) {
    const opConfig = opFor('${meta.configKey}')
    const path = ${pathValue}
    app.get(path, createReadRoute<TCtx, TPrisma, TEnv>({ config, opConfig, opKind: '${opKind}', handler: ${handlerName}, parse: 'query', dropGuard, settleBeforeHooks: SETTLE_BEFORE_HOOKS }))
${postReadLine}
  }`
}

function emitWriteOp(
  meta: (typeof OPERATION_METADATA)[number],
  modelName: string,
): string {
  const c = meta.name.charAt(0).toUpperCase() + meta.name.slice(1)
  const handlerName = `${modelName}${c}`
  const pathValue = pathExpr(meta.pathSuffix)
  const opKind = opKindFor(meta.name)

  return `  if (isEnabled(config.${meta.configKey})) {
    const opConfig = opFor('${meta.configKey}')
    const path = ${pathValue}
    app.${meta.method}(path, createWriteRoute<TCtx, TPrisma, TEnv>({ config, opConfig, opKind: '${opKind}', handler: ${handlerName}, dropGuard, settleBeforeHooks: SETTLE_BEFORE_HOOKS }))
  }`
}

/**
 * Guard behaviour is SEVEN INDEPENDENT OPT-IN CONTROLS on the route config.
 * See routeConfig.ts; the long rationale lives with the controls.
 *
 * Since phase S the orchestration itself is shared: every route is created by
 * `../routerParts` through the same pipeline stages the other targets and MCP
 * use, and this factory only decides WHICH routes exist. That module is also
 * the phase 9 static boundary — per-op route factories live there, so a
 * bundle importing only selected parts omits the rest.
 */
export function generateHonoRouterFunction({
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
  const routerFunctionName = `${modelName}Router`

  const handlerImports = OPERATION_METADATA.map(
    (m) => `  ${modelName}${m.name.charAt(0).toUpperCase() + m.name.slice(1)},`,
  ).join('\n')

  const readOps = OPERATION_METADATA.filter((m) => m.kind === 'read')
  const writeOps = OPERATION_METADATA.filter(
    (m) => m.kind === 'write' || m.kind === 'batch',
  ).filter((m) => m.name !== 'updateEach')

  const readOpBlocks = readOps.map((m) => emitReadOp(m, modelName)).join('\n\n')
  const writeOpBlocks = writeOps
    .map((m) => emitWriteOp(m, modelName))
    .join('\n\n')

  return `import { Hono } from 'hono'
import {
${handlerImports}
} from './${modelName}Handlers${ext}'
import type {
  RouteConfig,
  HonoEnvBase,
  GeneratedHonoEnv,
  PrismaClientLike,
} from '../routeConfig.target${ext}'
import { normalizePrefix, getEnv, resolveDropGuardEnv } from '../misc${ext}'
import { buildModelOpenApi } from '../buildModelOpenApi${ext}'
import {
  resolveGuardPolicy,
  resolvePostReadsEnabled,
  validateCountSourceWhere,
  validateUpdateEachConfig,
  warnIfUnguardedRoutes,
} from '../routeConfig${ext}'
import {
  createReadRoute,
  createWriteRoute,
  createUpdateEachRoute,
  opConfigFor,
  normalizeHonoOperation,
  registerOpenApiRoutes,
  sendError,
  type HandlerContext,
  type HonoOpConfig,
} from '../routerParts${ext}'
// The legacy router factory preserves pre-parts behavior: materialized-view
// counting is registered on import. The per-op parts boundary keeps this
// module out of opt-in small bundles.
import { MODEL_FIELDS, MODEL_ENUMS } from './${modelName}Metadata${ext}'

${generateRouteConfigType(modelName, 'HonoBeforeHook', guardShapesImport, importStyle, 'hono', clientImport)}
const _env = getEnv()

// Fixed at generation time. The \`allowE2EGuardBypass\` control decides whether the
// environment can additionally drop the guard at runtime; it defaults to true,
// which is upstream behaviour. See generateRouterHono.ts.
const DROP_GUARD = ${dropGuard}

export function ${routerFunctionName}<TCtx = unknown, TPrisma extends PrismaClientLike = PrismaClientLike, TEnv extends HonoEnvBase = HonoEnvBase>(config: ${modelName}RouteConfig<TCtx, TPrisma, TEnv> = {}): Hono<GeneratedHonoEnv<TEnv>> {
  validateCountSourceWhere(config.pagination?.countSource, '${modelName} pagination')
  validateCountSourceWhere(
    (config.findManyPaginated && typeof config.findManyPaginated === 'object' ? config.findManyPaginated : undefined)?.pagination?.countSource,
    '${modelName} findManyPaginated pagination',
  )

  const app = new Hono<GeneratedHonoEnv<TEnv>>()

  const isEnabled = (value: unknown): boolean => value !== false && !!(config.enableAll || value)
  warnIfUnguardedRoutes('${modelName}', ['findMany', 'findUnique', 'findUniqueOrThrow', 'findFirst', 'findFirstOrThrow', 'findManyPaginated', 'count', 'aggregate', 'groupBy', 'create', 'createMany', 'createManyAndReturn', 'update', 'updateMany', 'updateManyAndReturn', 'upsert', 'delete', 'deleteMany'], config, isEnabled)

  const customPrefix = normalizePrefix(config.customUrlPrefix || '')
  const modelPrefix = config.addModelPrefix !== false ? '/${modelSegment}' : ''
  const basePath = customPrefix + modelPrefix

  const POLICY = resolveGuardPolicy(config)
  const SETTLE_BEFORE_HOOKS = POLICY.guardResolutionOrder === 'before-hooks'

  /**
   * The environment bypass, honoured unless the consumer turned it off.
   * \`PGE_DROP_GUARD=true\` downgrading enforcement in a deployed environment is
   * a real hazard, and it is also upstream behaviour (under its deprecated
   * \`E2E=true\` spelling) — so it is a control, not a decision made here.
   */
  const dropGuard = DROP_GUARD || (POLICY.allowE2EGuardBypass && resolveDropGuardEnv(_env))

  const opFor = <K extends keyof ${modelName}RouteConfig<TCtx, TPrisma, TEnv>>(
    key: K,
  ): HonoOpConfig<TEnv> => {
    const raw = config[key] as unknown as Parameters<typeof normalizeHonoOperation<TEnv>>[0]
    return opConfigFor<TEnv>(raw, '${modelName}.' + String(key), POLICY)
  }

  const openApiDisabled = config.disableOpenApi === true
    || (config.disableOpenApi !== false && (
      _env.NODE_ENV === 'production'
      || _env.DISABLE_OPENAPI === 'true'
    ))

  let _openApiJsonCache: unknown = undefined
  const getOpenApiJson = (): unknown => {
    if (_openApiJsonCache === undefined) {
      _openApiJsonCache = buildModelOpenApi(
        '${modelName}',
        MODEL_FIELDS as unknown as Parameters<typeof buildModelOpenApi>[1],
        MODEL_ENUMS as unknown as Parameters<typeof buildModelOpenApi>[2],
        config as unknown as Parameters<typeof buildModelOpenApi>[3],
        { format: 'json', writeStrategy: '${writeStrategy}', pathSegment: '${modelSegment}' },
      )
    }
    return _openApiJsonCache
  }
  let _openApiYamlCache: string | undefined = undefined
  const getOpenApiYaml = (): string => {
    if (_openApiYamlCache === undefined) {
      _openApiYamlCache = buildModelOpenApi(
        '${modelName}',
        MODEL_FIELDS as unknown as Parameters<typeof buildModelOpenApi>[1],
        MODEL_ENUMS as unknown as Parameters<typeof buildModelOpenApi>[2],
        config as unknown as Parameters<typeof buildModelOpenApi>[3],
        { format: 'yaml', writeStrategy: '${writeStrategy}', pathSegment: '${modelSegment}' },
      ) as string
    }
    return _openApiYamlCache
  }

  if (config.queryBuilder && _env.NODE_ENV !== 'production') {
    console.warn(
      '[${modelName}Router] queryBuilder config is present but Hono target does not auto-start it. ' +
      'Run \`npx prisma-query-builder-ui\` in a separate process.',
    )
  }

  app.onError((err, c) => {
    return sendError(c as unknown as HandlerContext, err)
  })

  if (!openApiDisabled) {
    registerOpenApiRoutes(app, basePath, getOpenApiJson, getOpenApiYaml)
  }

${readOpBlocks}

${writeOpBlocks}

  if (config.updateEach) {
    /**
     * Refused only when \`enableUpdateEach\` is false. It bypasses guard shapes by design — the
     * endpoint is a batch of { where, data } applied directly — and the only thing
     * between it and an unguarded mass mutation is a console.warn suppressed in
     * production. A warning is not a security boundary.
     */
    if (!POLICY.enableUpdateEach) {
      throw new Error(
        '${modelName}.updateEach: enableUpdateEach is false, so this router ' +
        'does not register updateEach. It bypasses guard shapes entirely, so ' +
        'there is no configuration that makes it safe to expose. Perform batch ' +
        'updates through a guarded operation, or behind your own authenticated ' +
        'route outside the generated router.',
      )
    }

    const rawUpdateEach = config.updateEach as unknown as Parameters<typeof normalizeHonoOperation<TEnv>>[0]
    validateUpdateEachConfig(rawUpdateEach, '${modelName}.updateEach')
    const opConfig = normalizeHonoOperation<TEnv>(rawUpdateEach)
    if (opConfig.operationBefore.length === 0 && _env.NODE_ENV !== 'production') {
      console.warn(
        '[${modelName}Router] updateEach is enabled without a before hook. ' +
        'This endpoint bypasses guard shapes and should be protected by authentication middleware.',
      )
    }
    const path = basePath ? \`\${basePath}/each\` : '/each'
    app.post(path, createUpdateEachRoute<TCtx, TPrisma, TEnv>({ config, opConfig, handler: ${modelName}UpdateEach, dropGuard }))
  }

  return app
}
`
}
