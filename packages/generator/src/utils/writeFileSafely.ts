import { GeneratorOptions } from '@prisma/generator-helper'
import { DMMF } from '@prisma/generator-helper'
import * as fs from 'fs'
import * as path from 'path'
import prettier from 'prettier'

interface WriteFileOptions {
  content: string
  options: GeneratorOptions
  model?: DMMF.Model
  operation: string
}

let _prettierOptions: prettier.Options | null | undefined

async function getPrettierOptions(): Promise<prettier.Options | null> {
  if (_prettierOptions !== undefined) return _prettierOptions
  _prettierOptions = await prettier.resolveConfig(process.cwd())
  return _prettierOptions
}

export async function writeFileSafely({
  content,
  options,
  model,
  operation,
}: WriteFileOptions): Promise<void> {
  const outputPath = options.generator.output?.value
  if (!outputPath) {
    throw new Error('Output path not defined')
  }

  let filePath: string

  switch (operation) {
    case 'cacheConfig':
      filePath = path.join(outputPath, 'cacheConfig.ts')
      break

    case 'types/inputs':
      filePath = path.join(outputPath, 'types', 'inputs.ts')
      break

    case 'combinedDocs':
      filePath = path.join(outputPath, 'combinedDocs.ts')
      break

    case 'queryBuilder':
      filePath = path.join(outputPath, 'queryBuilder.ts')
      break

    default:
      if (!model) {
        throw new Error(`Model required for operation: ${operation}`)
      }
      filePath = path.join(
        outputPath,
        model.name,
        `${model.name}${operation}.ts`,
      )
  }

  const dirPath = path.dirname(filePath)
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
  }

  let formattedContent: string
  try {
    const resolvedOptions = await getPrettierOptions()
    formattedContent = await prettier.format(content, {
      ...resolvedOptions,
      parser: 'typescript',
    })
  } catch (error) {
    console.warn(
      `⚠️  Prettier formatting failed for ${path.basename(filePath)}, writing unformatted`,
    )
    formattedContent = content
  }

  fs.writeFileSync(filePath, formattedContent)
}
