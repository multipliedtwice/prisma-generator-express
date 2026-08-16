import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import express, { type RequestHandler } from 'express'
import { PrismaClient } from '@prisma/client'
import { guard } from './prisma/generated/guard/client.js'
import { DeliveryRouter as PromiseDeliveryRouter } from './prisma/generated/promise/Delivery/DeliveryRouter.js'
import { DeliveryRouter as TransactionDeliveryRouter } from './prisma/generated/transaction/Delivery/DeliveryRouter.js'

const prisma = new PrismaClient()
const guardedPrisma = prisma.$extends(guard.extension(() => ({})))
const lines: string[] = []

const record = (label: string, value: unknown) => {
  lines.push(`${label}: ${JSON.stringify(value)}`)
}

const readJson = async (response: Response) => ({
  status: response.status,
  body: await response.json(),
})

const get = (base: string, path: string, headers?: HeadersInit) =>
  fetch(`${base}${path}`, { headers })

const post = (base: string, path: string, body: unknown, headers?: HeadersInit) =>
  fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })

const parseSse = (body: string) => body
  .split('\n')
  .filter((line) => line.startsWith('data: '))
  .map((line) => JSON.parse(line.slice(6)))

const mutatingBodyHook: RequestHandler = (req, _res, next) => {
  if (!req.body) req.body = {}
  req.body.where = { status: 'cancelled' }
  next()
}

const parsedQueryHook: RequestHandler = (_req, res, next) => {
  res.locals.parsedQuery = { where: { status: 'cancelled' } }
  next()
}

const failStage = async () => {
  throw new Error('stage failed')
}

let manualAfterCount = 0
const countManualAfter: RequestHandler = (_req, _res, next) => {
  manualAfterCount += 1
  next()
}

const app = express()
app.use(express.json())
app.use((req, _res, next) => {
  Object.assign(req, { prisma: guardedPrisma })
  next()
})

app.use('/plain', PromiseDeliveryRouter({
  findMany: {},
  findManyPaginated: {},
  pagination: { defaultLimit: 2, maxLimit: 3, distinctCountLimit: 1 },
  disableOpenApi: true,
  queryBuilder: false,
}))

app.use('/native', PromiseDeliveryRouter({
  findMany: {},
  disableOpenApi: true,
  queryBuilder: false,
}))

app.use('/distinct-exact', PromiseDeliveryRouter({
  findManyPaginated: {},
  pagination: { distinctCountLimit: 10 },
  disableOpenApi: true,
  queryBuilder: false,
}))

app.use('/guarded', PromiseDeliveryRouter({
  findManyPaginated: {
    shape: {
      where: { status: { equals: true } },
      take: { max: 10, default: 4 },
      distinct: ['status'],
    },
  },
  pagination: { defaultLimit: 2, maxLimit: 3 },
  disableOpenApi: true,
  queryBuilder: false,
}))

app.use('/materialized', PromiseDeliveryRouter({
  findManyPaginated: {},
  pagination: {
    countSource: {
      type: 'materializedView',
      schema: 'public',
      relation: 'mv_delivery_count',
      column: 'total',
    },
  },
  disableOpenApi: true,
  queryBuilder: false,
}))

app.use('/materialized-guarded', PromiseDeliveryRouter({
  findManyPaginated: {
    shape: {
      where: { status: { equals: true } },
      take: { max: 10, default: 2 },
    },
  },
  pagination: {
    countSource: {
      type: 'materializedView',
      schema: 'public',
      relation: 'mv_delivery_count',
      column: 'total',
    },
  },
  disableOpenApi: true,
  queryBuilder: false,
}))

app.use('/transaction', TransactionDeliveryRouter({
  findManyPaginated: {},
  disableOpenApi: true,
  queryBuilder: false,
}))

const noTransactionClient = new Proxy(prisma, {
  get(target, property, receiver) {
    if (property === '$transaction') return undefined
    return Reflect.get(target, property, receiver)
  },
})

const noTransactionApp = express()
noTransactionApp.use((req, _res, next) => {
  Object.assign(req, { prisma: noTransactionClient })
  next()
})
noTransactionApp.use('/', TransactionDeliveryRouter({
  findManyPaginated: {},
  disableOpenApi: true,
  queryBuilder: false,
}))

app.use('/hook-body', PromiseDeliveryRouter({
  findMany: { before: [mutatingBodyHook] },
  disableOpenApi: true,
  queryBuilder: false,
}))

app.use('/hook-parsed', PromiseDeliveryRouter({
  findMany: { before: [parsedQueryHook] },
  disableOpenApi: true,
  queryBuilder: false,
}))

app.use('/manual', PromiseDeliveryRouter({
  resolveContext: () => ({}),
  findMany: {
    after: [countManualAfter],
    progressive: {
      stream: { stages: ['summary', 'statuses'] },
      failure: { stages: ['summary', 'fail'] },
    },
    progressiveStages: {
      summary: async ({ prisma: requestPrisma }) => ({
        key: 'summary',
        value: { total: await requestPrisma.delivery.count() },
      }),
      statuses: async ({ prisma: requestPrisma }) => ({
        key: 'statuses',
        value: await requestPrisma.delivery.findMany({
          orderBy: { id: 'asc' },
          select: { id: true, status: true },
          take: 2,
        }),
      }),
      fail: failStage,
    },
  },
  disableOpenApi: true,
  queryBuilder: false,
}))

app.use('/auto', PromiseDeliveryRouter({
  findMany: {
    progressive: {
      stream: { mode: 'autoInclude', fallback: 'error' },
      unsupported: { mode: 'autoInclude', fallback: 'error' },
      single: { mode: 'autoInclude', fallback: 'singleResult' },
    },
  },
  findManyPaginated: {
    progressive: {
      stream: { mode: 'autoInclude', fallback: 'error' },
    },
  },
  disableOpenApi: true,
  queryBuilder: false,
}))

const listen = async (target: express.Express) => {
  const server = target.listen(0)
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve)
    server.once('error', reject)
  })
  const address = server.address()
  assert(address && typeof address !== 'string')
  return { server, base: `http://127.0.0.1:${address.port}` }
}

const seed = async () => {
  await prisma.stop.deleteMany()
  await prisma.delivery.deleteMany()
  await prisma.courier.deleteMany()
  await prisma.courier.createMany({
    data: [
      { id: 'c1', name: 'Ari' },
      { id: 'c2', name: 'Bo' },
    ],
  })
  await prisma.delivery.createMany({
    data: [
      { id: 'd1', status: 'delivered', city: 'Bangkok', createdAt: new Date('2026-01-01T00:00:00Z'), courierId: 'c1' },
      { id: 'd2', status: 'delivered', city: 'Bangkok', createdAt: new Date('2026-01-02T00:00:00Z'), courierId: 'c1' },
      { id: 'd3', status: 'active', city: 'Chiang Mai', createdAt: new Date('2026-01-03T00:00:00Z'), courierId: 'c2' },
      { id: 'd4', status: 'active', city: 'Bangkok', createdAt: new Date('2026-01-04T00:00:00Z'), courierId: 'c2' },
      { id: 'd5', status: 'cancelled', city: 'Phuket', createdAt: new Date('2026-01-05T00:00:00Z'), courierId: 'c1' },
      { id: 'd6', status: 'cancelled', city: 'Bangkok', createdAt: new Date('2026-01-06T00:00:00Z'), courierId: 'c2' },
    ],
  })
  await prisma.stop.createMany({
    data: [
      { id: 's1', label: 'Pickup', position: 1, deliveryId: 'd1' },
      { id: 's2', label: 'Dropoff', position: 2, deliveryId: 'd1' },
      { id: 's3', label: 'Pickup', position: 1, deliveryId: 'd2' },
    ],
  })
  await prisma.$executeRawUnsafe('DROP MATERIALIZED VIEW IF EXISTS "mv_delivery_count"')
  await prisma.$executeRawUnsafe('CREATE MATERIALIZED VIEW "mv_delivery_count" AS SELECT 99::bigint AS "total"')
}

const main = async () => {
  await seed()
  const { server, base } = await listen(app)
  const noTx = await listen(noTransactionApp)
  try {
    record('VERSION', {
      generator: '1.64.4',
      guard: '1.33.0',
      prisma: '6.19.3',
      node: '22.14.0',
      postgres: '16.6',
    })

    const forward = await readJson(await get(base, '/plain/delivery/paginated?take=2&skip=1&orderBy=%7B%22id%22%3A%22asc%22%7D'))
    assert.equal(forward.status, 200)
    record('PAGINATION forward-offset', forward)
    const cursor = await readJson(await get(base, '/plain/delivery/paginated?take=2&cursor=%7B%22id%22%3A%22d2%22%7D&orderBy=%7B%22id%22%3A%22asc%22%7D'))
    record('PAGINATION cursor', cursor)
    const backward = await readJson(await get(base, '/plain/delivery/paginated?take=-2&cursor=%7B%22id%22%3A%22d5%22%7D&orderBy=%7B%22id%22%3A%22asc%22%7D'))
    record('PAGINATION negative-take', backward)
    const zero = await readJson(await get(base, '/plain/delivery/paginated?take=0'))
    record('PAGINATION take-zero', zero)
    const tx = await readJson(await get(base, '/transaction/delivery/paginated?take=2&orderBy=%7B%22id%22%3A%22asc%22%7D'))
    record('PAGINATION transaction', tx)
    const missingTx = await readJson(await get(noTx.base, '/delivery/paginated?take=2'))
    record('PAGINATION transaction-missing', missingTx)

    const defaultLimit = await readJson(await get(base, '/plain/delivery?orderBy=%7B%22id%22%3A%22asc%22%7D'))
    record('LIMIT unguarded-default', defaultLimit.body.length)
    const maxLimit = await readJson(await get(base, '/plain/delivery?take=10&orderBy=%7B%22id%22%3A%22asc%22%7D'))
    record('LIMIT unguarded-max', maxLimit.body.length)
    const guardDefault = await readJson(await get(base, '/guarded/delivery/paginated'))
    assert.equal(guardDefault.status, 200, JSON.stringify(guardDefault.body))
    record('LIMIT guard-default', guardDefault.body.data.length)
    const guardMax = await readJson(await get(base, '/guarded/delivery/paginated?take=10'))
    assert.equal(guardMax.status, 200, JSON.stringify(guardMax.body))
    record('LIMIT guard-client-max', guardMax.body.data.length)

    const exactDistinct = await readJson(await get(base, '/distinct-exact/delivery/paginated?distinct=status&take=3'))
    assert.equal(exactDistinct.status, 200)
    record('COUNT distinct-within-limit', { total: exactDistinct.body.total, rows: exactDistinct.body.data.length })
    const approximateDistinct = await readJson(await get(base, '/plain/delivery/paginated?distinct=status&take=3'))
    assert.equal(approximateDistinct.status, 200)
    record('COUNT distinct-over-limit', { total: approximateDistinct.body.total, rows: approximateDistinct.body.data.length })
    const guardedDistinct = await readJson(await get(base, '/guarded/delivery/paginated?distinct=status&take=3'))
    assert.equal(guardedDistinct.status, 200, JSON.stringify(guardedDistinct.body))
    record('COUNT guarded-distinct', { total: guardedDistinct.body.total, rows: guardedDistinct.body.data.length })
    const materialized = await readJson(await get(base, '/materialized/delivery/paginated?take=2'))
    record('COUNT materialized', materialized.body.total)
    const materializedWhere = await readJson(await get(base, '/materialized/delivery/paginated?take=2&where=%7B%22status%22%3A%22active%22%7D'))
    record('COUNT materialized-with-where', materializedWhere.body.total)
    const materializedDistinct = await readJson(await get(base, '/materialized/delivery/paginated?take=2&distinct=status'))
    record('COUNT materialized-with-distinct', materializedDistinct.body.total)
    const materializedGuard = await readJson(await get(base, '/materialized-guarded/delivery/paginated'))
    assert.equal(materializedGuard.status, 200, JSON.stringify(materializedGuard.body))
    record('COUNT materialized-with-guard', materializedGuard.body.total)

    const getRead = await readJson(await get(base, '/plain/delivery?take=2&where=%7B%22status%22%3A%22active%22%7D&orderBy=%7B%22id%22%3A%22asc%22%7D'))
    const postRead = await readJson(await post(base, '/plain/delivery/read', { take: 2, where: { status: 'active' }, orderBy: { id: 'asc' } }))
    record('POST-READ get-post-equal', JSON.stringify(getRead.body) === JSON.stringify(postRead.body))
    const postStringTake = await readJson(await post(base, '/native/delivery/read', { take: '2' }))
    const postStringMessage = typeof postStringTake.body.message === 'string'
      ? postStringTake.body.message.trim().split('\n').at(-1)
      : postStringTake.body.message
    record('POST-READ string-take', { status: postStringTake.status, message: postStringMessage })
    const postWithSseAccept = await post(base, '/plain/delivery/read', { take: 1 }, { accept: 'text/event-stream' })
    record('POST-READ sse-accept', {
      status: postWithSseAccept.status,
      contentType: postWithSseAccept.headers.get('content-type'),
      rows: (await postWithSseAccept.json()).length,
    })

    const hookPost = await readJson(await post(base, '/hook-body/delivery/read', {}))
    const hookGet = await readJson(await get(base, '/hook-body/delivery'))
    const hookParsed = await readJson(await post(base, '/hook-parsed/delivery/read', {}))
    record('HOOK mutate-body-post-row-count', hookPost.body.length)
    record('HOOK mutate-body-get-row-count', hookGet.body.length)
    record('HOOK mutate-parsed-query-row-count', hookParsed.body.length)

    const manualJson = await readJson(await get(base, '/manual/delivery?take=1'))
    record('SSE ordinary-json-after-count', { status: manualJson.status, afterCount: manualAfterCount })
    const singleResponse = await get(base, '/plain/delivery?take=1', { accept: 'text/event-stream' })
    const singleEvents = parseSse(await singleResponse.text())
    record('SSE unconfigured-types', singleEvents.map((event) => event.type))
    const manualResponse = await get(base, '/manual/delivery', { accept: 'text/event-stream', 'x-api-variant': 'stream' })
    const manualEvents = parseSse(await manualResponse.text())
    record('SSE manual-types', manualEvents.map((event) => event.type))
    record('SSE manual-result', manualEvents.at(-1))
    record('SSE progressive-after-count', manualAfterCount)
    const failureResponse = await get(base, '/manual/delivery', { accept: 'text/event-stream', 'x-api-variant': 'failure' })
    const failureEvents = parseSse(await failureResponse.text())
    record('SSE failure-types', failureEvents.map((event) => event.type))
    record('SSE failure-last', failureEvents.at(-1))
    const autoResponse = await get(base, '/auto/delivery?take=2&orderBy=%7B%22id%22%3A%22asc%22%7D&include=%7B%22courier%22%3Atrue%2C%22stops%22%3A%7B%22orderBy%22%3A%7B%22position%22%3A%22asc%22%7D%7D%7D', { accept: 'text/event-stream', 'x-api-variant': 'stream' })
    const autoEvents = parseSse(await autoResponse.text())
    record('SSE auto-types', autoEvents.map((event) => event.type))
    record('SSE auto-result-has-relations', autoEvents.at(-1)?.data.every((row: Record<string, unknown>) => 'courier' in row && 'stops' in row))
    const paginatedAutoResponse = await get(base, '/auto/delivery/paginated?take=2&orderBy=%7B%22id%22%3A%22asc%22%7D&include=%7B%22courier%22%3Atrue%7D', { accept: 'text/event-stream', 'x-api-variant': 'stream' })
    const paginatedAutoEvents = parseSse(await paginatedAutoResponse.text())
    record('SSE paginated-auto-types', paginatedAutoEvents.map((event) => event.type))
    record('SSE paginated-auto-result-shape', Object.keys(paginatedAutoEvents.at(-1)?.data ?? {}).sort())
    const unsupportedPath = '/auto/delivery?take=2&include=%7B%22stops%22%3A%7B%22take%22%3A1%7D%7D'
    const fallbackErrorResponse = await get(base, unsupportedPath, { accept: 'text/event-stream', 'x-api-variant': 'unsupported' })
    const fallbackErrorEvents = parseSse(await fallbackErrorResponse.text())
    record('SSE fallback-error', fallbackErrorEvents.map((event) => event.type))
    const fallbackSingleResponse = await get(base, unsupportedPath, { accept: 'text/event-stream', 'x-api-variant': 'single' })
    const fallbackSingleEvents = parseSse(await fallbackSingleResponse.text())
    record('SSE fallback-single', fallbackSingleEvents.map((event) => event.type))

    const output = `${lines.join('\n')}\n`
    if (process.argv.includes('--check')) {
      const expectedPath = fileURLToPath(new URL('./RESULTS.txt', import.meta.url))
      const expected = await readFile(expectedPath, 'utf8')
      assert.equal(output, expected, 'RESULTS.txt is stale; run npm run verify and update the fixture')
    }
    process.stdout.write(output)
  } finally {
    server.close()
    noTx.server.close()
    await prisma.$disconnect()
  }
}

await main()
