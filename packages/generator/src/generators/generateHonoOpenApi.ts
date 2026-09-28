import type { DMMF } from '@prisma/generator-helper'
import { generateRouteConfigType } from './generateRouteConfigType'
import type { ImportStyle } from '../utils/resolveImportStyle'
import { importExt } from '../utils/importExt'
import type { WriteStrategy } from '../constants'
import { modelPathSegment, type PathCase } from '../utils/pathCasing'

/**
 * The per-model OpenAPI part, in a module of its own so the phase 9 boundary
 * holds by construction: a bundle that does not import this file has no path
 * to `buildModelOpenApi` or `yaml`, regardless of bundler side-effect
 * heuristics.
 */
export function generateHonoOpenApiRoutes({
  model,
  enums,
  guardShapesImport,
  clientImport,
  importStyle,
  writeStrategy,
  pathCase,
}: {
  model: DMMF.Model
  enums: DMMF.DatamodelEnum[]
  guardShapesImport: string | null
  clientImport?: string
  importStyle: ImportStyle
  writeStrategy: WriteStrategy
  pathCase: PathCase
}): string {
  const ext = importExt(importStyle)
  const modelName = model.name
  const modelSegment = modelPathSegment(modelName, pathCase)
  const lower = modelName.charAt(0).toLowerCase() + modelName.slice(1)

  return `import { Hono } from 'hono'
import type {
  RouteConfig,
  HonoEnvBase,
  GeneratedHonoEnv,
  PrismaClientLike,
} from '../routeConfig.target${ext}'
import { normalizePrefix, getEnv } from '../misc${ext}'
import { registerOpenApiRoutes } from '../routerParts${ext}'
import { buildModelOpenApi } from '../buildModelOpenApi${ext}'
import { MODEL_FIELDS, MODEL_ENUMS } from './${modelName}Metadata${ext}'

${generateRouteConfigType(modelName, 'HonoBeforeHook', guardShapesImport, importStyle, 'hono', clientImport)}

export function ${lower}OpenApi<TCtx = unknown, TPrisma extends PrismaClientLike = PrismaClientLike, TEnv extends HonoEnvBase = HonoEnvBase>(config: ${modelName}RouteConfig<TCtx, TPrisma, TEnv> = {}): Hono<GeneratedHonoEnv<TEnv>> {
  const _env = getEnv()
  const customPrefix = normalizePrefix(config.customUrlPrefix || '')
  const modelPrefix = config.addModelPrefix !== false ? '/${modelSegment}' : ''
  const basePath = customPrefix + modelPrefix

  const openApiDisabled = config.disableOpenApi === true
    || (config.disableOpenApi !== false && (
      _env.NODE_ENV === 'production'
      || _env.DISABLE_OPENAPI === 'true'
    ))

  const app = new Hono<GeneratedHonoEnv<TEnv>>()
  if (!openApiDisabled) {
    let jsonCache: unknown = undefined
    let yamlCache: string | undefined = undefined
    registerOpenApiRoutes(app, basePath, () => {
      if (jsonCache === undefined) {
        jsonCache = buildModelOpenApi(
          '${modelName}',
          MODEL_FIELDS as unknown as Parameters<typeof buildModelOpenApi>[1],
          MODEL_ENUMS as unknown as Parameters<typeof buildModelOpenApi>[2],
          config as unknown as Parameters<typeof buildModelOpenApi>[3],
          { format: 'json', writeStrategy: '${writeStrategy}', pathSegment: '${modelSegment}' },
        )
      }
      return jsonCache
    }, () => {
      if (yamlCache === undefined) {
        yamlCache = buildModelOpenApi(
          '${modelName}',
          MODEL_FIELDS as unknown as Parameters<typeof buildModelOpenApi>[1],
          MODEL_ENUMS as unknown as Parameters<typeof buildModelOpenApi>[2],
          config as unknown as Parameters<typeof buildModelOpenApi>[3],
          { format: 'yaml', writeStrategy: '${writeStrategy}', pathSegment: '${modelSegment}' },
        ) as string
      }
      return yamlCache
    })
  }
  return app
}
`
}
