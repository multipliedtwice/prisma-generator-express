import { generatorHandler, GeneratorOptions } from '@prisma/generator-helper'
import { logger } from '@prisma/sdk'
import path from 'path'
import { GENERATOR_NAME } from './constants'
import { writeFileSafely } from './utils/writeFileSafely'
import { generateFindUniqueFunction } from './helpers/generateFindUnique'
import { generateImportPrismaStatement } from './helpers/generateImportPrismaStatement'

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

    options.dmmf.datamodel.models.forEach(async (model) => {
      const tsEnum = generateFindUniqueFunction({
        model,
        prismaImportStatement,
      })

      const writeLocation = path.join(
        options.generator.output?.value!,
        `${model.name}FindUnique.ts`,
      )

      await writeFileSafely(writeLocation, tsEnum)
    })
  },
})
