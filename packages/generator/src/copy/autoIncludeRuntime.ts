import type { Request, Response } from 'express'
import {
  initSSE,
  endSSE,
  startSSEKeepalive,
  sendSSEField,
  sendSSEResult,
  sendSSEError,
  sendSSEProgress,
  sendSSERootArray,
  sendSSERelationBatch,
  runSingleResultSSE,
  emitTerminalSSEError,
  setByPath,
  getDelegate,
  getExtendedClient,
  applyPaginationLimits,
  mapError,
  type OperationContext,
  type PrismaDelegate,
} from './operationRuntime'
import { isPlainObject } from './misc'
import {
  planAutoInclude,
  type AutoIncludePlan,
  type ModelRelationMap,
  type AutoIncludeStage,
} from './autoIncludePlanner'
import type { AutoIncludeProgressiveVariantConfig } from './routeConfig'

const STAGE_CONCURRENCY = 4
const MAX_IN_CHUNK = 1000

type IntervalHandle = ReturnType<typeof setInterval>

export type AutoIncludeBaseOp =
  | 'findUnique'
  | 'findUniqueOrThrow'
  | 'findFirst'
  | 'findFirstOrThrow'
  | 'findMany'

export type RunAutoIncludeOptions = {
  req: Request
  res: Response
  ctx: OperationContext
  args: Record<string, unknown>
  baseOp: AutoIncludeBaseOp
  modelName: string
  delegateKey: string
  models: Record<string, ModelRelationMap>
  variantConfig: AutoIncludeProgressiveVariantConfig
  coreQueryFn: () => Promise<unknown>
  signal?: AbortSignal
}

function readPath(source: Record<string, unknown>, path: string): unknown {
  if (path === '') return source
  const parts = path.split('.')
  let cursor: unknown = source
  for (const part of parts) {
    if (!isPlainObject(cursor)) return undefined
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
  if (!isPlainObject(userWhere) || Object.keys(userWhere).length === 0) return linkFilter
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
      if (isPlainObject(item)) {
        const copy: Record<string, unknown> = { ...item }
        stripInternalAtScope(copy, internalFieldPaths, scopePath)
        return copy
      }
      return item
    })
  }
  if (isPlainObject(result)) {
    const copy: Record<string, unknown> = { ...result }
    stripInternalAtScope(copy, internalFieldPaths, scopePath)
    return copy
  }
  return result
}

function normalizeKey(v: unknown): string {
  if (v === null || v === undefined) return '\u0000'
  if (typeof v === 'bigint') return 'B' + v.toString()
  if (v instanceof Date) return 'D' + v.getTime().toString()
  if (typeof v === 'object') return 'O' + JSON.stringify(v)
  return typeof v + ':' + String(v)
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

function handleAutoIncludeFallback(
  options: RunAutoIncludeOptions,
  message: string,
): Promise<void> {
  if (options.variantConfig.fallback === 'error') {
    emitTerminalSSEError(options.res, message)
    return Promise.resolve()
  }
  return runSingleResultSSE({
    req: options.req,
    res: options.res,
    coreQueryFn: options.coreQueryFn,
  })
}

function findManyUnsupportedReason(plan: AutoIncludePlan): string | null {
  for (const stage of plan.stages) {
    const rel = stage.relationField
    if (rel.parentLinkFields.length !== 1 || rel.childLinkFields.length !== 1) {
      return 'auto-progressive fallback: composite link fields not supported for findMany batched auto-include'
    }
    if (stage.depth > 1) {
      return 'auto-progressive fallback: nested relations not supported for findMany batched auto-include'
    }
    if (rel.isList) {
      const sa = stage.stageArgs
      if (
        sa.take !== undefined ||
        sa.skip !== undefined ||
        sa.cursor !== undefined ||
        sa.distinct !== undefined
      ) {
        return 'auto-progressive fallback: per-parent take/skip/cursor/distinct on to-many relations not supported for findMany batched auto-include'
      }
    }
  }
  return null
}

async function runOneStageSingle(options: {
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
  if (!isPlainObject(parentRaw)) {
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

async function runAutoIncludeSingle(
  options: RunAutoIncludeOptions,
  plan: AutoIncludePlan,
): Promise<void> {
  const { res, ctx, baseOp, delegateKey, models, signal } = options

  const isClientGone = () =>
    signal?.aborted === true || res.writableEnded || res.destroyed

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
      rootResult = await rootDelegate[baseOp as Exclude<AutoIncludeBaseOp, 'findMany'>](plan.rootArgs)
    } catch (err) {
      if (isClientGone()) return
      console.error('[auto-progressive] root query failed:', err)
      sendSSEError(res, mapError(err).message)
      return
    }

    if (isClientGone()) return

    if (rootResult === null || !isPlainObject(rootResult)) {
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
          await runOneStageSingle({
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
          stageErrorMessage = mapError(err).message
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
      sendSSEError(res, mapError(err).message)
    }
  } finally {
    endSSE(res, keepalive)
  }
}

function buildStageQueryArgs(
  stage: AutoIncludeStage,
  childKey: string,
  inChunk: unknown[],
): { args: Record<string, unknown>; injectedChildPath: string | null } {
  const baseSelect = isPlainObject(stage.stageArgs.select)
    ? (stage.stageArgs.select as Record<string, unknown>)
    : null
  const baseOmit = isPlainObject(stage.stageArgs.omit)
    ? (stage.stageArgs.omit as Record<string, unknown>)
    : null

  const finalArgs: Record<string, unknown> = { ...stage.stageArgs }
  finalArgs.where = mergeWhere(stage.stageArgs.where, { [childKey]: { in: inChunk } })

  let injectedChildPath: string | null = null

  if (baseSelect) {
    if (baseSelect[childKey] !== true) {
      finalArgs.select = { ...baseSelect, [childKey]: true }
      injectedChildPath = stage.relationPath + '.' + childKey
    }
  }

  if (baseOmit && baseOmit[childKey] === true) {
    const nextOmit: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(baseOmit)) {
      if (k === childKey) continue
      nextOmit[k] = v
    }
    if (Object.keys(nextOmit).length > 0) {
      finalArgs.omit = nextOmit
    } else {
      delete finalArgs.omit
    }
    injectedChildPath = stage.relationPath + '.' + childKey
  }

  return { args: finalArgs, injectedChildPath }
}

function collectDistinctParentValues(
  rows: Record<string, unknown>[],
  parentKey: string,
): unknown[] {
  const seen = new Set<string>()
  const out: unknown[] = []
  for (const row of rows) {
    const v = row[parentKey]
    if (v === undefined || v === null) continue
    const k = normalizeKey(v)
    if (seen.has(k)) continue
    seen.add(k)
    out.push(v)
  }
  return out
}

function groupRelatedRows(
  children: unknown[],
  childKey: string,
): Map<string, unknown[]> {
  const grouped = new Map<string, unknown[]>()
  for (const child of children) {
    if (!isPlainObject(child)) continue
    const k = child[childKey]
    if (k === undefined || k === null) continue
    const key = normalizeKey(k)
    let arr = grouped.get(key)
    if (!arr) {
      arr = []
      grouped.set(key, arr)
    }
    arr.push(child)
  }
  return grouped
}

async function runOneStageMany(options: {
  extended: unknown
  models: Record<string, ModelRelationMap>
  stage: AutoIncludeStage
  internalRows: Record<string, unknown>[]
  publicRows: Record<string, unknown>[]
  internalFieldPaths: string[]
  res: Response
  isAborted: () => boolean
}): Promise<void> {
  const {
    extended, models, stage, internalRows, publicRows,
    internalFieldPaths, res, isAborted,
  } = options

  if (isAborted()) return

  const rel = stage.relationField
  const parentKey = rel.parentLinkFields[0]
  const childKey = rel.childLinkFields[0]

  const targetModel = models[rel.type]
  if (!targetModel) {
    throw new Error('Target model not in relation metadata: ' + rel.type)
  }

  const distinctValues = collectDistinctParentValues(internalRows, parentKey)
  const delegate: PrismaDelegate = getDelegate(extended, targetModel.delegateKey)

  const children: unknown[] = []
  let injectedChildPath: string | null = null

  for (let i = 0; i < distinctValues.length; i += MAX_IN_CHUNK) {
    if (isAborted()) return
    const chunk = distinctValues.slice(i, i + MAX_IN_CHUNK)
    const { args, injectedChildPath: ip } = buildStageQueryArgs(stage, childKey, chunk)
    if (ip) injectedChildPath = ip
    const partial = await delegate.findMany(args)
    if (isAborted()) return
    if (Array.isArray(partial)) {
      for (const c of partial) children.push(c)
    }
  }

  const effectivePaths = injectedChildPath
    ? [...internalFieldPaths, injectedChildPath]
    : internalFieldPaths

  const grouped = groupRelatedRows(children, childKey)
  const publicValues: unknown[] = new Array(internalRows.length)

  for (let i = 0; i < internalRows.length; i++) {
    const row = internalRows[i]
    const fkVal = row[parentKey]
    let internalVal: unknown

    if (fkVal === undefined || fkVal === null) {
      internalVal = emptyResultFor(rel.isList)
    } else {
      const matches = grouped.get(normalizeKey(fkVal)) ?? []
      if (rel.isList) {
        internalVal = matches
      } else {
        internalVal = matches.length > 0 ? matches[0] : null
      }
    }

    const publicVal = buildPublicForStage(internalVal, effectivePaths, stage.relationPath)

    internalRows[i][stage.relationName] = internalVal
    publicRows[i][stage.relationName] = publicVal
    publicValues[i] = publicVal
  }

  if (isAborted()) return
  sendSSERelationBatch(res, stage.relationPath, publicValues)
}

async function runAutoIncludeMany(
  options: RunAutoIncludeOptions,
  plan: AutoIncludePlan,
): Promise<void> {
  const { res, ctx, delegateKey, models, signal } = options

  const isClientGone = () =>
    signal?.aborted === true || res.writableEnded || res.destroyed

  let keepalive: IntervalHandle | null = null
  try {
    initSSE(res)
    keepalive = startSSEKeepalive(res)
    if (isClientGone()) return

    const extended = await getExtendedClient(ctx)
    if (isClientGone()) return

    const rootDelegate = getDelegate(extended, delegateKey)
    const rootArgs = applyPaginationLimits(plan.rootArgs, ctx.paginationConfig)

    let rootResult: unknown
    try {
      rootResult = await rootDelegate.findMany(rootArgs)
    } catch (err) {
      if (isClientGone()) return
      console.error('[auto-progressive] root findMany failed:', err)
      sendSSEError(res, mapError(err).message)
      return
    }

    if (isClientGone()) return

    if (!Array.isArray(rootResult)) {
      sendSSEError(res, 'auto-progressive: unexpected non-array root result for findMany')
      return
    }

    const internalRows: Record<string, unknown>[] = new Array(rootResult.length)
    const publicRows: Record<string, unknown>[] = new Array(rootResult.length)

    for (let i = 0; i < rootResult.length; i++) {
      const row = rootResult[i]
      if (!isPlainObject(row)) {
        internalRows[i] = {}
        publicRows[i] = {}
        continue
      }
      const internalCopy: Record<string, unknown> = { ...row }
      const publicCopy: Record<string, unknown> = { ...row }
      stripInternalAtScope(publicCopy, plan.internalFieldPaths, '')
      internalRows[i] = internalCopy
      publicRows[i] = publicCopy
    }

    sendSSERootArray(res, publicRows)
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
          await runOneStageMany({
            extended,
            models,
            stage,
            internalRows,
            publicRows,
            internalFieldPaths: plan.internalFieldPaths,
            res,
            isAborted,
          })
        } catch (err) {
          if (isAborted()) return
          console.error('[auto-progressive] stage failed:', stage.relationPath, err)
          stageErrorMessage = mapError(err).message
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
    sendSSEResult(res, publicRows)
  } catch (err) {
    if (isClientGone()) return
    console.error('[auto-progressive] many dispatch error:', err)
    if (!res.writableEnded && !res.destroyed) {
      sendSSEError(res, mapError(err).message)
    }
  } finally {
    endSSE(res, keepalive)
  }
}

export async function runAutoIncludeProgressive(
  options: RunAutoIncludeOptions,
): Promise<void> {
  if (options.ctx.guardShape) {
    return handleAutoIncludeFallback(
      options,
      'auto-progressive fallback: guard shape disables auto-include',
    )
  }

  const plan = planAutoInclude({
    rootModelName: options.modelName,
    models: options.models,
    args: options.args,
  })

  if (plan.unsupportedReason) {
    return handleAutoIncludeFallback(options, plan.unsupportedReason)
  }

  if (options.baseOp === 'findMany') {
    const reason = findManyUnsupportedReason(plan)
    if (reason) return handleAutoIncludeFallback(options, reason)
  }

  if (plan.stages.length === 0) {
    return runSingleResultSSE({
      req: options.req,
      res: options.res,
      coreQueryFn: options.coreQueryFn,
    })
  }

  if (options.baseOp === 'findMany') {
    return runAutoIncludeMany(options, plan)
  }
  return runAutoIncludeSingle(options, plan)
}