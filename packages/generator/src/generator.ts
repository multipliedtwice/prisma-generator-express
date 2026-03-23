import { generatorHandler, GeneratorOptions } from '@prisma/generator-helper'
import { logger } from '@prisma/sdk'
import { GENERATOR_NAME } from './constants'
import { writeFileSafely } from './utils/writeFileSafely'
import { generateImportPrismaStatement } from './helpers/generateImportPrismaStatement'
import { generateRouterFunction } from './helpers/generateRouteFile'
import { generateOperationFunction, OPERATION_CONFIGS } from './helpers/generateOperation'
import { copyFiles } from './utils/copyFiles'

const { version } = require('../package.json')

generatorHandler({
  onManifest() {
    logger.info(`${GENERATOR_NAME}:Registered`)
    return {
      version,
      defaultOutput: '../generated',
      prettyName: GENERATOR_NAME,
    }
  },
  onGenerate: async (options: GeneratorOptions) => {
    const prismaImportStatement = generateImportPrismaStatement(options)

    for await (const model of options.dmmf.datamodel.models) {
      if (
        model.documentation &&
        model.documentation.includes('generator off')
      ) {
        logger.info(
          `Skipping generation for model ${model.name} as it is marked with 'generator off'.`,
        )
        continue
      }

      for (const cfg of OPERATION_CONFIGS) {
        await writeFileSafely({
          content: generateOperationFunction(cfg, model, prismaImportStatement),
          options,
          model,
          operation: cfg.operation,
        })
      }

      await writeFileSafely({
        content: generateRouterFunction({ model }),
        options,
        model,
        operation: 'index',
      })
    }

    await copyFiles(options)
  },
})