import { force } from 'prisma-guard'
import { guard } from './generated/guard/client'
import { SCOPE_MAP } from './generated/guard/index'

// Reproduces every message and every emitted-args snippet quoted in
// docs/articles/A3-force-and-boundaries.md, on that article's own schema
// (Organizer @scope-root -> Event -> Ticket).
//
// Read cases run through BOTH entry points and are labelled AGREE / DIFFER.
// Mutation cases are labelled DELEGATE-ONLY: guard.query() accepts read methods
// only, so there is no second entry point to compare against.

const ext = guard.extension(() => ({ Organizer: 'org_1' }) as any)
const OPS = ['findMany', 'findFirst', 'findUnique', 'create', 'createMany', 'update', 'updateMany', 'upsert', 'delete', 'deleteMany', 'count', 'aggregate', 'groupBy']
const fake = Object.fromEntries(OPS.map((op) => [op, async (args: unknown) => args]))
const delegates: Record<string, unknown> = { organizer: fake, event: fake, ticket: fake }

const show = async (fn: () => unknown) => {
  try {
    return JSON.stringify(await fn())
  } catch (e: any) {
    return `THROW ${e?.constructor?.name} status=${e?.status}: ${e?.message?.slice(0, 400)}`
  }
}

const guarded = (model: string, shape: any) =>
  (ext.model as any)[model].guard.call({ $parent: delegates }, shape)

// A read case: run it through guard.query().parse() AND the guarded delegate.
async function read(label: string, model: string, shape: any, body: any, method = 'findMany') {
  const viaParse = await show(() => guard.query(model as any, method as any, shape).parse(body))
  const viaDelegate = await show(() => (guarded(model.toLowerCase(), shape) as any)[method](body))
  console.log(`${viaParse === viaDelegate ? 'AGREE ' : 'DIFFER'}  ${label}`)
  console.log(`        parse    -> ${viaParse}`)
  console.log(`        delegate -> ${viaDelegate}`)
}

// A mutation case: the guarded delegate is the only entry point.
async function write(label: string, model: string, shape: any, method: string, body: any) {
  const out = await show(() => (guarded(model, shape) as any)[method](body))
  console.log(`DELEGATE-ONLY  ${label}\n        delegate -> ${out}`)
}

const publicEvents = {
  where: { isPublished: { equals: force(true) }, title: { contains: true } },
  take: { max: 50, default: 20 },
}

// Every create shape below is COMPLETE for the schema: title, venue and startsAt are
// required with no default, and organizerId is injected by the scope extension.
const completeCreate = { title: true, venue: true, startsAt: true }
const completeBody = { title: 'Gala', venue: 'Hall', startsAt: '2026-09-01T00:00:00.000Z' }

console.log('\n=== A3 §3 — lenient position: wholly forced top-level predicate ===')
await read('client sends nothing', 'Event', publicEvents, {})
await read('client sends the same value', 'Event', publicEvents, { where: { isPublished: { equals: true } } })
await read('client sends a different value', 'Event', publicEvents, { where: { isPublished: { equals: false } } })
await read('client sends a different operator', 'Event', publicEvents, { where: { isPublished: { not: false } } })
await read('forced string, client sends its own', 'Event', { where: { title: { contains: 'gala' } }, take: { max: 50 } }, { where: { title: { contains: 'anything' } } })

console.log('\n=== A3 §2 — forced value without an operator ===')
await read('where: { isPublished: force(true) }', 'Event', { where: { isPublished: force(true) }, take: { max: 5 } }, {})

console.log('\n=== A3 §3 — strict positions ===')
await read('forced modifier, client sends mode', 'Event', { where: { title: { contains: true, mode: 'insensitive' } }, take: { max: 5 } }, { where: { title: { contains: 'gala', mode: 'insensitive' } } })
await read('forced modifier, client omits mode', 'Event', { where: { title: { contains: true, mode: 'insensitive' } }, take: { max: 5 } }, { where: { title: { contains: 'gala' } } })
await read('to-one relation filter', 'Event', { where: { organizer: { is: { id: { equals: force('org_1') } } } }, take: { max: 5 } }, { where: { organizer: { is: { id: { equals: 'org_1' } } } } })
await read('to-many relation filter', 'Event', { where: { tickets: { some: { tier: { equals: force('vip') } } } }, take: { max: 5 } }, { where: { tickets: { some: { tier: { equals: 'ga' } } } } })
await write('data shape, forced field sent by the client', 'event', { data: { ...completeCreate, isPublished: force(false) } }, 'create', { data: { ...completeBody, isPublished: true } })

console.log('\n=== A3 §3b — nested include is a strict position ===')
const nested = {
  include: { events: { where: { isCancelled: { equals: force(false) }, title: { contains: true } }, take: { max: 20, default: 10 } } },
  take: { max: 10 },
}
await read('client filters inside the relation', 'Organizer', nested, { include: { events: { where: { title: { contains: 'gala' } } } } })
await read('client sends the forced nested field', 'Organizer', nested, { include: { events: { where: { isCancelled: { equals: true } } } } })
await read('client widens the nested take', 'Organizer', nested, { include: { events: { take: 500 } } })

console.log('\n=== A3 §4 — the documented-vs-runtime conflict claim ===')
await read('boolean equals: forced true, client false', 'Event', { where: { isPublished: { equals: force(true) } }, take: { max: 5 } }, { where: { isPublished: { equals: false } } })
await read('string contains: forced "gala", client "anything"', 'Event', { where: { title: { contains: 'gala' } }, take: { max: 5 } }, { where: { title: { contains: 'anything' } } })
await read('int gte: forced 100, client 5', 'Ticket', { where: { priceCents: { gte: 100 } }, take: { max: 5 } }, { where: { priceCents: { gte: 5 } } })
await read('FK equals: forced org_1, client org_2', 'Event', { where: { organizerId: { equals: force('org_1') } }, take: { max: 5 } }, { where: { organizerId: { equals: 'org_2' } } })
await read('CONTROL — conflict inside the shape config', 'Event', { where: { isPublished: { equals: force(true) }, AND: { isPublished: { equals: force(false) } } }, take: { max: 5 } }, {})

console.log('\n=== A3 §5 — where the forced condition lands ===')
await read('client filters a different field (AND-wrap)', 'Event', publicEvents, { where: { title: { contains: 'gala' } } })
await read('client touches the same field (inline merge)', 'Event', publicEvents, { where: { isPublished: { equals: false } } })

// The force is INSIDE the OR, which is what "lifted out of a combinator" means.
const forcedInsideOr = {
  where: { OR: { title: { contains: true }, venue: { contains: true }, isPublished: { equals: force(true) } } },
  take: { max: 5 },
}
await read('force INSIDE OR, client sends two OR branches', 'Event', forcedInsideOr, { where: { OR: [{ title: { contains: 'gala' } }, { venue: { contains: 'hall' } }] } })
await read('force INSIDE OR, client sends nothing', 'Event', forcedInsideOr, {})
await read('force INSIDE AND', 'Event', { where: { AND: { title: { contains: true }, isPublished: { equals: force(true) } } }, take: { max: 5 } }, { where: { AND: [{ title: { contains: 'gala' } }] } })
// Contrast: the force as a SIBLING of OR is a different shape that emits similar args.
await read('CONTRAST — force as a sibling of OR, not inside it', 'Event', { where: { OR: { title: { contains: true }, venue: { contains: true } }, isPublished: { equals: force(true) } }, take: { max: 5 } }, { where: { OR: [{ title: { contains: 'gala' } }, { venue: { contains: 'gala' } }] } })

// Which models the generator actually scoped. A3 §7 names mapped and unmapped
// models by name; this records the generated map itself rather than leaving that
// claim to be read off the article. Both schemas' models are listed, so an
// unscoped model shows up as an explicit "(no scope mapping)" line.
console.log('\n=== A3 §7 — generated SCOPE_MAP (all models in both schemas) ===')
const ALL_MODELS = ['Nursery', 'Plant', 'Customer', 'Order', 'OrderItem', 'Organizer', 'Event', 'Ticket']
const scopeMappings = new Map(Object.entries(SCOPE_MAP))
for (const m of ALL_MODELS) {
  const entry = scopeMappings.get(m)
  console.log(`MAP     ${m.padEnd(10)} -> ${entry ? JSON.stringify(entry) : '(no scope mapping — unscoped, queries on it are not filtered)'}`)
}

console.log('\n=== A3 §5b — forced NOT: merged or a separate branch? ===')
// The shape's NOT declares one forced key and one client-controlled key, so the
// client is allowed to send a NOT of its own. That is what makes the question askable.
const notShape = { where: { NOT: { isCancelled: { equals: force(true) }, title: { contains: true } }, venue: { contains: true } }, take: { max: 5 } }
await read('forced NOT, client sends nothing', 'Event', notShape, {})
await read('forced NOT, client sends its own NOT (object form)', 'Event', notShape, { where: { NOT: { title: { contains: 'draft' } } } })
await read('forced NOT, client sends its own NOT (array form)', 'Event', notShape, { where: { NOT: [{ title: { contains: 'draft' } }] } })
await read('forced NOT, client filters outside NOT', 'Event', notShape, { where: { venue: { contains: 'hall' } } })
// Control: the same client NOT against a shape whose NOT declares no client key.
await read('CONTROL — client NOT against a wholly forced NOT', 'Event', { where: { NOT: { isCancelled: { equals: force(true) } }, venue: { contains: true } }, take: { max: 5 } }, { where: { NOT: { venue: { contains: 'draft' } } } })

console.log('\n=== A3 §7b — are forced relation filters lifted? ===')
const relShape = { where: { tickets: { some: { tier: { equals: force('vip') }, priceCents: { gte: true } } } }, take: { max: 5 } }
await read('forced value inside some(), client sends nothing', 'Event', relShape, {})
await read('forced value inside some(), client filters inside the same relation', 'Event', relShape, { where: { tickets: { some: { priceCents: { gte: 100 } } } } })
await read('forced value inside some(), client filters a top-level field', 'Event', { where: { ...relShape.where, title: { contains: true } }, take: { max: 5 } }, { where: { title: { contains: 'gala' } } })
await read('forced value inside none(), mixed with a client condition', 'Event', { where: { tickets: { none: { tier: { equals: force('comp') }, priceCents: { gte: true } } } }, take: { max: 5 } }, { where: { tickets: { none: { priceCents: { gte: 1 } } } } })
await read('wholly forced none(), client-controlled field elsewhere', 'Event', { where: { tickets: { none: { tier: { equals: force('comp') } } }, title: { contains: true } }, take: { max: 5 } }, { where: { title: { contains: 'gala' } } })
// The message names mixing as the cause. This shape mixes nothing: one forced condition, no client-controlled key anywhere in it.
await read('CONTROL — forced none(), nothing client-controlled at all', 'Event', { where: { tickets: { none: { tier: { equals: force('comp') } } } }, take: { max: 5 } }, {})
await read('CONTROL — the same forced condition under some()', 'Event', { where: { tickets: { some: { tier: { equals: force('vip') } } }, title: { contains: true } }, take: { max: 5 } }, {})
await read('CONTROL — the same forced condition under every()', 'Event', { where: { tickets: { every: { tier: { equals: force('vip') } } }, title: { contains: true } }, take: { max: 5 } }, {})
// The to-one control the §7b round was missing. Same relation, same forced condition,
// opposite operator: is() builds, isNot() is refused. A wholly client-controlled isNot()
// builds, which is what isolates the trigger as "forced under negation".
await read('to-one is(), wholly forced', 'Event', { where: { organizer: { is: { name: { equals: force('Acme') } } } }, take: { max: 5 } }, {})
await read('to-one isNot(), wholly forced', 'Event', { where: { organizer: { isNot: { name: { equals: force('Acme') } } } }, take: { max: 5 } }, {})
await read('CONTROL — to-one isNot(), wholly client-controlled', 'Event', { where: { organizer: { isNot: { name: { equals: true } } } }, take: { max: 5 } }, { where: { organizer: { isNot: { name: { equals: 'Acme' } } } } })
await read('isNot on a to-many relation', 'Event', { where: { tickets: { isNot: { tier: { equals: force('comp') } } } }, take: { max: 5 } }, {})

console.log('\n=== A3 §6 — validation layers ===')
await write('inline refine violated', 'event', { data: { title: true, venue: (b: any) => b.max(120), startsAt: true, isPublished: force(false), isCancelled: force(false) } }, 'create', { data: { ...completeBody, venue: 'x'.repeat(200) } })
await write('create shape incomplete (venue missing from the shape)', 'event', { data: { title: true, startsAt: true } }, 'create', { data: { title: 'Gala', startsAt: '2026-09-01T00:00:00.000Z' } })

console.log('\n=== A3 §6b — upsert and update ===')
const upsertShape = {
  where: { id: true },
  create: { ...completeCreate, isPublished: force(false), isCancelled: force(false) },
  update: { title: true },
}
await write('upsert, client omits the forced fields', 'event', upsertShape, 'upsert', { where: { id: 'e1' }, create: completeBody, update: { title: 'Gala 2' } })
await write('upsert, client sends a forced field in create', 'event', upsertShape, 'upsert', { where: { id: 'e1' }, create: { ...completeBody, isPublished: true }, update: { title: 'Gala 2' } })
await write('update, forced data field applied when the client omits it', 'event', { data: { title: true, isCancelled: force(true) }, where: { id: true } }, 'update', { where: { id: 'e1' }, data: { title: 'x' } })

console.log('\n=== A3 §7 — where forced values do not reach ===')

// Scope injection, run through the extension's $allOperations, for a scoped model
// and for the scope root itself.
const scoped = (model: string, operation: string, args: unknown) =>
  (ext.query as any).$allOperations({ model, operation, args, query: async (a: unknown) => a })

const scopeCase = async (label: string, model: string, operation: string, args: unknown) => {
  const out = await show(() => scoped(model, operation, args))
  console.log(`SCOPE  ${label}\n        -> ${out}`)
}
await scopeCase('scoped model: findMany gets the tenant filter', 'Event', 'findMany', {})
await scopeCase('scope root: findMany on Organizer', 'Organizer', 'findMany', {})
await scopeCase('scope root: findMany on Organizer with a client where', 'Organizer', 'findMany', { where: { name: { contains: 'a' } } })

// Nested reads: the to-many mitigation, and the to-one position where it does not exist.
await read('to-many include with a forced where', 'Organizer', { include: { events: { where: { isPublished: { equals: force(true) } }, take: { max: 10 } } }, take: { max: 10 } }, {})
await read('to-many include, client tries its own where', 'Organizer', { include: { events: { where: { isPublished: { equals: force(true) } }, take: { max: 10 } } }, take: { max: 10 } }, { include: { events: { where: { isPublished: { equals: false } } } } })
await read('to-one relation in select', 'Ticket', { select: { id: true, event: { select: { title: true } } }, take: { max: 10 } }, {})
await read('to-one relation with a where in the shape', 'Ticket', { select: { id: true, event: { where: { isPublished: { equals: force(true) } }, select: { title: true } } }, take: { max: 10 } }, {})

console.log('\n=== A3 §7 — relation write config ===')
await write('connect: true', 'event', { data: { ...completeCreate, tickets: { connect: true } } }, 'create', { data: completeBody })
await write('connect: { id: true }', 'event', { data: { ...completeCreate, tickets: { connect: { id: true } } } }, 'create', { data: { ...completeBody, tickets: { connect: { id: 't1' } } } })

console.log('\n=== A3 §8 — parse() vs delegate, and reads-only ===')
await read('projection: parse() vs delegate (expected to DIFFER)', 'Event', { select: { id: true, title: true }, take: { max: 10 } }, {})
await read('mutation shape passed to guard.query()', 'Event', { data: { title: true }, where: { id: true } }, { where: { id: 'e1' }, data: { title: 'x' } }, 'update')
