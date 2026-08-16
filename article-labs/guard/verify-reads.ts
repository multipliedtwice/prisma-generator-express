import { force } from 'prisma-guard'
import { guard } from './generated/guard/client'

type Case = { name: string; run: () => unknown }

const show = (v: unknown) => JSON.stringify(v)

function report(cases: Case[], title: string) {
  console.log('\n=== ' + title + ' ===')
  for (const c of cases) {
    try {
      const out = c.run()
      console.log(`PASS  ${c.name}\n      -> ${show(out)}`)
    } catch (err: any) {
      console.log(
        `THROW ${c.name}\n      -> ${err?.constructor?.name} status=${err?.status} code=${err?.code}\n      -> ${err?.message?.slice(0, 400)}`,
      )
    }
  }
}

// ---------------------------------------------------------------- item 1
// Does a client that sends a value MATCHING a forced field pass or 400?
const publicPlants = {
  where: {
    isPublished: { equals: force(true) },
    isDeleted: { equals: false },
    name: { contains: true },
  },
  take: { max: 50, default: 20 },
}

const parsePublic = (body: unknown) =>
  guard.query('Plant', 'findMany', publicPlants as any).parse(body)

report(
  [
    { name: 'no forced field sent', run: () => parsePublic({ where: { name: { contains: 'fern' } } }) },
    { name: 'forced boolean sent with the SAME value', run: () => parsePublic({ where: { isPublished: { equals: true } } }) },
    { name: 'forced boolean sent with a DIFFERENT value', run: () => parsePublic({ where: { isPublished: { equals: false } } }) },
    { name: 'forced literal false sent with same value', run: () => parsePublic({ where: { isDeleted: { equals: false } } }) },
    { name: 'forced literal false sent with different value', run: () => parsePublic({ where: { isDeleted: { equals: true } } }) },
    { name: 'unknown field', run: () => parsePublic({ where: { priceCents: { equals: 5 } } }) },
    { name: 'take above max', run: () => parsePublic({ take: 5000 }) },
  ],
  'ITEM 1 — forced field supplied by the client',
)

// forced scalar inside a relation filter (tenant-style scope)
const scopedOrders = (nurseryId: string) => ({
  where: {
    items: { some: { plant: { is: { nurseryId: { equals: force(nurseryId) } } } } },
    status: { equals: true },
  },
  take: { max: 20 },
})

const parseOrders = (body: unknown, nurseryId = 'nursery-1') =>
  guard.query('Order', 'findMany', scopedOrders(nurseryId) as any).parse(body)

report(
  [
    { name: 'relation-forced value, client sends nothing', run: () => parseOrders({ where: { status: { equals: 'paid' } } }) },
    { name: 'relation-forced value, client sends the SAME id', run: () => parseOrders({ where: { items: { some: { plant: { is: { nurseryId: { equals: 'nursery-1' } } } } } } }) },
    { name: 'relation-forced value, client sends ANOTHER id', run: () => parseOrders({ where: { items: { some: { plant: { is: { nurseryId: { equals: 'nursery-2' } } } } } } }) },
  ],
  'ITEM 1b — forced value inside a relation filter',
)

// ---------------------------------------------------------------- item 2
// Exact caller-routing messages.
const namedShapes = {
  storefront: { where: { name: { contains: true } }, take: { max: 20 } },
  backoffice: { where: { name: { contains: true }, isDeleted: { equals: true } }, take: { max: 100 } },
}
const namedWithDefault = { ...namedShapes, default: { where: { name: { contains: true } }, take: { max: 5 } } }

const parseNamed = (body: unknown, caller?: string, shapes: any = namedShapes) =>
  guard.query('Plant', 'findMany', shapes).parse(body, caller ? { caller } : undefined)

report(
  [
    { name: 'known caller', run: () => parseNamed({}, 'storefront') },
    { name: 'missing caller, no default', run: () => parseNamed({}) },
    { name: 'unknown caller, no default', run: () => parseNamed({}, 'nope') },
    { name: 'blank caller, no default', run: () => parseNamed({}, '   ') },
    { name: 'missing caller, with default', run: () => parseNamed({}, undefined, namedWithDefault) },
    { name: 'unknown caller, with default', run: () => parseNamed({}, 'nope', namedWithDefault) },
    { name: 'caller key in the body', run: () => parseNamed({ caller: 'backoffice' }, 'storefront') },
    { name: 'parameterized caller pattern', run: () => guard.query('Plant', 'findMany', { '/shop/:slug': { where: { name: { contains: true } }, take: { max: 10 } } } as any).parse({}, { caller: '/shop/ferns' }) },
    { name: 'parameterized pattern, wrong segment count', run: () => guard.query('Plant', 'findMany', { '/shop/:slug': { where: { name: { contains: true } }, take: { max: 10 } } } as any).parse({}, { caller: '/shop/ferns/extra' }) },
  ],
  'ITEM 2 — caller routing',
)

// ---------------------------------------------------------------- item 3
// mode: "insensitive" written as a forced literal vs client-controlled.
const modeForced = { where: { name: { contains: true, mode: 'insensitive' } }, take: { max: 10 } }
const modeClient = { where: { name: { contains: true, mode: true } }, take: { max: 10 } }

report(
  [
    { name: 'forced mode, client sends none', run: () => guard.query('Plant', 'findMany', modeForced as any).parse({ where: { name: { contains: 'fern' } } }) },
    { name: 'forced mode, client sends mode too', run: () => guard.query('Plant', 'findMany', modeForced as any).parse({ where: { name: { contains: 'fern', mode: 'insensitive' } } }) },
    { name: 'client-controlled mode, client sends it', run: () => guard.query('Plant', 'findMany', modeClient as any).parse({ where: { name: { contains: 'fern', mode: 'insensitive' } } }) },
    { name: 'client-controlled mode, client omits it', run: () => guard.query('Plant', 'findMany', modeClient as any).parse({ where: { name: { contains: 'fern' } } }) },
  ],
  'ITEM 3 — mode modifier',
)

// ---------------------------------------------------------------- item 4
// Coercion: string inputs (as they arrive from a query string) vs native JSON.
const coercionShape = {
  where: {
    priceCents: { gte: true },
    isPublished: { equals: true },
    createdAt: { gte: true },
    tags: { hasSome: true },
  },
  take: { max: 50 },
  skip: true,
}
const parseCoercion = (body: unknown) => guard.query('Plant', 'findMany', coercionShape as any).parse(body)

report(
  [
    { name: 'native types (POST body)', run: () => parseCoercion({ where: { priceCents: { gte: 500 }, isPublished: { equals: true }, createdAt: { gte: '2026-01-01T00:00:00.000Z' } }, take: 10, skip: 0 }) },
    { name: 'string number (decoded query string)', run: () => parseCoercion({ where: { priceCents: { gte: '500' } } }) },
    { name: 'string boolean', run: () => parseCoercion({ where: { isPublished: { equals: 'true' } } }) },
    { name: 'string date', run: () => parseCoercion({ where: { createdAt: { gte: '2026-01-01' } } }) },
    { name: 'string take', run: () => parseCoercion({ take: '10' }) },
    { name: 'scalar list hasSome', run: () => parseCoercion({ where: { tags: { hasSome: ['indoor', 'shade'] } } }) },
    { name: 'garbage number', run: () => parseCoercion({ where: { priceCents: { gte: 'abc' } } }) },
  ],
  'ITEM 4 — coercion',
)

// ---------------------------------------------------------------- extras
// Claims the FAQ will make; each needs a real message.
report(
  [
    { name: 'empty combinator', run: () => guard.query('Plant', 'findMany', { where: { AND: {} }, take: { max: 5 } } as any).parse({}) },
    { name: 'shape config value not exactly true (orderBy: false)', run: () => guard.query('Plant', 'findMany', { orderBy: { name: false }, take: { max: 5 } } as any).parse({}) },
    { name: 'empty select', run: () => guard.query('Plant', 'findMany', { select: {}, take: { max: 5 } } as any).parse({}) },
    { name: 'conflicting forced where values', run: () => guard.query('Plant', 'findMany', { where: { isPublished: { equals: force(true) }, AND: { isPublished: { equals: force(false) } } }, take: { max: 5 } } as any).parse({}) },
    { name: 'select and include together in the request', run: () => guard.query('Plant', 'findMany', { select: { id: true, name: true }, take: { max: 5 } } as any).parse({ select: { id: true }, include: { nursery: true } }) },
    { name: 'projection auto-apply (client sends no select)', run: () => guard.query('Plant', 'findMany', { select: { id: true, name: true }, take: { max: 5 } } as any).parse({}) },
    { name: 'client selects a field outside the shape', run: () => guard.query('Plant', 'findMany', { select: { id: true, name: true }, take: { max: 5 } } as any).parse({ select: { id: true, priceCents: true } }) },
    { name: 'deleteMany shape without where', run: () => guard.query('Plant', 'deleteMany' as any, {} as any).parse({ where: { isDeleted: { equals: true } } }) },
    { name: 'forced value inside OR is lifted', run: () => guard.query('Plant', 'findMany', { where: { OR: { name: { contains: true }, description: { contains: true } }, isPublished: { equals: force(true) } }, take: { max: 5 } } as any).parse({ where: { OR: [{ name: { contains: 'fern' } }, { description: { contains: 'fern' } }] } }) },
    { name: 'negative take', run: () => guard.query('Plant', 'findMany', { take: { max: 50 } } as any).parse({ take: -5 }) },
  ],
  'EXTRAS — shape construction and projection',
)
