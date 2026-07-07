import type { Request, Response } from 'express'
import { HttpError, LOG_PREFIX, mapError } from './errorMapper'
import {
  sendSSEField,
  sendSSEResult,
  sendSSEError,
  sendSSEProgress,
  runSingleResultSSE,
  emitTerminalSSEError,
  safeSendError,
  withSSE,
} from './sse'
import {
  getDelegate,
  getExtendedClient,
  type OperationContext,
} from './operationRuntime'
import { isPlainObject } from './misc'
import { mapLimited } from './concurrency'
import {
  planGuardedAutoInclude,
  type GuardedAutoIncludePlan,
  type GuardedAutoIncludeStage,
} from './autoIncludePlannerGuarded'
import type { ModelRelationMap } from './autoIncludePlanner'
import type { AutoIncludeProgressiveVariantConfig } from './routeConfig'

const STAGE_CONCURRENCY = 4

type GuardedBaseOp =
  | 'findUnique'
  | 'findUniqueOrThrow'
  | 'findFirst'
  | 'findFirstOrThrow'

const GUARDED_BASE_OPS = new Set<string>([
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
])

export function isGuardedAutoIncludeBaseOp(op: string): op is GuardedBaseOp {
  return GUARDED_BASE_OPS.has(op)
}

export type RunGuardedAutoIncludeOptions = {
  req: Request
  res: Response
  ctx: OperationContext
  args: Record<string, unknown>
  baseOp: GuardedBaseOp
  modelName: string
  delegateKey: string
  models: Record<string, ModelRelationMap>
  variantConfig: AutoIncludeProgressiveVariantConfig
  coreQueryFn: () => Promise<unknown>
  signal?: AbortSignal
}

type GuardedDelegate = {
  resolve: (body?: unknown) => {
    shape: Record<string, unknown>
    body: Record<string, unknown>
    effectiveReadBody: Record<string, unknown>
    matchedKey: string
    wasDynamic: boolean
  }
  findFirst: (args?: unknown) => Promise<unknown>
  findFirstOrThrow: (args?: unknown) => Promise<unknown>
  findUnique: (args?: unknown) => Promise<unknown>
  findUniqueOrThrow: (args?: unknown) => Promise<unknown>
  findMany: (args?: unknown) => Promise<unknown>
}

function guarded(
  delegate: unknown,
  shape: Record<string, unknown>,
  caller: string | undefined,
): GuardedDelegate {
  const d = delegate as {
    guard?: (shape: Record<string, unknown>, caller?: string) => unknown
  }
  if (typeof d.guard !== 'function') {
    throw new HttpError(
      500,
      'Guarded auto-include requires prisma-guard extension on PrismaClient.',
    )
  }
  return d.guard(shape, caller) as GuardedDelegate
}

function createClientGoneChecker(res: Response, signal?: AbortSignal): () => boolean {
  return () => signal?.aborted === true || res.writableEnded || res.destroyed
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

function hasClientProjection(body: unknown): boolean {
  if (!isPlainObject(body)) return false
  return 'select' in body || 'include' in body || 'omit' in body
}

function handleGuardedFallback(
  options: RunGuardedAutoIncludeOptions,
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

async function runRootQuery(
  extended: unknown,
  delegateKey: string,
  rootShape: Record<string, unknown>,
  rootArgs: Record<string, unknown>,
  baseOp: GuardedBaseOp,
  caller: string | undefined,
): Promise<unknown> {
  const rootDelegate = getDelegate(extended, delegateKey)
  const g = guarded(rootDelegate, rootShape, caller)
  return g[baseOp](rootArgs)
}

async function runStage(
  base: unknown,
  models: Record<string, ModelRelationMap>,
  stage: GuardedAutoIncludeStage,
  parentValue: unknown,
  caller: string | undefined,
): Promise<unknown> {
  const rel = stage.relationField
  const parentKey = rel.parentLinkFields[0]
  const childKey = rel.childLinkFields[0]

  if (!isPlainObject(parentValue)) {
    return rel.isList ? [] : null
  }

  const linkVal = parentValue[parentKey]
  if (linkVal === undefined || linkVal === null) {
    return rel.isList ? [] : null
  }

  const targetModel = models[rel.type]
  if (!targetModel) {
    throw new HttpError(500, 'Target model not in relation metadata: ' + rel.type)
  }

  const stageArgs: Record<string, unknown> = { ...stage.stageArgs }

  if (stageArgs.where !== undefined && !isPlainObject(stageArgs.where)) {
    throw new HttpError(
      500,
      'Invalid guarded stage where for ' + stage.relationPath,
    )
  }

  const existingWhere = isPlainObject(stageArgs.where) ? stageArgs.where : {}
  stageArgs.where = {
    ...existingWhere,
    [childKey]: { in: [linkVal] },
  }

  const stageDelegate = getDelegate(base, targetModel.delegateKey)
  const g = guarded(stageDelegate, stage.stageShape, caller)

  if (rel.isList) {
    return g.findMany(stageArgs)
  }
  return g.findFirst(stageArgs)
}

async function runGuardedAutoIncludeSingle(
  options: RunGuardedAutoIncludeOptions,
  plan: GuardedAutoIncludePlan,
  extended: unknown,
): Promise<void> {
  const { res, ctx, baseOp, delegateKey, models, signal } = options
  const caller = ctx.guardCaller
  const isClientGone = createClientGoneChecker(res, signal)

  await withSSE({ res, signal, label: 'guarded-single' }, async () => {
    if (isClientGone()) return

    let rootResult: unknown
    try {
      rootResult = await runRootQuery(
        extended,
        delegateKey,
        plan.rootShape,
        plan.rootArgs,
        baseOp,
        caller,
      )
    } catch (err) {
      if (isClientGone()) return
      console.error(LOG_PREFIX, 'guarded root query failed:', err)
      sendSSEError(res, mapError(err).message)
      return
    }

    if (isClientGone()) return

    if (rootResult === null || !isPlainObject(rootResult)) {
      sendSSEResult(res, rootResult)
      return
    }

    const internal: Record<string, unknown> = { ...rootResult }
    const publicRoot: Record<string, unknown> = { ...rootResult }
    stripInternalAtScope(publicRoot, plan.internalFieldPaths, '')

    const publicState: Record<string, unknown> = { ...publicRoot }
    for (const [k, v] of Object.entries(publicRoot)) {
      if (isClientGone()) return
      const ok = sendSSEField(res, k, v)
      if (!ok) return
    }

    if (isClientGone()) return
    const okStart = sendSSEProgress(res, 'root', 0, plan.stages.length)
    if (!okStart) return

    let completed = 0
    let stageErrorMessage: string | null = null
    const isAborted = () =>
      stageErrorMessage !== null ||
      signal?.aborted === true ||
      res.writableEnded ||
      res.destroyed

    await mapLimited(plan.stages, STAGE_CONCURRENCY, async (stage) => {
      if (isAborted()) return
      try {
        const stageResult = await runStage(
          ctx.prisma,
          models,
          stage,
          internal,
          caller,
        )

        if (isAborted()) return

        internal[stage.relationName] = stageResult
        const publicVal = buildPublicForStage(
          stageResult,
          plan.internalFieldPaths,
          stage.relationPath,
        )
        publicState[stage.relationName] = publicVal

        const okField = sendSSEField(res, stage.relationName, publicVal)
        if (!okField) return
      } catch (err) {
        if (isAborted()) return
        console.error(LOG_PREFIX, 'guarded stage failed:', stage.relationPath, err)
        stageErrorMessage = mapError(err).message
        return
      }

      if (isAborted()) return
      completed++
      const okProg = sendSSEProgress(res, stage.relationPath, completed, plan.stages.length)
      if (!okProg) return
    })

    if (isClientGone()) return

    if (stageErrorMessage) {
      safeSendError(res, stageErrorMessage)
      return
    }

    if (res.writableEnded || res.destroyed) return
    sendSSEResult(res, publicState)
  })
}

export async function runGuardedAutoIncludeProgressive(
  options: RunGuardedAutoIncludeOptions,
): Promise<void> {
  if (hasClientProjection(options.args)) {
    return handleGuardedFallback(
      options,
      'guarded auto-progressive fallback: client projection rejected under guarded MVP',
    )
  }

  const guardShape = options.ctx.guardShape
  if (!guardShape) {
    return handleGuardedFallback(
      options,
      'guarded auto-progressive fallback: guardShape missing',
    )
  }

  let extended: unknown
  try {
    extended = await getExtendedClient(options.ctx)
  } catch (err) {
    return handleGuardedFallback(
      options,
      'guarded auto-progressive fallback: getExtendedClient failed: ' + mapError(err).message,
    )
  }

  let resolved: {
    shape: Record<string, unknown>
    body: Record<string, unknown>
    effectiveReadBody: Record<string, unknown>
  }
  try {
    const rootDelegate = getDelegate(extended, options.delegateKey)
    const g = guarded(rootDelegate, guardShape, options.ctx.guardCaller)
    resolved = g.resolve(options.args)
  } catch (err) {
    return handleGuardedFallback(
      options,
      'guarded auto-progressive fallback: resolve failed: ' + mapError(err).message,
    )
  }

  const plan = planGuardedAutoInclude({
    rootModelName: options.modelName,
    models: options.models,
    effectiveReadBody: resolved.effectiveReadBody,
    shape: resolved.shape,
  })

  if (plan.unsupportedReason) {
    return handleGuardedFallback(options, plan.unsupportedReason)
  }

  if (plan.stages.length === 0) {
    return runSingleResultSSE({
      req: options.req,
      res: options.res,
      coreQueryFn: options.coreQueryFn,
    })
  }

  return runGuardedAutoIncludeSingle(options, plan, extended)
}