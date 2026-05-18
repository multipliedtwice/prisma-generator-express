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

export interface BaseOperationConfig<HookHandler, TShape = Record<string, any>> {
  before?: HookHandler[]
  after?: HookHandler[]
  shape?: TShape
}

export interface BaseRouteConfig<HookHandler, RequestType, TShape = Record<string, any>> {
  enableAll?: boolean
  addModelPrefix?: boolean
  customUrlPrefix?: string
  specBasePath?: string
  disableOpenApi?: boolean
  disablePostReads?: boolean
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
  findUnique?: BaseOperationConfig<HookHandler, TShape>
  findUniqueOrThrow?: BaseOperationConfig<HookHandler, TShape>
  findFirst?: BaseOperationConfig<HookHandler, TShape>
  findFirstOrThrow?: BaseOperationConfig<HookHandler, TShape>
  findMany?: BaseOperationConfig<HookHandler, TShape>
  findManyPaginated?: BaseOperationConfig<HookHandler, TShape>
  create?: BaseOperationConfig<HookHandler, TShape>
  createMany?: BaseOperationConfig<HookHandler, TShape>
  createManyAndReturn?: BaseOperationConfig<HookHandler, TShape>
  update?: BaseOperationConfig<HookHandler, TShape>
  updateMany?: BaseOperationConfig<HookHandler, TShape>
  updateManyAndReturn?: BaseOperationConfig<HookHandler, TShape>
  upsert?: BaseOperationConfig<HookHandler, TShape>
  delete?: BaseOperationConfig<HookHandler, TShape>
  deleteMany?: BaseOperationConfig<HookHandler, TShape>
  aggregate?: BaseOperationConfig<HookHandler, TShape>
  count?: BaseOperationConfig<HookHandler, TShape>
  groupBy?: BaseOperationConfig<HookHandler, TShape>
}

export type OperationConfig = BaseOperationConfig<any>

export type RouteConfig = BaseRouteConfig<any, any>