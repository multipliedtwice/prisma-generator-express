#!/usr/bin/env node
// Regenerates RESULTS.txt: runs every verify script in order, writes the header,
// and strips npm's own command banners so the file is byte-comparable across runs.
//
// Use `npm run results`. Do not pipe `npm run verify` into RESULTS.txt by hand —
// that loses the header and keeps the banners.

import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(readFileSync(resolve(here, 'package.json'), 'utf8'))
const deps = { ...pkg.dependencies, ...pkg.devDependencies }

const SCRIPTS = [
  ['verify:reads', 'verify-reads.ts'],
  ['verify:writes', 'verify-writes-and-scope.mts'],
  ['verify:extras', 'verify-extras.mts'],
  ['verify:forced', 'verify-forced-positions.mts'],
  ['verify:a3', 'verify-a3-ticketing.mts'],
  ['verify:wrong-api', 'verify-wrong-api.ts'],
]

const header = [
  '# Verified behavior of prisma-guard, recorded by article-labs/guard/write-results.mjs.',
  `# Versions (exact, see package.json + package-lock.json): prisma-guard ${deps['prisma-guard']}, zod ${deps.zod}, prisma ${deps.prisma}, @prisma/client ${deps['@prisma/client']}`,
  '# Schemas: Nursery(@scope-root) -> Plant, Order; Customer; OrderItem  |  Organizer(@scope-root) -> Event -> Ticket',
  '# Reproduce from a clean checkout: npm ci && npm run generate && npm run results',
  '#',
  '# Read cases in verify-forced-positions and verify-a3-ticketing run through BOTH entry points',
  '# (guard.query().parse and the guarded delegate) and are labelled AGREE / DIFFER.',
  '# Mutation cases are labelled DELEGATE-ONLY: guard.query() accepts read methods only.',
  '# Scope-injection cases are labelled SCOPE: they run through the extension\'s $allOperations,',
  '# which is the only entry point where the tenant filter is visible.',
  '# Four DIFFER lines are expected and are themselves findings — see article-labs/guard/README.md.',
  '',
]

const chunks = [header.join('\n')]

for (const [script, file] of SCRIPTS) {
  const run = spawnSync('npx', ['tsx', file], { cwd: here, encoding: 'utf8' })
  if (run.status !== 0) {
    process.stderr.write(`${script} failed:\n${run.stderr}`)
    process.exit(run.status ?? 1)
  }
  chunks.push(`########## ${script} (${file}) ##########`)
  chunks.push(run.stdout.replace(/^\n+/, '').replace(/\n+$/, ''))
  chunks.push('')
}

const out = chunks.join('\n') + '\n'
writeFileSync(resolve(here, 'RESULTS.txt'), out)

const differ = (out.match(/^DIFFER/gm) ?? []).length
const agree = (out.match(/^AGREE/gm) ?? []).length
const delegateOnly = (out.match(/^DELEGATE-ONLY/gm) ?? []).length
const scope = (out.match(/^SCOPE/gm) ?? []).length
console.log(`RESULTS.txt written: ${agree} AGREE, ${differ} DIFFER, ${delegateOnly} DELEGATE-ONLY, ${scope} SCOPE`)
