import { WebSocketServer } from 'ws';
import { clients, onlineUsers } from './state.js';
import { removeFromQueue } from './matchmaker.js';
import { leaveRoom } from './utils.js';
import { dispatch } from './handlers/index.js';
import { roomCount } from './rooms.js';

const RATE_LIMIT = 20;
const RATE_WINDOW = 1000;
const MAX_CONN_PER_IP = 5;
const ALLOWED_ORIGINS = [
  'nomi98.com',
  'nomi98.ir',
  'localhost',
  '127.0.0.1'
];

const connectionsByIP = new Map();

function getIP(req) {
  return (req.headers['cf-connecting-ip'] ||
          req.headers['x-forwarded-for'] ||
          req.socket.remoteAddress || 'unknown').split(',')[0].trim();
}

function checkOrigin(req) {
  const origin = req.headers.origin || '';
  if (!origin) return true;
  return ALLOWED_ORIGINS.some(o => origin.includes(o));
}

export function setupWS(httpServer) {
  const wss = new WebSocketServer({
    server: httpServer,
    maxPayload: 64 * 1024,
    verifyClient: (info, cb) => {
      const ip = getIP(info.req);
      const current = connectionsByIP.get(ip) || 0;
      if (current >= MAX_CONN_PER_IP) {
        console.warn('[ws] rate limit by IP:', ip);
        cb(false, 429, 'too many connections');
        return;
      }
      if (!checkOrigin(info.req)) {
        console.warn('[ws] blocked origin:', info.req.headers.origin);
        cb(false, 403, 'origin not allowed');
        return;
      }
      cb(true);
    }
  });

  wss.on('connection', (ws, req) => {
    const ip = getIP(req);
    connectionsByIP.set(ip, (connectionsByIP.get(ip) || 0) + 1);

    ws._msgTimes = [];
    ws._ip = ip;
    console.log('[ws] connected from', ip.slice(0, 20));

    ws.on('message', async (raw) => {
      const now = Date.now();
      ws._msgTimes = ws._msgTimes.filter(t => now - t < RATE_WINDOW);
      ws._msgTimes.push(now);

      if (ws._msgTimes.length > RATE_LIMIT) {
        console.warn('[ws] rate limit exceeded — closing');
        try { ws.close(1008, 'rate limit'); } catch (e) {}
        return;
      }

      let msg;
      try { msg = JSON.parse(raw.toString()); } catch (e) { return; }

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
      const c = connectionsByIP.get(ip) || 1;
      if (c <= 1) connectionsByIP.delete(ip);
      else connectionsByIP.set(ip, c - 1);
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
    clients: clients.size,
    ips: connectionsByIP.size
  };
}
