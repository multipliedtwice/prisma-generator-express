import {
  fromJsonSchema,
  McpServer,
  type AuthInfo,
  type StandardSchemaWithJSON,
} from '@modelcontextprotocol/server'
import {
  normalizeOperation,
  validateOperationConfig,
  type NormalizedOperationConfig,
  type OperationConfigInput,
  type PaginationConfig,
} from './routeConfig'
import {
  getEnv,
  isPlainObject,
  resolveDropGuardEnv,
  sanitizeKeys,
} from './misc'
import {
  routeOperation,
  prepareGuardOperation,
  settleStage,
  classifyError,
  memoizeContext,
  executeOperation,
  requirePrisma,
  type ArgsChannel,
  type RouteStageOk,
} from './operationPipeline'
import { transformResult, type OperationContext } from './operationRuntime'
import { HttpError } from './errorMapper'
import {
  argsShapeConfigProblem,
  buildModelAwareArgsSchema,
  buildModelAwareWriteArgsSchema,
  writeShapeConfigProblem,
  type WriteSchemaOperation,
  type SchemaFieldMeta,
  type SchemaModelMeta,
} from './operationSchemas'

export type { SchemaFieldMeta, SchemaModelMeta }
import { mergePaginationConfig } from './pagination'
import type { OpKind } from './projectionDefaults'
import { OPERATION_BY_NAME } from './operationDefinitions'

/**
 * MCP transport over the shared operation pipeline: explicitly allowlisted
 * read actions and guarded write actions (no updateEach), each represented
 * as one tool.
 *
 * Reuses the REST core: variant resolution, guard enforcement, pagination,
 * operation overrides, memoized context, the Prisma operation core,
 * transformResult and error classification. The only MCP-owned policy is the
 * `authorize` callback, and it runs AFTER variant settlement and BEFORE any
 * application-context resolution, dynamic guard-shape evaluation or database
 * call — a denied call performs zero work.
 *
 * The verified principal is REQUIRED: registration refuses to run without
 * one, and every call re-reads it from the SDK's per-request context
 * (`ctx.http.authInfo`). A call without verified authentication is denied
 * before any work.
 */

export type McpAuthInfo = AuthInfo

/** Hooks are opaque here: MCP only checks presence, never calls them. */
type McpHook = (...args: never[]) => unknown

/** Everything `server.registerTool` needs, computed BEFORE any mutation. */
export interface McpRegistration {
  name: string
  config: {
    description?: string
    annotations?: {
      readOnlyHint?: boolean
      destructiveHint?: boolean
      idempotentHint?: boolean
      openWorldHint?: boolean
    }
    inputSchema: StandardSchemaWithJSON<Record<string, unknown>>
  }
  handler: (
    args: Record<string, unknown>,
    ctx?: McpCallContext,
  ) => Promise<{
    content: Array<{ type: 'text'; text: string }>
    isError?: boolean
  }>
}

/** The five read operations exposed in this release. */
export type McpReadOperation =
  | 'findMany'
  | 'findUnique'
  | 'findFirst'
  | 'count'
  | 'findManyPaginated'

const MCP_READ_OPERATIONS: ReadonlySet<string> = new Set([
  'findMany',
  'findUnique',
  'findFirst',
  'count',
  'findManyPaginated',
])

/**
 * Every guarded write operation. `updateEach` is NOT one: it bypasses guard
 * shapes entirely, so no MCP tool can expose it under the fail-closed rules.
 */
export type McpWriteOperation = WriteSchemaOperation

const MCP_WRITE_OPERATIONS: ReadonlySet<string> = new Set([
  'create',
  'createMany',
  'createManyAndReturn',
  'update',
  'updateMany',
  'updateManyAndReturn',
  'upsert',
  'delete',
  'deleteMany',
])

/** OpKind per write op (the dropped-guard vocabulary; MCP never drops). */
const WRITE_OP_KIND: Record<McpWriteOperation, OpKind> = {
  create: 'create',
  createMany: 'createMany',
  createManyAndReturn: 'createMany',
  update: 'update',
  updateMany: 'updateMany',
  updateManyAndReturn: 'updateMany',
  upsert: 'upsert',
  delete: 'delete',
  deleteMany: 'deleteMany',
}

/** Thrown by an `authorize` callback to DENY a call. */
export class McpAuthorizationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'McpAuthorizationError'
  }
}

/** Result payload exceeded the serialized-size cap. */
export class McpResultSizeError extends Error {
  constructor(maxBytes: number) {
    super(
      'Result exceeds the MCP result-size cap of ' +
        maxBytes +
        ' UTF-8 bytes. Narrow the query: reduce take, or use select to return fewer fields.',
    )
    this.name = 'McpResultSizeError'
  }
}

export interface McpSharedOptions {
  /** The Prisma client (or extended client) tools execute against. */
  prisma: unknown
  /**
   * Maps the verified AuthInfo to the guard routing key. The caller string is
   * a ROUTING KEY ONLY — never an identity, never taken from tool arguments.
   */
  resolveCaller: (authInfo: AuthInfo) => string | undefined
  /**
   * MCP-only authorization. Runs after variant settlement, before any context
   * resolution, dynamic shape evaluation or database call. Denial = throw
   * `McpAuthorizationError`; any other throw becomes a classified internal
   * error. Exceptions are never treated as allow.
   */
  authorize: (input: {
    principal: AuthInfo
    model: string
    operation: string
    args: Record<string, unknown>
    variant: string | undefined
  }) => void | Promise<void>
  /** Injected when a list query omits `take`. */
  defaultLimit: number
  /** take is clamped down to this before the guard applies its own limits. */
  maxLimit: number
  /** Cap on the UTF-8 byte size of the final serialized result. */
  maxResultBytes: number
  /** Application context for dynamic guard shapes and overrides. */
  resolveContext?: (authInfo: AuthInfo) => unknown
  /**
   * The VERIFIED principal for this registration. The mount glue passes the
   * per-request factory's `ctx.authInfo`; registration refuses to run without
   * it, and every call re-verifies against the SDK request context.
   */
  authInfo: AuthInfo
}

export interface McpToolContribution {
  readonly model: string
  readonly operation: string
  /**
   * Preflight. Runs for EVERY contribution before ANY registers, so one bad
   * tool cannot leave a partially registered set behind.
   */
  validate(shared: McpSharedOptions): void
  /**
   * Builds the registration payload WITHOUT touching the server. Runs for
   * every contribution before `registerTool` is called on any of them, so
   * duplicate names or late schema failures cannot leave a partial set.
   * Returns null when this caller gets no tool (unresolvable variant).
   */
  prepare(shared: McpSharedOptions, authInfo: AuthInfo): McpRegistration | null
}

function positiveSafeInteger(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw new Error(
      'registerMcpTools: ' +
        name +
        ' must be a positive safe integer, got ' +
        String(value),
    )
  }
  return value
}

function looksLikeAuthInfo(value: unknown): value is AuthInfo {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>).clientId === 'string'
  )
}

/**
 * Fail closed, before a single tool is validated: verified principal present,
 * every required callback present, every numeric option valid, and NO
 * effective guard drop in this process. `allowE2EGuardBypass` on a REST
 * config cannot change this — MCP never honours the bypass.
 */
export function validateMcpSharedOptions(
  options: Partial<McpSharedOptions>,
): void {
  if (typeof options.prisma !== 'object' || options.prisma === null) {
    throw new Error(
      'registerMcpTools: prisma is required — the guarded client the tools execute against.',
    )
  }
  if (!looksLikeAuthInfo(options.authInfo)) {
    throw new Error(
      "registerMcpTools: a verified authInfo is required. Pass the per-request factory's ctx.authInfo; MCP never serves an unauthenticated caller.",
    )
  }
  if (typeof options.resolveCaller !== 'function') {
    throw new Error(
      'registerMcpTools: resolveCaller is required. It maps the verified AuthInfo to the guard routing key.',
    )
  }
  if (typeof options.authorize !== 'function') {
    throw new Error(
      'registerMcpTools: authorize is required. Deny by throwing McpAuthorizationError.',
    )
  }
  const defaultLimit = positiveSafeInteger(options.defaultLimit, 'defaultLimit')
  const maxLimit = positiveSafeInteger(options.maxLimit, 'maxLimit')
  positiveSafeInteger(options.maxResultBytes, 'maxResultBytes')
  if (defaultLimit > maxLimit) {
    throw new Error(
      'registerMcpTools: defaultLimit (' +
        defaultLimit +
        ') must not exceed maxLimit (' +
        maxLimit +
        ').',
    )
  }
  if (resolveDropGuardEnv(getEnv())) {
    throw new Error(
      'registerMcpTools: refusing to register MCP tools because the guard is dropped in this environment ' +
        '(PGE_DROP_GUARD=true or the deprecated E2E=true). MCP is fail-closed and offers no bypass.',
    )
  }
}

type TakeConfig =
  | { kind: 'number'; max: number; default: number }
  | { kind: 'object'; max: number; default?: number }
  | { kind: 'none' }

function takeConfigOfShape(shape: unknown): TakeConfig {
  if (!isPlainObject(shape)) return { kind: 'none' }
  const take = shape.take
  if (typeof take === 'number') {
    return { kind: 'number', max: take, default: take }
  }
  if (isPlainObject(take)) {
    const max = typeof take.max === 'number' ? take.max : undefined
    if (max === undefined) return { kind: 'none' }
    const def = typeof take.default === 'number' ? take.default : undefined
    return { kind: 'object', max, default: def }
  }
  return { kind: 'none' }
}

function requireListShapeTake(
  shape: unknown,
  location: string,
  defaultLimit: number,
): void {
  const cfg = takeConfigOfShape(shape)
  if (cfg.kind === 'none') {
    throw new Error(
      location +
        ': every exposed findMany/findManyPaginated shape must declare take ' +
        '(take: N or take: { max, default? }); without it MCP cannot bound rows.',
    )
  }
  if (cfg.max < defaultLimit) {
    throw new Error(
      location +
        ': shape take.max (' +
        cfg.max +
        ') is below defaultLimit (' +
        defaultLimit +
        '), so the injected default would be rejected. Raise take.max or lower defaultLimit.',
    )
  }
}

function opKindOf(operation: string): OpKind {
  if (operation === 'findUnique') return 'readUnique'
  if (isWriteOperation(operation)) return WRITE_OP_KIND[operation]
  return 'read'
}

function isWriteOperation(operation: string): operation is McpWriteOperation {
  return MCP_WRITE_OPERATIONS.has(operation)
}

function snakeCase(value: string): string {
  return value.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase()).replace(/^_/, '')
}

function toolName(model: string, operation: string): string {
  return snakeCase(model) + '_' + snakeCase(operation)
}

function isErrorResult(
  message: string,
  status?: number,
): {
  content: Array<{ type: 'text'; text: string }>
  isError: boolean
} {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          status === undefined ? { message } : { message, status },
        ),
      },
    ],
    isError: true,
  }
}

export interface CreateMcpReadToolInput {
  model: string
  operation: McpReadOperation
  config: Record<string, unknown>
  core: (ctx: OperationContext) => Promise<unknown>
  /** This model's fields (from the emitted *Metadata.ts). */
  fields: readonly SchemaFieldMeta[]
  /** This model's enum value maps: enum name -> values. */
  enums: ReadonlyMap<string, readonly string[]>
  /**
   * Related models' full metadata, for recursive select/include narrowing
   * (compound uniques ride along so nested cursors keep their selectors).
   */
  modelIndex: ReadonlyMap<string, SchemaModelMeta>
  /**
   * Compound unique constraints of this model. `selector` is the compound
   * client-input key (fields joined with '_'); `fields` are the columns.
   */
  compoundUniques?: ReadonlyArray<{
    selector: string
    fields: readonly string[]
  }>
  /** This model's unique field names (id + @unique columns). */
  uniqueFields?: readonly string[]
}

/** What the SDK v2 tool callback actually receives over HTTP. */
export interface McpCallContext {
  http?: { authInfo?: AuthInfo }
}

/** The generator's `writeStrategy`, baked into every emitted write factory. */
export type McpWriteStrategy = 'regular' | 'throwOnNonReturning' | 'forceReturn'

export type CreateMcpWriteToolInput = Omit<
  CreateMcpReadToolInput,
  'operation'
> & {
  operation: McpWriteOperation
  /**
   * What the operation core actually calls for createMany/updateMany:
   * `forceReturn` routes them to the returning guard methods (projection
   * allowed), `throwOnNonReturning` makes their cores 501 on every call.
   * Defaults to `regular`.
   */
  writeStrategy?: McpWriteStrategy
}

/**
 * The guard method the operation core really invokes under the generator's
 * writeStrategy (mirrors generateOperationCore decideWriteOp): the schema
 * and shape validation follow THAT method, never the tool's name.
 */
function effectiveWriteOperation(
  operation: McpWriteOperation,
  strategy: McpWriteStrategy,
): McpWriteOperation {
  if (strategy !== 'forceReturn') return operation
  if (operation === 'createMany') return 'createManyAndReturn'
  if (operation === 'updateMany') return 'updateManyAndReturn'
  return operation
}

/**
 * Creates one model-operation tool contribution. Registration-time refusals
 * (missing guard, REST hooks present) throw HERE, at creation, so a
 * misconfigured deployment fails at boot with the offending model and
 * operation named. Static limit checks run in `validate`, which
 * `registerMcpTools` runs for every contribution before registering any.
 */
export function createMcpReadTool(
  input: CreateMcpReadToolInput,
): McpToolContribution {
  return createMcpOperationTool(input, false)
}

/**
 * The write twin: same pipeline, same fail-closed rules, plus the write-shape
 * contract — data configs must be statically mirrorable (no relation writes,
 * no inline refines) or registration refuses.
 */
export function createMcpWriteTool(
  input: CreateMcpWriteToolInput,
): McpToolContribution {
  return createMcpOperationTool(input, true)
}

function createMcpOperationTool(
  input: CreateMcpReadToolInput | CreateMcpWriteToolInput,
  write: boolean,
): McpToolContribution {
  const operationName: string = input.operation
  if (write && operationName === 'updateEach') {
    throw new Error(
      'MCP tool for ' +
        input.model +
        '.updateEach: refused. updateEach bypasses guard shapes entirely, ' +
        'and every MCP tool must execute through a guard.',
    )
  }
  const allowedOperations = write ? MCP_WRITE_OPERATIONS : MCP_READ_OPERATIONS
  if (!allowedOperations.has(input.operation)) {
    throw new Error(
      'MCP tool for ' +
        input.model +
        '.' +
        input.operation +
        ': this release exposes ' +
        (write
          ? 'create, createMany, createManyAndReturn, update, updateMany, updateManyAndReturn, upsert, delete and deleteMany only.'
          : 'findMany, findUnique, findFirst, count and findManyPaginated only.'),
    )
  }

  const location = input.model + '.' + input.operation + ' (MCP)'
  const writeStrategy: McpWriteStrategy =
    'writeStrategy' in input && input.writeStrategy
      ? input.writeStrategy
      : 'regular'
  if (
    write &&
    writeStrategy === 'throwOnNonReturning' &&
    (operationName === 'createMany' || operationName === 'updateMany')
  ) {
    throw new Error(
      location +
        ': disabled by writeStrategy="throwOnNonReturning" — its operation ' +
        'core returns 501 for every call. Expose the returning variant ' +
        '(' +
        operationName +
        'AndReturn) instead.',
    )
  }
  // the guard method the core invokes: schemas and shape validation follow it
  const schemaOperation = isWriteOperation(input.operation)
    ? effectiveWriteOperation(input.operation, writeStrategy)
    : undefined
  const raw = input.config[input.operation]
  validateOperationConfig(
    raw as { shape?: unknown; variants?: unknown } | undefined,
    location,
  )
  const opConfig = normalizeOperation<McpHook, McpHook>(
    raw as OperationConfigInput<McpHook, McpHook> | undefined,
  )

  if (!opConfig.guardShape) {
    throw new Error(
      location +
        ': no guard configured. Every MCP-exposed operation requires a guard shape or variants; read and write tools are not exempt.',
    )
  }

  const hookViolations: string[] = []
  if (opConfig.authorize !== undefined) hookViolations.push('authorize')
  if (opConfig.operationBefore.length > 0) hookViolations.push('before')
  if (opConfig.operationAfter.length > 0) hookViolations.push('after')
  for (const [key, hooks] of Object.entries(opConfig.variantHooks)) {
    if (hooks.before.length > 0)
      hookViolations.push('variants.' + key + '.before')
    if (hooks.after.length > 0)
      hookViolations.push('variants.' + key + '.after')
  }
  if (hookViolations.length > 0) {
    throw new Error(
      location +
        ': the REST configuration defines hooks (' +
        hookViolations.join(', ') +
        '). MCP refuses to expose an operation whose transport-specific policy ' +
        'would be silently ignored. Remove the hooks or keep the operation REST-only.',
    )
  }

  // write schemas are narrowed from a STATIC shape only: a dynamic write
  // shape would need an opaque data/where surface, which MCP refuses
  if (write) {
    const shapes =
      opConfig.guardRouting.kind === 'named'
        ? Object.entries(opConfig.guardShape as Record<string, unknown>)
        : [['', opConfig.guardShape] as const]
    for (const [key, entry] of shapes) {
      if (typeof entry === 'function') {
        throw new Error(
          location +
            (key ? ' variant "' + key + '"' : '') +
            ': dynamic (function) write shapes are refused. MCP write tools ' +
            'advertise a schema narrowed from a static shape; use static ' +
            'shapes (per-tenant variants for tenant-forced values).',
        )
      }
    }
  }

  const isList =
    input.operation === 'findMany' || input.operation === 'findManyPaginated'

  const meta = OPERATION_BY_NAME[input.operation]
  const mergedPagination = mergePaginationConfig(
    input.config.pagination as Partial<PaginationConfig> | undefined,
    opConfig.pagination,
  )
  const modelMeta: SchemaModelMeta = {
    name: input.model,
    fields: input.fields,
    enums: input.enums,
    uniqueFields:
      input.uniqueFields ??
      input.fields
        .filter((f) => f.isId || f.isUnique === true)
        .map((f) => f.name),
    compoundUniques: input.compoundUniques ?? [],
    modelIndex: input.modelIndex,
  }

  return {
    model: input.model,
    operation: input.operation,

    validate(shared: McpSharedOptions): void {
      const shapeIsObject = isPlainObject(opConfig.guardShape)
      if (isList && shapeIsObject) {
        const routing = opConfig.guardRouting
        if (routing.kind === 'named') {
          for (const key of routing.keys) {
            const entry = (opConfig.guardShape as Record<string, unknown>)[key]
            // a function variant is resolved per call; its contracts are
            // enforced after resolution, not here
            if (typeof entry === 'function') continue
            requireListShapeTake(
              entry,
              location + ' variant "' + key + '"',
              shared.defaultLimit,
            )
          }
        } else {
          requireListShapeTake(
            opConfig.guardShape,
            location,
            shared.defaultLimit,
          )
        }
      }
      // guard-config validity per exposed variant — the COMPLETE shape,
      // not just where: guard 1.33 rejects (or crashes on) invalid cursor,
      // orderBy, distinct, select, include, _count AND write data/where
      // configs for EVERY input too, so the tool must not register —
      // fail closed at boot
      const checkShape = (shape: unknown, loc: string): void => {
        if (!isPlainObject(shape)) return
        const problem = write
          ? writeShapeConfigProblem(
              modelMeta,
              schemaOperation ?? input.operation,
              shape,
            )
          : argsShapeConfigProblem(modelMeta, input.operation, shape)
        if (problem) {
          throw new Error(loc + ': ' + problem)
        }
      }
      if (shapeIsObject) {
        const routing = opConfig.guardRouting
        if (routing.kind === 'named') {
          for (const key of routing.keys) {
            const entry = (opConfig.guardShape as Record<string, unknown>)[key]
            if (typeof entry === 'function') continue
            checkShape(entry, location + ' variant "' + key + '"')
          }
        } else {
          checkShape(opConfig.guardShape, location)
        }
      }
    },

    prepare(
      shared: McpSharedOptions,
      authInfo: AuthInfo,
    ): McpRegistration | null {
      const caller = shared.resolveCaller(authInfo)
      const routed = routeOperation({
        guardRouting: opConfig.guardRouting,
        caller,
      })
      // Fail closed: a caller whose variant cannot be resolved gets NO tool.
      if (!routed.ok) return null

      const variantShape =
        routed.variantKey !== undefined &&
        isPlainObject(opConfig.guardShape) &&
        routed.variantKey in (opConfig.guardShape as Record<string, unknown>)
          ? (opConfig.guardShape as Record<string, unknown>)[routed.variantKey]
          : opConfig.guardShape

      const schema = schemaOperation
        ? buildModelAwareWriteArgsSchema(
            schemaOperation,
            modelMeta,
            variantShape,
          )
        : buildModelAwareArgsSchema(input.operation, modelMeta, variantShape)
      const takeCfg = takeConfigOfShape(variantShape)
      const effectiveMax =
        takeCfg.kind === 'none'
          ? shared.maxLimit
          : Math.min(shared.maxLimit, takeCfg.max)

      const description = write
        ? 'Guarded ' +
          input.operation +
          ' over ' +
          input.model +
          ' through the same pipeline as REST: guard enforcement, forced values, classified errors.' +
          ' Explicitly allowlisted by the application; authorization runs before any database call.' +
          (meta.destructive
            ? ' This operation is destructive (destructiveHint).'
            : '') +
          ' Results larger than ' +
          shared.maxResultBytes +
          ' UTF-8 bytes are rejected.'
        : 'Read-only ' +
          input.operation +
          ' over ' +
          input.model +
          ' through the guarded REST pipeline.' +
          (isList
            ? ' Rows are limited: take defaults to ' +
              shared.defaultLimit +
              ', must be a positive integer, and is clamped down to ' +
              effectiveMax +
              " (the guard shape may cap lower); take above the guard shape's own max is rejected."
            : '') +
          ' Results larger than ' +
          shared.maxResultBytes +
          ' UTF-8 bytes are rejected — narrow take or select.'

      // every tool acts on this application's own database — a closed world
      // (the MCP default for openWorldHint is true)
      const annotations = {
        readOnlyHint: meta.readOnly,
        destructiveHint: meta.destructive,
        idempotentHint: meta.idempotent,
        openWorldHint: false,
      }

      return {
        name: toolName(input.model, input.operation),
        config: {
          description,
          annotations,
          inputSchema: fromJsonSchema<Record<string, unknown>>(
            schema as Parameters<typeof fromJsonSchema>[0],
          ),
        },
        handler: (args: Record<string, unknown>, ctx?: McpCallContext) =>
          runMcpCall({
            input,
            opConfig,
            mergedPagination,
            shared,
            validatedArgs: args,
            principal: ctx?.http?.authInfo,
            isList,
            write,
          }),
      }
    },
  }
}

async function runMcpCall(deps: {
  input: CreateMcpReadToolInput | CreateMcpWriteToolInput
  opConfig: NormalizedOperationConfig<McpHook, McpHook>
  mergedPagination: PaginationConfig | undefined
  shared: McpSharedOptions
  validatedArgs: Record<string, unknown>
  principal: AuthInfo | undefined
  isList: boolean
  write: boolean
}): Promise<{
  content: Array<{ type: 'text'; text: string }>
  isError?: boolean
}> {
  const { input, opConfig, shared, isList, write } = deps
  const location = input.model + '.' + input.operation + ' (MCP)'
  try {
    // Fail closed on missing verified authentication BEFORE any work.
    const principal = deps.principal
    if (!looksLikeAuthInfo(principal)) {
      return isErrorResult('unauthenticated: a verified principal is required')
    }

    const sanitized = sanitizeKeys(deps.validatedArgs)
    // a fully forced selector leaves `where` optional in the schema; the operation
    // core still requires the body field (REST parity), so the empty object
    // is injected and guard merges the forced selector into it
    const args =
      write &&
      sanitized.where === undefined &&
      OPERATION_BY_NAME[input.operation].requiredBodyFields.includes('where')
        ? { ...sanitized, where: {} }
        : sanitized
    // REST write routes carry no query channel: parsedQuery stays empty and
    // the body channel alone feeds the operation core
    const holder: { value?: Record<string, unknown> } = {
      value: write ? {} : args,
    }
    const channel: ArgsChannel = {
      read: () => holder.value,
      write: (next) => {
        holder.value = next
      },
    }

    // 2-3. route + settle variant, re-resolved for THIS call from the verified
    // principal (the registration-time resolution only chose the tool set)
    const caller = shared.resolveCaller(principal)
    const routed: RouteStageOk = (() => {
      const result = routeOperation({
        guardRouting: opConfig.guardRouting,
        caller,
      })
      settleStage(result)
      return result
    })()

    // 4. MCP authorize — before context, before shape evaluation, before Prisma
    await shared.authorize({
      principal,
      model: input.model,
      operation: input.operation,
      args,
      variant: routed.variantKey,
    })

    // 5-6. prepareGuard + settle, with resolved-shape validation ALWAYS on
    const getContext = memoizeContext(() => shared.resolveContext?.(principal))
    const guard = await prepareGuardOperation(routed, {
      guardShape: opConfig.guardShape,
      opKind: opKindOf(input.operation),
      policy: { dropGuard: false, validateResolvedShapes: true },
      getContext,
      args: channel,
      writeArgs: undefined,
    })
    settleStage(guard)

    // dynamic list shapes: the resolved shape must bound rows, with room for
    // the injected default — classified 500, no database call
    if (isList) {
      const resolvedMap = guard.guardShape
      const shapeForCheck =
        routed.variantKey !== undefined && isPlainObject(resolvedMap)
          ? (resolvedMap as Record<string, unknown>)[routed.variantKey]
          : resolvedMap
      requireListShapeTake(
        shapeForCheck,
        location + ' resolved shape',
        shared.defaultLimit,
      )
    }

    // pre-guard take normalization for list queries: take must be a positive
    // integer (the guard rejects anything else); above maxLimit clamps down
    if (isList) {
      const current = holder.value as Record<string, unknown>
      const raw = current.take
      if (raw === undefined) {
        current.take = shared.defaultLimit
      } else if (
        typeof raw !== 'number' ||
        !Number.isFinite(raw) ||
        !Number.isInteger(raw) ||
        raw <= 0
      ) {
        throw new HttpError(400, 'Invalid take: must be a positive integer')
      } else {
        // the effective bound is the smaller of maxLimit and the resolved
        // shape's take.max — exactly what the tool description states; the
        // guard's own stricter rejection sits behind this as backstop
        const resolvedShape =
          routed.variantKey !== undefined && isPlainObject(guard.guardShape)
            ? (guard.guardShape as Record<string, unknown>)[routed.variantKey]
            : guard.guardShape
        const takeCfg = takeConfigOfShape(resolvedShape)
        const effectiveMax =
          takeCfg.kind === 'none'
            ? shared.maxLimit
            : Math.min(shared.maxLimit, takeCfg.max)
        if (raw > effectiveMax) {
          current.take = effectiveMax
        }
      }
    }

    // 7. execute — the SAME shared stage REST uses. Write cores read their
    // arguments from ctx.body, exactly like the REST write routes: the tool
    // arguments ARE the request body.
    const result = await executeOperation(
      { variantKey: routed.variantKey, caller: routed.caller },
      { guardShape: guard.guardShape },
      {
        core: input.core,
        args: channel,
        body: write ? args : undefined,
        prisma: requirePrisma(shared.prisma),
        pagination: deps.mergedPagination,
        override: opConfig.override,
        getContext,
      },
    )

    const transformed = transformResult(result)
    const json = JSON.stringify(transformed)

    // 9. result-size enforcement on the final serialized payload
    const bytes = new TextEncoder().encode(json).byteLength
    if (bytes > shared.maxResultBytes) {
      // a write is already COMMITTED here: an error would invite a retry
      // (a duplicate create, a second update). Report success with the
      // result omitted instead; reads keep the narrowing error.
      if (write) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                committed: true,
                resultOmitted: true,
                message:
                  input.operation +
                  ' on ' +
                  input.model +
                  ' was committed. Its result (' +
                  bytes +
                  ' UTF-8 bytes) exceeds the MCP result-size cap of ' +
                  shared.maxResultBytes +
                  ' bytes and was omitted. Do not retry; read the affected records with a narrower select.',
              }),
            },
          ],
        }
      }
      throw new McpResultSizeError(shared.maxResultBytes)
    }

    // 10. MCP response encoding
    return { content: [{ type: 'text', text: json }] }
  } catch (error) {
    // actionable MCP-specific failures keep their message in EVERY
    // environment — classifyError would strip them under NODE_ENV=production
    if (error instanceof McpAuthorizationError) {
      return isErrorResult(error.message)
    }
    if (error instanceof McpResultSizeError) {
      return isErrorResult(error.message)
    }
    const classified = classifyError(error)
    return isErrorResult(classified.message, classified.status)
  }
}

/**
 * App-level registry. `tools` is the explicit allowlist: only the model-op
 * contributions the application passes in are registered — `enableAll` on a
 * REST config never implies MCP exposure.
 *
 * Contract: `server` must be FRESH for this registration (the mount glue's
 * per-request factory guarantees it — each request constructs a new
 * McpServer). Under that contract registration is all-or-nothing: every
 * contribution is validated, every payload prepared, names checked for
 * duplicates and for pre-existing registrations (SDK introspection), and the
 * whole set rehearsed on a throwaway McpServer BEFORE the caller's server is
 * mutated. A server reused across registrations falls outside this contract.
 */
export function registerMcpTools(
  server: McpServer,
  options: Partial<McpSharedOptions> & {
    tools: readonly McpToolContribution[]
  },
): void {
  validateMcpSharedOptions(options)
  if (!Array.isArray(options.tools)) {
    throw new Error('registerMcpTools: tools must be an array of contributions')
  }
  const shared = options as McpSharedOptions
  // pass 1: preflight everything — one invalid tool registers nothing
  for (const tool of options.tools) {
    tool.validate(shared)
  }
  // pass 2: build every payload; nothing has touched the server yet, so a
  // duplicate name or a late failure here still leaves zero tools registered
  const registrations: McpRegistration[] = []
  for (const tool of options.tools) {
    const registration = tool.prepare(shared, shared.authInfo)
    if (registration) registrations.push(registration)
  }
  const names = new Set<string>()
  for (const registration of registrations) {
    if (names.has(registration.name)) {
      throw new Error(
        'registerMcpTools: duplicate tool name "' +
          registration.name +
          '" — two contributions resolved to the same tool.',
      )
    }
    names.add(registration.name)
  }
  // pass 3: detect names ALREADY registered on the caller's server — the SDK
  // exposes registered input schemas by name, and a collision would silently
  // overwrite an existing tool. Best-effort: disabled tools are invisible to
  // this introspection, which is exactly why the contract requires a FRESH
  // server (the mount glue provides one per request).
  for (const registration of registrations) {
    const introspect = (
      server as {
        toolInputSchemaJson?: (
          name: string,
        ) => Record<string, unknown> | undefined
      }
    ).toolInputSchemaJson?.bind(server)
    if (introspect && introspect(registration.name) !== undefined) {
      throw new Error(
        'registerMcpTools: "' +
          registration.name +
          '" is already registered on this server. MCP never overwrites an existing tool.',
      )
    }
  }
  // pass 4: REHEARSE on a throwaway real McpServer — the SDK performs its
  // own validation (schema checks, per-server duplicate detection) inside
  // registerTool, so any throw there happens before the caller's server is
  // touched. The rehearsal instance is discarded.
  const rehearsal = new McpServer({
    name: 'registration-rehearsal',
    version: '0.0.0',
  })
  for (const registration of registrations) {
    rehearsal.registerTool(
      registration.name,
      registration.config,
      registration.handler,
    )
  }
  // pass 4: mutate the real server
  for (const registration of registrations) {
    server.registerTool(
      registration.name,
      registration.config,
      registration.handler,
    )
  }
}
