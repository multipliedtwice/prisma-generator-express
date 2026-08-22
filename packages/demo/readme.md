# demo

Private demo app for prisma-generator-express (Express 5, Prisma 6, PostgreSQL via docker-compose).

The files under `prisma/generated/` are committed on purpose: they let you inspect
real generator output (routers, runtime helpers, guard artifacts) without running
`npx prisma generate` first. Delete the folder and regenerate if you change the schema.
