# HTTP verification lab

This lab runs generated Express routes against PostgreSQL 16. It uses the normal Prisma query engine. It does not use the no-op engine stub from `../guard/`.

Pinned runtime:

- Node 22.14.0
- PostgreSQL 16.6
- Prisma 6.19.3
- `prisma-generator-express` 1.64.4
- `prisma-guard` 1.33.0

Run from this directory:

```sh
docker compose build
docker compose up -d --wait postgres
docker compose run --rm runner
docker compose down -v
```

The runner creates the schema, replaces the fixture rows, exercises the HTTP routes, and compares its normalized output with `RESULTS.txt`. A mismatch exits non-zero.

The database uses a temporary filesystem. `docker compose down -v` removes the Compose resources. The lab writes no database or generated runtime files to the host checkout.
