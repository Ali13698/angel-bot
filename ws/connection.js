import { WebSocketServer } from 'ws';
import { clients, onlineUsers } from './state.js';
import { removeFromQueue } from './matchmaker.js';
import { leaveRoom } from './utils.js';
import { dispatch } from './handlers/index.js';
import { roomCount } from './rooms.js';

// rate limit: max 20 پیام در ۱ ثانیه
const RATE_LIMIT = 20;
const RATE_WINDOW = 1000;

export function setupWS(httpServer) {
  const wss = new WebSocketServer({ server: httpServer, maxPayload: 64 * 1024 });

  wss.on('connection', (ws) => {
    ws._msgTimes = [];
    console.log('[ws] connected');

    ws.on('message', async (raw) => {
      // rate limit
      const now = Date.now();
      ws._msgTimes = ws._msgTimes.filter(t => now - t < RATE_WINDOW);
      ws._msgTimes.push(now);

      if (ws._msgTimes.length > RATE_LIMIT) {
        console.warn('[ws] rate limit exceeded — closing');
        try { ws.close(1008, 'rate limit'); } catch (e) {}
        return;
      }

      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch (e) {
        return;
      }

      try {
        await dispatch(ws, msg);
      } catch (err) {
        console.error('[ws dispatch]', err);
      }
    });

    ws.on('close', () => {
      const info = clients.get(ws);
      if (info) {
        removeFromQueue(ws);
        if (info.code) leaveRoom(ws);
        if (onlineUsers.get(info.userId) === ws) {
          onlineUsers.delete(info.userId);
        }
        clients.delete(ws);
        console.log('[ws] disconnected', info.userId);
      } else {
        console.log('[ws] disconnected (never authed)');
      }
    });

    ws.on('error', (err) => {
      console.error('[ws error]', err.message);
    });
  });

  console.log('[ws] server ready');
  return wss;
}

export function getStats() {
  return {
    rooms: roomCount(),
    online: onlineUsers.size,
    clients: clients.size
  };
}
