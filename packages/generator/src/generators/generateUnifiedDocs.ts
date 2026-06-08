import { ImportStyle } from '../utils/resolveImportStyle'
import { importExt } from '../utils/importExt'
import type { Target } from '../constants'

export function generateUnifiedDocs(
  modelNames: string[],
  target: Target,
  importStyle: ImportStyle,
): string {
  const ext = importExt(importStyle)
  if (target === 'fastify') return generateFastify(modelNames, ext)
  if (target === 'hono') return generateHono(modelNames, ext)
  return generateExpress(modelNames, ext)
}

const renderIndexFn = `function renderIndex(title: string, modelNames: string[], basePath: string): string {
  const links = modelNames
    .map((n) => '<li><a href="' + basePath + '/' + n.toLowerCase() + '">' + n + '</a></li>')
    .join('')

  return '<!DOCTYPE html><html><head><meta charset="utf-8" /><title>' + title +
    '</title><script src="https://cdn.tailwindcss.com"></script></head>' +
    '<body class="m-0 bg-white text-gray-900 font-sans">' +
    '<div class="max-w-[1120px] mx-auto px-5 pt-[30px] pb-20">' +
    '<h1 class="text-xl font-black border-b-2 border-gray-900 pb-3">' + title + '</h1>' +
    '<ul class="mt-4 list-disc pl-6 text-sm">' + links + '</ul>' +
    '</div></body></html>'
}`

function generateExpress(modelNames: string[], ext: string): string {
  return `import type { Router } from 'express'
import { getEnv, removeTrailingSlash } from './misc${ext}'

const _env = getEnv()

const MODELS = ${JSON.stringify(modelNames)} as const

interface UnifiedDocsConfig {
  title?: string
  basePath?: string
  models?: string[]
  disableInProduction?: boolean
}

export function registerUnifiedDocs(router: Router, config: UnifiedDocsConfig = {}): void {
  const disabled = config.disableInProduction !== false && _env.NODE_ENV === 'production'
  if (disabled) return

  const basePath = removeTrailingSlash(config.basePath || '/docs')
  const enabled = config.models && config.models.length > 0
    ? MODELS.filter((m) => config.models!.includes(m))
    : MODELS

  router.get(basePath, (_req, res) => {
    res.type('html').send(renderIndex(config.title || 'API Documentation', enabled as string[], basePath))
  })
}

${renderIndexFn}

export default registerUnifiedDocs
`
}

function generateFastify(modelNames: string[], ext: string): string {
  return `import type { FastifyInstance } from 'fastify'
import { getEnv, removeTrailingSlash } from './misc${ext}'

const _env = getEnv()

const MODELS = ${JSON.stringify(modelNames)} as const

interface UnifiedDocsConfig {
  title?: string
  basePath?: string
  models?: string[]
  disableInProduction?: boolean
}

export async function registerUnifiedDocs(
  fastify: FastifyInstance,
  config: UnifiedDocsConfig = {},
): Promise<void> {
  const disabled = config.disableInProduction !== false && _env.NODE_ENV === 'production'
  if (disabled) return

  const basePath = removeTrailingSlash(config.basePath || '/docs')
  const enabled = config.models && config.models.length > 0
    ? MODELS.filter((m) => config.models!.includes(m))
    : MODELS

  fastify.get(basePath, async (_request, reply) => {
    reply.type('text/html').send(renderIndex(config.title || 'API Documentation', enabled as string[], basePath))
  })
}

${renderIndexFn}

export default registerUnifiedDocs
`
}

function generateHono(modelNames: string[], ext: string): string {
  return `import type { Hono } from 'hono'
import { getEnv, removeTrailingSlash } from './misc${ext}'

const _env = getEnv()

const MODELS = ${JSON.stringify(modelNames)} as const

interface UnifiedDocsConfig {
  title?: string
  basePath?: string
  models?: string[]
  disableInProduction?: boolean
}

export function registerUnifiedDocs(app: Hono, config: UnifiedDocsConfig = {}): void {
  const disabled = config.disableInProduction !== false && _env.NODE_ENV === 'production'
  if (disabled) return

  const basePath = removeTrailingSlash(config.basePath || '/docs')
  const enabled = config.models && config.models.length > 0
    ? MODELS.filter((m) => config.models!.includes(m))
    : MODELS

  app.get(basePath, (c) => {
    return c.html(renderIndex(config.title || 'API Documentation', enabled as string[], basePath))
  })
}

${renderIndexFn}

export default registerUnifiedDocs
`
}