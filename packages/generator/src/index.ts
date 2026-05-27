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
import {
  generateOperationRuntime,
  generateModelCore,
} from './generators/generateOperationCore'
import {
  getRelativeClientPath,
  getGuardShapesImport,
} from './generators/generateImportPrismaStatement'
import { writeFileSafely } from './utils/writeFileSafely'
import { copyFiles } from './utils/copyFiles'
import { GENERATOR_NAME, Target } from './constants'

function getTarget(options: GeneratorOptions): Target {
  const raw = String(
    (options.generator.config as Record<string, unknown>).target ?? 'express',
  ).toLowerCase()
  if (raw === 'express' || raw === 'fastify' || raw === 'hono') return raw
  throw new Error(
    `Invalid target "${raw}". Expected "express", "fastify", or "hono".`,
  )
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

    const hasExplicitOutput = !!options.generator.output?.fromEnvVar
      || (options.generator.config as Record<string, unknown>).output !== undefined

    if (!hasExplicitOutput) {
      const schemaDir = path.dirname(options.schemaPath)
      const outputPath = path.join(schemaDir, 'generated', target)
      options.generator.output = { value: outputPath, fromEnvVar: null }
    }

    console.log(`\n═══ Prisma Generator (${target.toUpperCase()}) ═══`)
    console.log(`  Target: ${target}`)
    console.log(`  Output: ${options.generator.output?.value}`)

    await copyFiles(options, target)

    await writeFileSafely({
      content: generateOperationRuntime(),
      options,
      operation: 'operationRuntime',
    })

    const modelNames: string[] = []

    const generateHandler =
      target === 'fastify'
        ? generateFastifyHandler
        : target === 'hono'
          ? generateHonoHandler
          : generateUnifiedHandler

    for (const model of options.dmmf.datamodel.models) {
      if (
        model.documentation &&
        model.documentation.includes('generator off')
      ) {
        console.log(`  Skipping: ${model.name} (generator off)`)
        continue
      }

      modelNames.push(model.name)

      const relativeClientPath = getRelativeClientPath(options, model.name)
      const guardShapesImport = getGuardShapesImport(options, model.name)

      await writeFileSafely({
        content: generateModelCore({ model: model as DMMF.Model }),
        options,
        model: model as DMMF.Model,
        operation: 'Core',
      })

      await writeFileSafely({
        content: generateHandler({
          model: model as DMMF.Model,
        }),
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
            })
          : target === 'hono'
            ? generateHonoRouterFunction({
                model: model as DMMF.Model,
                enums: options.dmmf.datamodel.enums as DMMF.DatamodelEnum[],
                guardShapesImport,
              })
            : generateRouterFunction({
                model: model as DMMF.Model,
                enums: options.dmmf.datamodel.enums as DMMF.DatamodelEnum[],
                relativeClientPath,
                guardShapesImport,
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
        }),
        options,
        model: model as DMMF.Model,
        operation: 'Docs',
      })
    }

    await writeFileSafely({
      content: generateUnifiedDocs(modelNames, target),
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
    console.log(`✓ OpenAPI documentation generated`)
    if (target === 'hono') {
      console.log(`✓ Query builder helper generated (not auto-started for Hono)`)
    } else {
      console.log(`✓ Query builder helper generated`)
    }
    console.log('')
  },
})