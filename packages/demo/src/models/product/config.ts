/**
 * Product route config.
 *
 * Widest slice of generator surface:
 *   - customUrlPrefix, per-router OpenAPI overrides
 *   - router-level pagination with an operation-level override
 *   - three role variants plus a catalog variant
 *   - prefetchMaxOrderId + attachMaxOrderId demonstrate custom
 *     enrichment via before/after hooks
 *
 * No progressive SSE here — the generator disables auto-include when a
 * shape is set. SSE demos live on Order (manual) and OrderLine
 * (auto-include).
 */
import { force } from 'prisma-guard'
import type { ProductRouteConfig } from '../../../prisma/generated/express/Product/ProductRouter'
import { prefetchMaxOrderId, attachMaxOrderId } from './decorators'

const publicProductSelect = {
  id: true,
  name: true,
  price: true,
  category: true,
} as const

const listProductSelect = {
  ...publicProductSelect,
  isPublished: true,
  createdAt: true,
  _count: { select: { orderLines: true } },
} as const

export const productConfig: ProductRouteConfig = {
  enableAll: true,
  customUrlPrefix: '/api/v1',
  queryBuilder: { enabled: true },
  openApiTitle: 'Product API',
  openApiDescription: 'Product catalog and inventory endpoints',
  openApiServers: [
    { url: 'https://api.example.com/v1', description: 'Production' },
  ],
  openApiSecuritySchemes: {
    bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
  },
  openApiSecurity: [{ bearerAuth: [] }],
  pagination: { defaultLimit: 20, maxLimit: 100 },
  guard: { variantHeader: 'x-api-variant' },
  findMany: {
    before: [prefetchMaxOrderId],
    after: [attachMaxOrderId],
    shape: {
      owner: {
        where: {
          name: { contains: true },
          category: { equals: true },
          isPublished: { equals: true },
          orderLines: { some: { quantity: { gt: true } } },
        },
        select: listProductSelect,
        orderBy: { createdAt: true },
        take: { max: 200, default: 25 },
      },
      admin: {
        where: {
          name: { contains: true },
          category: { equals: true },
          isPublished: { equals: true },
        },
        select: listProductSelect,
        orderBy: { createdAt: true },
        take: { max: 200, default: 25 },
      },
      member: {
        where: {
          name: { contains: true },
          category: { equals: true },
          isPublished: { equals: force(true) },
        },
        select: publicProductSelect,
        orderBy: { name: true },
        take: { max: 50, default: 20 },
      },
    },
  },
  findManyPaginated: {
    pagination: { maxLimit: 500 },
    shape: {
      owner: {
        where: { name: { contains: true }, category: { equals: true } },
        select: listProductSelect,
        orderBy: { createdAt: true },
        take: { max: 500, default: 50 },
      },
      admin: {
        where: { name: { contains: true }, category: { equals: true } },
        select: listProductSelect,
        orderBy: { createdAt: true },
        take: { max: 500, default: 50 },
      },
      member: {
        where: { name: { contains: true }, category: { equals: true } },
        select: publicProductSelect,
        take: { max: 100, default: 20 },
      },
      catalog: {
        where: {
          name: { contains: true },
          category: { equals: true },
          isPublished: { equals: force(true) },
        },
        select: publicProductSelect,
        orderBy: { name: true },
        take: { max: 100, default: 20 },
      },
    },
  },
  create: {
    shape: {
      owner: {
        data: { name: true, price: true, category: true, isPublished: true },
        select: listProductSelect,
      },
      admin: {
        data: { name: true, price: true, category: true, isPublished: force(false) },
        select: listProductSelect,
      },
    },
  },
  createMany: {
    shape: {
      owner: {
        data: { name: true, price: true, category: true, isPublished: true },
        select: listProductSelect,
      },
      admin: {
        data: { name: true, price: true, category: true, isPublished: force(false) },
        select: listProductSelect,
      },
    },
  },
  update: {
    shape: {
      owner: {
        data: { name: true, price: true, category: true, isPublished: true },
        where: { id: { equals: true } },
        select: listProductSelect,
      },
      admin: {
        data: { name: true, price: true, isPublished: true },
        where: { id: { equals: true } },
        select: listProductSelect,
      },
    },
  },
  delete: {
    shape: {
      owner: {
        where: { id: { equals: true } },
        select: { id: true, name: true },
      },
    },
  },
}