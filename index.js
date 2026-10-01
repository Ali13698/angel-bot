import express from 'express';
import { createServer } from 'http';
import { PORT, WEBAPP_URL, REQUIRED_CHANNEL } from './config.js';
import { initTables, DB } from './db/index.js';
import { setupWS, getStats } from './ws/connection.js';
import { startBot } from './bot/index.js';
import { startBaleBot } from './bot/bale.js';
import { preflight } from './ws/preflight.js';
import { setupDebugRoutes } from './ws/debug.js';

const app = express();
app.use(express.json({ limit: '1mb' }));

app.get('/', (req, res) => res.send('Angel Platform v4'));

// ============ HEALTH ============
app.get('/health', (req, res) => {
  const s = getStats();
  res.json({
    ok: true,
    uptime: Math.floor(process.uptime()),
    time: new Date().toISOString(),
    ...s
  });
});

// ============ READY ============
let bootReady = false;

app.get('/ready', async (req, res) => {
  if (!bootReady) {
    return res.status(503).json({ ok: false, error: 'still booting' });
  }
  try {
    await DB.query('SELECT 1');
    res.json({
      ok: true,
      db: 'connected',
      uptime: Math.floor(process.uptime())
    });
  } catch (e) {
    res.status(503).json({ ok: false, error: 'db not ready' });
  }
});

app.get('/api/games', async (req, res) => {
  try {
    const r = await DB.query('SELECT * FROM game_config WHERE is_active = 1');
    res.json({ ok: true, games: r.results });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

app.get('/api/shop', async (req, res) => {
  try {
    const r = await DB.query('SELECT * FROM shop_items WHERE is_active = 1 ORDER BY item_type, price_coins');
    res.json({ ok: true, items: r.results });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

// ============ DEBUG ============
setupDebugRoutes(app);

const httpServer = createServer(app);
const wss = setupWS(httpServer);

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`[server] listening on :${PORT}`);
  console.log(`[server] webapp: ${WEBAPP_URL}`);
});

// ============ BOOT ============
(async () => {
  await preflight();

  try {
    await initTables();
    console.log('[init] base tables');
  } catch (e) {
    console.error('[init] base:', e.message);
  }
  try {
    startBot();
  } catch (e) {
    console.error('[init] bot:', e.message);
  }
  try {
    startBaleBot();
  } catch (e) {
    console.error('[init] bale bot:', e.message);
  }
  bootReady = true;
  console.log('[init] ALL SYSTEMS READY ✅');
})();

// ============ GRACEFUL SHUTDOWN ============
let shuttingDown = false;

async function gracefulShutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`[shutdown] ${signal} received — shutting down gracefully`);

  httpServer.close(() => {
    console.log('[shutdown] http server closed');
  });

  try {
    if (wss && wss.clients) {
      for (const client of wss.clients) {
        try { client.close(1001, 'server shutting down'); } catch (e) {}
      }
      wss.close();
    }
  } catch (e) {
    console.error('[shutdown] ws close error', e.message);
  }

  try {
    if (DB && typeof DB.close === 'function') {
      await DB.close();
      console.log('[shutdown] db closed');
    }
  } catch (e) {
    console.error('[shutdown] db close error', e.message);
  }

  setTimeout(() => {
    console.log('[shutdown] forcing exit');
    process.exit(0);
  }, 5000).unref();

  setTimeout(() => {
    console.log('[shutdown] clean exit');
    process.exit(0);
  }, 500);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

process.on('uncaughtException', (e) => {
  console.error('[uncaught]', e && e.message ? e.message : e);
});
process.on('unhandledRejection', (e) => {
  console.error('[unhandled]', e && e.message ? e.message : e);
});
