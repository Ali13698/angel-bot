# Angel

Messaging platform with embedded games (Plato-like).

## Stack

- TypeScript + Node.js 20
- Fastify (HTTP + WebSocket)
- PostgreSQL 16
- Redis 7
- Prisma (ORM + migrations)
- Vitest (tests)

## Local Development

```bash
cp .env.example .env
docker compose up -d
npm install
npm run db:generate
npm run db:migrate
npm run dev
