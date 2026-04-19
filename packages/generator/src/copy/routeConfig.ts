import type { FastifyRequest, FastifyReply } from 'fastify'

export type FastifyHookHandler = (
  request: FastifyRequest,
  reply: FastifyReply,
) => Promise<void> | void

export interface OperationConfig {
  before?: FastifyHookHandler[]
  after?: FastifyHookHandler[]
  shape?: Record<string, any>
}

export interface QueryBuilderConfig {
  enabled?: boolean
  port?: number
  host?: string
  schemaPath?: string
  databaseUrl?: string
}

export interface OpenApiServerConfig {
  url: string
  description?: string
}

export interface OpenApiSecuritySchemeConfig {
  type: string
  scheme?: string
  bearerFormat?: string
  name?: string
  in?: string
  description?: string
}

export interface RouteConfig {
  enableAll?: boolean
  addModelPrefix?: boolean
  customUrlPrefix?: string
  specBasePath?: string
  disableOpenApi?: boolean
  scalarCdnUrl?: string

  openApiTitle?: string
  openApiDescription?: string
  openApiVersion?: string
  openApiServers?: OpenApiServerConfig[]
  openApiSecuritySchemes?: Record<string, OpenApiSecuritySchemeConfig>
  openApiSecurity?: Record<string, string[]>[]

  guard?: {
    resolveVariant?: (request: FastifyRequest) => string | undefined
    variantHeader?: string
  }

  queryBuilder?: QueryBuilderConfig | false

  pagination?: {
    defaultLimit?: number
    maxLimit?: number
    distinctCountLimit?: number
  }

  findUnique?: OperationConfig
  findUniqueOrThrow?: OperationConfig
  findFirst?: OperationConfig
  findFirstOrThrow?: OperationConfig
  findMany?: OperationConfig
  findManyPaginated?: OperationConfig
  create?: OperationConfig
  createMany?: OperationConfig
  createManyAndReturn?: OperationConfig
  update?: OperationConfig
  updateMany?: OperationConfig
  updateManyAndReturn?: OperationConfig
  upsert?: OperationConfig
  delete?: OperationConfig
  deleteMany?: OperationConfig
  aggregate?: OperationConfig
  count?: OperationConfig
  groupBy?: OperationConfig
}