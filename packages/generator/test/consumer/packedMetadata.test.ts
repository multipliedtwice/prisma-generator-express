import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { execFileSync } from 'node:child_process'
import {
  mkdtempSync,
  rmSync,
  existsSync,
  readFileSync,
  readdirSync,
} from 'node:fs'
import { join, resolve, basename } from 'node:path'
import { createRequire } from 'node:module'

/**
 * THE METADATA IS REACHABLE FROM AN INSTALLED PACKAGE.
 *
 * **The failure this exists to catch, which shipped once.** The first version of
 * `GUARD_OPTION_METADATA` lived in `src/copy/routeConfig.ts`. That directory is
 * excluded from the TypeScript build, because those files are copied verbatim
 * into a generated project rather than compiled — so the metadata never reached
 * `dist`, was not exported from the package entry, and the consumer it was
 * written for could not import it at all. Every unit test passed the whole time,
 * because unit tests import from `src/` by relative path.
 *
 * So this test does what no unit test can: it PACKS the package with `npm pack`,
 * extracts the tarball, and imports the result through its declared entry point —
 * the same bytes and the same resolution a consumer gets from `npm install`. A
 * file missing from `files`, an export missing from `index`, or a build that
 * never emitted it all fail here.
 *
 * It is slow — a real pack and a real tsc build — and that is the price of
 * testing the artifact instead of the intent.
 */

const GENERATOR =
  basename(process.cwd()) === 'generator'
    ? process.cwd()
    : resolve('packages/generator')

let workdir: string
let packageRoot: string
let packFailed: string | null = null

beforeAll(() => {
  /**
   * Extracted INSIDE the package tree, not in /tmp.
   *
   * The entry point requires `@prisma/generator-helper`, which is a real runtime
   * dependency — an actual `npm install` would provide it. Extracting under the
   * repo lets Node's upward resolution find it, which reproduces an installed
   * consumer without running a full `npm install` into a temp directory.
   */
  workdir = mkdtempSync(join(GENERATOR, '.consumer-pack-'))

  try {
    // Build first: `npm pack` ships whatever is on disk, so packing a stale or
    // absent dist would test nothing and pass.
    execFileSync('npm', ['run', 'build'], {
      cwd: GENERATOR,
      stdio: 'pipe',
      encoding: 'utf-8',
    })

    /**
     * `--ignore-scripts`, because `prepack` MUTATES THE WORKING TREE.
     *
     * `prepack` is `node copy.js && npm run build`, and `copy.js` copies the
     * repository-root `README.md` and `LICENSE` over this package's own tracked
     * copies. That is correct when publishing and wrong here: running the suite
     * left `packages/generator/README.md` modified, and a consumer of this
     * repository that asserts a clean worktree — as the CMS pinning this
     * submodule does — then failed on a test run that had passed.
     *
     * Nothing is lost by skipping it. The build half already ran explicitly
     * above, and the copy half is asserted instead of performed: the two files
     * `copy.js` would write are checked below to already match their sources, so
     * the tarball carries the same bytes `prepack` would have produced.
     */
    const out = execFileSync(
      'npm',
      ['pack', '--ignore-scripts', '--pack-destination', workdir],
      {
        cwd: GENERATOR,
        stdio: 'pipe',
        encoding: 'utf-8',
      },
    )

    const tarball = out.trim().split('\n').pop()!.trim()
    const tarballPath = join(workdir, basename(tarball))

    execFileSync('tar', ['-xzf', tarballPath, '-C', workdir], { stdio: 'pipe' })
    packageRoot = join(workdir, 'package')
  } catch (error) {
    packFailed = error instanceof Error ? error.message : String(error)
  }
}, 900_000)

afterAll(() => {
  if (workdir) rmSync(workdir, { recursive: true, force: true })
})

describe('the packed tarball', () => {
  it('packed at all — otherwise nothing below is meaningful', () => {
    // Explicit rather than skipped. A pack failure that quietly disabled this
    // file would restore exactly the blind spot it was written to remove.
    expect(packFailed, `npm pack failed: ${packFailed}`).toBeNull()
    expect(existsSync(packageRoot)).toBe(true)
  })

  it('ships the compiled metadata module', () => {
    expect(
      existsSync(join(packageRoot, 'dist', 'guardOptions.js')),
      'dist/guardOptions.js is not in the tarball',
    ).toBe(true)
    expect(
      existsSync(join(packageRoot, 'dist', 'guardOptions.d.ts')),
      'the type declarations are not in the tarball',
    ).toBe(true)
  })

  it('does NOT ship src/copy as a compiled module, which is why this file exists', () => {
    // src/** is shipped as source (the generator copies it into projects), but it
    // is not compiled. Asserting the absence keeps the reason visible.
    expect(
      existsSync(join(packageRoot, 'dist', 'copy', 'routeConfig.js')),
    ).toBe(false)
  })
})

describe('importing it the way the CMS would', () => {
  it('resolves through the package entry point, not a deep path', () => {
    expect(packFailed).toBeNull()

    const manifest = JSON.parse(
      readFileSync(join(packageRoot, 'package.json'), 'utf-8'),
    )
    const entry = join(packageRoot, manifest.main)

    expect(
      existsSync(entry),
      `package.json main (${manifest.main}) is not in the tarball`,
    ).toBe(true)

    const requireFromConsumer = createRequire(join(packageRoot, 'package.json'))
    const pkg = requireFromConsumer(entry)

    expect(
      pkg.GUARD_OPTION_METADATA,
      'metadata is not exported from the entry point',
    ).toBeTruthy()
    expect(Array.isArray(pkg.GUARD_OPTION_METADATA)).toBe(true)
    expect(pkg.GUARD_OPTION_METADATA).toHaveLength(7)
  })

  it('exposes the defaults, the profile and the resolver a UI needs', () => {
    expect(packFailed).toBeNull()

    const requireFromConsumer = createRequire(join(packageRoot, 'package.json'))
    const pkg = requireFromConsumer(join(packageRoot, 'dist', 'index.js'))

    expect(pkg.UPSTREAM_GUARD_DEFAULTS).toEqual({
      requireGuardShape: false,
      validateGuardShapes: false,
      requireDefaultVariantOptIn: false,
      enableUpdateEach: true,
      guardResolutionOrder: 'after-hooks',
      allowE2EGuardBypass: true,
      validateResolvedShapes: false,
    })

    expect(typeof pkg.resolveGuardPolicy).toBe('function')
    expect(pkg.resolveGuardPolicy({})).toEqual(pkg.UPSTREAM_GUARD_DEFAULTS)
    expect(pkg.HARDENED_GUARD_PROFILE.requireGuardShape).toBe(true)
  })

  it('carries enough per-option detail to render a settings screen', () => {
    expect(packFailed).toBeNull()

    const requireFromConsumer = createRequire(join(packageRoot, 'package.json'))
    const pkg = requireFromConsumer(join(packageRoot, 'dist', 'index.js'))

    for (const option of pkg.GUARD_OPTION_METADATA) {
      expect(option.name, 'an option has no name').toBeTruthy()
      expect(option.label, `${option.name} has no label`).toBeTruthy()
      expect(
        option.description,
        `${option.name} has no description`,
      ).toBeTruthy()
      expect(option.warning, `${option.name} has no warning`).toBeTruthy()
      expect(option.target, `${option.name} does not name its target`).toBe(
        'hono',
      )
      expect(['boolean', 'enum']).toContain(option.type)
      expect(
        option,
        `${option.name} does not advertise a default`,
      ).toHaveProperty('default')
      expect(
        option,
        `${option.name} does not advertise a hardened value`,
      ).toHaveProperty('hardened')
    }
  })

  it('declares its own incompleteness, so a UI cannot assume coverage', () => {
    expect(packFailed).toBeNull()

    const requireFromConsumer = createRequire(join(packageRoot, 'package.json'))
    const pkg = requireFromConsumer(join(packageRoot, 'dist', 'index.js'))

    expect(pkg.GUARD_METADATA_SCOPE.complete).toBe(false)
    expect(pkg.GUARD_METADATA_SCOPE.notDescribedYet).toContain('dropGuard')
  })

  it('ships type declarations for the exported metadata', () => {
    expect(packFailed).toBeNull()

    const types = readFileSync(join(packageRoot, 'dist', 'index.d.ts'), 'utf-8')
    expect(types, 'the entry does not re-export the metadata types').toMatch(
      /GUARD_OPTION_METADATA|guardOptions/,
    )
  })
})

/**
 * WHAT `prepack` WOULD HAVE WRITTEN, ASSERTED RATHER THAN WRITTEN.
 *
 * `copy.js` keeps this package's `README.md` and `LICENSE` identical to the
 * repository root's, so a consumer installing from npm reads the same document
 * as somebody reading the repository. That is worth keeping true, and it does
 * not need a test run to mutate tracked files to stay true — the pack above
 * skips the script, and these check the property it exists to maintain.
 *
 * A failure here means the root copies moved and this package's did not. Run
 * `node copy.js` to bring them back into line, and commit the result.
 */
describe('the documents copy.js keeps in step', () => {
  const REPO_ROOT = resolve(GENERATOR, '..', '..')
  const read = (...segments: string[]) =>
    readFileSync(join(...segments), 'utf-8')

  for (const filename of ['README.md', 'LICENSE']) {
    it(`has ${filename} identical to the repository root's`, () => {
      expect(
        read(GENERATOR, filename),
        `${filename} has drifted from the root copy — run \`node copy.js\``,
      ).toBe(read(REPO_ROOT, filename))
    })
  }

  it('packs the root documents into the tarball', () => {
    expect(packFailed).toBeNull()

    for (const filename of ['README.md', 'LICENSE']) {
      expect(
        read(packageRoot, filename),
        `the tarball's ${filename} is not the one a publish would ship`,
      ).toBe(read(REPO_ROOT, filename))
    }
  })
})
