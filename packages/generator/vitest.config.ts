import { fileURLToPath } from 'node:url'

export default {
  resolve: {
    alias: {
      'prisma-sql': fileURLToPath(
        new URL('./test/stubs/prisma-sql.ts', import.meta.url),
      ),
    },
  },
  test: {
    environment: 'node',
    // test/consumer/** packs the tarball and imports it as an installed
    // package would. It is slow and it is the only thing that can catch a public
    // export that never reaches dist — see test/consumer/packedMetadata.test.ts.
    include: ['test/unit/**/*.test.ts', 'test/consumer/**/*.test.ts'],
    testTimeout: 900_000,
    hookTimeout: 900_000,
  },
}
