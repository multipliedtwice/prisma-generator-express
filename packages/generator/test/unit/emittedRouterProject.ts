import { copyFile, mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import prettier from 'prettier'
import type { DMMF } from '@prisma/generator-helper'
import { generateModelMetadata } from '../../src/generators/generateModelMetadata'
import { generateModelCore } from '../../src/generators/generateOperationCore'
import { generateHonoHandler } from '../../src/generators/generateHonoHandler'
import { generateFastifyHandler } from '../../src/generators/generateFastifyHandler'
import { generateUnifiedHandler } from '../../src/generators/generateUnifiedHandler'
import { generateHonoRouterFunction } from '../../src/generators/generateRouterHono'
import { generateFastifyRouterFunction } from '../../src/generators/generateRouterFastify'
import { generateRouterFunction } from '../../src/generators/generateRouter'
import {
  generateRelationMeta,
  generateRelationModelsIndex,
} from '../../src/generators/generateRelationMeta'
import { generateQueryBuilderHelper } from '../../src/generators/generateQueryBuilderHelper'

/**
 * A REAL emitted router, on disk, importable, running the REAL copied runtime.
 *
 * Most tests around this one assert properties of the emitted TEXT; that is the
 * right shape for claims about what ships, and the wrong one for claims about
 * what EXECUTING it does — construction runs `normalizeOperation` over every
 * enabled operation, and the guard-drop decision runs per request. So this lays
 * out what a generated project actually holds: the `src/copy` runtime beside a
 * per-model directory, `routeConfig.target.ts` copied from the requested
 * target, every emitted file put through the same prettier formatting as
 * `writeFileSafely` (which also normalizes recoverable generator artifacts the
 * TS parser forgives), and hands back the router path for a dynamic import.
 */
const COPY_DIR = resolve(__dirname, '../../src/copy')

export type EmittedTarget = 'hono' | 'express' | 'fastify'

async function emit(content: string): Promise<string> {
  return prettier.format(content, { parser: 'typescript' })
}

export async function writeEmittedRouterProject(args: {
  target: EmittedTarget
  model: DMMF.Model
  dropGuard?: boolean
}): Promise<{ routerPath: string; cleanup: () => Promise<void> }> {
  const modelName = args.model.name
  /**
   * Inside the package, not the system temp directory: the copied runtime has
   * bare imports (`yaml`, `hono`, …) that only resolve by walking up into the
   * repository's node_modules. Gitignored as `.emitted-router-*`, and removed
   * by each test's cleanup.
   */
  const dir = await mkdtemp(resolve(__dirname, `../../.emitted-router-${args.target}-`))
  for (const name of await readdir(COPY_DIR)) {
    if (!name.endsWith('.ts')) continue
    await copyFile(join(COPY_DIR, name), join(dir, name))
  }
  await copyFile(join(COPY_DIR, `routeConfig.${args.target}.ts`), join(dir, 'routeConfig.target.ts'))
  await writeFile(join(dir, 'queryBuilder.ts'), await emit(generateQueryBuilderHelper()), 'utf8')

  const shared = {
    model: args.model,
    enums: [] as DMMF.DatamodelEnum[],
    guardShapesImport: null,
    importStyle: 'ts' as never,
    writeStrategy: 'transaction' as never,
    findManyPaginatedMode: 'transaction' as never,
    pathCase: 'raw' as never,
    dropGuard: args.dropGuard ?? false,
  }
  const routerText =
    args.target === 'hono'
      ? generateHonoRouterFunction(shared)
      : args.target === 'fastify'
        ? generateFastifyRouterFunction(shared)
        : generateRouterFunction(shared)
  const handlerText = (
    args.target === 'hono'
      ? generateHonoHandler
      : args.target === 'fastify'
        ? generateFastifyHandler
        : generateUnifiedHandler
  )({ model: args.model, importStyle: 'ts' as never })
  const coreText = generateModelCore({
    model: args.model,
    importStyle: 'ts' as never,
    writeStrategy: 'transaction' as never,
    findManyPaginatedMode: 'transaction' as never,
  })
  const metadataText = generateModelMetadata({
    model: args.model,
    enums: [],
    importStyle: 'ts' as never,
  })

  const modelDir = join(dir, modelName)
  await mkdir(modelDir, { recursive: true })
  const routerPath = join(modelDir, `${modelName}Router.ts`)
  await writeFile(routerPath, await emit(routerText), 'utf8')
  await writeFile(join(modelDir, `${modelName}Handlers.ts`), await emit(handlerText), 'utf8')
  await writeFile(join(modelDir, `${modelName}Core.ts`), await emit(coreText), 'utf8')
  await writeFile(join(modelDir, `${modelName}Metadata.ts`), await emit(metadataText), 'utf8')
  if (args.target === 'express') {
    await writeFile(
      join(modelDir, `${modelName}Relations.ts`),
      await emit(
        generateRelationMeta({
          model: args.model,
          allModels: [args.model],
          importStyle: 'ts' as never,
        }),
      ),
      'utf8',
    )
    await writeFile(
      join(dir, 'relationModels.ts'),
      await emit(generateRelationModelsIndex({ modelNames: [modelName], importStyle: 'ts' as never })),
      'utf8',
    )
  }
  return {
    routerPath,
    cleanup: () => rm(dir, { recursive: true, force: true }),
  }
}

export async function importEmittedRouter(routerPath: string): Promise<Record<string, unknown>> {
  return (await import(pathToFileURL(routerPath).href)) as Record<string, unknown>
}

/**
 * The smallest model a router can be generated for, plus one tenant column so a
 * guard shape has something real to force.
 */
export const ARTICLE_MODEL = {
  name: 'Article',
  dbName: null,
  schema: null,
  fields: [
    {
      name: 'id',
      kind: 'scalar',
      isList: false,
      isRequired: true,
      isUnique: false,
      isId: true,
      isReadOnly: false,
      hasDefaultValue: false,
      type: 'String',
      isGenerated: false,
      isUpdatedAt: false,
    },
    {
      name: 'site_id',
      kind: 'scalar',
      isList: false,
      isRequired: true,
      isUnique: false,
      isId: false,
      isReadOnly: false,
      hasDefaultValue: false,
      type: 'String',
      isGenerated: false,
      isUpdatedAt: false,
    },
  ],
  primaryKey: null,
  uniqueFields: [],
  uniqueIndexes: [],
  isGenerated: false,
} as unknown as DMMF.Model

/**
 * A delegate that records how it was reached. `guard` present, because the kept
 * path asserts it exists and calls THROUGH it; the dropped path never touches it
 * and calls the operation directly with the forced query.
 */
export function recordingDelegate(): {
  prisma: Record<string, unknown>
  guardCalls: Array<Record<string, unknown>>
  findManyCalls: unknown[]
} {
  const guardCalls: Array<Record<string, unknown>> = []
  const findManyCalls: unknown[] = []
  const answer = async () => []
  const delegate: Record<string, unknown> = {
    findMany: async (query: unknown) => {
      findManyCalls.push(query)
      return []
    },
    findFirst: answer,
    findUnique: answer,
    findUniqueOrThrow: answer,
    findFirstOrThrow: answer,
    create: answer,
    createMany: answer,
    createManyAndReturn: answer,
    update: answer,
    updateMany: answer,
    updateManyAndReturn: answer,
    upsert: answer,
    delete: answer,
    deleteMany: answer,
    count: async () => 0,
    aggregate: answer,
    groupBy: answer,
    guard: (shape: Record<string, unknown>) => {
      guardCalls.push(shape)
      return delegate
    },
  }
  return { prisma: { article: delegate }, guardCalls, findManyCalls }
}
