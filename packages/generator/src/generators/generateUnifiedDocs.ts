import { Target } from '../constants.js'

export function generateUnifiedDocs(
  models: string[],
  target: Target = 'express',
): string {
  const imports = models
    .map((model) => `import { ${model}Docs } from './${model}/${model}Docs.js'`)
    .join('\n')

  const handlersEntries = models
    .map((model) => `  ${model}: ${model}Docs`)
    .join(',\n')

  const frameworkImport =
    target === 'fastify'
      ? `import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'`
      : `import { Request, Response } from 'express'`

  const routeConfigImport = `import type { RouteConfig } from './routeConfig.js'`

  const handlerType =
    target === 'fastify'
      ? `(config: any) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>`
      : `(config: any) => (req: Request, res: Response) => any`

  const combinedDocsReturn =
    target === 'fastify'
      ? generateFastifyCombinedDocs()
      : generateExpressCombinedDocs()

  const registerDocs =
    target === 'fastify'
      ? generateFastifyRegisterDocs()
      : generateExpressRegisterDocs()

  return `${imports}
${frameworkImport}
${routeConfigImport}

const _env = typeof process !== 'undefined' && process.env ? process.env : {} as Record<string, string | undefined>

const docsHandlers: Record<string, ${handlerType}> = {
${handlersEntries}
}

type DocsUI = 'docs' | 'scalar' | 'json' | 'yaml' | 'playground'

interface ModelDocsConfig extends RouteConfig {
  docsTitle?: string
  docsUi?: DocsUI
}

export interface CombinedDocsConfig {
  disableOpenApi?: boolean
  title?: string
  description?: string
  basePath?: string
  version?: string
  modelConfigs: {
    [modelName: string]: ModelDocsConfig
  }
}

function escapeHtml(input: string) {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function removeTrailingSlash(p: string): string {
  if (p === '/') return ''
  return p.endsWith('/') ? p.slice(0, -1) : p
}

function isOpenApiDisabled(disableOpenApi?: boolean) {
  if (disableOpenApi === true) return true
  if (disableOpenApi === false) return false
  return _env.DISABLE_OPENAPI === 'true' || _env.NODE_ENV === 'production'
}

function isPlaygroundAvailable(config?: ModelDocsConfig) {
  if (_env.NODE_ENV === 'production') return false
  if (!config) return true
  if (config.queryBuilder === false) return false
  if (typeof config.queryBuilder === 'object' && config.queryBuilder.enabled === false) return false
  return true
}

function buildCombinedHtml(
  config: CombinedDocsConfig,
  registeredModels: string[],
) {
  const title = config.title || 'API Documentation'
  const description = config.description || ''
  const version = config.version || ''
  const basePath = removeTrailingSlash(config.basePath || '/docs')
  const generatedAt = new Date().toISOString()

  const modelRows = registeredModels.map((m) => {
    const lower = m.toLowerCase()
    const docsUrl = basePath + '/' + lower
    const scalarUrl = docsUrl + '?ui=scalar'
    const jsonUrl = docsUrl + '?ui=json'
    const yamlUrl = docsUrl + '?ui=yaml'
    const playgroundUrl = docsUrl + '?ui=playground'
    const modelCfg = config.modelConfigs[m]
    const modelPlayground = isPlaygroundAvailable(modelCfg)
    const playgroundLink = modelPlayground
      ? ', <a href="' + playgroundUrl + '" class="text-inherit underline">playground</a>'
      : ''
    return '<tr>' +
      '<td class="text-left py-2 px-2 border-b border-gray-300 align-top">' + escapeHtml(m) + '</td>' +
      '<td class="text-left py-2 px-2 border-b border-gray-300 align-top"><a href="' + docsUrl + '" class="text-inherit underline">' + escapeHtml(docsUrl) + '</a></td>' +
      '<td class="text-left py-2 px-2 border-b border-gray-300 align-top">' +
        '<a href="' + scalarUrl + '" class="text-inherit underline">scalar</a>, ' +
        '<a href="' + jsonUrl + '" class="text-inherit underline">json</a>, ' +
        '<a href="' + yamlUrl + '" class="text-inherit underline">yaml</a>' +
        playgroundLink +
      '</td>' +
    '</tr>'
  }).join('')

  const descriptionHtml = description
    ? '<div class="mt-1.5 text-gray-500 text-sm">' + escapeHtml(description) + '</div>'
    : ''
  const versionHtml = version
    ? '<div>Version: ' + escapeHtml(version) + '</div>'
    : ''

  return '<!DOCTYPE html>' +
    '<html lang="en">' +
    '<head>' +
      '<meta charset="utf-8" />' +
      '<meta name="viewport" content="width=device-width, initial-scale=1" />' +
      '<title>' + escapeHtml(title) + '</title>' +
      '<script src="https://cdn.tailwindcss.com"></' + 'script>' +
    '</head>' +
    '<body class="m-0 bg-white text-gray-900 font-serif leading-normal">' +
      '<div class="max-w-[980px] mx-auto px-7 pt-10 pb-16">' +
        '<div class="border-b-2 border-gray-900 pb-3.5 mb-[18px]">' +
          '<div class="text-[28px] font-bold tracking-wide">' + escapeHtml(title) + '</div>' +
          descriptionHtml +
          '<div class="mt-3 flex gap-x-5 text-[13px] text-gray-500">' +
            versionHtml +
            '<div>Generated: ' + escapeHtml(generatedAt) + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="mt-[22px]">' +
          '<h2 class="m-0 mb-2.5 text-lg border-t border-gray-300 pt-3.5">Models</h2>' +
          '<table class="w-full border-collapse text-[13px]">' +
            '<thead>' +
              '<tr>' +
                '<th class="text-left py-2 px-2 border-b border-gray-300 align-top font-bold">Model</th>' +
                '<th class="text-left py-2 px-2 border-b border-gray-300 align-top font-bold">Documentation</th>' +
                '<th class="text-left py-2 px-2 border-b border-gray-300 align-top font-bold">Views</th>' +
              '</tr>' +
            '</thead>' +
            '<tbody>' + modelRows + '</tbody>' +
          '</table>' +
        '</div>' +
      '</div>' +
    '</body>' +
    '</html>'
}

function getRegisteredModels(config: CombinedDocsConfig) {
  return Object.keys(config.modelConfigs).filter((m) => {
    const cfg = config.modelConfigs[m]
    return m in docsHandlers && !isOpenApiDisabled(cfg?.disableOpenApi ?? config.disableOpenApi)
  })
}

${combinedDocsReturn}

${registerDocs}
`
}

function generateExpressCombinedDocs(): string {
  return `export function generateCombinedDocs(config: CombinedDocsConfig) {
  return (req: Request, res: Response) => {
    const registeredModels = getRegisteredModels(config)

    if (registeredModels.length === 0) {
      return res.status(404).send('OpenAPI documentation is disabled')
    }

    const html = buildCombinedHtml(config, registeredModels)
    res.type('html').send(html)
  }
}`
}

function generateFastifyCombinedDocs(): string {
  return `export function generateCombinedDocs(config: CombinedDocsConfig) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const registeredModels = getRegisteredModels(config)

    if (registeredModels.length === 0) {
      return reply.code(404).send('OpenAPI documentation is disabled')
    }

    const html = buildCombinedHtml(config, registeredModels)
    return reply.type('text/html').send(html)
  }
}`
}

function generateExpressRegisterDocs(): string {
  return `export function registerModelDocs(
  app: any,
  basePath: string = '/docs',
  configs: CombinedDocsConfig['modelConfigs'] = {},
  options?: { disableOpenApi?: boolean }
) {
  const normalizedBase = removeTrailingSlash(basePath)
  const registeredModels = Object.keys(configs).filter((m) => {
    const cfg = configs[m]
    return m in docsHandlers && !isOpenApiDisabled(cfg?.disableOpenApi ?? options?.disableOpenApi)
  })

  if (registeredModels.length === 0) return

  registeredModels.forEach((model) => {
    const handler = docsHandlers[model]
    const cfg = configs[model] || {}
    const docPath = normalizedBase + '/' + model.toLowerCase()
    console.log('  Registered docs: ' + docPath)
    app.get(docPath, handler(cfg))
  })
}`
}

function generateFastifyRegisterDocs(): string {
  return `export function registerModelDocs(
  app: FastifyInstance,
  basePath: string = '/docs',
  configs: CombinedDocsConfig['modelConfigs'] = {},
  options?: { disableOpenApi?: boolean }
) {
  const normalizedBase = removeTrailingSlash(basePath)
  const registeredModels = Object.keys(configs).filter((m) => {
    const cfg = configs[m]
    return m in docsHandlers && !isOpenApiDisabled(cfg?.disableOpenApi ?? options?.disableOpenApi)
  })

  if (registeredModels.length === 0) return

  registeredModels.forEach((model) => {
    const handler = docsHandlers[model]
    const cfg = configs[model] || {}
    const docPath = normalizedBase + '/' + model.toLowerCase()
    console.log('  Registered docs: ' + docPath)
    app.get(docPath, handler(cfg))
  })
}`
}