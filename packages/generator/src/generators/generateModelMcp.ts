import type { DMMF } from '@prisma/generator-helper'
import type { ImportStyle } from '../utils/resolveImportStyle'
import { importExt } from '../utils/importExt'
import { OPERATION_METADATA } from '../copy/operationDefinitions'
import type { WriteStrategy } from '../constants'

const MCP_OPS = [
  { name: 'findMany', coreName: 'findMany' },
  { name: 'findUnique', coreName: 'findUnique' },
  { name: 'findFirst', coreName: 'findFirst' },
  { name: 'count', coreName: 'count' },
  { name: 'findManyPaginated', coreName: 'findManyPaginated' },
] as const

/**
 * Every guarded write op from the shared metadata. `updateEach` is excluded:
 * it bypasses guard shapes, so it has no MCP factory.
 */
const MCP_WRITE_OPS = OPERATION_METADATA.filter(
  (m) => (m.kind === 'write' || m.kind === 'batch') && m.name !== 'updateEach',
).map((m) => ({ name: m.name, coreName: m.coreName }))

/** Matches MAX_PROJECTION_DEPTH in operationSchemas.ts. */
const MAX_PROJECTION_DEPTH = 4

/**
 * The models reachable from `model` through relation fields, to the supported
 * projection depth. Schema narrowing recurses into nested select/include
 * trees through this set — a `User → Post → Comment` projection stays
 * model-aware at `Comment` instead of degrading to an opaque object.
 */
function transitiveRelations(
  model: DMMF.Model,
  allModels: readonly DMMF.Model[],
): string[] {
  // allModels is the EMITTED model set: models turned off with
  /// @generator off have no metadata file, so they are opaque here
  const byName = new Map(allModels.map((m) => [m.name, m]))
  const involved = new Set<string>([model.name])
  let frontier = [model.name]
  for (let depth = 0; depth < MAX_PROJECTION_DEPTH; depth++) {
    const next: string[] = []
    for (const name of frontier) {
      const m = byName.get(name)
      if (!m) continue
      for (const field of m.fields) {
        if (
          field.kind === 'object' &&
          byName.has(field.type) &&
          !involved.has(field.type)
        ) {
          involved.add(field.type)
          next.push(field.type)
        }
      }
    }
    if (next.length === 0) break
    frontier = next
  }
  return [...involved].filter((n) => n !== model.name)
}

/**
 * Per-model MCP tool factories: one named export per exposed operation (five
 * reads plus every guarded write), each returning a
 * `McpToolContribution` the application passes to `registerMcpTools`.
 * Importing only the operations you expose is the same static assembly
 * boundary the Hono parts use — unselected operations never enter the module
 * graph, and write tools exist ONLY where application code imports them.
 *
 * Schema narrowing is model-aware and transitive: each tool carries this
 * model's metadata plus the metadata of every model reachable through its
 * relations (to the supported projection depth), so nested `select`/`include`
 * trees stay narrowed at every level, with enum values available throughout.
 */
export function generateModelMcp({
  model,
  allModels,
  importStyle,
  writeStrategy,
}: {
  model: DMMF.Model
  allModels: readonly DMMF.Model[]
  importStyle: ImportStyle
  /** Same value the operation cores were generated with. */
  writeStrategy: WriteStrategy
}): string {
  const ext = importExt(importStyle)
  const modelName = model.name
  const lower = modelName.charAt(0).toLowerCase() + modelName.slice(1)
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

  const related = transitiveRelations(model, allModels)
  // Model directories are keyed by the RAW model name for every target
  // (writeFileSafely ignores pathCase for directories), so raw-name imports
  // are correct under every pathCase configuration.
  const relatedImports = related
    .map(
      (t) =>
        `import { MODEL_FIELDS as ${t}Fields, MODEL_ENUMS as ${t}Enums, COMPOUND_ID as ${t}CompoundId, COMPOUND_UNIQUES as ${t}CompoundUniques } from '../${t}/${t}Metadata${ext}'`,
    )
    .join('\n')
  const enumSets = [modelName, ...related]
    .map(
      (t) =>
        `for (const e of ${t === modelName ? 'MODEL_ENUMS' : t + 'Enums'}) {
  enums.set(e.name, e.values.map((v) => v.name))
}`,
    )
    .join('\n')
  const coreEntries = [modelName, ...related]
    .map((t) => {
      const fields = t === modelName ? 'MODEL_FIELDS' : t + 'Fields'
      const compound =
        t === modelName
          ? 'compoundUniques'
          : `(() => {
  const list: Array<{ selector: string; fields: string[] }> = []
  if (${t}CompoundId) {
    list.push({ selector: ${t}CompoundId.selector, fields: [...${t}CompoundId.fields] })
  }
  for (const cu of ${t}CompoundUniques) {
    list.push({ selector: cu.selector, fields: [...cu.fields] })
  }
  return list
})()`
      return `  ['${t}', {
    name: '${t}',
    fields: ${fields},
    enums,
    uniqueFields: ${fields}.filter((f) => f.isId || f.isUnique).map((f) => f.name),
    compoundUniques: ${compound},
  }]`
    })
    .join(',\n')

  const writeNames = new Set(MCP_WRITE_OPS.map((op) => op.name))
  const factories = [...MCP_OPS, ...MCP_WRITE_OPS]
    .map(
      (op) => `
export function ${lower}${cap(op.name)}Tool<TCtx = unknown, TPrisma extends PrismaClientLike = PrismaClientLike>(options: {
  config: ${modelName}RouteConfig<TCtx, TPrisma>
}): McpToolContribution {
  return ${writeNames.has(op.name) ? 'createMcpWriteTool' : 'createMcpReadTool'}({
    model: '${modelName}',
    operation: '${op.name}',
    config: options.config as unknown as Record<string, unknown>,
    core: core.${op.coreName},
    fields: MODEL_FIELDS,
    enums: enums,
    uniqueFields: MODEL_FIELDS.filter((f) => f.isId || f.isUnique).map(
      (f) => f.name,
    ),
    compoundUniques: compoundUniques,
    modelIndex: modelIndex,${
      writeNames.has(op.name)
        ? `
    writeStrategy: '${writeStrategy}',`
        : ''
    }
  })
}
`,
    )
    .join('\n')

  return `import * as core from './${modelName}Core${ext}'
import type { ${modelName}RouteConfig } from './${modelName}Router${ext}'
import type { PrismaClientLike } from '../routeConfig.target${ext}'
import {
  createMcpReadTool,
  createMcpWriteTool,
  type McpToolContribution,
  type SchemaModelMeta,
} from '../mcpRuntime${ext}'
import {
  MODEL_FIELDS,
  MODEL_ENUMS,
  COMPOUND_ID,
  COMPOUND_UNIQUES,
} from './${modelName}Metadata${ext}'
${relatedImports ? '\n' + relatedImports + '\n' : ''}
// transitive relation metadata: narrowing recurses through these FULL model
// metas — compound unique constraints (@@id / @@unique) ride along so nested
// cursors and nested findUnique surfaces keep their unique selectors.
const compoundUniques: Array<{ selector: string; fields: string[] }> = []
if (COMPOUND_ID) {
  compoundUniques.push({ selector: COMPOUND_ID.selector, fields: COMPOUND_ID.fields })
}
for (const cu of COMPOUND_UNIQUES) {
  compoundUniques.push({ selector: cu.selector, fields: cu.fields })
}

const enums = new Map<string, readonly string[]>()
${enumSets}

// one shared, self-referential metadata index: every related model keeps
// its full meta (compound uniques included) at every recursion depth
const modelIndex = new Map<string, SchemaModelMeta>()
const coreMetas: Array<[string, Omit<SchemaModelMeta, 'modelIndex'>]> = [
${coreEntries},
]
for (const [name, core] of coreMetas) {
  modelIndex.set(name, { ...core, modelIndex })
}
${factories}
`
}
