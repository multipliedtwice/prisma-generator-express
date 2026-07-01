import {
  generatorHandler,
  GeneratorOptions,
  DMMF,
} from '@prisma/generator-helper'
import path from 'path'
import { generateUnifiedHandler } from './generators/generateUnifiedHandler'
import { generateFastifyHandler } from './generators/generateFastifyHandler'
import { generateHonoHandler } from './generators/generateHonoHandler'
import { generateRouterFunction } from './generators/generateRouter'
import { generateFastifyRouterFunction } from './generators/generateRouterFastify'
import { generateHonoRouterFunction } from './generators/generateRouterHono'
import { generateScalarUIHandler } from './generators/generateUnifiedScalarUI'
import { generateUnifiedDocs } from './generators/generateUnifiedDocs'
import { generateQueryBuilderHelper } from './generators/generateQueryBuilderHelper'
import { generateModelCore } from './generators/generateOperationCore'
import {
  generateRelationMeta,
  generateRelationModelsIndex,
} from './generators/generateRelationMeta'
import {
  getRelativeClientPath,
  getGuardShapesImport,
} from './generators/generateImportPrismaStatement'
import { writeFileSafely } from './utils/writeFileSafely'
import { copyFiles } from './utils/copyFiles'
import { resolveImportStyle, ImportStyle } from './utils/resolveImportStyle'
import {
  GENERATOR_NAME,
  Target,
  WriteStrategy,
  FindManyPaginatedMode,
} from './constants'

const GENERATOR_OFF_RE = /^\s*generator off\s*$/m

function getTarget(options: GeneratorOptions): Target {
  const raw = String(
    (options.generator.config as Record<string, unknown>).target ?? 'express',
  ).toLowerCase()
  if (raw === 'express' || raw === 'fastify' || raw === 'hono') return raw
  throw new Error(
    `Invalid target "${raw}". Expected "express", "fastify", or "hono".`,
  )
}

function getWriteStrategy(options: GeneratorOptions): WriteStrategy {
  const raw = String(
    (options.generator.config as Record<string, unknown>).writeStrategy ??
      'regular',
  )
  const lower = raw.toLowerCase()
  if (lower === 'regular') return 'regular'
  if (lower === 'throwonnonreturning') return 'throwOnNonReturning'
  if (lower === 'throwonregular') {
    console.warn(
      '[prisma-generator-express] writeStrategy="throwOnRegular" is deprecated. Use "throwOnNonReturning" instead.',
    )
    return 'throwOnNonReturning'
  }
  if (lower === 'forcereturn') return 'forceReturn'
  throw new Error(
    `Invalid writeStrategy "${raw}". Expected "regular", "throwOnNonReturning", or "forceReturn".`,
  )
}

function getFindManyPaginatedMode(
  options: GeneratorOptions,
): FindManyPaginatedMode {
  const raw = String(
    (options.generator.config as Record<string, unknown>)
      .findManyPaginatedMode ?? 'promiseAll',
  )
  const lower = raw.toLowerCase()
  if (lower === 'transaction') return 'transaction'
  if (lower === 'promiseall') return 'promiseAll'
  throw new Error(
    `Invalid findManyPaginatedMode "${raw}". Expected "transaction" or "promiseAll".`,
  )
}

function getDropGuard(options: GeneratorOptions): boolean {
  const raw = (options.generator.config as Record<string, unknown>).dropGuard
  if (raw === undefined || raw === null) return false

  if (typeof raw === 'boolean') return raw

  if (typeof raw === 'string') {
    const s = raw.trim()
    const lower = s.toLowerCase()
    if (lower === 'true' || lower === '1' || lower === 'yes') return true
    if (lower === 'false' || lower === '0' || lower === 'no' || s === '') return false
    const envVal = process.env[s]
    if (envVal === undefined) return false
    const el = envVal.trim().toLowerCase()
    return el === 'true' || el === '1' || el === 'yes'
  }

  return false
}

function validateClientGeneratorPresent(options: GeneratorOptions): void {
  getRelativeClientPath(
    options,
    options.dmmf.datamodel.models[0]?.name ?? 'Model',
  )
}

generatorHandler({
  onManifest() {
    return {
      version: require('../package.json').version,
      defaultOutput: '../generated/output',
      prettyName: GENERATOR_NAME,
    }
  },

  async onGenerate(options: GeneratorOptions) {
    const target = getTarget(options)
    const writeStrategy = getWriteStrategy(options)
    const findManyPaginatedMode = getFindManyPaginatedMode(options)
    const dropGuard = getDropGuard(options)

    const manifestDefaultAbs = path.resolve(
      __dirname,
      '..',
      'generated',
      'output',
    )
    const currentOutput = options.generator.output?.value
    const isUnsetOrManifestDefault =
      !currentOutput || path.resolve(currentOutput) === manifestDefaultAbs

    if (isUnsetOrManifestDefault) {
      const schemaDir = path.dirname(options.schemaPath)
      const outputPath = path.join(schemaDir, 'generated', target)
      options.generator.output = { value: outputPath, fromEnvVar: null }
    }

    const importStyle = resolveImportStyle(options)

    console.log(`\n═══ Prisma Generator (${target.toUpperCase()}) ═══`)
    console.log(`  Target: ${target}`)
    console.log(`  Output: ${options.generator.output?.value}`)
    console.log(`  Import style: ${importStyle}`)
    console.log(`  Write strategy: ${writeStrategy}`)
    console.log(`  findManyPaginated mode: ${findManyPaginatedMode}`)

    if (dropGuard) {
      console.log('')
      console.log('  !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
      console.log('  !!!!! GUARD IS DROPPED (generator config) !!!!!')
      console.log('  !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
      console.log('')
    }

    if (options.dmmf.datamodel.models.length > 0) {
      validateClientGeneratorPresent(options)
    }

    await copyFiles(options, target, importStyle)

    const modelNames: string[] = []
    const generateHandler: (opts: {
      model: DMMF.Model
      importStyle: ImportStyle
    }) => string =
      target === 'fastify'
        ? generateFastifyHandler
        : target === 'hono'
          ? generateHonoHandler
          : generateUnifiedHandler

    const allModels = options.dmmf.datamodel.models as DMMF.Model[]

    for (const model of options.dmmf.datamodel.models) {
      if (model.documentation && GENERATOR_OFF_RE.test(model.documentation)) {
        console.log(`  Skipping: ${model.name} (generator off)`)
        continue
      }
      modelNames.push(model.name)

      const guardShapesImport = getGuardShapesImport(options, model.name)

      await writeFileSafely({
        content: generateModelCore({
          model: model as DMMF.Model,
          importStyle,
          writeStrategy,
          findManyPaginatedMode,
        }),
        options,
        model: model as DMMF.Model,
        operation: 'Core',
      })

      await writeFileSafely({
        content: generateHandler({ model: model as DMMF.Model, importStyle }),
        options,
        model: model as DMMF.Model,
        operation: 'Handlers',
      })

      const routerContent =
        target === 'fastify'
          ? generateFastifyRouterFunction({
              model: model as DMMF.Model,
              enums: options.dmmf.datamodel.enums as DMMF.DatamodelEnum[],
              guardShapesImport,
              importStyle,
              writeStrategy,
              findManyPaginatedMode,
              dropGuard,
            })
          : target === 'hono'
            ? generateHonoRouterFunction({
                model: model as DMMF.Model,
                enums: options.dmmf.datamodel.enums as DMMF.DatamodelEnum[],
                guardShapesImport,
                importStyle,
                writeStrategy,
                dropGuard,
              })
            : generateRouterFunction({
                model: model as DMMF.Model,
                enums: options.dmmf.datamodel.enums as DMMF.DatamodelEnum[],
                guardShapesImport,
                importStyle,
                writeStrategy,
                findManyPaginatedMode,
                dropGuard,
              })

      await writeFileSafely({
        content: routerContent,
        options,
        model: model as DMMF.Model,
        operation: 'Router',
      })

      await writeFileSafely({
        content: generateScalarUIHandler({
          model: model as DMMF.Model,
          enums: options.dmmf.datamodel.enums as DMMF.DatamodelEnum[],
          target,
          importStyle,
          writeStrategy,
        }),
        options,
        model: model as DMMF.Model,
        operation: 'Docs',
      })

      if (target === 'express') {
        await writeFileSafely({
          content: generateRelationMeta({
            model: model as DMMF.Model,
            allModels,
            importStyle,
          }),
          options,
          model: model as DMMF.Model,
          operation: 'Relations',
        })
      }
    }

    if (target === 'express') {
      await writeFileSafely({
        content: generateRelationModelsIndex({ modelNames, importStyle }),
        options,
        operation: 'relationModelsIndex',
      })
    }

    await writeFileSafely({
      content: generateUnifiedDocs(modelNames, target, importStyle),
      options,
      operation: 'combinedDocs',
    })

    await writeFileSafely({
      content: generateQueryBuilderHelper(options),
      options,
      operation: 'queryBuilder',
    })

    console.log('\n═══ Generation Complete ═══')
    console.log(`✓ ${modelNames.length} models (${target})`)
    console.log('')
  },
})
