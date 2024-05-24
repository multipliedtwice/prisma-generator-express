export function generateRouteConfigType() {
  return `import { RequestHandler } from 'express';

  interface MiddlewareConfig<M> {
    before?: M[];
    after?: RequestHandler[];
  }
  
  export interface RouteConfig<M> {
    findFirst?: MiddlewareConfig<M>;
    findMany?: MiddlewareConfig<M>;
    findUnique?: MiddlewareConfig<M>;
    create?: MiddlewareConfig<M>;
    createMany?: MiddlewareConfig<M>;
    update?: MiddlewareConfig<M>;
    updateMany?: MiddlewareConfig<M>;
    upsert?: MiddlewareConfig<M>;
    delete?: MiddlewareConfig<M>;
    deleteMany?: MiddlewareConfig<M>;
    aggregate?: MiddlewareConfig<M>;
    count?: MiddlewareConfig<M>;
    groupBy?: MiddlewareConfig<M>;
    addModelPrefix?: boolean;
    enableAll?: boolean;
  }
  
  export default RouteConfig;`
}
