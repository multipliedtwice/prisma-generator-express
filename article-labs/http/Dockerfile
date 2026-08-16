FROM node:22.14.0-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma
RUN npm run generate

COPY tsconfig.json verify.mts RESULTS.txt README.md ./

CMD ["sh", "-c", "npm run typecheck && npm run db:push && npm run results"]
