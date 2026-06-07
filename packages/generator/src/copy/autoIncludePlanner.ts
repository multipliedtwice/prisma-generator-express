export type ModelRelationDirection = 'parentOwnsFk' | 'childOwnsFk' | 'implicitM2M'

export type ModelRelationField = {
  name: string
  type: string
  isList: boolean
  isRequired: boolean
  direction: ModelRelationDirection
  parentLinkFields: string[]
  childLinkFields: string[]
}

export type ModelRelationMap = {
  name: string
  delegateKey: string
  scalarFields: string[]
  idFields: string[]
  relations: Record<string, ModelRelationField>
}

export type AutoIncludeStage = {
  relationPath: string
  parentPath: string
  relationName: string
  relationField: ModelRelationField
  stageArgs: Record<string, unknown>
  depth: number
}

export type AutoIncludePlan = {
  rootArgs: Record<string, unknown>
  stages: AutoIncludeStage[]
  internalFieldPaths: string[]
  unsupportedReason?: string
}

export type AutoIncludePlannerInput = {
  rootModelName: string
  models: Record<string, ModelRelationMap>
  args: Record<string, unknown>
  maxDepth?: number
  maxStages?: number
}

export const DEFAULT_AUTO_INCLUDE_MAX_DEPTH = 3
export const DEFAULT_AUTO_INCLUDE_MAX_STAGES = 20

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false
  if (Array.isArray(value)) return false
  return true
}

function hasCountKey(value: unknown): boolean {
  if (!isPlainObject(value)) return false
  return '_count' in value
}

function hasWhereLikeRelationReference(
  args: Record<string, unknown>,
  model: ModelRelationMap,
): boolean {
  const checkObject = (obj: unknown): boolean => {
    if (!isPlainObject(obj)) return false
    for (const key of Object.keys(obj)) {
      if (model.relations[key]) return true
      if (key === 'AND' || key === 'OR' || key === 'NOT') {
        const sub = obj[key]
        if (Array.isArray(sub)) {
          for (const item of sub) if (checkObject(item)) return true
        } else if (checkObject(sub)) {
          return true
        }
      }
    }
    return false
  }

  if (checkObject(args.where)) return true

  if (args.orderBy) {
    const obs = Array.isArray(args.orderBy) ? args.orderBy : [args.orderBy]
    for (const ob of obs) {
      if (!isPlainObject(ob)) continue
      for (const key of Object.keys(ob)) {
        if (model.relations[key]) return true
      }
    }
  }

  if (isPlainObject(args.cursor)) {
    for (const key of Object.keys(args.cursor)) {
      if (model.relations[key]) return true
    }
  }

  return false
}

type WalkContext = {
  models: Record<string, ModelRelationMap>
  stages: AutoIncludeStage[]
  internalFieldPaths: string[]
  maxDepth: number
  maxStages: number
}

type WalkResult = {
  unsupportedReason?: string
  projectionAfterStrip?: Record<string, unknown>
}

function walk(
  ctx: WalkContext,
  modelName: string,
  parentPath: string,
  parentArgs: Record<string, unknown>,
  depth: number,
): WalkResult {
  if (depth > ctx.maxDepth) {
    return { unsupportedReason: 'depth exceeds maxDepth=' + ctx.maxDepth }
  }
  if (ctx.stages.length > ctx.maxStages) {
    return { unsupportedReason: 'stages exceed maxStages=' + ctx.maxStages }
  }

  const model = ctx.models[modelName]
  if (!model) {
    return { unsupportedReason: 'model ' + modelName + ' not in relation metadata' }
  }

  const select = parentArgs.select
  const include = parentArgs.include
  const omit = parentArgs.omit

  if (isPlainObject(select) && isPlainObject(include)) {
    return { unsupportedReason: 'select+include at same level' }
  }
  if (isPlainObject(select) && isPlainObject(omit)) {
    return { unsupportedReason: 'select+omit at same level' }
  }
  if (hasCountKey(select) || hasCountKey(include)) {
    return { unsupportedReason: '_count not supported in MVP' }
  }
  if (hasWhereLikeRelationReference(parentArgs, model)) {
    return { unsupportedReason: 'relation used in where/orderBy/cursor is not supported in MVP' }
  }

  const projection = isPlainObject(select) ? select : (isPlainObject(include) ? include : null)
  if (!projection) {
    return {}
  }

  const isSelectMode = isPlainObject(select)
  const localOmit = isPlainObject(omit) ? omit : null
  const updatedProjection: Record<string, unknown> = {}
  const userFields = new Set(Object.keys(projection))

  const relationBranches: Array<{ name: string; value: unknown }> = []

  for (const [key, value] of Object.entries(projection)) {
    if (model.relations[key]) {
      relationBranches.push({ name: key, value })
    } else {
      updatedProjection[key] = value
    }
  }

  if (relationBranches.length === 0) {
    return { projectionAfterStrip: isSelectMode ? updatedProjection : undefined }
  }

  for (const branch of relationBranches) {
    const relation = model.relations[branch.name]

    if (relation.direction === 'implicitM2M') {
      return { unsupportedReason: 'implicit many-to-many not supported in MVP' }
    }
    if (relation.parentLinkFields.length === 0 || relation.childLinkFields.length === 0) {
      return { unsupportedReason: 'ambiguous relation metadata for ' + relation.name }
    }
    if (relation.parentLinkFields.length !== relation.childLinkFields.length) {
      return { unsupportedReason: 'mismatched link field counts for ' + relation.name }
    }

    for (const linkField of relation.parentLinkFields) {
      if (localOmit && localOmit[linkField] === true) {
        const where = parentPath ? parentPath + '.' : 'root '
        return { unsupportedReason: 'required parent link field omitted: ' + where + linkField }
      }
    }

    for (const linkField of relation.parentLinkFields) {
      if (isSelectMode && !userFields.has(linkField)) {
        updatedProjection[linkField] = true
        const fullPath = parentPath ? parentPath + '.' + linkField : linkField
        ctx.internalFieldPaths.push(fullPath)
      }
    }

    const relationArgs: Record<string, unknown> = branch.value === true
      ? {}
      : (isPlainObject(branch.value) ? branch.value : {})

    const relationPath = parentPath ? parentPath + '.' + branch.name : branch.name

    const stageArgs: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(relationArgs)) {
      if (k === 'select' || k === 'include' || k === 'omit') continue
      stageArgs[k] = v
    }

    const stageIndex = ctx.stages.length

    ctx.stages.push({
      relationPath,
      parentPath,
      relationName: branch.name,
      relationField: relation,
      stageArgs,
      depth: depth + 1,
    })

    const hasNestedProjection =
      isPlainObject(relationArgs.select) ||
      isPlainObject(relationArgs.include) ||
      isPlainObject(relationArgs.omit)

    if (hasNestedProjection) {
      const stagesBeforeRecursion = ctx.stages.length

      const nested = walk(ctx, relation.type, relationPath, relationArgs, depth + 1)
      if (nested.unsupportedReason) return nested

      if (relation.isList && ctx.stages.length > stagesBeforeRecursion) {
        return { unsupportedReason: 'nested relation through to-many parent not supported in MVP' }
      }

      if (nested.projectionAfterStrip) {
        ctx.stages[stageIndex].stageArgs.select = nested.projectionAfterStrip
      }
      if (isPlainObject(relationArgs.omit)) {
        ctx.stages[stageIndex].stageArgs.omit = relationArgs.omit
      }
    }
  }

  return { projectionAfterStrip: isSelectMode ? updatedProjection : undefined }
}

export function planAutoInclude(input: AutoIncludePlannerInput): AutoIncludePlan {
  const maxDepth = input.maxDepth ?? DEFAULT_AUTO_INCLUDE_MAX_DEPTH
  const maxStages = input.maxStages ?? DEFAULT_AUTO_INCLUDE_MAX_STAGES

  const ctx: WalkContext = {
    models: input.models,
    stages: [],
    internalFieldPaths: [],
    maxDepth,
    maxStages,
  }

  const result = walk(ctx, input.rootModelName, '', input.args, 0)

  if (result.unsupportedReason) {
    return {
      rootArgs: input.args,
      stages: [],
      internalFieldPaths: [],
      unsupportedReason: 'auto-progressive fallback: ' + result.unsupportedReason,
    }
  }

  const rootArgs: Record<string, unknown> = { ...input.args }
  const rootModel = input.models[input.rootModelName]

  if (result.projectionAfterStrip) {
    rootArgs.select = result.projectionAfterStrip
    delete rootArgs.include
  } else if (rootModel && isPlainObject(input.args.include)) {
    const stripped: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(input.args.include)) {
      if (!rootModel.relations[k]) {
        stripped[k] = v
      }
    }
    if (Object.keys(stripped).length > 0) {
      rootArgs.include = stripped
    } else {
      delete rootArgs.include
    }
  }

  return {
    rootArgs,
    stages: ctx.stages,
    internalFieldPaths: ctx.internalFieldPaths,
  }
}