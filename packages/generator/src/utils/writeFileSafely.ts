import fs from 'fs/promises'
import path from 'path'
import { formatFile } from './formatFile'
import { DMMF, GeneratorOptions } from '@prisma/generator-helper'

export const writeFileSafely = async ({
  model,
  operation,
  options,
  content,
}: {
  model: DMMF.Model
  operation: string
  options: GeneratorOptions
  content: string
}) => {
  const fileName = operation === 'index' ? 'index' : `${model.name}${operation}`
  const filePath = path.join(
    options.generator.output?.value!,
    `${model.name}/${fileName}.ts`,
  )
  console.log('filePath :>> ', filePath)
  await fs.mkdir(path.dirname(filePath), {
    recursive: true,
  })

  await fs.writeFile(filePath, await formatFile(content))
}
