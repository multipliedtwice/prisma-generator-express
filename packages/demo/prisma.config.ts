import 'dotenv/config'
import { defineConfig } from 'prisma/config'

export default defineConfig({
    schema: 'prisma/schema.prisma',
    datasource: {
        // Keep generate working even when DATABASE_URL is not set.
        url: process.env.DATABASE_URL ?? '',
    },
})