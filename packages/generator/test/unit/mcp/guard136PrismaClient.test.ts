import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { force, ShapeError } from 'prisma-guard'

const packageRoot = resolve(process.cwd())
const prismaBin = resolve(packageRoot, 'node_modules/.bin/prisma')
let workDir = ''
let databasePath = ''

beforeAll(async () => {
  workDir = await mkdtemp(join(packageRoot, '.mcp-gen-guard136-'))
  databasePath = join(workDir, 'guard.db')
  await writeFile(databasePath, '')
  await writeFile(
    join(workDir, 'prisma.config.ts'),
    `import { defineConfig } from 'prisma/config'

export default defineConfig({
  schema: 'schema.prisma',
  datasource: { url: 'file:./guard.db' },
})
`,
  )
  await writeFile(
    join(workDir, 'schema.prisma'),
    `generator client {
  provider = "prisma-client-js"
  output   = "./generated/client"
}

generator guard {
  provider = "prisma-guard"
  output   = "./generated/guard"
}

datasource db {
  provider = "sqlite"
}

/// @scope-root
model Tenant {
  id    String @id
  posts Post[]
}

model Post {
  id       String @id
  tenantId String
  title    String
  tenant   Tenant @relation(fields: [tenantId], references: [id])

  @@index([tenantId])
}
`,
  )
  execFileSync(prismaBin, ['generate', '--config', 'prisma.config.ts'], {
    cwd: workDir,
    env: { ...process.env, PATH: `${dirname(prismaBin)}:${process.env.PATH}` },
    stdio: 'pipe',
  })
  execFileSync(prismaBin, ['db', 'push', '--config', 'prisma.config.ts'], {
    cwd: workDir,
    env: {
      ...process.env,
      PATH: `${dirname(prismaBin)}:${process.env.PATH}`,
    },
    stdio: 'pipe',
  })
})

afterAll(async () => {
  if (workDir) await rm(workDir, { recursive: true, force: true })
})

describe('prisma-guard 1.36 Prisma Client extension', () => {
  it('binds the generated all-model guard through PrismaClient.$extends', async () => {
    const clientModule = await import(
      pathToFileURL(join(workDir, 'generated/client/index.js')).href
    )
    const guardModule = await import(
      pathToFileURL(join(workDir, 'generated/guard/client.ts')).href
    )
    const adapter = new PrismaBetterSqlite3({ url: `file:${databasePath}` })
    const base = new clientModule.PrismaClient({ adapter })
    const prisma = base.$extends(
      guardModule.guard.extension(() => ({ Tenant: 'tenant-a' })),
    )

    try {
      await base.tenant.createMany({
        data: [{ id: 'tenant-a' }, { id: 'tenant-b' }],
      })
      await base.post.create({
        data: { id: 'other', tenantId: 'tenant-b', title: 'other tenant' },
      })
      await prisma.post
        .guard({
          data: { id: true, title: true, tenantId: force('tenant-a') },
        })
        .create({ data: { id: 'owned', title: 'owned tenant' } })

      expect(() =>
        prisma.post
          .guard({
            data: { id: true, title: true, tenantId: force('tenant-a') },
          })
          .create({
            data: {
              id: 'client-tenant',
              tenantId: 'tenant-b',
              title: 'client tenant',
            },
          }),
      ).toThrow(ShapeError)

      const guardedRows = await prisma.post
        .guard({
          where: { tenantId: { equals: force('tenant-a') } },
          orderBy: { id: true },
          select: { id: true, tenantId: true, title: true },
        })
        .findMany({ orderBy: { id: 'asc' } })
      const guardedTenants = await prisma.tenant
        .guard({ orderBy: { id: true }, select: { id: true } })
        .findMany({ orderBy: { id: 'asc' } })
      const storedRows = await base.post.findMany({ orderBy: { id: 'asc' } })

      expect(guardedRows).toEqual([
        { id: 'owned', tenantId: 'tenant-a', title: 'owned tenant' },
      ])
      expect(storedRows).toEqual([
        { id: 'other', tenantId: 'tenant-b', title: 'other tenant' },
        { id: 'owned', tenantId: 'tenant-a', title: 'owned tenant' },
      ])
      expect(guardedTenants).toEqual([{ id: 'tenant-a' }, { id: 'tenant-b' }])
    } finally {
      await base.$disconnect()
    }
  })
})
