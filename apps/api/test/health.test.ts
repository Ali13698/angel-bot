import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ dbDown: false, redisDown: false }));

vi.mock('@angel/db', () => ({
  createPrisma: () => ({
    $connect: async () => undefined,
    $disconnect: async () => undefined,
    $queryRaw: async () => {
      if (state.dbDown) throw new Error('db down');
      return [{ ok: 1 }];
    },
  }),
}));

vi.mock('ioredis', () => {
  class RedisMock {
    status = 'ready';
    async connect(): Promise<void> {
      if (state.redisDown) throw new Error('redis down');
    }
    async ping(): Promise<string> {
      if (state.redisDown) throw new Error('redis down');
      return 'PONG';
    }
    disconnect(): void {
      this.status = 'end';
    }
  }
  return { Redis: RedisMock };
});

import { buildServer } from '../src/server.js';
import type { Env } from '../src/env.js';

const testEnv: Env = {
  NODE_ENV: 'test',
  PORT: 0,
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/angel_test',
  REDIS_URL: 'redis://localhost:6379/0',
  SESSION_PEPPER_CURRENT: 'test-pepper-change-me-0123456789',
  ACCESS_TTL_SECONDS: 900,
  REFRESH_TTL_SECONDS: 2592000,
  LOG_LEVEL: 'error',
};

describe('health endpoints', () => {
  beforeEach(() => {
    state.dbDown = false;
    state.redisDown = false;
  });

  it('GET /health returns liveness only', async () => {
    const { app } = await buildServer(testEnv);
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
    await app.close();
  });

  it('GET /ready returns 200 when db and redis answer', async () => {
    const { app } = await buildServer(testEnv);
    const res = await app.inject({ method: 'GET', url: '/ready' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true, checks: { db: true, redis: true } });
    await app.close();
  });

  it('GET /ready returns 503 when dependencies are down', async () => {
    state.dbDown = true;
    state.redisDown = true;
    const { app } = await buildServer(testEnv);
    const res = await app.inject({ method: 'GET', url: '/ready' });
    expect(res.statusCode).toBe(503);
    expect(res.json()).toMatchObject({ ok: false, checks: { db: false, redis: false } });
    await app.close();
  });
});
