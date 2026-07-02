/**
 * User route config.
 *
 * restrictMemberToSelf runs on both findMany and findUnique so a MEMBER
 * cannot fetch another user by id.
 *
 * passwordHash appears in `data` but never in `select`. Combined with
 * generator-level enforceProjection this guarantees hashes never leak
 * on mutation responses either.
 *
 * updateEach bypasses guard shapes; requireOwnerRole gates it.
 */
import { force } from 'prisma-guard'
import type { UserRouteConfig } from '../../../prisma/generated/express/User/UserRouter'
import { restrictMemberToSelf, requireOwnerRole } from '../../hooks'

const publicUserSelect = {
  id: true,
  email: true,
  role: true,
  isActive: true,
  createdAt: true,
} as const

export const userConfig: UserRouteConfig = {
  enableAll: true,
  queryBuilder: { enabled: true },
  guard: { variantHeader: 'x-api-variant' },
  findMany: {
    before: [restrictMemberToSelf],
    shape: {
      owner: {
        where: {
          email: { contains: true },
          role: { equals: true },
          isActive: { equals: true },
        },
        select: publicUserSelect,
        orderBy: { createdAt: true },
        take: { max: 100, default: 25 },
      },
      admin: {
        where: { email: { contains: true }, role: { equals: true } },
        select: publicUserSelect,
        orderBy: { createdAt: true },
        take: { max: 100, default: 25 },
      },
      member: {
        where: { id: { equals: true } },
        select: publicUserSelect,
        take: { max: 1, default: 1 },
      },
    },
  },
  findUnique: {
    before: [restrictMemberToSelf],
    shape: {
      owner:  { where: { id: { equals: true } }, select: publicUserSelect },
      admin:  { where: { id: { equals: true } }, select: publicUserSelect },
      member: { where: { id: { equals: true } }, select: publicUserSelect },
    },
  },
  create: {
    shape: {
      owner: {
        data: {
          email: true,
          passwordHash: true,
          role: true,
          isActive: force(true),
        },
        select: publicUserSelect,
      },
      admin: {
        data: {
          email: true,
          passwordHash: true,
          role: 'MEMBER',
          isActive: force(true),
        },
        select: publicUserSelect,
      },
    },
  },
  update: {
    shape: {
      owner: {
        data: { email: true, role: true, isActive: true },
        where: { id: { equals: true } },
        select: publicUserSelect,
      },
      admin: {
        data: { email: true, isActive: true },
        where: { id: { equals: true } },
        select: publicUserSelect,
      },
    },
  },
  updateEach: {
    before: [requireOwnerRole],
  },
}