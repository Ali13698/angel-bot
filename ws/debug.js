import WebSocket from 'ws';

export function setupDebugRoutes(app) {
  app.get('/debug/snapshot', async (req, res) => {
    try {
      const { onlineUsers, clients, pendingInvites } = await import('./state.js');
      const { queueSize, getQueueStats } = await import('./matchmaker.js');
      const { roomCount } = await import('./rooms.js');
      res.json({
        ok: true,
        uptime_sec: Math.floor(process.uptime()),
        clients: clients.size,
        online_users: Array.from(onlineUsers.keys()),
        pending_invites: pendingInvites.size,
        queues: getQueueStats(),
        queue_total: queueSize(),
        rooms: roomCount(),
        memory_mb: Math.round(process.memoryUsage().rss / 1024 / 1024)
      });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/debug/ready', async (req, res) => {
    const out = { verdict: 'PASS', checks: {} };
    const t0 = Date.now();

    try {
      const { DB } = await import('../db/index.js');
      await DB.query('SELECT 1');
      out.checks.db = { ok: true };
    } catch (e) {
      out.checks.db = { ok: false, error: e.message };
      out.verdict = 'FAIL';
    }

    try {
      const result = await runMatchSimulation();
      out.checks.match = result;
      if (!result.ok) out.verdict = 'FAIL';
    } catch (e) {
      out.checks.match = { ok: false, error: e.message };
      out.verdict = 'FAIL';
    }

    out.duration_ms = Date.now() - t0;
    res.status(out.verdict === 'PASS' ? 200 : 500).json(out);
  });
}

async function runMatchSimulation() {
  const port = process.env.PORT || 3000;
  const url = 'ws://127.0.0.1:' + port;
  const trace = [];
  const userA = 9000001;
  const userB = 9000002;
  const platform = 'telegram';

  const a = await openClient(url, platform, userA, trace, 'A');
  const b = await openClient(url, platform, userB, trace, 'B');

  await delay(200);

  const aWait = waitFor(a, 'match_found', 3000);
  const bWait = waitFor(b, 'match_found', 3000);

  a.send(JSON.stringify({ type: 'quick_match', gameId: 'ludo', cbid: 1000 }));
  await delay(50);
  b.send(JSON.stringify({ type: 'quick_match', gameId: 'ludo', cbid: 1001 }));

  const aRes = await aWait;
  const bRes = await bWait;

  try { a.close(); } catch (e) {}
  try { b.close(); } catch (e) {}

  const sameRoom = !!(aRes && bRes && aRes.code && aRes.code === bRes.code);

  return {
    ok: sameRoom,
    user_a: { match: !!aRes, room: aRes && aRes.code, idx: aRes && aRes.playerIndex },
    user_b: { match: !!bRes, room: bRes && bRes.code, idx: bRes && bRes.playerIndex },
    same_room: sameRoom,
    trace
  };
}

function openClient(url, platform, userId, trace, tag) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws._waiters = {};
    ws.on('open', () => {
      trace.push(tag + ': open');
      ws.send(JSON.stringify({
        type: 'init_user',
        platform,
        initData: '',
        user: { id: userId, username: 'sim_' + userId, first_name: 'Sim ' + tag }
      }));
    });
    ws.on('message', (raw) => {
      let msg;
      try { msg = JSON.parse(raw.toString()); } catch (e) { return; }
      trace.push(tag + ': recv ' + msg.type);
      if (ws._waiters[msg.type]) {
        const r = ws._waiters[msg.type];
        delete ws._waiters[msg.type];
        r(msg);
      }
    });
    ws.on('error', (e) => {
      trace.push(tag + ': error ' + e.message);
      reject(e);
    });
    setTimeout(() => resolve(ws), 300);
  });
}

function waitFor(ws, type, timeoutMs) {
  return new Promise((resolve) => {
    const t = setTimeout(() => {
      delete ws._waiters[type];
      resolve(null);
    }, timeoutMs);
    ws._waiters[type] = (msg) => {
      clearTimeout(t);
      resolve(msg);
    };
  });
}

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}
