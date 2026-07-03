import type { Request, Response } from 'express'
import {
  sendSSEField,
  sendSSEResult,
  sendSSEError,
  sendSSEProgress,
  sendSSERootArray,
  sendSSERelationBatch,
  sendSSENestedRelationBatch,
  sendSSEPageMeta,
  runSingleResultSSE,
  emitTerminalSSEError,
  safeSendError,
  setByPath,
  getDelegate,
  getExtendedClient,
  applyPaginationLimits,
  countForPagination,
  withSSE,
  mapError,
  HttpError,
  LOG_PREFIX,
  type OperationContext,
  type PrismaDelegate,
  type FindManyPaginatedMode,
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

export type AutoIncludeBaseOp =
  | 'findUnique'
  | 'findUniqueOrThrow'
  | 'findFirst'
  | 'findFirstOrThrow'
  | 'findMany'
  | 'findManyPaginated'

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

type RowPair = {
  internal: Record<string, unknown>
  public: Record<string, unknown>
}

type ParentEntry = RowPair & {
  locator: Array<number | string>
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
  const prefix = scopePath === '' ? '' : scopePath + '.'
  for (const fullPath of internalPaths) {
    if (!fullPath.startsWith(prefix)) continue
    const relative = fullPath.slice(prefix.length)
    if (relative === '' || relative.includes('.')) continue
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
  const process = (item: unknown): unknown => {
    if (!isPlainObject(item)) return item
    const copy: Record<string, unknown> = { ...item }
    stripInternalAtScope(copy, internalFieldPaths, scopePath)
    return copy
  }
  if (Array.isArray(result)) return result.map(process)
  return process(result)
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

function singleUnsupportedReason(plan: AutoIncludePlan): string | null {
  const stagesByPath = new Map(plan.stages.map((s) => [s.relationPath, s]))
  for (const stage of plan.stages) {
    let parentPath = stage.parentPath
    while (parentPath) {
      const parentStage = stagesByPath.get(parentPath)
      if (parentStage?.relationField.isList) {
        return 'auto-progressive fallback: nested relation through to-many parent is not supported for single-result auto-include'
      }
      const dot = parentPath.lastIndexOf('.')
      parentPath = dot === -1 ? '' : parentPath.slice(0, dot)
    }
  }
  return null
}

function collectParentEntries(
  rootPairs: RowPair[],
  parentPath: string,
): ParentEntry[] {
  const initial: ParentEntry[] = rootPairs.map((p, i) => ({
    internal: p.internal,
    public: p.public,
    locator: [i],
  }))
  if (parentPath === '') return initial

  let entries = initial
  for (const segment of parentPath.split('.')) {
    const next: ParentEntry[] = []
    for (const entry of entries) {
      const internalValue = entry.internal[segment]
      const publicValue = entry.public[segment]
      if (Array.isArray(internalValue) && Array.isArray(publicValue)) {
        const length = Math.min(internalValue.length, publicValue.length)
        for (let i = 0; i < length; i++) {
          const internalItem = internalValue[i]
          const publicItem = publicValue[i]
          if (isPlainObject(internalItem) && isPlainObject(publicItem)) {
            next.push({
              internal: internalItem,
              public: publicItem,
              locator: [...entry.locator, segment, i],
            })
          }
        }
        continue
      }
      if (isPlainObject(internalValue) && isPlainObject(publicValue)) {
        next.push({
          internal: internalValue,
          public: publicValue,
          locator: [...entry.locator, segment],
        })
      }
    }
    entries = next
  }
  return entries
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
    if (stage.parentPath !== '') return
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

  await withSSE({ res, signal, label: 'single' }, async () => {
    const extended = await getExtendedClient(ctx)
    if (isClientGone()) return

    const rootDelegate = getDelegate(extended, delegateKey)

    let rootResult: unknown
    try {
      rootResult = await rootDelegate[baseOp as Exclude<AutoIncludeBaseOp, 'findMany' | 'findManyPaginated'>](plan.rootArgs)
    } catch (err) {
      if (isClientGone()) return
      console.error(LOG_PREFIX, 'root query failed:', err)
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
      const okField = sendSSEField(res, k, v)
      if (!okField) return
    }

    if (isClientGone()) return
    const okStart = sendSSEProgress(res, 'root', 0, plan.stages.length)
    if (!okStart) return

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
          console.error(LOG_PREFIX, 'stage failed:', stage.relationPath, err)
          stageErrorMessage = mapError(err).message
          return
        }
        if (isAborted()) return
        completed++
        const ok = sendSSEProgress(res, stage.relationPath, completed, plan.stages.length)
        if (!ok) return
      })
    }

    if (isClientGone()) return

    if (stageErrorMessage) {
      safeSendError(res, stageErrorMessage)
      return
    }

    if (res.writableEnded || res.destroyed) return
    sendSSEResult(res, publicState)
  })
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
  parentEntries: ParentEntry[]
  internalFieldPaths: string[]
  res: Response
  isAborted: () => boolean
}): Promise<void> {
  const { extended, models, stage, parentEntries, internalFieldPaths, res, isAborted } = options

  if (isAborted()) return

  const rel = stage.relationField
  const parentKey = rel.parentLinkFields[0]
  const childKey = rel.childLinkFields[0]

  const targetModel = models[rel.type]
  if (!targetModel) {
    throw new Error('Target model not in relation metadata: ' + rel.type)
  }

  if (parentEntries.length === 0) {
    if (stage.depth === 1) {
      sendSSERelationBatch(res, stage.relationPath, [])
    } else {
      sendSSENestedRelationBatch(res, stage.relationPath, stage.depth, [])
    }
    return
  }

  const internalParents = parentEntries.map((p) => p.internal)
  const distinctValues = collectDistinctParentValues(internalParents, parentKey)
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
  const publicValues: unknown[] = new Array(parentEntries.length)

  for (let i = 0; i < parentEntries.length; i++) {
    const entry = parentEntries[i]
    const fkVal = entry.internal[parentKey]
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

    entry.internal[stage.relationName] = internalVal
    entry.public[stage.relationName] = publicVal
    publicValues[i] = publicVal
  }

  if (isAborted()) return

  if (stage.depth === 1) {
    sendSSERelationBatch(res, stage.relationPath, publicValues)
    return
  }

  const attachments = parentEntries.map((entry, i) => ({
    locator: entry.locator,
    value: publicValues[i],
  }))
  sendSSENestedRelationBatch(res, stage.relationPath, stage.depth, attachments)
}

function buildRootPairs(
  rootRows: unknown[],
  internalFieldPaths: string[],
): { publicRows: Record<string, unknown>[]; rootPairs: RowPair[] } {
  const n = rootRows.length
  const publicRows: Record<string, unknown>[] = new Array(n)
  const rootPairs: RowPair[] = new Array(n)
  for (let i = 0; i < n; i++) {
    const row = rootRows[i]
    if (!isPlainObject(row)) {
      const internalEmpty: Record<string, unknown> = {}
      const publicEmpty: Record<string, unknown> = {}
      publicRows[i] = publicEmpty
      rootPairs[i] = { internal: internalEmpty, public: publicEmpty }
      continue
    }
    const internalCopy: Record<string, unknown> = { ...row }
    const publicCopy: Record<string, unknown> = { ...row }
    stripInternalAtScope(publicCopy, internalFieldPaths, '')
    publicRows[i] = publicCopy
    rootPairs[i] = { internal: internalCopy, public: publicCopy }
  }
  return { publicRows, rootPairs }
}

async function processFindManyStages(args: {
  extended: unknown
  models: Record<string, ModelRelationMap>
  plan: AutoIncludePlan
  rootPairs: RowPair[]
  res: Response
  signal?: AbortSignal
}): Promise<string | null> {
  const { extended, models, plan, rootPairs, res, signal } = args
  const groups = groupStagesByDepth(plan.stages)
  let completed = 0
  let stageErrorMessage: string | null = null
  const isAborted = () =>
    stageErrorMessage !== null ||
    signal?.aborted === true ||
    res.writableEnded ||
    res.destroyed

  for (const group of groups) {
    if (signal?.aborted === true || res.writableEnded || res.destroyed) return stageErrorMessage
    if (stageErrorMessage) break

    await runConcurrent(group, STAGE_CONCURRENCY, async (stage) => {
      if (isAborted()) return
      const parentEntries = collectParentEntries(rootPairs, stage.parentPath)
      try {
        await runOneStageMany({
          extended,
          models,
          stage,
          parentEntries,
          internalFieldPaths: plan.internalFieldPaths,
          res,
          isAborted,
        })
      } catch (err) {
        if (isAborted()) return
        console.error(LOG_PREFIX, 'stage failed:', stage.relationPath, err)
        stageErrorMessage = mapError(err).message
        return
      }
      if (isAborted()) return
      completed++
      const ok = sendSSEProgress(res, stage.relationPath, completed, plan.stages.length)
      if (!ok) return
    })
  }
  return stageErrorMessage
}

async function runPaginatedRoot(args: {
  extended: unknown
  delegateKey: string
  rootArgs: Record<string, unknown>
  ctx: OperationContext
  mode: FindManyPaginatedMode
}): Promise<{ data: unknown[]; count: number }> {
  const { extended, delegateKey, rootArgs, ctx, mode } = args
  const distinctCountLimit = ctx.paginationConfig?.distinctCountLimit
  const countSource = ctx.paginationConfig?.countSource

  if (mode === 'transaction') {
    const txClient = extended as {
      $transaction?: <T>(fn: (tx: unknown) => Promise<T>) => Promise<T>
    }
    if (typeof txClient.$transaction !== 'function') {
      throw new HttpError(
        500,
        'findManyPaginatedMode="transaction" requires transaction support on the Prisma client',
      )
    }
    const result = await txClient.$transaction(async (tx: unknown) => {
      const txDelegate = getDelegate(tx, delegateKey)
      const [data, count] = await Promise.all([
        txDelegate.findMany(rootArgs),
        countForPagination(
          txDelegate,
          rootArgs,
          undefined,
          undefined,
          distinctCountLimit,
          countSource,
          tx,
        ),
      ])
      return { data, count }
    })
    return { data: result.data as unknown[], count: result.count }
  }

  const rootDelegate = getDelegate(extended, delegateKey)
  const [data, count] = await Promise.all([
    rootDelegate.findMany(rootArgs),
    countForPagination(
      rootDelegate,
      rootArgs,
      undefined,
      undefined,
      distinctCountLimit,
      countSource,
      extended,
    ),
  ])
  return { data: data as unknown[], count }
}

async function runAutoIncludeManyOrPaginated(
  options: RunAutoIncludeOptions,
  plan: AutoIncludePlan,
  isPaginated: boolean,
): Promise<void> {
  const { res, ctx, delegateKey, models, signal } = options

  const isClientGone = () =>
    signal?.aborted === true || res.writableEnded || res.destroyed

  await withSSE({ res, signal, label: isPaginated ? 'paginated' : 'many' }, async () => {
    const extended = await getExtendedClient(ctx)
    if (isClientGone()) return

    const rootArgs = applyPaginationLimits(plan.rootArgs, ctx.paginationConfig, !!ctx.guardShape)

    let rootRows: unknown[]
    let total = 0
    let hasMore = false

    try {
      if (isPaginated) {
        const mode: FindManyPaginatedMode = ctx.findManyPaginatedMode ?? 'promiseAll'
        const r = await runPaginatedRoot({ extended, delegateKey, rootArgs, ctx, mode })
        rootRows = r.data
        total = r.count
        const skip = typeof rootArgs.skip === 'number' ? rootArgs.skip : 0
        const takeRaw = typeof rootArgs.take === 'number' ? rootArgs.take : rootRows.length
        const absTake = Math.abs(takeRaw)
        hasMore = absTake > 0 && rootRows.length >= absTake && skip + rootRows.length < total
      } else {
        const rootDelegate = getDelegate(extended, delegateKey)
        const result = await rootDelegate.findMany(rootArgs)
        if (!Array.isArray(result)) {
          safeSendError(res, 'auto-progressive: unexpected non-array root result for findMany')
          return
        }
        rootRows = result
      }
    } catch (err) {
      if (isClientGone()) return
      console.error(
        LOG_PREFIX,
        isPaginated ? 'root findManyPaginated failed:' : 'root findMany failed:',
        err,
      )
      sendSSEError(res, mapError(err).message)
      return
    }

    if (isClientGone()) return

    const { publicRows, rootPairs } = buildRootPairs(rootRows, plan.internalFieldPaths)

    if (isPaginated) {
      sendSSEPageMeta(res, total, hasMore)
    }
    sendSSERootArray(res, publicRows)
    sendSSEProgress(res, 'root', 0, plan.stages.length)

    const stageError = await processFindManyStages({
      extended, models, plan, rootPairs, res, signal,
    })

    if (isClientGone()) return

    if (stageError) {
      safeSendError(res, stageError)
      return
    }

    if (res.writableEnded || res.destroyed) return
    if (isPaginated) {
      sendSSEResult(res, { data: publicRows, total, hasMore })
    } else {
      sendSSEResult(res, publicRows)
    }
  })
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

  if (options.baseOp === 'findMany' || options.baseOp === 'findManyPaginated') {
    const reason = findManyUnsupportedReason(plan)
    if (reason) return handleAutoIncludeFallback(options, reason)
  } else {
    const reason = singleUnsupportedReason(plan)
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
    return runAutoIncludeManyOrPaginated(options, plan, false)
  }
  if (options.baseOp === 'findManyPaginated') {
    return runAutoIncludeManyOrPaginated(options, plan, true)
  }
  return runAutoIncludeSingle(options, plan)
}