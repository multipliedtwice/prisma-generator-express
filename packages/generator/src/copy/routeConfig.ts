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

export interface BaseOperationConfig<HookHandler> {
  before?: HookHandler[]
  after?: HookHandler[]
  shape?: Record<string, any>
}

export interface BaseRouteConfig<HookHandler, RequestType> {
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
    resolveVariant?: (request: RequestType) => string | undefined
    variantHeader?: string
  }

  queryBuilder?: QueryBuilderConfig | false

  pagination?: {
    defaultLimit?: number
    maxLimit?: number
    distinctCountLimit?: number
  }

  findUnique?: BaseOperationConfig<HookHandler>
  findUniqueOrThrow?: BaseOperationConfig<HookHandler>
  findFirst?: BaseOperationConfig<HookHandler>
  findFirstOrThrow?: BaseOperationConfig<HookHandler>
  findMany?: BaseOperationConfig<HookHandler>
  findManyPaginated?: BaseOperationConfig<HookHandler>
  create?: BaseOperationConfig<HookHandler>
  createMany?: BaseOperationConfig<HookHandler>
  createManyAndReturn?: BaseOperationConfig<HookHandler>
  update?: BaseOperationConfig<HookHandler>
  updateMany?: BaseOperationConfig<HookHandler>
  updateManyAndReturn?: BaseOperationConfig<HookHandler>
  upsert?: BaseOperationConfig<HookHandler>
  delete?: BaseOperationConfig<HookHandler>
  deleteMany?: BaseOperationConfig<HookHandler>
  aggregate?: BaseOperationConfig<HookHandler>
  count?: BaseOperationConfig<HookHandler>
  groupBy?: BaseOperationConfig<HookHandler>
}

export type OperationConfig = BaseOperationConfig<any>

export type RouteConfig = BaseRouteConfig<any, any>