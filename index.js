import express from 'express';
import { createServer } from 'http';
import { PORT, WEBAPP_URL, REQUIRED_CHANNEL } from './config.js';
import { initTables, initAdminTables, initPlatformTables, DB } from './db/index.js';
import { setupWS, getStats } from './ws/connection.js';
import { startBot } from './bot/index.js';
import { startBaleBot } from './bot/bale.js';

const app = express();
app.use(express.json({ limit: '1mb' }));

app.get('/', (req, res) => res.send('Angel Platform v4'));
app.get('/health', (req, res) => {
  const s = getStats();
  res.json({ ok: true, ...s, uptime: Math.floor(process.uptime()), time: new Date().toISOString() });
});

app.get('/api/games', async (req, res) => {
  try {
    const games = await DB.platform.listGames();
    res.json({ ok: true, games });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

app.get('/api/shop', async (req, res) => {
  try {
    const items = await DB.platform.listItems({
      game_id: req.query.game_id,
      slot: req.query.slot,
      item_type: req.query.item_type
    });
    res.json({ ok: true, items });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

const httpServer = createServer(app);
setupWS(httpServer);

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`[server] listening on :${PORT}`);
  console.log(`[server] webapp: ${WEBAPP_URL}`);
});

(async () => {
  try { await initTables(); console.log('[init] base tables'); } catch (e) { console.error('[init] base:', e.message); }
  try { await initAdminTables(); console.log('[init] admin tables'); } catch (e) { console.error('[init] admin:', e.message); }
  try { await initPlatformTables(); console.log('[init] platform tables'); } catch (e) { console.error('[init] platform:', e.message); }
  try { startBot(); } catch (e) { console.error('[init] bot:', e.message); }
  try { startBaleBot(); } catch (e) { console.error('[init] bale bot:', e.message); }
  console.log('[init] ALL SYSTEMS READY ✅');
})();

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
process.on('uncaughtException', (e) => console.error('[uncaught]', e));
process.on('unhandledRejection', (e) => console.error('[unhandled]', e));
