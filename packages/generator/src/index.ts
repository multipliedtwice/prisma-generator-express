import {
  generatorHandler,
  GeneratorOptions,
  DMMF,
} from '@prisma/generator-helper'
import path from 'path'
import { generateUnifiedHandler } from './generators/generateUnifiedHandler.js'
import { generateFastifyHandler } from './generators/generateFastifyHandler.js'
import { generateRouterFunction } from './generators/generateRouter.js'
import { generateFastifyRouterFunction } from './generators/generateRouterFastify.js'
import { generateScalarUIHandler } from './generators/generateUnifiedScalarUI.js'
import { generateUnifiedDocs } from './generators/generateUnifiedDocs.js'
import { generateQueryBuilderHelper } from './generators/generateQueryBuilderHelper.js'
import {
  generateOperationRuntime,
  generateModelCore,
} from './generators/generateOperationCore.js'
import {
  generateImportPrismaStatement,
  getRelativeClientPath,
} from './generators/generateImportPrismaStatement.js'
import { writeFileSafely } from './utils/writeFileSafely.js'
import { copyFiles } from './utils/copyFiles.js'
import { GENERATOR_NAME, Target } from './constants.js'

function getTarget(options: GeneratorOptions): Target {
  const raw = String(
    (options.generator.config as Record<string, unknown>).target ?? 'express',
  ).toLowerCase()
  if (raw === 'express' || raw === 'fastify') return raw
  throw new Error(`Invalid target "${raw}". Expected "express" or "fastify".`)
}

function resolveOutputPath(options: GeneratorOptions, target: Target): string {
  const explicit = options.generator.output?.value

  if (explicit && explicit.length > 0) {
    return explicit
  }

  const schemaDir = path.dirname(options.schemaPath)
  return path.join(schemaDir, 'generated', target)
}

generatorHandler({
  onManifest() {
    return {
      version: require('../package.json').version,
      defaultOutput: '',
      prettyName: GENERATOR_NAME,
    }
  },

  async onGenerate(options: GeneratorOptions) {
    const target = getTarget(options)
    const outputPath = resolveOutputPath(options, target)

    options.generator.output = { value: outputPath, fromEnvVar: null }

    console.log(`\n═══ Prisma Generator (${target.toUpperCase()}) ═══`)
    console.log(`  Target: ${target}`)
    console.log(`  Output: ${outputPath}`)

    await copyFiles(options, target)

    await writeFileSafely({
      content: generateOperationRuntime(),
      options,
      operation: 'operationRuntime',
    })

    const modelNames: string[] = []

    const generateHandler =
      target === 'fastify' ? generateFastifyHandler : generateUnifiedHandler

    const generateRouter =
      target === 'fastify'
        ? generateFastifyRouterFunction
        : generateRouterFunction

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

      await writeFileSafely({
        content: generateRouter({
          model: model as DMMF.Model,
          enums: options.dmmf.datamodel.enums as DMMF.DatamodelEnum[],
          relativeClientPath,
        }),
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
    console.log(`✓ Query builder helper generated`)
    console.log('')
  },
})