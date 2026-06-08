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
import { GENERATOR_NAME, Target } from './constants'

const GENERATOR_OFF_RE = /\bgenerator off\b/

function getTarget(options: GeneratorOptions): Target {
  const raw = String(
    (options.generator.config as Record<string, unknown>).target ?? 'express',
  ).toLowerCase()
  if (raw === 'express' || raw === 'fastify' || raw === 'hono') return raw
  throw new Error(
    `Invalid target "${raw}". Expected "express", "fastify", or "hono".`,
  )
}

function validateClientGeneratorPresent(options: GeneratorOptions): void {
  getRelativeClientPath(options, options.dmmf.datamodel.models[0]?.name ?? 'Model')
}

generatorHandler({
  onManifest() {
    return {
      version: require('../package.json').version,
      defaultOutput: '../generated/express',
      prettyName: GENERATOR_NAME,
    }
  },

  async onGenerate(options: GeneratorOptions) {
    const target = getTarget(options)
    const hasExplicitOutput =
      !!options.generator.output?.fromEnvVar ||
      (options.generator.config as Record<string, unknown>).output !== undefined

    if (!hasExplicitOutput) {
      const schemaDir = path.dirname(options.schemaPath)
      const outputPath = path.join(schemaDir, 'generated', target)
      options.generator.output = { value: outputPath, fromEnvVar: null }
    }

    const importStyle = resolveImportStyle(options)

    console.log(`\n═══ Prisma Generator (${target.toUpperCase()}) ═══`)
    console.log(`  Target: ${target}`)
    console.log(`  Output: ${options.generator.output?.value}`)
    console.log(`  Import style: ${importStyle}`)

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
      if (
        model.documentation &&
        GENERATOR_OFF_RE.test(model.documentation)
      ) {
        console.log(`  Skipping: ${model.name} (generator off)`)
        continue
      }
      modelNames.push(model.name)

      const guardShapesImport = getGuardShapesImport(options, model.name)

      await writeFileSafely({
        content: generateModelCore({ model: model as DMMF.Model, importStyle }),
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
            })
          : target === 'hono'
            ? generateHonoRouterFunction({
                model: model as DMMF.Model,
                enums: options.dmmf.datamodel.enums as DMMF.DatamodelEnum[],
                guardShapesImport,
                importStyle,
              })
            : generateRouterFunction({
                model: model as DMMF.Model,
                enums: options.dmmf.datamodel.enums as DMMF.DatamodelEnum[],
                guardShapesImport,
                importStyle,
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