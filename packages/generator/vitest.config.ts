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
    include: ['test/unit/**/*.test.ts'],
  },
}
