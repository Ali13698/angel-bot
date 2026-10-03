import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import pino from 'pino';
import { Redis } from 'ioredis';
import { createPrisma, type PrismaClient } from '@angel/db';
import type { Env } from './env.js';
import { registerHealth } from './routes/health.js';

export interface AppDeps {
  prisma: PrismaClient;
  redis: Redis;
}

export async function buildServer(env: Env) {
  const log = pino({ level: env.LOG_LEVEL });

  const app = Fastify({
    logger: log,
    bodyLimit: 64 * 1024,
  });

  const prisma = createPrisma(env.DATABASE_URL);
  const redis = new Redis(env.REDIS_URL, { lazyConnect: true });
  await redis.connect();

  const deps: AppDeps = { prisma, redis };

  await app.register(websocket);
  registerHealth(app, deps);

  app.addHook('onClose', async () => {
    await prisma.$disconnect();
    redis.disconnect();
  });

  return { app, deps };
}
