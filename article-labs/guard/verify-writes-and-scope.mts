import { force } from 'prisma-guard'
import { guard } from './generated/guard/client'

let scopeCtx: Record<string, unknown> = { Nursery: 'nursery-1' }
const ext = guard.extension(() => scopeCtx as any)

const OPS = [
  'findMany', 'findFirst', 'findUnique', 'create', 'createMany', 'update',
  'updateMany', 'upsert', 'delete', 'deleteMany', 'count', 'aggregate', 'groupBy',
]

// Fake delegate: returns the args it would have sent to the database.
const fakeDelegate = Object.fromEntries(OPS.map((op) => [op, async (args: unknown) => args]))

const delegates: Record<string, unknown> = {
  nursery: fakeDelegate, plant: fakeDelegate, customer: fakeDelegate,
  order: fakeDelegate, orderItem: fakeDelegate,
}

// Emulates prisma.<model>.guard(shape, caller).<op>(args) without a Prisma client.
function guarded(model: string, shape: unknown, caller?: string) {
  const modelExt = (ext.model as any)[model]
  return modelExt.guard.call({ $parent: delegates }, shape, caller)
}

// Emulates the scope extension's interception of a raw operation.
async function scoped(model: string, operation: string, args: unknown) {
  return (ext.query as any).$allOperations({
    model, operation, args, query: async (a: unknown) => a,
  })
}

type Case = { name: string; run: () => unknown }

async function report(cases: Case[], title: string) {
  console.log('\n=== ' + title + ' ===')
  for (const c of cases) {
    try {
      console.log(`PASS  ${c.name}\n      -> ${JSON.stringify(await c.run())}`)
    } catch (err: any) {
      console.log(
        `THROW ${c.name}\n      -> ${err?.constructor?.name} status=${err?.status}\n      -> ${err?.message?.slice(0, 300)}`,
      )
    }
  }
}

const createShape = {
  data: { name: true, priceCents: true, tags: true, isPublished: force(false), description: (b: any) => b.max(20) },
}

await report(
  [
    { name: 'create, allowed fields only', run: () => guarded('plant', createShape).create({ data: { name: 'Fern', priceCents: 900, tags: [] } }) },
    { name: 'create, client sends forced field with a DIFFERENT value', run: () => guarded('plant', createShape).create({ data: { name: 'Fern', priceCents: 900, tags: [], isPublished: true } }) },
    { name: 'create, client sends forced field with the SAME value', run: () => guarded('plant', createShape).create({ data: { name: 'Fern', priceCents: 900, tags: [], isPublished: false } }) },
    { name: 'create, field absent from the data shape', run: () => guarded('plant', createShape).create({ data: { name: 'Fern', priceCents: 900, tags: [], tags: ['indoor'] } }) },
    { name: 'create, missing a required field', run: () => guarded('plant', createShape).create({ data: { name: 'Fern', tags: [] } }) },
    { name: 'create, inline refine violated', run: () => guarded('plant', createShape).create({ data: { name: 'Fern', priceCents: 900, tags: [], description: 'x'.repeat(50) } }) },
    { name: 'create, scope FK sent by the client', run: () => guarded('plant', createShape).create({ data: { name: 'Fern', priceCents: 900, tags: [], nurseryId: 'nursery-99' } }) },
    { name: 'create on Customer, @zod .email() violated', run: () => guarded('customer', { data: { email: true, name: true } }).create({ data: { email: 'not-an-email' } }) },
    { name: 'create on Customer, @zod satisfied', run: () => guarded('customer', { data: { email: true, name: true } }).create({ data: { email: 'a@b.com' } }) },
    { name: 'create, client asks for a projection the shape does not define', run: () => guarded('plant', createShape).create({ data: { name: 'Fern', priceCents: 900, tags: [] }, select: { id: true } }) },
    { name: 'create, projection allowed by the shape', run: () => guarded('plant', { ...createShape, select: { id: true, name: true } }).create({ data: { name: 'Fern', priceCents: 900, tags: [] }, select: { id: true } }) },
    { name: 'create, no projection requested (enforceProjection=false)', run: () => guarded('plant', { ...createShape, select: { id: true, name: true } }).create({ data: { name: 'Fern', priceCents: 900, tags: [] } }) },
  ],
  'MUTATIONS — create',
)

await report(
  [
    { name: 'update, allowed', run: () => guarded('plant', { data: { name: true }, where: { id: true } }).update({ where: { id: 'p1' }, data: { name: 'New' } }) },
    { name: 'update, data key not in shape', run: () => guarded('plant', { data: { name: true }, where: { id: true } }).update({ where: { id: 'p1' }, data: { priceCents: 1 } }) },
    { name: 'update, where key not in shape', run: () => guarded('plant', { data: { name: true }, where: { id: true } }).update({ where: { name: 'Fern' }, data: { name: 'New' } }) },
    { name: 'updateMany, shape has no where', run: () => guarded('plant', { data: { isPublished: true } }).updateMany({ where: { isDeleted: false }, data: { isPublished: true } }) },
    { name: 'updateMany, shape has where', run: () => guarded('plant', { data: { isPublished: true }, where: { isDeleted: { equals: true } } }).updateMany({ where: { isDeleted: { equals: true } }, data: { isPublished: true } }) },
    { name: 'updateMany, body has no where', run: () => guarded('plant', { data: { isPublished: true }, where: { isDeleted: { equals: true } } }).updateMany({ data: { isPublished: true } }) },
    { name: 'deleteMany, forced where only, empty body where', run: () => guarded('plant', { where: { isDeleted: { equals: force(true) } } }).deleteMany({ where: {} }) },
    { name: 'upsert with data instead of create/update', run: () => guarded('plant', { where: { id: true }, data: { name: true } }).upsert({ where: { id: 'p1' }, data: { name: 'x' } }) },
    { name: 'upsert, correct shape', run: () => guarded('plant', { where: { id: true }, create: { name: true, priceCents: true }, update: { name: true } }).upsert({ where: { id: 'p1' }, create: { name: 'Fern', priceCents: 900 }, update: { name: 'Fern2' } }) },
    { name: 'createMany with a single object', run: () => guarded('plant', { data: { name: true, priceCents: true } }).createMany({ data: { name: 'Fern', priceCents: 900, tags: [] } }) },
    { name: 'createMany with an array', run: () => guarded('plant', { data: { name: true, priceCents: true } }).createMany({ data: [{ name: 'Fern', priceCents: 900 }] }) },
    { name: 'relation write: connect allowed', run: () => guarded('order', { data: { status: true, customer: { connect: { id: true } } } }).create({ data: { status: 'draft', customer: { connect: { id: 'c1' } } } }) },
    { name: 'relation write: nested create not in shape', run: () => guarded('order', { data: { status: true, customer: { connect: { id: true } } } }).create({ data: { status: 'draft', customer: { create: { email: 'a@b.com' } } } }) },
    { name: 'delete on an unscoped model (Customer) with scope ctx present', run: () => guarded('customer', { where: { id: true } }).delete({ where: { id: 'c1' } }) },
  ],
  'MUTATIONS — update / bulk / upsert / relations',
)

await report(
  [
    { name: 'read, named shapes, caller missing (extension API wording)', run: () => guarded('plant', { storefront: { where: { name: { contains: true } }, take: { max: 10 } } }).findMany({}) },
    { name: 'read, caller in the body', run: () => guarded('plant', { storefront: { where: { name: { contains: true } }, take: { max: 10 } } }).findMany({ caller: 'storefront' }) },
    { name: 'resolve() instead of executing', run: () => guarded('plant', { where: { name: { contains: true } }, take: { max: 10 } }).resolve({ where: { name: { contains: 'fern' } } }) },
  ],
  'ENTRY-POINT WORDING',
)

await report(
  [
    { name: 'scope injected into findMany where', run: () => scoped('Plant', 'findMany', { where: { isPublished: true } }) },
    { name: 'scope injected into create data', run: () => scoped('Plant', 'create', { data: { name: 'Fern', priceCents: 900, tags: [] } }) },
    { name: 'scope injected into updateMany where', run: () => scoped('Plant', 'updateMany', { where: { isDeleted: false }, data: { isPublished: true } }) },
    { name: 'scope on an unscoped model (Customer) is a no-op', run: () => scoped('Customer', 'findMany', { where: {} }) },
    { name: 'scope root model is not self-scoped', run: () => scoped('Nursery', 'findMany', { where: {} }) },
    { name: 'nested include of a scoped relation is NOT filtered', run: () => scoped('Nursery', 'findMany', { include: { plants: true } }) },
    {
      name: 'missing scope context on a READ (onMissingScopeContext=error)',
      run: async () => { scopeCtx = {}; try { return await scoped('Plant', 'findMany', { where: {} }) } finally { scopeCtx = { Nursery: 'nursery-1' } } },
    },
    {
      name: 'missing scope context on a WRITE',
      run: async () => { scopeCtx = {}; try { return await scoped('Plant', 'create', { data: { name: 'Fern', tags: [] } }) } finally { scopeCtx = { Nursery: 'nursery-1' } } },
    },
    {
      name: 'scope value of the wrong type',
      run: async () => { scopeCtx = { Nursery: 42 }; try { return await scoped('Plant', 'findMany', { where: {} }) } finally { scopeCtx = { Nursery: 'nursery-1' } } },
    },
  ],
  'SCOPE — automatic tenant isolation',
)
