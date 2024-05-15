import { GeneratorOptions } from '@prisma/generator-helper'
import path from 'path'

interface ImportPrismaStatementOptions {
  outputPath: string
}

function getImportGeneratorOptions(
  options: GeneratorOptions,
): ImportPrismaStatementOptions {
  const clientGenerator = options.otherGenerators.find(
    (gen) => gen.name === 'client',
  )

  if (!clientGenerator || !clientGenerator.output?.value) {
    throw new Error('Prisma client generator not found.')
  }

  const modelDirPath = path.join(
    options.generator.output?.value!,
    'modelFolder', // workaround for saving with /modelName/operation structure
  )
  const clientOutputPath = clientGenerator.output.value

  const relativeImportPath = path.relative(modelDirPath, clientOutputPath)

  return {
    outputPath: relativeImportPath.split(path.sep).join(path.posix.sep),
  }
}

export function generateImportPrismaStatement(
  generatorOptions: GeneratorOptions,
): string {
  const options = getImportGeneratorOptions(generatorOptions)
  // console.log('options.outputPath :>> ', options.outputPath)
  return `import type { Prisma } from '${options.outputPath}';\nimport type { PrismaClient } from '${options.outputPath}';\n`
}
