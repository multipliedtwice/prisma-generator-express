import { force } from 'prisma-guard'
import { guard } from './generated/guard/client'

// Every case runs through BOTH entry points:
//   parse    = guard.query(model, method, shape).parse(body)
//   delegate = prisma.<model>.guard(shape).findMany(body), emulated with a fake delegate
// If the two ever disagree, that disagreement is the finding.

const ext = guard.extension(() => ({ Nursery: 'nursery-1' }) as any)
const OPS = ['findMany', 'findFirst', 'findUnique', 'create', 'createMany', 'update', 'updateMany', 'upsert', 'delete', 'deleteMany', 'count', 'aggregate', 'groupBy']
const fake = Object.fromEntries(OPS.map((op) => [op, async (args: unknown) => args]))
const delegates: Record<string, unknown> = { nursery: fake, plant: fake, customer: fake, order: fake, orderItem: fake }

const show = async (fn: () => unknown) => {
  try {
    return JSON.stringify(await fn())
  } catch (e: any) {
    return `THROW ${e?.constructor?.name} status=${e?.status}: ${e?.message?.slice(0, 200)}`
  }
}

const parse = (shape: any, body: any) => show(() => guard.query('Plant', 'findMany', shape).parse(body))
const guarded = (shape: any, body: any) =>
  show(() => (ext.model as any).plant.guard.call({ $parent: delegates }, shape).findMany(body))

const T = { max: 5 }

const cases: Array<[string, any, any]> = [
  ['wholly forced boolean predicate, client sends the same value', { where: { isPublished: { equals: force(true) } }, take: T }, { where: { isPublished: { equals: true } } }],
  ['wholly forced boolean predicate, client sends a different value', { where: { isPublished: { equals: force(true) } }, take: T }, { where: { isPublished: { equals: false } } }],
  ['wholly forced boolean predicate, client sends a different operator', { where: { isPublished: { equals: force(true) } }, take: T }, { where: { isPublished: { not: false } } }],
  ['wholly forced string predicate, client sends its own value', { where: { name: { contains: 'fern' } }, take: T }, { where: { name: { contains: 'rose' } } }],
  ['wholly forced numeric predicate, client sends its own value', { where: { priceCents: { gte: 100 } }, take: T }, { where: { priceCents: { gte: 5 } } }],
  ['forced predicate, client filters a DIFFERENT field (AND-wrap)', { where: { isPublished: { equals: force(true) }, name: { contains: true } }, take: T }, { where: { name: { contains: 'fern' } } }],
  ['forced modifier beside a client operator, client sends the modifier', { where: { name: { contains: true, mode: 'insensitive' } }, take: T }, { where: { name: { contains: 'fern', mode: 'insensitive' } } }],
  ['forced modifier beside a client operator, client omits the modifier', { where: { name: { contains: true, mode: 'insensitive' } }, take: T }, { where: { name: { contains: 'fern' } } }],
  ['client-controlled modifier, client omits it', { where: { name: { contains: true, mode: true } }, take: T }, { where: { name: { contains: 'fern' } } }],
  ['forced scalar inside a to-one relation filter, client sends the same value', { where: { nursery: { is: { id: { equals: force('n1') } } } }, take: T }, { where: { nursery: { is: { id: { equals: 'n1' } } } } }],
  ['forced scalar inside a to-many relation filter, client sends another value', { where: { orderItems: { some: { plantId: { equals: force('p1') } } } }, take: T }, { where: { orderItems: { some: { plantId: { equals: 'p2' } } } } }],
  ['force INSIDE OR, lifted to top-level AND', { where: { OR: { name: { contains: true }, description: { contains: true }, isPublished: { equals: force(true) } } }, take: T }, { where: { OR: [{ name: { contains: 'fern' } }, { description: { contains: 'fern' } }] } }],
  ['force INSIDE OR, client sends nothing (no OR survives)', { where: { OR: { name: { contains: true }, isPublished: { equals: force(true) } } }, take: T }, {}],
  ['CONTRAST — force as a SIBLING of OR, not inside it', { where: { OR: { name: { contains: true }, description: { contains: true } }, isPublished: { equals: force(true) } }, take: T }, { where: { OR: [{ name: { contains: 'fern' } }, { description: { contains: 'fern' } }] } }],
  ['forced value without an operator (shorthand)', { where: { isPublished: force(true) }, take: T }, { where: { isPublished: false } }],
]

console.log('\n=== FORCED VALUE POSITIONS — BOTH ENTRY POINTS ===')
for (const [name, shape, body] of cases) {
  const viaParse = await parse(shape, body)
  const viaDelegate = await guarded(shape, body)
  console.log(`${viaParse === viaDelegate ? 'AGREE ' : 'DIFFER'}  ${name}`)
  console.log(`        parse    -> ${viaParse}`)
  console.log(`        delegate -> ${viaDelegate}`)
}

// The prisma-guard 1.33.0 README, under "Forced where merge strategy", states:
//   "Inline merge — if a forced field's value is a plain operator object and the client
//    also provided an operator object for the same field, the forced operator keys are
//    merged into the client's operator object. ... Conflicts on the same op key
//    (different values) throw ShapeError."
// These cases probe that sentence for a CLIENT-supplied conflicting value.
console.log('\n=== DOCUMENTED CLAIM: "conflicts on the same op key (different values) throw ShapeError" ===')
const conflicts: Array<[string, any, any]> = [
  ['boolean equals: forced true, client false', { where: { isPublished: { equals: force(true) } }, take: T }, { where: { isPublished: { equals: false } } }],
  ['string contains: forced "fern", client "rose"', { where: { name: { contains: 'fern' } }, take: T }, { where: { name: { contains: 'rose' } } }],
  ['numeric gte: forced 100, client 5', { where: { priceCents: { gte: 100 } }, take: T }, { where: { priceCents: { gte: 5 } } }],
  ['scope-style FK: forced "n1", client "n2"', { where: { nurseryId: { equals: force('n1') } }, take: T }, { where: { nurseryId: { equals: 'n2' } } }],
]
for (const [name, shape, body] of conflicts) {
  console.log(`${name}\n        parse    -> ${await parse(shape, body)}\n        delegate -> ${await guarded(shape, body)}`)
}

// Control: the same-op-key conflict WITHIN the shape config (top level vs combinator).
// The README describes this case too, and here the ShapeError does occur.
console.log('\n=== CONTROL: same-op-key conflict inside the SHAPE, not from the client ===')
console.log(
  '        parse    -> ' +
    (await parse({ where: { isPublished: { equals: force(true) }, AND: { isPublished: { equals: force(false) } } }, take: T }, {})),
)
