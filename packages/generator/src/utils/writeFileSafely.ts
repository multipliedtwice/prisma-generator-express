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
  if (!outputPath) throw new Error('Output path not defined')

  let filePath: string
  switch (operation) {
    case 'combinedDocs':
      filePath = path.join(outputPath, 'combinedDocs.ts')
      break
    case 'queryBuilder':
      filePath = path.join(outputPath, 'queryBuilder.ts')
      break
    case 'relationModelsIndex':
      filePath = path.join(outputPath, 'relationModels.ts')
      break
    default:
      if (!model) throw new Error('Model required for operation: ' + operation)
      filePath = path.join(outputPath, model.name, `${model.name}${operation}.ts`)
  }

  const dirPath = path.dirname(filePath)
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true })

  const resolvedOptions = await getPrettierOptions()
  const formattedContent = await prettier.format(content, {
    ...resolvedOptions,
    parser: 'typescript',
  })

  fs.writeFileSync(filePath, formattedContent)
}