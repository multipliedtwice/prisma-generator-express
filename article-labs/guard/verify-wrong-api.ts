import { force } from 'prisma-guard'
import { guard } from './generated/guard/client'

type Case = { name: string; run: () => unknown }

function report(cases: Case[], title: string) {
  console.log('\n=== ' + title + ' ===')
  for (const c of cases) {
    try {
      console.log(`PASS  ${c.name}\n      -> ${JSON.stringify(c.run())}`)
    } catch (err: any) {
      console.log(
        `THROW ${c.name}\n      -> ${err?.constructor?.name} status=${err?.status}\n      -> ${err?.message?.slice(0, 400)}`,
      )
    }
  }
}

const q = (model: string, method: string, shape: any, body: unknown, caller?: string) =>
  guard.query(model as any, method as any, shape).parse(body, caller ? { caller } : undefined)

// ------------------------------------------------------------ data shapes
const createShape = {
  data: { name: true, priceCents: true, isPublished: force(false), description: (b: any) => b.max(20) },
}

report(
  [
    { name: 'create, only client fields', run: () => q('Plant', 'create', createShape, { data: { name: 'Fern', priceCents: 900, nurseryId: 'n1' } }) },
    { name: 'create, client sends the forced field with a DIFFERENT value', run: () => q('Plant', 'create', createShape, { data: { name: 'Fern', priceCents: 900, nurseryId: 'n1', isPublished: true } }) },
    { name: 'create, client sends the forced field with the SAME value', run: () => q('Plant', 'create', createShape, { data: { name: 'Fern', priceCents: 900, nurseryId: 'n1', isPublished: false } }) },
    { name: 'create, field absent from the data shape', run: () => q('Plant', 'create', createShape, { data: { name: 'Fern', priceCents: 900, nurseryId: 'n1', tags: ['indoor'] } }) },
    { name: 'create, missing a required field', run: () => q('Plant', 'create', createShape, { data: { name: 'Fern' } }) },
    { name: 'create, inline refine violated', run: () => q('Plant', 'create', createShape, { data: { name: 'Fern', priceCents: 900, nurseryId: 'n1', description: 'x'.repeat(50) } }) },
    { name: 'create, @zod violated on another model', run: () => q('Customer', 'create', { data: { email: true, name: true } }, { data: { email: 'not-an-email' } }) },
    { name: 'create, @zod satisfied', run: () => q('Customer', 'create', { data: { email: true, name: true } }, { data: { email: 'a@b.com' } }) },
    { name: 'create, projection not in shape', run: () => q('Plant', 'create', createShape, { data: { name: 'Fern', priceCents: 900, nurseryId: 'n1' }, select: { id: true } }) },
    { name: 'create, projection allowed by shape', run: () => q('Plant', 'create', { ...createShape, select: { id: true, name: true } }, { data: { name: 'Fern', priceCents: 900, nurseryId: 'n1' }, select: { id: true } }) },
  ],
  'DATA SHAPES — create',
)

report(
  [
    { name: 'update with where + data', run: () => q('Plant', 'update', { data: { name: true }, where: { id: true } }, { where: { id: 'p1' }, data: { name: 'New' } }) },
    { name: 'update, data key not in shape', run: () => q('Plant', 'update', { data: { name: true }, where: { id: true } }, { where: { id: 'p1' }, data: { priceCents: 1 } }) },
    { name: 'update, where key not in shape', run: () => q('Plant', 'update', { data: { name: true }, where: { id: true } }, { where: { name: 'Fern' }, data: { name: 'New' } }) },
    { name: 'updateMany without where in shape', run: () => q('Plant', 'updateMany', { data: { isPublished: true } }, { where: { isDeleted: false }, data: { isPublished: true } }) },
    { name: 'updateMany with where in shape', run: () => q('Plant', 'updateMany', { data: { isPublished: true }, where: { isDeleted: { equals: true } } }, { where: { isDeleted: { equals: true } }, data: { isPublished: true } }) },
    { name: 'updateMany, body without where', run: () => q('Plant', 'updateMany', { data: { isPublished: true }, where: { isDeleted: { equals: true } } }, { data: { isPublished: true } }) },
    { name: 'deleteMany with where shape', run: () => q('Plant', 'deleteMany', { where: { isDeleted: { equals: force(true) } } }, { where: {} }) },
    { name: 'upsert with data instead of create/update', run: () => q('Plant', 'upsert', { where: { id: true }, data: { name: true } }, { where: { id: 'p1' }, data: { name: 'x' } }) },
    { name: 'upsert correct', run: () => q('Plant', 'upsert', { where: { id: true }, create: { name: true, priceCents: true }, update: { name: true } }, { where: { id: 'p1' }, create: { name: 'Fern', priceCents: 900, nurseryId: 'n1' }, update: { name: 'Fern2' } }) },
    { name: 'createMany with a single object', run: () => q('Plant', 'createMany', { data: { name: true, priceCents: true } }, { data: { name: 'Fern', priceCents: 900, nurseryId: 'n1' } }) },
    { name: 'createMany with an array', run: () => q('Plant', 'createMany', { data: { name: true, priceCents: true } }, { data: [{ name: 'Fern', priceCents: 900, nurseryId: 'n1' }] }) },
    { name: 'relation write: connect allowed by shape', run: () => q('Order', 'create', { data: { status: true, customer: { connect: true } } }, { data: { status: 'draft', nurseryId: 'n1', customer: { connect: { id: 'c1' } } } }) },
    { name: 'relation write: nested create not in shape', run: () => q('Order', 'create', { data: { status: true, customer: { connect: true } } }, { data: { status: 'draft', nurseryId: 'n1', customer: { create: { email: 'a@b.com' } } } }) },
  ],
  'DATA SHAPES — update / bulk / upsert / relations',
)

// ------------------------------------------------------------ reads, misc
report(
  [
    { name: 'findUnique, non-unique where', run: () => q('Plant', 'findUnique', { where: { name: true } }, { where: { name: 'Fern' } }) },
    { name: 'findUnique, unique where', run: () => q('Customer', 'findUnique', { where: { email: true } }, { where: { email: 'a@b.com' } }) },
    { name: 'groupBy without by', run: () => q('Plant', 'groupBy', { _count: { _all: true } }, { by: ['isPublished'] }) },
    { name: 'groupBy with by', run: () => q('Plant', 'groupBy', { by: ['isPublished'], _count: { _all: true } }, { by: ['isPublished'] }) },
    { name: 'nested include with forced where (to-many)', run: () => q('Nursery', 'findMany', { include: { plants: { where: { isDeleted: { equals: false } }, take: { max: 20, default: 10 } } }, take: { max: 10 } }, {}) },
    { name: 'nested include, client widens the nested take', run: () => q('Nursery', 'findMany', { include: { plants: { where: { isDeleted: { equals: false } }, take: { max: 20, default: 10 } } }, take: { max: 10 } }, { include: { plants: { take: 500 } } }) },
    { name: 'to-one relation in select, no forced where possible', run: () => q('Plant', 'findMany', { select: { id: true, nursery: { select: { name: true } } }, take: { max: 10 } }, {}) },
    { name: 'orderBy field not in shape', run: () => q('Plant', 'findMany', { orderBy: { name: true }, take: { max: 10 } }, { orderBy: { priceCents: 'desc' } }) },
    { name: 'orderBy allowed', run: () => q('Plant', 'findMany', { orderBy: { name: true }, take: { max: 10 } }, { orderBy: { name: 'desc' } }) },
    { name: 'skip not enabled in shape', run: () => q('Plant', 'findMany', { take: { max: 10 } }, { skip: 5 }) },
    { name: 'skip enabled', run: () => q('Plant', 'findMany', { skip: true, take: { max: 10 } }, { skip: 5 }) },
    { name: 'distinct not in shape', run: () => q('Plant', 'findMany', { take: { max: 10 } }, { distinct: ['name'] }) },
    { name: 'take omitted, shape default applied', run: () => q('Plant', 'findMany', { take: { max: 10, default: 3 } }, {}) },
    { name: 'take omitted, no default in shape', run: () => q('Plant', 'findMany', { take: { max: 10 } }, {}) },
    { name: 'context-dependent shape', run: () => guard.query('Plant', 'findMany', (ctx: any) => ({ where: { nurseryId: { equals: force(ctx.nurseryId) } }, take: { max: 10 } })).parse({}, { ctx: { nurseryId: 'n-42' } } as any) },
    { name: 'context-dependent shape, ctx missing', run: () => guard.query('Plant', 'findMany', (ctx: any) => { if (!ctx?.nurseryId) throw new Error('Missing nurseryId in guard context'); return { where: { nurseryId: { equals: force(ctx.nurseryId) } }, take: { max: 10 } } }).parse({}) },
  ],
  'READS — projection, ordering, pagination, context',
)
