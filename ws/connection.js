import { WebSocketServer } from 'ws';
import { clients, onlineUsers } from './state.js';
import { removeFromQueue } from './matchmaker.js';
import { leaveRoom } from './utils.js';
import { dispatch } from './handlers/index.js';
import { roomCount } from './rooms.js';

const RATE_LIMIT = 20;
const RATE_WINDOW = 1000;
const MAX_CONN_PER_IP = 5;
const ALLOWED_ORIGINS = ['nomi98.com', 'nomi98.ir', 'localhost', '127.0.0.1'];

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
      const origin = info.req.headers.origin || '(none)';
      const ua = (info.req.headers['user-agent'] || '').slice(0, 60);
      const current = connectionsByIP.get(ip) || 0;

      console.log('[ws] attempt | ip=' + ip.slice(0, 20) + ' | origin=' + origin + ' | ua=' + ua + ' | current=' + current);

      if (current >= MAX_CONN_PER_IP) {
        console.warn('[ws] REJECT rate-limit | ip=' + ip);
        cb(false, 429, 'too many connections');
        return;
      }

      if (!checkOrigin(info.req)) {
        console.warn('[ws] REJECT bad-origin | origin=' + origin);
        cb(false, 403, 'origin not allowed');
        return;
      }

      console.log('[ws] ACCEPT');
      cb(true);
    }
  });

  wss.on('connection', (ws, req) => {
    const ip = getIP(req);
    const connId = Math.random().toString(36).substring(2, 8);
    ws._connId = connId;
    connectionsByIP.set(ip, (connectionsByIP.get(ip) || 0) + 1);
    ws._msgTimes = [];
    ws._ip = ip;
    console.log('[ws] opened#' + connId + ' | ip=' + ip.slice(0, 20));

    ws.on('message', async (raw) => {
      const now = Date.now();
      ws._msgTimes = ws._msgTimes.filter(t => now - t < RATE_WINDOW);
      ws._msgTimes.push(now);

      if (ws._msgTimes.length > RATE_LIMIT) {
        console.warn('[ws] rate-limit exceeded#' + connId);
        try { ws.close(1008, 'rate limit'); } catch (e) {}
        return;
      }

      let msg;
      try { msg = JSON.parse(raw.toString()); } catch (e) {
        console.warn('[ws] invalid-json#' + connId);
        return;
      }

      if (msg && msg.type) {
        console.log('[ws] <- ' + msg.type + '#' + connId + ' | cbid=' + (msg.cbid !== undefined ? msg.cbid : '-'));
      }

      try {
        await dispatch(ws, msg);
      } catch (err) {
        console.error('[ws] dispatch-error#' + connId, err);
      }
    });

    ws.on('close', (code, reason) => {
      const info = clients.get(ws);
      const who = info ? ('userId=' + info.userId) : 'never-authed';
      console.log('[ws] closed#' + connId + ' ' + who + ' | code=' + code + ' | reason=' + (reason ? reason.toString() : '-'));

      if (info) {
        removeFromQueue(ws);
        if (info.code) leaveRoom(ws);
        if (onlineUsers.get(info.userId) === ws) onlineUsers.delete(info.userId);
        clients.delete(ws);
      }
      const c = connectionsByIP.get(ip) || 1;
      if (c <= 1) connectionsByIP.delete(ip);
      else connectionsByIP.set(ip, c - 1);
    });

    ws.on('error', (err) => {
      console.error('[ws] error#' + connId, err.message);
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
