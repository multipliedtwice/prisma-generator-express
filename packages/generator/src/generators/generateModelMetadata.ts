import { DMMF } from '@prisma/generator-helper'
import { ImportStyle } from '../utils/resolveImportStyle'
import { importExt } from '../utils/importExt'

function exampleValueForType(fieldType: string): unknown {
  switch (fieldType) {
    case 'String': return 'example'
    case 'Int': return 1
    case 'BigInt': return '1'
    case 'Float': return 1.0
    case 'Decimal': return '1.0'
    case 'Boolean': return true
    case 'DateTime': return '2025-01-01T00:00:00.000Z'
    case 'Json': return {}
    case 'Bytes': return 'base64data'
    default: return 'example'
  }
}

export interface GenerateModelMetadataOptions {
  model: DMMF.Model
  enums: DMMF.DatamodelEnum[]
  importStyle: ImportStyle
}

export function generateModelMetadata(options: GenerateModelMetadataOptions): string {
  const ext = importExt(options.importStyle)
  const { model, enums } = options
  const modelName = model.name

  const fieldsMeta = model.fields.map((f: any) => ({
    name: f.name,
    kind: f.kind,
    type: f.type,
    isList: f.isList,
    isRequired: f.isRequired,
    hasDefaultValue: f.hasDefaultValue,
    isUpdatedAt: Boolean(f.isUpdatedAt),
    documentation: f.documentation ?? null,
    isId: Boolean(f.isId),
    isUnique: Boolean(f.isUnique),
    relationFromFields: f.relationFromFields,
  }))

  const referencedEnumTypes = new Set(
    model.fields.filter((f: any) => f.kind === 'enum').map((f: any) => f.type),
  )

  const enumsMeta = enums
    .filter((e) => referencedEnumTypes.has(e.name))
    .map((e) => ({
      name: e.name,
      values: e.values.map((v) => ({ name: v.name })),
    }))

  const exampleValues: Record<string, unknown> = {}
  for (const f of model.fields as any[]) {
    if (f.isId || f.isUnique || f.kind === 'scalar' || f.kind === 'enum') {
      if (f.kind === 'enum') {
        const enumDef = enums.find((e) => e.name === f.type)
        exampleValues[f.name] = enumDef?.values[0]?.name || 'VALUE'
      } else {
        exampleValues[f.name] = exampleValueForType(f.type)
      }
    }
  }

  const compoundId =
    model.primaryKey && model.primaryKey.fields.length > 1
      ? { fields: model.primaryKey.fields }
      : null

  const compoundUniques = ((model as any).uniqueIndexes || [])
    .filter((idx: any) => idx.fields && idx.fields.length > 1)
    .map((idx: any) => ({
      name: idx.name || idx.fields.join('_'),
      fields: idx.fields,
    }))

  return `import type { FieldMeta, EnumMeta } from '../docsRenderer${ext}'

export const MODEL_FIELDS: FieldMeta[] = ${JSON.stringify(fieldsMeta, null, 2)}

export const MODEL_ENUMS: EnumMeta[] = ${JSON.stringify(enumsMeta, null, 2)}

export const COMPOUND_ID: { fields: string[] } | null = ${JSON.stringify(compoundId)}

export const COMPOUND_UNIQUES: { name: string; fields: string[] }[] = ${JSON.stringify(compoundUniques)}

export const EXAMPLE_VALUES: Record<string, unknown> = ${JSON.stringify(exampleValues, null, 2)}
`
}