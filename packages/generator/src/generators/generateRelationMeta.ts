import { DMMF } from '@prisma/generator-helper'
import { ImportStyle } from '../utils/resolveImportStyle'
import { importExt } from '../utils/importExt'

type RelationDirection = 'parentOwnsFk' | 'childOwnsFk' | 'implicitM2M'

type RelationFieldMeta = {
  name: string
  type: string
  isList: boolean
  isRequired: boolean
  direction: RelationDirection
  parentLinkFields: string[]
  childLinkFields: string[]
}

type ModelMeta = {
  name: string
  delegateKey: string
  scalarFields: string[]
  relations: Record<string, RelationFieldMeta>
}

function findOppositeField(
  models: ReadonlyArray<DMMF.Model>,
  targetModelName: string,
  relationName: string | undefined,
  selfModelName: string,
  selfFieldName: string,
): DMMF.Field | null {
  if (!relationName) return null
  const target = models.find((m) => m.name === targetModelName)
  if (!target) return null
  const isSelfRelation = targetModelName === selfModelName
  return target.fields.find(
    (f) =>
      f.kind === 'object' &&
      f.relationName === relationName &&
      f.type === selfModelName &&
      !(isSelfRelation && f.name === selfFieldName),
  ) || null
}

function computeRelation(
  field: DMMF.Field,
  selfModelName: string,
  models: ReadonlyArray<DMMF.Model>,
): RelationFieldMeta {
  const selfFrom = (field.relationFromFields ?? []) as string[]
  const selfTo = (field.relationToFields ?? []) as string[]

  if (selfFrom.length > 0) {
    return {
      name: field.name,
      type: field.type,
      isList: field.isList,
      isRequired: field.isRequired,
      direction: 'parentOwnsFk',
      parentLinkFields: selfFrom,
      childLinkFields: selfTo,
    }
  }

  const opposite = findOppositeField(models, field.type, field.relationName, selfModelName, field.name)
  if (opposite) {
    const oppFrom = (opposite.relationFromFields ?? []) as string[]
    const oppTo = (opposite.relationToFields ?? []) as string[]
    if (oppFrom.length > 0) {
      return {
        name: field.name,
        type: field.type,
        isList: field.isList,
        isRequired: field.isRequired,
        direction: 'childOwnsFk',
        parentLinkFields: oppTo,
        childLinkFields: oppFrom,
      }
    }
  }

  return {
    name: field.name,
    type: field.type,
    isList: field.isList,
    isRequired: field.isRequired,
    direction: 'implicitM2M',
    parentLinkFields: [],
    childLinkFields: [],
  }
}

function buildModelMeta(
  model: DMMF.Model,
  models: ReadonlyArray<DMMF.Model>,
): ModelMeta {
  const scalarFields: string[] = []
  const relations: Record<string, RelationFieldMeta> = {}

  for (const field of model.fields) {
    if (field.kind === 'object') {
      relations[field.name] = computeRelation(field, model.name, models)
    } else if (field.kind === 'scalar' || field.kind === 'enum') {
      scalarFields.push(field.name)
    }
  }

  return {
    name: model.name,
    delegateKey: model.name.charAt(0).toLowerCase() + model.name.slice(1),
    scalarFields,
    relations,
  }
}

export interface GenerateRelationMetaOptions {
  model: DMMF.Model
  allModels: ReadonlyArray<DMMF.Model>
  importStyle: ImportStyle
}

export function generateRelationMeta(options: GenerateRelationMetaOptions): string {
  const ext = importExt(options.importStyle)
  const meta = buildModelMeta(options.model, options.allModels)
  return `import type { ModelRelationMap } from '../autoIncludePlanner${ext}'

export const ${options.model.name}Relations: ModelRelationMap = ${JSON.stringify(meta, null, 2)}
`
}

export interface GenerateRelationModelsIndexOptions {
  modelNames: ReadonlyArray<string>
  importStyle: ImportStyle
}

export function generateRelationModelsIndex(options: GenerateRelationModelsIndexOptions): string {
  const ext = importExt(options.importStyle)
  const imports = options.modelNames
    .map((n) => `import { ${n}Relations } from './${n}/${n}Relations${ext}'`)
    .join('\n')
  const entries = options.modelNames
    .map((n) => `  ${n}: ${n}Relations,`)
    .join('\n')
  return `import type { ModelRelationMap } from './autoIncludePlanner${ext}'
${imports}

export const relationModels: Record<string, ModelRelationMap> = {
${entries}
}
`
}