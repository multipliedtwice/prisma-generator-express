import { GeneratorOptions } from '@prisma/generator-helper'
import path from 'path'

function findClientGenerator(options: GeneratorOptions) {
  const byName = options.otherGenerators.find((gen) => gen.name === 'client')
  if (byName) return byName

  const byProvider = options.otherGenerators.find(
    (gen) =>
      gen.provider.value === 'prisma-client-js' ||
      gen.provider.value === '@prisma/client' ||
      gen.provider.value === 'prisma-client',
  )
  if (byProvider) return byProvider

  const withOutput = options.otherGenerators.find(
    (gen) =>
      gen.output?.value?.includes('prisma') ||
      gen.output?.value?.includes('client'),
  )
  return withOutput || null
}

function getRelativeImportPath(
  fromDir: string,
  clientOutputPath: string,
): string {
  let relativeImportPath = path.relative(fromDir, clientOutputPath)
  relativeImportPath = relativeImportPath.split(path.sep).join(path.posix.sep)
  if (!relativeImportPath.startsWith('.')) {
    relativeImportPath = './' + relativeImportPath
  }
  return relativeImportPath
}

export function generateImportPrismaStatement(
  generatorOptions: GeneratorOptions,
): string {
  const clientGenerator = findClientGenerator(generatorOptions)

  if (!clientGenerator || !clientGenerator.output?.value) {
    throw new Error(
      'Prisma client generator not found. Ensure a generator with provider "prisma-client-js" exists in your schema.',
    )
  }

  const outputValue = generatorOptions.generator.output?.value
  if (!outputValue) {
    throw new Error('Generator output path not defined.')
  }

  const subDir = path.join(outputValue, '_relative')
  const outputPath = getRelativeImportPath(subDir, clientGenerator.output.value)

  return `import { Prisma, PrismaClient } from '${outputPath}';\n`
}

export function getRelativeClientPath(
  generatorOptions: GeneratorOptions,
  modelName: string,
): string {
  const clientGenerator = findClientGenerator(generatorOptions)

  if (!clientGenerator || !clientGenerator.output?.value) {
    throw new Error(
      'Prisma client generator not found. Ensure a generator with provider "prisma-client-js" exists in your schema.',
    )
  }

  const outputValue = generatorOptions.generator.output?.value
  if (!outputValue) {
    throw new Error('Generator output path not defined.')
  }

  const routerDirPath = path.join(outputValue, modelName)

  return getRelativeImportPath(routerDirPath, clientGenerator.output.value)
}
