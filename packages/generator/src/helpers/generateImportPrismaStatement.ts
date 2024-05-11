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

  if (!clientGenerator) {
    throw new Error('Prisma client generator not found.')
  }

  const relativeImportPath = path.relative(
    options.generator.output?.value || './generated',
    clientGenerator.output?.value || './generated/types',
  )

  return {
    outputPath: relativeImportPath.split(path.sep).join(path.posix.sep),
  }
}

export function generateImportPrismaStatement(
  generatorOptions: GeneratorOptions,
): string {
  const options = getImportGeneratorOptions(generatorOptions)

  return `import type { Prisma } from '${options.outputPath}';\n\n`
}
