import { generatorHandler, GeneratorOptions } from '@prisma/generator-helper'
import { logger } from '@prisma/sdk'
import { GENERATOR_NAME } from './constants'
import { writeFileSafely } from './utils/writeFileSafely'
import { generateFindUniqueFunction } from './helpers/generateFindUnique'
import { generateImportPrismaStatement } from './helpers/generateImportPrismaStatement'
import { generateFindManyFunction } from './helpers/generateFindMany'
import { generateFindFirstFunction } from './helpers/generateFindFirst'
import { generateCreateFunction } from './helpers/generateCreate'
import { generateRouterFunction } from './helpers/generateRouteFile'
import { generateCreateManyFunction } from './helpers/generateCreateMany'
import { generateUpdateFunction } from './helpers/generateUpdate'
import { generateUpdateManyFunction } from './helpers/generateUpdateMany'
import { generateUpsertFunction } from './helpers/generateUpsert'
import { generateDeleteFunction } from './helpers/generateDelete'
import { generateDeleteManyFunction } from './helpers/generateDeleteMany'
import { generateAggregateFunction } from './helpers/generateAggregate'
import { generateCountFunction } from './helpers/generateCount'
import { generateGroupByFunction } from './helpers/generateGroupBy'

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
      await writeFileSafely({
        content: generateFindUniqueFunction({
          model,
          prismaImportStatement,
        }),
        options,
        model,
        operation: 'FindUnique',
      })

      await writeFileSafely({
        content: generateFindFirstFunction({
          model,
          prismaImportStatement,
        }),
        options,
        model,
        operation: 'FindFirst',
      })

      await writeFileSafely({
        content: generateFindManyFunction({
          model,
          prismaImportStatement,
        }),
        options,
        model,
        operation: 'FindMany',
      })

      await writeFileSafely({
        content: generateCreateFunction({
          model,
          prismaImportStatement,
        }),
        options,
        model,
        operation: 'Create',
      })

      await writeFileSafely({
        content: generateCreateManyFunction({
          model,
          prismaImportStatement,
        }),
        options,
        model,
        operation: 'CreateMany',
      })

      await writeFileSafely({
        content: generateUpdateFunction({
          model,
          prismaImportStatement,
        }),
        options,
        model,
        operation: 'Update',
      })

      await writeFileSafely({
        content: generateUpdateManyFunction({
          model,
          prismaImportStatement,
        }),
        options,
        model,
        operation: 'UpdateMany',
      })

      await writeFileSafely({
        content: generateUpsertFunction({
          model,
          prismaImportStatement,
        }),
        options,
        model,
        operation: 'Upsert',
      })

      await writeFileSafely({
        content: generateDeleteFunction({
          model,
          prismaImportStatement,
        }),
        options,
        model,
        operation: 'Delete',
      })

      await writeFileSafely({
        content: generateDeleteManyFunction({
          model,
          prismaImportStatement,
        }),
        options,
        model,
        operation: 'DeleteMany',
      })

      await writeFileSafely({
        content: generateAggregateFunction({
          model,
          prismaImportStatement,
        }),
        options,
        model,
        operation: 'Aggregate',
      })

      await writeFileSafely({
        content: generateCountFunction({
          model,
          prismaImportStatement,
        }),
        options,
        model,
        operation: 'Count',
      })

      await writeFileSafely({
        content: generateGroupByFunction({
          model,
          prismaImportStatement,
        }),
        options,
        model,
        operation: 'GroupBy',
      })

      await writeFileSafely({
        content: generateRouterFunction({ model }),
        options,
        model,
        operation: 'index',
      })
    }
  },
})
