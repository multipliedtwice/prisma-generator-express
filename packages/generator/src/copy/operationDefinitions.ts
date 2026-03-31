export type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete'

export interface OperationDef {
  name: string
  method: HttpMethod
  pathSuffix: string
  configKey: string
}

export const OPERATION_DEFS: OperationDef[] = [
  { name: 'findMany', method: 'get', pathSuffix: '', configKey: 'findMany' },
  {
    name: 'findUnique',
    method: 'get',
    pathSuffix: '/unique',
    configKey: 'findUnique',
  },
  {
    name: 'findUniqueOrThrow',
    method: 'get',
    pathSuffix: '/unique/strict',
    configKey: 'findUniqueOrThrow',
  },
  {
    name: 'findFirst',
    method: 'get',
    pathSuffix: '/first',
    configKey: 'findFirst',
  },
  {
    name: 'findFirstOrThrow',
    method: 'get',
    pathSuffix: '/first/strict',
    configKey: 'findFirstOrThrow',
  },
  {
    name: 'findManyPaginated',
    method: 'get',
    pathSuffix: '/paginated',
    configKey: 'findManyPaginated',
  },
  { name: 'create', method: 'post', pathSuffix: '', configKey: 'create' },
  {
    name: 'createMany',
    method: 'post',
    pathSuffix: '/many',
    configKey: 'createMany',
  },
  {
    name: 'createManyAndReturn',
    method: 'post',
    pathSuffix: '/many/return',
    configKey: 'createManyAndReturn',
  },
  { name: 'update', method: 'put', pathSuffix: '', configKey: 'update' },
  {
    name: 'updateMany',
    method: 'put',
    pathSuffix: '/many',
    configKey: 'updateMany',
  },
  {
    name: 'updateManyAndReturn',
    method: 'put',
    pathSuffix: '/many/return',
    configKey: 'updateManyAndReturn',
  },
  { name: 'upsert', method: 'patch', pathSuffix: '', configKey: 'upsert' },
  { name: 'delete', method: 'delete', pathSuffix: '', configKey: 'delete' },
  {
    name: 'deleteMany',
    method: 'delete',
    pathSuffix: '/many',
    configKey: 'deleteMany',
  },
  { name: 'count', method: 'get', pathSuffix: '/count', configKey: 'count' },
  {
    name: 'aggregate',
    method: 'get',
    pathSuffix: '/aggregate',
    configKey: 'aggregate',
  },
  {
    name: 'groupBy',
    method: 'get',
    pathSuffix: '/groupby',
    configKey: 'groupBy',
  },
]

export function isOperationEnabled(
  config: Record<string, any>,
  def: OperationDef,
): boolean {
  return !!(config.enableAll || config[def.configKey])
}
