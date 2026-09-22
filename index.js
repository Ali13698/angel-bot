import express from 'express';
import { createServer } from 'http';
import { PORT, WEBAPP_URL, REQUIRED_CHANNEL } from './config.js';
import { initTables, DB } from './db/index.js';
import { setupWS, getStats } from './ws/connection.js';
import { startBot } from './bot/index.js';

// ============ EXPRESS ============
const app = express();

app.get('/', (req, res) => {
  res.send('Angel Ludo Server v2 — OK');
});

app.get('/health', (req, res) => {
  const s = getStats();
  res.json({
    ok: true,
    rooms: s.rooms,
    online: s.online,
    clients: s.clients,
    uptime: Math.floor(process.uptime()),
    time: new Date().toISOString()
  });
});

app.get('/ping', (req, res) => res.json({ pong: Date.now() }));

// ============ HTTP ============
const httpServer = createServer(app);

// ============ WEBSOCKET ============
setupWS(httpServer);

// ============ LISTEN ============
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`[server] listening on :${PORT}`);
  console.log(`[server] webapp: ${WEBAPP_URL}`);
  console.log(`[server] channel: ${REQUIRED_CHANNEL || '(none)'}`);
});

// ============ INIT ============
(async () => {
  try {
    await initTables();
    console.log('[init] tables ready');
  } catch (e) {
    console.error('[init] DB failed:', e.message);
  }

  try {
    startBot();
  } catch (e) {
    console.error('[init] bot failed:', e.message);
  }

  console.log('[init] all systems ready ✅');
})();

// ============ GRACEFUL SHUTDOWN ============
process.on('SIGINT', () => {
  console.log('[shutdown] SIGINT');
  process.exit(0);
});
process.on('SIGTERM', () => {
  console.log('[shutdown] SIGTERM');
  process.exit(0);
});
process.on('uncaughtException', (err) => {
  console.error('[uncaught]', err);
});
process.on('unhandledRejection', (err) => {
  console.error('[unhandled]', err);
});
