import type { FastifyInstance } from 'fastify';
import type { Redis } from 'ioredis';
import type { PrismaClient } from '@angel/db';

export interface HealthDeps {
  prisma: PrismaClient;
  redis: Redis;
}

export function registerHealth(app: FastifyInstance, deps: HealthDeps): void {
  app.get('/health', async () => ({ ok: true }));

  app.get('/ready', async (_req, reply) => {
    const checks = { db: false, redis: false };

    try {
      await deps.prisma.$queryRaw`SELECT 1`;
      checks.db = true;
    } catch {
      checks.db = false;
    }

    try {
      const pong = await deps.redis.ping();
      checks.redis = pong === 'PONG';
    } catch {
      checks.redis = false;
    }

    const ok = checks.db && checks.redis;
    reply.code(ok ? 200 : 503);
    return { ok, checks, ts: Date.now() };
  });
}
