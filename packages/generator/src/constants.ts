export const GENERATOR_NAME = 'prisma-generator-express'

export type Target = 'express' | 'fastify' | 'hono'

export type WriteStrategy = 'regular' | 'throwOnNonReturning' | 'forceReturn'

export type FindManyPaginatedMode = 'transaction' | 'promiseAll'
