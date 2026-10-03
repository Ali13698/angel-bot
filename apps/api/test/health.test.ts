import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { loadEnv } from '../src/env.js';
import { buildServer } from '../src/server.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;

beforeAll(async () => {
  process.env.DATABASE_URL ??= 'postgresql://angel:angel@localhost:5432/angel_test';
  process.env.REDIS_URL ??= 'redis://localhost:6379';
  process.env.SESSION_PEPPER_CURRENT ??= 'test-pepper-0123456789abcdef';
  process.env.NODE_ENV = 'test';

  const env = loadEnv();
  const built = await buildServer(env);
  app = built.app;
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('health', () => {
  it('GET /health returns ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true });
  });

  it('GET /ready returns 200 when deps are up', async () => {
    const res = await app.inject({ method: 'GET', url: '/ready' });
    expect(res.statusCode).toBe(200);
    expect(res.json().checks).toEqual({ db: true, redis: true });
  });
});
