import type { Request, Response } from 'express'
import {
  initSSE,
  endSSE,
  startSSEKeepalive,
  sendSSEField,
  sendSSEResult,
  sendSSEError,
  sendSSEProgress,
  runSingleResultSSE,
  emitTerminalSSEError,
  setByPath,
  getDelegate,
  getExtendedClient,
  type OperationContext,
  type PrismaDelegate,
} from './operationRuntime'
import {
  planAutoInclude,
  type ModelRelationMap,
  type AutoIncludeStage,
} from './autoIncludePlanner'
import type { AutoIncludeProgressiveVariantConfig } from './routeConfig'

const STAGE_CONCURRENCY = 4
type IntervalHandle = ReturnType<typeof setInterval>

export type RunAutoIncludeOptions = {
  req: Request
  res: Response
  ctx: OperationContext
  args: Record<string, unknown>
  baseOp: 'findUnique' | 'findUniqueOrThrow' | 'findFirst' | 'findFirstOrThrow'
  modelName: string
  delegateKey: string
  models: Record<string, ModelRelationMap>
  variantConfig: AutoIncludeProgressiveVariantConfig
  coreQueryFn: () => Promise<unknown>
  signal?: AbortSignal
}

function isObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

function readPath(source: Record<string, unknown>, path: string): unknown {
  if (path === '') return source
  const parts = path.split('.')
  let cursor: unknown = source
  for (const part of parts) {
    if (!isObject(cursor)) return undefined
    cursor = cursor[part]
  }
  return cursor
}

function stripInternalAtScope(
  target: Record<string, unknown>,
  internalPaths: string[],
  scopePath: string,
): void {
  for (const fullPath of internalPaths) {
    if (scopePath === '') {
      if (!fullPath.includes('.')) {
        delete target[fullPath]
      }
      continue
    }
    if (!fullPath.startsWith(scopePath + '.')) continue
    const relative = fullPath.slice(scopePath.length + 1)
    if (relative.includes('.')) continue
    delete target[relative]
  }
}

function mergeWhere(
  userWhere: unknown,
  linkFilter: Record<string, unknown>,
): Record<string, unknown> {
  if (!isObject(userWhere) || Object.keys(userWhere).length === 0) return linkFilter
  return { AND: [userWhere, linkFilter] }
}

function buildLinkFilter(
  stage: AutoIncludeStage,
  parentValue: Record<string, unknown>,
): Record<string, unknown> | null {
  const filter: Record<string, unknown> = {}
  const rel = stage.relationField
  for (let i = 0; i < rel.parentLinkFields.length; i++) {
    const parentKey = rel.parentLinkFields[i]
    const childKey = rel.childLinkFields[i]
    const value = parentValue[parentKey]
    if (value === undefined || value === null) return null
    filter[childKey] = value
  }
  return filter
}

function emptyResultFor(isList: boolean): unknown {
  return isList ? [] : null
}

function buildPublicForStage(
  result: unknown,
  internalFieldPaths: string[],
  scopePath: string,
): unknown {
  if (Array.isArray(result)) {
    return result.map((item) => {
      if (isObject(item)) {
        const copy: Record<string, unknown> = { ...item }
        stripInternalAtScope(copy, internalFieldPaths, scopePath)
        return copy
      }
      return item
    })
  }
  if (isObject(result)) {
    const copy: Record<string, unknown> = { ...result }
    stripInternalAtScope(copy, internalFieldPaths, scopePath)
    return copy
  }
  return result
}

async function runOneStage(options: {
  extended: unknown
  models: Record<string, ModelRelationMap>
  stage: AutoIncludeStage
  internal: Record<string, unknown>
  publicState: Record<string, unknown>
  internalFieldPaths: string[]
  res: Response
  isAborted: () => boolean
}): Promise<void> {
  const { extended, models, stage, internal, publicState, internalFieldPaths, res, isAborted } = options
  if (isAborted()) return

  const parentRaw = readPath(internal, stage.parentPath)
  if (!isObject(parentRaw)) {
    if (stage.parentPath !== '') {
      return
    }
    const empty = emptyResultFor(stage.relationField.isList)
    const applied = setByPath(publicState, stage.relationPath, empty)
    if (applied) sendSSEField(res, stage.relationPath, empty)
    return
  }

  const linkFilter = buildLinkFilter(stage, parentRaw)
  if (!linkFilter) {
    const empty = emptyResultFor(stage.relationField.isList)
    const appliedInternal = setByPath(internal, stage.relationPath, empty)
    const appliedPublic = setByPath(publicState, stage.relationPath, empty)
    if (appliedInternal && appliedPublic) {
      sendSSEField(res, stage.relationPath, empty)
    }
    return
  }

  const targetModel = models[stage.relationField.type]
  if (!targetModel) {
    throw new Error('Target model not in relation metadata: ' + stage.relationField.type)
  }

  const finalArgs: Record<string, unknown> = { ...stage.stageArgs }
  finalArgs.where = mergeWhere(stage.stageArgs.where, linkFilter)

  const delegate: PrismaDelegate = getDelegate(extended, targetModel.delegateKey)
  const method: 'findMany' | 'findFirst' = stage.relationField.isList ? 'findMany' : 'findFirst'
  const result = await delegate[method](finalArgs)

  if (isAborted()) return

  const appliedInternal = setByPath(internal, stage.relationPath, result)
  if (!appliedInternal) {
    throw new Error('Failed to apply internal patch for ' + stage.relationPath)
  }

  const publicResult = buildPublicForStage(result, internalFieldPaths, stage.relationPath)

  const appliedPublic = setByPath(publicState, stage.relationPath, publicResult)
  if (!appliedPublic) {
    throw new Error('Failed to apply public patch for ' + stage.relationPath)
  }

  sendSSEField(res, stage.relationPath, publicResult)
}

function groupStagesByDepth(stages: AutoIncludeStage[]): AutoIncludeStage[][] {
  const byDepth = new Map<number, AutoIncludeStage[]>()
  for (const s of stages) {
    const arr = byDepth.get(s.depth)
    if (arr) arr.push(s)
    else byDepth.set(s.depth, [s])
  }
  return Array.from(byDepth.keys())
    .sort((a, b) => a - b)
    .map((d) => byDepth.get(d) as AutoIncludeStage[])
}

async function runConcurrent<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  let index = 0
  const workers: Promise<void>[] = []
  const workerCount = Math.min(limit, items.length)
  for (let w = 0; w < workerCount; w++) {
    workers.push((async () => {
      for (;;) {
        const i = index++
        if (i >= items.length) return
        await fn(items[i])
      }
    })())
  }
  await Promise.all(workers)
}

export async function runAutoIncludeProgressive(
  options: RunAutoIncludeOptions,
): Promise<void> {
  const { req, res, ctx, args, baseOp, modelName, delegateKey, models, variantConfig, coreQueryFn, signal } = options

  const isClientGone = () =>
    signal?.aborted === true || res.writableEnded || res.destroyed

  if (ctx.guardShape) {
    if (variantConfig.fallback === 'error') {
      emitTerminalSSEError(res, 'auto-progressive fallback: guard shape disables auto-include')
      return
    }
    return runSingleResultSSE({ req, res, coreQueryFn })
  }

  const plan = planAutoInclude({
    rootModelName: modelName,
    models,
    args,
  })

  if (plan.unsupportedReason) {
    if (variantConfig.fallback === 'error') {
      emitTerminalSSEError(res, plan.unsupportedReason)
      return
    }
    return runSingleResultSSE({ req, res, coreQueryFn })
  }

  if (plan.stages.length === 0) {
    return runSingleResultSSE({ req, res, coreQueryFn })
  }

  let keepalive: IntervalHandle | null = null
  try {
    initSSE(res)
    keepalive = startSSEKeepalive(res)
    if (isClientGone()) return

    const extended = await getExtendedClient(ctx)
    if (isClientGone()) return

    const rootDelegate = getDelegate(extended, delegateKey)

    let rootResult: unknown
    try {
      rootResult = await rootDelegate[baseOp](plan.rootArgs)
    } catch (err) {
      if (isClientGone()) return
      const code = (err as { code?: string } | null)?.code
      const isOrThrow = baseOp === 'findUniqueOrThrow' || baseOp === 'findFirstOrThrow'
      if (isOrThrow && code === 'P2025') {
        sendSSEError(res, 'Record not found')
        return
      }
      console.error('[auto-progressive] root query failed:', err)
      sendSSEError(res, 'Root query failed')
      return
    }

    if (isClientGone()) return

    if (rootResult === null || !isObject(rootResult)) {
      sendSSEResult(res, null)
      return
    }

    const internal: Record<string, unknown> = { ...rootResult }
    const publicRoot: Record<string, unknown> = { ...rootResult }
    stripInternalAtScope(publicRoot, plan.internalFieldPaths, '')

    const publicState: Record<string, unknown> = { ...publicRoot }
    for (const [k, v] of Object.entries(publicRoot)) {
      if (isClientGone()) return
      sendSSEField(res, k, v)
    }

    if (isClientGone()) return
    sendSSEProgress(res, 'root', 0, plan.stages.length)

    const groups = groupStagesByDepth(plan.stages)
    let completed = 0
    let stageErrorMessage: string | null = null
    const isAborted = () =>
      stageErrorMessage !== null ||
      signal?.aborted === true ||
      res.writableEnded ||
      res.destroyed

    for (const group of groups) {
      if (isClientGone()) return
      if (stageErrorMessage) break

      await runConcurrent(group, STAGE_CONCURRENCY, async (stage) => {
        if (isAborted()) return
        try {
          await runOneStage({
            extended,
            models,
            stage,
            internal,
            publicState,
            internalFieldPaths: plan.internalFieldPaths,
            res,
            isAborted,
          })
        } catch (err) {
          if (isAborted()) return
          console.error('[auto-progressive] stage failed:', stage.relationPath, err)
          stageErrorMessage = 'Could not load progressive response'
          return
        }
        if (isAborted()) return
        completed++
        sendSSEProgress(res, stage.relationPath, completed, plan.stages.length)
      })
    }

    if (isClientGone()) return

    if (stageErrorMessage) {
      if (!res.writableEnded && !res.destroyed) {
        sendSSEError(res, stageErrorMessage)
      }
      return
    }

    if (res.writableEnded || res.destroyed) return
    sendSSEResult(res, publicState)
  } catch (err) {
    if (isClientGone()) return
    console.error('[auto-progressive] dispatch error:', err)
    if (!res.writableEnded && !res.destroyed) {
      sendSSEError(res, 'Internal server error')
    }
  } finally {
    endSSE(res, keepalive)
  }
}