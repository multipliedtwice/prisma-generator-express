import { RequestHandler } from 'express'
import { ZodTypeAny } from 'zod'

export interface ValidatorConfig {
  allow?: string[]
  forbid?: string[]
  schema: ZodTypeAny
}

interface MiddlewareConfig<M> {
  before?: M[]
  after?: RequestHandler[]
  input?: ValidatorConfig
  output?: ValidatorConfig
}

export interface RouteConfig<M> {
  findFirst?: MiddlewareConfig<M>
  findMany?: MiddlewareConfig<M>
  findUnique?: MiddlewareConfig<M>
  create?: MiddlewareConfig<M>
  createMany?: MiddlewareConfig<M>
  update?: MiddlewareConfig<M>
  updateMany?: MiddlewareConfig<M>
  upsert?: MiddlewareConfig<M>
  delete?: MiddlewareConfig<M>
  deleteMany?: MiddlewareConfig<M>
  aggregate?: MiddlewareConfig<M>
  count?: MiddlewareConfig<M>
  groupBy?: MiddlewareConfig<M>
  addModelPrefix?: boolean
  enableAll?: boolean
  customUrlPrefix?: string
}
