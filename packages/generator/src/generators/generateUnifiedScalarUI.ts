import { DMMF } from '@prisma/generator-helper'
import { Target, WriteStrategy } from '../constants'
import { ImportStyle } from '../utils/resolveImportStyle'
import { importExt } from '../utils/importExt'

function exampleValueForType(fieldType: string): unknown {
  switch (fieldType) {
    case 'String':
      return 'example'
    case 'Int':
      return 1
    case 'BigInt':
      return '1'
    case 'Float':
      return 1.0
    case 'Decimal':
      return '1.0'
    case 'Boolean':
      return true
    case 'DateTime':
      return '2025-01-01T00:00:00.000Z'
    case 'Json':
      return {}
    case 'Bytes':
      return 'base64data'
    default:
      return 'example'
  }
}

function generateExpressDocsExport(modelName: string): string {
  return `export function ${modelName}Docs(config: DocsConfig = {}) {
  return (req: Request, res: Response) => {
    const disabled = isOpenApiDisabled(config.disableOpenApi)
    if (disabled) return res.status(404).send('OpenAPI documentation is disabled in production')

    const rawUi = (req.query['ui'] as string | undefined) || config.docsUi || 'docs'
    const validUis: DocsUI[] = ['docs', 'scalar', 'json', 'yaml', 'playground']
    const ui: DocsUI = validUis.includes(rawUi as DocsUI) ? (rawUi as DocsUI) : 'docs'

    if (ui === 'playground') {
      if (!isPlaygroundAvailable(config)) {
        return res.status(404).send('Query builder is disabled')
      }
      return res.type('html').send(renderPlayground('${modelName}', config))
    }

    if (ui === 'yaml') {
      const yaml = buildModelOpenApi(
        '${modelName}',
        MODEL_FIELDS as unknown as Parameters<typeof buildModelOpenApi>[1],
        MODEL_ENUMS as unknown as Parameters<typeof buildModelOpenApi>[2],
        config,
        { format: 'yaml', writeStrategy: WRITE_STRATEGY }
      )
      return res.type('application/yaml').send(yaml as string)
    }

    const spec = buildModelOpenApi(
      '${modelName}',
      MODEL_FIELDS as unknown as Parameters<typeof buildModelOpenApi>[1],
      MODEL_ENUMS as unknown as Parameters<typeof buildModelOpenApi>[2],
      config,
      { format: 'json', writeStrategy: WRITE_STRATEGY }
    )

    if (ui === 'json') return res.json(spec)

    const pageTitle = config.docsTitle || \`${modelName} API\`

    if (ui === 'scalar') {
      return res.type('html').send(renderScalar('${modelName}', spec, pageTitle, config.scalarCdnUrl))
    }

    const html = renderDocs('${modelName}', config, MODEL_CONTEXT, WRITE_STRATEGY)
    return res.type('html').send(html)
  }
}`
}

function generateFastifyDocsExport(modelName: string): string {
  return `export function ${modelName}Docs(config: DocsConfig = {}) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const disabled = isOpenApiDisabled(config.disableOpenApi)
    if (disabled) { reply.code(404).send('OpenAPI documentation is disabled in production'); return }

    const queryParams = request.query as { ui?: string } | undefined
    const rawUi = queryParams?.ui || config.docsUi || 'docs'
    const validUis: DocsUI[] = ['docs', 'scalar', 'json', 'yaml', 'playground']
    const ui: DocsUI = validUis.includes(rawUi as DocsUI) ? (rawUi as DocsUI) : 'docs'

    if (ui === 'playground') {
      if (!isPlaygroundAvailable(config)) {
        reply.code(404).send('Query builder is disabled'); return
      }
      reply.type('text/html').send(renderPlayground('${modelName}', config)); return
    }

    if (ui === 'yaml') {
      const yaml = buildModelOpenApi(
        '${modelName}',
        MODEL_FIELDS as unknown as Parameters<typeof buildModelOpenApi>[1],
        MODEL_ENUMS as unknown as Parameters<typeof buildModelOpenApi>[2],
        config,
        { format: 'yaml', writeStrategy: WRITE_STRATEGY }
      )
      reply.type('application/yaml').send(yaml as string); return
    }

    const spec = buildModelOpenApi(
      '${modelName}',
      MODEL_FIELDS as unknown as Parameters<typeof buildModelOpenApi>[1],
      MODEL_ENUMS as unknown as Parameters<typeof buildModelOpenApi>[2],
      config,
      { format: 'json', writeStrategy: WRITE_STRATEGY }
    )

    if (ui === 'json') { reply.send(spec); return }

    const pageTitle = config.docsTitle || \`${modelName} API\`

    if (ui === 'scalar') {
      reply.type('text/html').send(renderScalar('${modelName}', spec, pageTitle, config.scalarCdnUrl)); return
    }

    const html = renderDocs('${modelName}', config, MODEL_CONTEXT, WRITE_STRATEGY)
    reply.type('text/html').send(html)
  }
}`
}

function generateHonoDocsExport(modelName: string): string {
  return `export function ${modelName}Docs(config: DocsConfig = {}) {
  return (c: Context): Response | Promise<Response> => {
    const disabled = isOpenApiDisabled(config.disableOpenApi)
    if (disabled) return c.text('OpenAPI documentation is disabled in production', 404)

    const rawUi = c.req.query('ui') || config.docsUi || 'docs'
    const validUis: DocsUI[] = ['docs', 'scalar', 'json', 'yaml', 'playground']
    const ui: DocsUI = (validUis as string[]).includes(rawUi) ? (rawUi as DocsUI) : 'docs'

    if (ui === 'playground') {
      if (!isPlaygroundAvailable(config)) {
        return c.text('Query builder is disabled', 404)
      }
      return c.html(renderPlayground('${modelName}', config))
    }

    if (ui === 'yaml') {
      const yaml = buildModelOpenApi(
        '${modelName}',
        MODEL_FIELDS as unknown as Parameters<typeof buildModelOpenApi>[1],
        MODEL_ENUMS as unknown as Parameters<typeof buildModelOpenApi>[2],
        config,
        { format: 'yaml', writeStrategy: WRITE_STRATEGY }
      ) as string
      return c.body(yaml, 200, { 'Content-Type': 'application/yaml' })
    }

    const spec = buildModelOpenApi(
      '${modelName}',
      MODEL_FIELDS as unknown as Parameters<typeof buildModelOpenApi>[1],
      MODEL_ENUMS as unknown as Parameters<typeof buildModelOpenApi>[2],
      config,
      { format: 'json', writeStrategy: WRITE_STRATEGY }
    )

    if (ui === 'json') return c.json(spec as Record<string, unknown>)

    const pageTitle = config.docsTitle || \`${modelName} API\`

    if (ui === 'scalar') {
      return c.html(renderScalar('${modelName}', spec, pageTitle, config.scalarCdnUrl))
    }

    const html = renderDocs('${modelName}', config, MODEL_CONTEXT, WRITE_STRATEGY)
    return c.html(html)
  }
}`
}

export function generateScalarUIHandler(options: {
  model: DMMF.Model
  enums: DMMF.DatamodelEnum[]
  target?: Target
  importStyle: ImportStyle
  writeStrategy: WriteStrategy
}): string {
  const { model, enums, writeStrategy } = options
  const target = options.target || 'express'
  const ext = importExt(options.importStyle)
  const modelName = model.name

  const fieldsMeta = model.fields.map((f: any) => ({
    name: f.name,
    kind: f.kind,
    type: f.type,
    isList: f.isList,
    isRequired: f.isRequired,
    hasDefaultValue: f.hasDefaultValue,
    isUpdatedAt: Boolean(f.isUpdatedAt),
    documentation: f.documentation ?? null,
    isId: Boolean(f.isId),
    isUnique: Boolean(f.isUnique),
    relationFromFields: f.relationFromFields,
  }))

  const referencedEnumTypes = new Set(
    model.fields.filter((f: any) => f.kind === 'enum').map((f: any) => f.type),
  )

  const enumsMeta = enums
    .filter((e) => referencedEnumTypes.has(e.name))
    .map((e) => ({
      name: e.name,
      values: e.values.map((v) => ({ name: v.name })),
    }))

  const exampleValueMap = JSON.stringify(
    Object.fromEntries(
      model.fields
        .filter(
          (f: any) =>
            f.isId || f.isUnique || f.kind === 'scalar' || f.kind === 'enum',
        )
        .map((f: any) => {
          if (f.kind === 'enum') {
            const enumDef = enums.find((e) => e.name === f.type)
            return [f.name, enumDef?.values[0]?.name || 'VALUE']
          }
          return [f.name, exampleValueForType(f.type)]
        }),
    ),
  )

  const compoundIdMeta =
    model.primaryKey && model.primaryKey.fields.length > 1
      ? { fields: model.primaryKey.fields }
      : null

  const compoundUniquesMeta = ((model as any).uniqueIndexes || [])
    .filter((idx: any) => idx.fields && idx.fields.length > 1)
    .map((idx: any) => ({
      name: idx.name || idx.fields.join('_'),
      fields: idx.fields,
    }))

  const frameworkImport =
    target === 'fastify'
      ? `import type { FastifyRequest, FastifyReply } from 'fastify'`
      : target === 'hono'
        ? `import type { Context } from 'hono'`
        : `import { Request, Response } from 'express'`

  const docsExport =
    target === 'fastify'
      ? generateFastifyDocsExport(modelName)
      : target === 'hono'
        ? generateHonoDocsExport(modelName)
        : generateExpressDocsExport(modelName)

  return `${frameworkImport}
import { buildModelOpenApi } from '../buildModelOpenApi${ext}'
import type { WriteStrategy } from '../routeConfig${ext}'
import {
  renderDocs,
  renderScalar,
  renderPlayground,
  isOpenApiDisabled,
  isPlaygroundAvailable,
  type FieldMeta,
  type EnumMeta,
  type DocsUI,
  type DocsConfig,
  type DocsModelContext,
} from '../docsRenderer${ext}'

const WRITE_STRATEGY: WriteStrategy = '${writeStrategy}'

export const MODEL_FIELDS: FieldMeta[] = ${JSON.stringify(fieldsMeta, null, 2)}

export const MODEL_ENUMS: EnumMeta[] = ${JSON.stringify(enumsMeta, null, 2)}

const COMPOUND_ID: { fields: string[] } | null = ${JSON.stringify(compoundIdMeta)}

const COMPOUND_UNIQUES: { name: string; fields: string[] }[] = ${JSON.stringify(compoundUniquesMeta)}

const EXAMPLE_VALUES: Record<string, unknown> = ${exampleValueMap}

const MODEL_CONTEXT: DocsModelContext = {
  fields: MODEL_FIELDS,
  enums: MODEL_ENUMS,
  compoundId: COMPOUND_ID,
  compoundUniques: COMPOUND_UNIQUES,
  exampleValues: EXAMPLE_VALUES,
}

${docsExport}
`
}