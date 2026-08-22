import { ImportStyle } from './resolveImportStyle'

export function importExt(style: ImportStyle): string {
  if (style === 'js') return '.js'
  if (style === 'ts') return '.ts'
  return ''
}
