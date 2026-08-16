import { force } from 'prisma-guard'
import { guard } from './generated/guard/client'

const ext = guard.extension(() => ({ Nursery: 'nursery-1' }) as any)
const OPS = ['findMany', 'findFirst', 'findUnique', 'create', 'createMany', 'update', 'updateMany', 'upsert', 'delete', 'deleteMany', 'count', 'aggregate', 'groupBy']
const fake = Object.fromEntries(OPS.map((op) => [op, async (args: unknown) => args]))
const delegates: Record<string, unknown> = { nursery: fake, plant: fake, customer: fake, order: fake, orderItem: fake }
const guarded = (model: string, shape: unknown, caller?: string) =>
  (ext.model as any)[model].guard.call({ $parent: delegates }, shape, caller)

type Case = { name: string; run: () => unknown }

async function report(cases: Case[], title: string) {
  console.log('\n=== ' + title + ' ===')
  for (const c of cases) {
    try {
      console.log(`PASS  ${c.name}\n      -> ${JSON.stringify(await c.run())}`)
    } catch (err: any) {
      console.log(`THROW ${c.name}\n      -> ${err?.constructor?.name} status=${err?.status}\n      -> ${err?.message?.slice(0, 400)}`)
    }
  }
}

const selectShape = { select: { id: true, name: true }, take: { max: 10 } }

await report(
  [
    { name: 'READ projection auto-apply, via parse()', run: () => guard.query('Plant', 'findMany', selectShape as any).parse({}) },
    { name: 'READ projection auto-apply, via the guarded delegate', run: () => guarded('plant', selectShape).findMany({}) },
    { name: 'READ projection auto-apply, client sends a narrower select', run: () => guarded('plant', selectShape).findMany({ select: { id: true } }) },
    { name: 'take default via the guarded delegate', run: () => guarded('plant', { take: { max: 10, default: 3 } }).findMany({}) },
    { name: 'take with no default via the guarded delegate', run: () => guarded('plant', { take: { max: 10 } }).findMany({}) },
  ],
  'PROJECTION AUTO-APPLY AND TAKE DEFAULTS',
)

await report(
  [
    { name: 'deleteMany shape without where', run: () => guarded('plant', { where: {} }).deleteMany({ where: { isDeleted: true } }) },
    { name: 'deleteMany shape with no where key at all', run: () => guarded('plant', {} as any).deleteMany({ where: { isDeleted: true } }) },
    { name: 'updateManyAndReturn shape without where', run: () => guarded('plant', { data: { isPublished: true } }).updateManyAndReturn({ where: { isDeleted: true }, data: { isPublished: true } }) },
    { name: 'ambiguous caller across two patterns', run: () => guarded('plant', { '/shop/:slug': { take: { max: 5 } }, '/:section/ferns': { take: { max: 5 } } }, '/shop/ferns').findMany({}) },
    { name: 'reserved key as a caller name, extension entry point', run: () => guarded('plant', { where: { name: { contains: true } }, storefront: { take: { max: 5 } } } as any, 'storefront').findMany({}) },
  ],
  'BULK SAFETY AND ROUTING EDGE CASES',
)

await report(
  [
    { name: 'forced NOT plus client NOT', run: () => guard.query('Plant', 'findMany', { where: { NOT: { isDeleted: { equals: force(true) } }, name: { contains: true } }, take: { max: 5 } } as any).parse({ where: { NOT: { name: { contains: 'draft' } } } }) },
    { name: 'forced value AND-wrapped when the client filters another field', run: () => guard.query('Plant', 'findMany', { where: { isPublished: { equals: force(true) }, name: { contains: true } }, take: { max: 5 } } as any).parse({ where: { name: { contains: 'fern' } } }) },
    { name: 'forced value inline-merged when the client touches the same field', run: () => guard.query('Plant', 'findMany', { where: { isPublished: { equals: force(true) }, name: { contains: true } }, take: { max: 5 } } as any).parse({ where: { isPublished: { equals: false } } }) },
    { name: '@zod .default() field omitted from a create data shape', run: () => guarded('plant', { data: { name: true, priceCents: true, tags: true } }).create({ data: { name: 'Fern', priceCents: 1, tags: [] } }) },
  ],
  'FORCED MERGE STRATEGY',
)

await report(
  [
    { name: 'relation write config: connect: true', run: () => guarded('order', { data: { status: true, customer: { connect: true } } }).create({ data: { status: 'draft', customer: { connect: { id: 'c1' } } } }) },
    { name: 'relation write config: connect with unique selector', run: () => guarded('order', { data: { status: true, customer: { connect: { id: true } } } }).create({ data: { status: 'draft', customer: { connect: { id: 'c1' } } } }) },
    { name: 'create shape missing a required no-default field', run: () => guarded('plant', { data: { name: true, priceCents: true } }).create({ data: { name: 'Fern', priceCents: 1 } }) },
    { name: 'unique where on a non-unique field (findUnique)', run: () => guard.query('Plant', 'findUnique', { where: { name: true } } as any).parse({ where: { name: 'Fern' } }) },
    { name: 'groupBy shape without by', run: () => guard.query('Plant', 'groupBy', { _count: { _all: true } } as any).parse({ by: ['isPublished'] }) },
  ],
  'SHAPE CONSTRUCTION MESSAGES QUOTED IN THE FAQ',
)

await report(
  [
    { name: 'nested include, forced where, client sends the forced field', run: () => guard.query('Nursery', 'findMany', { include: { plants: { where: { isDeleted: { equals: force(false) } }, take: { max: 20, default: 10 } } }, take: { max: 10 } } as any).parse({ include: { plants: { where: { isDeleted: { equals: true } } } } }) },
    { name: 'nested include, forced where, client filters an allowed field', run: () => guard.query('Nursery', 'findMany', { include: { plants: { where: { isDeleted: { equals: force(false) }, name: { contains: true } }, take: { max: 20, default: 10 } } }, take: { max: 10 } } as any).parse({ include: { plants: { where: { name: { contains: 'fern' } } } } }) },
  ],
  'NESTED INCLUDE IS A STRICT POSITION (nursery schema, quoted in A9)',
)
