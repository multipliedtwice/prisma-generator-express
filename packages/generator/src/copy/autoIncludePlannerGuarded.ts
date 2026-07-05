import { isPlainObject } from './misc'
import type {
  ModelRelationField,
  ModelRelationMap,
} from './autoIncludePlanner'

export type GuardedAutoIncludeStage = {
  relationPath: string
  parentPath: string
  relationName: string
  relationField: ModelRelationField
  stageArgs: Record<string, unknown>
  stageShape: Record<string, unknown>
  depth: number
}

export type GuardedAutoIncludePlan = {
  rootArgs: Record<string, unknown>
  rootShape: Record<string, unknown>
  stages: GuardedAutoIncludeStage[]
  internalFieldPaths: string[]
  unsupportedReason?: string
}

export type GuardedAutoIncludePlannerInput = {
  rootModelName: string
  models: Record<string, ModelRelationMap>
  effectiveReadBody: Record<string, unknown>
  shape: Record<string, unknown>
  maxDepth?: number
  maxStages?: number
}

export const DEFAULT_GUARDED_MAX_DEPTH = 3
export const DEFAULT_GUARDED_MAX_STAGES = 20

const ALLOWED_TO_ONE_STAGE_ARGS = new Set(['select', 'include', 'omit'])
const ALLOWED_TO_MANY_STAGE_ARGS = new Set([
  'select', 'include', 'omit', 'where', 'orderBy', 'take', 'skip', 'cursor', 'distinct',
])

function containsCountProjection(value: unknown): boolean {
  if (!isPlainObject(value)) return false
  if ('_count' in value) return true
  for (const child of Object.values(value)) {
    if (containsCountProjection(child)) return true
  }
  return false
}

function projectionHasCount(node: Record<string, unknown>): boolean {
  return containsCountProjection(node.select) || containsCountProjection(node.include)
}

function rootHasRelationRefInFilter(
  args: Record<string, unknown>,
  model: ModelRelationMap,
): boolean {
  const walkWhere = (obj: unknown): boolean => {
    if (!isPlainObject(obj)) return false
    for (const key of Object.keys(obj)) {
      if (model.relations[key]) return true
      if (key === 'AND' || key === 'OR' || key === 'NOT') {
        const sub = obj[key]
        if (Array.isArray(sub)) {
          for (const item of sub) if (walkWhere(item)) return true
        } else if (walkWhere(sub)) {
          return true
        }
      }
    }
    return false
  }

  const orderByHas = (v: unknown): boolean => {
    const list = Array.isArray(v) ? v : [v]
    for (const ob of list) {
      if (!isPlainObject(ob)) continue
      for (const key of Object.keys(ob)) if (model.relations[key]) return true
    }
    return false
  }

  if (walkWhere(args.where)) return true
  if (args.orderBy && orderByHas(args.orderBy)) return true
  if (isPlainObject(args.cursor)) {
    for (const key of Object.keys(args.cursor)) {
      if (model.relations[key]) return true
    }
  }
  return false
}

function stageHasBlockedRelationRef(
  args: Record<string, unknown>,
  model: ModelRelationMap,
): boolean {
  const orderByHas = (v: unknown): boolean => {
    const list = Array.isArray(v) ? v : [v]
    for (const ob of list) {
      if (!isPlainObject(ob)) continue
      for (const key of Object.keys(ob)) if (model.relations[key]) return true
    }
    return false
  }

  if (args.orderBy && orderByHas(args.orderBy)) return true
  if (isPlainObject(args.cursor)) {
    for (const key of Object.keys(args.cursor)) {
      if (model.relations[key]) return true
    }
  }
  return false
}

function whereMentionsField(where: unknown, fieldName: string): boolean {
  if (!isPlainObject(where)) return false
  for (const key of Object.keys(where)) {
    if (key === fieldName) return true
    if (key === 'AND' || key === 'OR' || key === 'NOT') {
      const sub = where[key]
      if (Array.isArray(sub)) {
        for (const item of sub) if (whereMentionsField(item, fieldName)) return true
      } else if (whereMentionsField(sub, fieldName)) {
        return true
      }
    }
  }
  return false
}

function rejectIncludeOrOmit(node: Record<string, unknown>, label: string): string | null {
  if (isPlainObject(node.include)) {
    return label + ' uses include (guarded MVP supports select only)'
  }
  if (isPlainObject(node.omit)) {
    return label + ' uses omit (guarded MVP supports select only)'
  }
  return null
}

type WalkContext = {
  models: Record<string, ModelRelationMap>
  stages: GuardedAutoIncludeStage[]
  internalFieldPaths: string[]
  maxDepth: number
  maxStages: number
}

type WalkResult = {
  unsupportedReason?: string
  bodyProjectionAfterStrip?: Record<string, unknown>
  shapeProjectionAfterStrip?: Record<string, unknown>
}

function isRejectableWhere(value: unknown): boolean {
  return value !== undefined && !isPlainObject(value)
}

function walkRoot(
  ctx: WalkContext,
  modelName: string,
  parentBody: Record<string, unknown>,
  parentShape: Record<string, unknown>,
): WalkResult {
  if (ctx.stages.length >= ctx.maxStages) {
    return { unsupportedReason: 'stages reached maxStages=' + ctx.maxStages }
  }

  const model = ctx.models[modelName]
  if (!model) {
    return { unsupportedReason: 'model ' + modelName + ' not in relation metadata' }
  }

  const bodyIncludeOmit = rejectIncludeOrOmit(parentBody, 'root body')
  if (bodyIncludeOmit) return { unsupportedReason: bodyIncludeOmit }
  const shapeIncludeOmit = rejectIncludeOrOmit(parentShape, 'root shape')
  if (shapeIncludeOmit) return { unsupportedReason: shapeIncludeOmit }

  if (projectionHasCount(parentBody)) {
    return { unsupportedReason: '_count in root body not supported in guarded MVP' }
  }
  if (projectionHasCount(parentShape)) {
    return { unsupportedReason: '_count in root shape not supported in guarded MVP' }
  }

  if (isRejectableWhere(parentBody.where)) {
    return { unsupportedReason: 'root body where must be a plain object' }
  }
  if (isRejectableWhere(parentShape.where)) {
    return { unsupportedReason: 'root shape where must be a plain object' }
  }

  if (rootHasRelationRefInFilter(parentBody, model)) {
    return { unsupportedReason: 'root body where/orderBy/cursor relation ref not supported' }
  }
  if (rootHasRelationRefInFilter(parentShape, model)) {
    return { unsupportedReason: 'root shape where/orderBy/cursor relation ref not supported' }
  }

  const bodySelect = parentBody.select
  const shapeSelect = parentShape.select

  const bodyProjection = isPlainObject(bodySelect) ? bodySelect : null
  const shapeProjection = isPlainObject(shapeSelect) ? shapeSelect : null

  if (!bodyProjection || !shapeProjection) {
    return {}
  }

  const updatedBodyProjection: Record<string, unknown> = {}
  const updatedShapeProjection: Record<string, unknown> = {}

  const relationBranches: Array<{
    name: string
    bodyValue: unknown
    shapeValue: unknown
  }> = []

  for (const [key, value] of Object.entries(bodyProjection)) {
    if (model.relations[key]) {
      if (value === false || value === null || value === undefined) {
        updatedBodyProjection[key] = value
        if (key in shapeProjection) {
          updatedShapeProjection[key] = shapeProjection[key]
        }
        continue
      }
      const shapeBranch = shapeProjection[key]
      if (shapeBranch === undefined) {
        return {
          unsupportedReason: 'body projects relation "' + key + '" not present in guard shape at root',
        }
      }
      relationBranches.push({ name: key, bodyValue: value, shapeValue: shapeBranch })
    } else {
      updatedBodyProjection[key] = value
      if (key in shapeProjection) {
        updatedShapeProjection[key] = shapeProjection[key]
      }
    }
  }

  for (const branch of relationBranches) {
    if (ctx.stages.length >= ctx.maxStages) {
      return { unsupportedReason: 'stages reached maxStages=' + ctx.maxStages }
    }

    const relation = model.relations[branch.name]

    if (relation.direction === 'implicitM2M') {
      return { unsupportedReason: 'implicit many-to-many not supported in guarded MVP' }
    }
    if (relation.parentLinkFields.length === 0 || relation.childLinkFields.length === 0) {
      return { unsupportedReason: 'ambiguous relation metadata for ' + relation.name }
    }
    if (relation.parentLinkFields.length !== relation.childLinkFields.length) {
      return { unsupportedReason: 'mismatched link field counts for ' + relation.name }
    }
    if (relation.parentLinkFields.length !== 1) {
      return {
        unsupportedReason: 'composite link fields not supported for guarded stage ' + relation.name,
      }
    }
    if (!ctx.models[relation.type]) {
      return {
        unsupportedReason: 'target model ' + relation.type + ' not in relation metadata for ' + branch.name,
      }
    }

    if (branch.bodyValue !== true && !isPlainObject(branch.bodyValue)) {
      return { unsupportedReason: 'invalid relation projection body for ' + branch.name }
    }
    if (branch.shapeValue !== true && !isPlainObject(branch.shapeValue)) {
      return { unsupportedReason: 'invalid relation projection shape for ' + branch.name }
    }

    const parentKey = relation.parentLinkFields[0]
    const childKey = relation.childLinkFields[0]

    if (updatedBodyProjection[parentKey] !== true) {
      updatedBodyProjection[parentKey] = true
      ctx.internalFieldPaths.push(parentKey)
    }
    if (updatedShapeProjection[parentKey] !== true) {
      updatedShapeProjection[parentKey] = true
    }

    const relationBodyArgs: Record<string, unknown> = branch.bodyValue === true ? {} : branch.bodyValue
    const relationShapeArgs: Record<string, unknown> = branch.shapeValue === true ? {} : branch.shapeValue

    const allowedArgs = relation.isList ? ALLOWED_TO_MANY_STAGE_ARGS : ALLOWED_TO_ONE_STAGE_ARGS
    for (const key of Object.keys(relationBodyArgs)) {
      if (!allowedArgs.has(key)) {
        return {
          unsupportedReason: 'unsupported body arg "' + key + '" for ' +
            (relation.isList ? 'to-many' : 'to-one') + ' relation ' + relation.name,
        }
      }
    }
    for (const key of Object.keys(relationShapeArgs)) {
      if (!allowedArgs.has(key)) {
        return {
          unsupportedReason: 'unsupported shape arg "' + key + '" for ' +
            (relation.isList ? 'to-many' : 'to-one') + ' relation ' + relation.name,
        }
      }
    }

    if (isPlainObject(relationBodyArgs.include)) {
      return { unsupportedReason: 'stage body uses include for ' + relation.name + ' (guarded MVP supports select only)' }
    }
    if (isPlainObject(relationBodyArgs.omit)) {
      return { unsupportedReason: 'stage body uses omit for ' + relation.name + ' (guarded MVP supports select only)' }
    }
    if (isPlainObject(relationShapeArgs.include)) {
      return { unsupportedReason: 'stage shape uses include for ' + relation.name + ' (guarded MVP supports select only)' }
    }
    if (isPlainObject(relationShapeArgs.omit)) {
      return { unsupportedReason: 'stage shape uses omit for ' + relation.name + ' (guarded MVP supports select only)' }
    }

    if (projectionHasCount(relationBodyArgs)) {
      return { unsupportedReason: '_count in stage body for ' + relation.name + ' not supported in guarded MVP' }
    }
    if (projectionHasCount(relationShapeArgs)) {
      return { unsupportedReason: '_count in stage shape for ' + relation.name + ' not supported in guarded MVP' }
    }

    if (isRejectableWhere(relationBodyArgs.where)) {
      return { unsupportedReason: 'stage body where must be a plain object for ' + relation.name }
    }
    if (isRejectableWhere(relationShapeArgs.where)) {
      return { unsupportedReason: 'stage shape where must be a plain object for ' + relation.name }
    }

    if (stageHasBlockedRelationRef(relationBodyArgs, ctx.models[relation.type])) {
      return { unsupportedReason: 'stage body orderBy/cursor relation ref not supported for ' + relation.name }
    }
    if (stageHasBlockedRelationRef(relationShapeArgs, ctx.models[relation.type])) {
      return { unsupportedReason: 'stage shape orderBy/cursor relation ref not supported for ' + relation.name }
    }

    if (whereMentionsField(relationBodyArgs.where, childKey)) {
      return {
        unsupportedReason: 'FK collision: stage body where for ' + relation.name +
          ' already mentions child link field "' + childKey + '"',
      }
    }
    if (whereMentionsField(relationShapeArgs.where, childKey)) {
      return {
        unsupportedReason: 'FK collision: stage shape where for ' + relation.name +
          ' already mentions child link field "' + childKey + '"',
      }
    }

    const stageArgs: Record<string, unknown> = { ...relationBodyArgs }
    const stageShape: Record<string, unknown> = { ...relationShapeArgs }

    injectChildFkIntoStageProjection(
      stageArgs,
      stageShape,
      childKey,
      branch.name,
      ctx.internalFieldPaths,
    )

    injectChildFkPermissionIntoStageShape(stageShape, childKey)

    ctx.stages.push({
      relationPath: branch.name,
      parentPath: '',
      relationName: branch.name,
      relationField: relation,
      stageArgs,
      stageShape,
      depth: 1,
    })
  }

  return {
    bodyProjectionAfterStrip: updatedBodyProjection,
    shapeProjectionAfterStrip: updatedShapeProjection,
  }
}

function injectChildFkIntoStageProjection(
  stageArgs: Record<string, unknown>,
  stageShape: Record<string, unknown>,
  childKey: string,
  relationPath: string,
  internalFieldPaths: string[],
): void {
  const bodySelect = stageArgs.select
  const shapeSelect = stageShape.select

  if (isPlainObject(bodySelect)) {
    if ((bodySelect as Record<string, unknown>)[childKey] !== true) {
      const next: Record<string, unknown> = { ...bodySelect, [childKey]: true }
      stageArgs.select = next
      internalFieldPaths.push(relationPath + '.' + childKey)
    }
  }

  if (isPlainObject(shapeSelect)) {
    if ((shapeSelect as Record<string, unknown>)[childKey] !== true) {
      const next: Record<string, unknown> = { ...shapeSelect, [childKey]: true }
      stageShape.select = next
    }
  }
}

function injectChildFkPermissionIntoStageShape(
  stageShape: Record<string, unknown>,
  childKey: string,
): void {
  const existingWhere = stageShape.where
  const nextWhere: Record<string, unknown> = isPlainObject(existingWhere)
    ? { ...existingWhere }
    : {}
  nextWhere[childKey] = { in: true }
  stageShape.where = nextWhere
}

export function planGuardedAutoInclude(
  input: GuardedAutoIncludePlannerInput,
): GuardedAutoIncludePlan {
  const maxDepth = input.maxDepth ?? DEFAULT_GUARDED_MAX_DEPTH
  const maxStages = input.maxStages ?? DEFAULT_GUARDED_MAX_STAGES

  const ctx: WalkContext = {
    models: input.models,
    stages: [],
    internalFieldPaths: [],
    maxDepth,
    maxStages,
  }

  const result = walkRoot(
    ctx,
    input.rootModelName,
    input.effectiveReadBody,
    input.shape,
  )

  if (result.unsupportedReason) {
    return {
      rootArgs: input.effectiveReadBody,
      rootShape: input.shape,
      stages: [],
      internalFieldPaths: [],
      unsupportedReason: 'guarded auto-progressive fallback: ' + result.unsupportedReason,
    }
  }

  const rootArgs: Record<string, unknown> = { ...input.effectiveReadBody }
  const rootShape: Record<string, unknown> = { ...input.shape }

  if (result.bodyProjectionAfterStrip) {
    rootArgs.select = result.bodyProjectionAfterStrip
    delete rootArgs.include
    delete rootArgs.omit
  }

  if (result.shapeProjectionAfterStrip) {
    rootShape.select = result.shapeProjectionAfterStrip
    delete rootShape.include
    delete rootShape.omit
  }

  return {
    rootArgs,
    rootShape,
    stages: ctx.stages,
    internalFieldPaths: ctx.internalFieldPaths,
  }
}