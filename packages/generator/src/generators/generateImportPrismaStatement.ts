import { GeneratorOptions } from '@prisma/generator-helper'
import * as fs from 'fs'
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
  return byProvider || null
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

export function getRelativeClientPath(
  generatorOptions: GeneratorOptions,
  modelName: string,
): string {
  const clientGenerator = findClientGenerator(generatorOptions)

  if (!clientGenerator || !clientGenerator.output?.value) {
    throw new Error(
      'Prisma client generator not found. Ensure a generator block exists with name "client" or provider one of: prisma-client-js, @prisma/client, prisma-client.',
    )
  }

  const outputValue = generatorOptions.generator.output?.value
  if (!outputValue) {
    throw new Error('Generator output path not defined.')
  }

  const routerDirPath = path.join(outputValue, modelName)

  return getRelativeImportPath(routerDirPath, clientGenerator.output.value)
}

function findGuardGenerator(options: GeneratorOptions) {
  const byProvider = options.otherGenerators.find(
    (gen) =>
      !!gen.provider?.value && gen.provider.value.includes('prisma-guard'),
  )
  if (byProvider) return byProvider

  const byConfig = options.otherGenerators.find(
    (gen) =>
      !!gen.config &&
      ('typedGuardShapes' in gen.config ||
        'onInvalidZod' in gen.config ||
        'findUniqueMode' in gen.config),
  )
  return byConfig || null
}

export function getGuardShapesImport(
  options: GeneratorOptions,
  modelName: string,
): string | null {
  const guard = findGuardGenerator(options)
  if (!guard || !guard.output?.value) return null

  if (guard.config?.typedGuardShapes === 'false') return null

  const outputValue = options.generator.output?.value
  if (!outputValue) return null

  const fromDir = path.join(outputValue, modelName)
  const shapesPath = path.join(guard.output.value, 'shapes')
  return getRelativeImportPath(fromDir, shapesPath)
}
