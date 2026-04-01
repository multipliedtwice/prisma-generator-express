import {
  generatorHandler,
  GeneratorOptions,
  DMMF,
} from '@prisma/generator-helper'
import { generateUnifiedHandler } from './generators/generateUnifiedHandler.js'
import { generateRouterFunction } from './generators/generateRouter.js'
import { generateScalarUIHandler } from './generators/generateUnifiedScalarUI.js'
import { generateUnifiedDocs } from './generators/generateUnifiedDocs.js'
import { generateQueryBuilderHelper } from './generators/generateQueryBuilderHelper.js'
import {
  generateImportPrismaStatement,
  getRelativeClientPath,
} from './generators/generateImportPrismaStatement.js'
import { writeFileSafely } from './utils/writeFileSafely.js'
import { copyFiles } from './utils/copyFiles.js'
import { GENERATOR_NAME } from './constants.js'

generatorHandler({
  onManifest() {
    return {
      version: require('../package.json').version,
      defaultOutput: '../generated',
      prettyName: GENERATOR_NAME,
    }
  },

  async onGenerate(options: GeneratorOptions) {
    const prismaImportStatement = generateImportPrismaStatement(options)

    console.log('\n═══ Prisma Generator Express ═══')

    await copyFiles(options)

    const modelNames: string[] = []

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
        content: generateUnifiedHandler({
          model: model as DMMF.Model,
          prismaImportStatement,
        }),
        options,
        model: model as DMMF.Model,
        operation: 'Handlers',
      })

      await writeFileSafely({
        content: generateRouterFunction({
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
        }),
        options,
        model: model as DMMF.Model,
        operation: 'Docs',
      })
    }

    await writeFileSafely({
      content: generateUnifiedDocs(modelNames),
      options,
      operation: 'combinedDocs',
    })

    await writeFileSafely({
      content: generateQueryBuilderHelper(options),
      options,
      operation: 'queryBuilder',
    })

    console.log('\n═══ Generation Complete ═══')
    console.log(`✓ ${modelNames.length} models`)
    console.log(`✓ OpenAPI documentation generated`)
    console.log(`✓ Query builder helper generated`)
    console.log('')
  },
})