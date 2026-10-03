import Fastify, { type FastifyInstance } from 'fastify';
import websocket from '@fastify/websocket';
import { Redis } from 'ioredis';
import { createPrisma, type PrismaClient } from '@angel/db';
import { ErrorCodes, fail } from '@angel/contracts';
import type { Env } from './env.js';
import { registerHealth } from './routes/health.js';

export interface ServerDeps {
  prisma: PrismaClient;
  redis: Redis;
}

export interface BuiltServer {
  app: FastifyInstance;
  deps: ServerDeps;
}

export async function buildServer(env: Env): Promise<BuiltServer> {
  const app = Fastify({ logger: { level: env.LOG_LEVEL } });

  const prisma = createPrisma(env.DATABASE_URL);
  const redis = new Redis(env.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 2,
    retryStrategy: (times: number) => (times > 3 ? null : Math.min(times * 200, 1000)),
  });

  try {
    await prisma.$connect();
  } catch (err) {
    app.log.warn({ err }, 'prisma initial connect failed; /ready will answer 503');
  }

  try {
    await redis.connect();
  } catch (err) {
    app.log.warn({ err }, 'redis initial connect failed; /ready will answer 503');
  }

  await app.register(websocket);

  app.setErrorHandler((error, _req, reply) => {
    app.log.error({ err: error }, 'unhandled error');
    const spec = ErrorCodes.SYS_001;
    void reply.code(spec.http).send(fail('SYS_001', 'internal error', spec.retry));
  });

  registerHealth(app, { prisma, redis });

  app.addHook('onClose', async () => {
    await prisma.$disconnect().catch(() => undefined);
    if (redis.status !== 'end') redis.disconnect();
  });

  return { app, deps: { prisma, redis } };
}
