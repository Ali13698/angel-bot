import type { FastifyInstance } from 'fastify';
import type { Redis } from 'ioredis';
import type { PrismaClient } from '@angel/db';

export function registerHealth(
  app: FastifyInstance,
  deps: { prisma: PrismaClient; redis: Redis }
) {
  app.get('/health', async () => ({ ok: true, ts: Date.now() }));

  app.get('/ready', async (_req, reply) => {
    const checks: Record<string, boolean> = { db: false, redis: false };

    try {
      await deps.prisma.$queryRaw`SELECT 1`;
      checks.db = true;
    } catch { /* keep false */ }

    try {
      const pong = await deps.redis.ping();
      checks.redis = pong === 'PONG';
    } catch { /* keep false */ }

    const ok = checks.db && checks.redis;
    reply.code(ok ? 200 : 503);
    return { ok, checks, ts: Date.now() };
  });
}
