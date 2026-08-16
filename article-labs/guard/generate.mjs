#!/usr/bin/env node
// Runs `prisma generate` without downloading Prisma's engine binaries.
//
// The guard generator needs only the DMMF, which Prisma parses with WASM, but the
// CLI still resolves a schema engine and a query engine library before it will run
// any generator. Pointing both at a no-op executable skips the download.
//
// `/bin/true` is not portable — it does not exist on macOS. This writes its own
// stub and passes an absolute path, so the same command works everywhere.

import { spawnSync } from 'node:child_process'
import { chmodSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const isWindows = process.platform === 'win32'
const stub = resolve(here, isWindows ? '.engine-stub.cmd' : '.engine-stub')

writeFileSync(stub, isWindows ? '@echo off\r\nexit /b 0\r\n' : '#!/bin/sh\nexit 0\n')
if (!isWindows) chmodSync(stub, 0o755)

const result = spawnSync('npx', ['prisma', 'generate'], {
  cwd: here,
  env: {
    ...process.env,
    PRISMA_SCHEMA_ENGINE_BINARY: stub,
    PRISMA_QUERY_ENGINE_LIBRARY: stub,
    PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING: '1',
  },
  shell: isWindows,
  stdio: 'inherit',
})

process.exit(result.status ?? 1)
