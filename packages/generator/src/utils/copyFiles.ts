import { GeneratorOptions } from '@prisma/generator-helper'
import fs from 'fs/promises'
import path from 'path'

export const copyFiles = async (
  options: GeneratorOptions,
  destPath?: string,
) => {
  const sourceDir = path.join(__dirname.replace('dist', 'src'), '..', 'copy')
  const destinationDir = destPath || options.generator.output?.value!

  const files = await fs.readdir(sourceDir)

  for (const file of files) {
    if (file.endsWith('.spec.ts')) {
      continue
    }

    const sourceFile = path.join(sourceDir, file)
    const destinationFile = path.join(destinationDir, file)

    await fs.mkdir(path.dirname(destinationFile), { recursive: true })
    await fs.copyFile(sourceFile, destinationFile)
  }

  console.log(`Files copied from ${sourceDir} to ${destinationDir}`)
}
