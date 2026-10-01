import { replyErr, replyOk } from '../utils.js';
import { clients, onlineUsers } from '../state.js';
import { DB } from '../../db/index.js';

export async function initUser(ws, msg) {
  try {
    let tg = ws.tg || null;
    let platform = ws.platform || 'telegram';

    if (msg.user && msg.user.id) {
      tg = msg.user;
    } else if (msg.data && msg.data.user && msg.data.user.id) {
      tg = msg.data.user;
    }

    if (msg.platform) {
      platform = msg.platform;
    }

    if (!tg || !tg.id) {
      tg = {
        id: 'guest_' + Math.floor(Math.random() * 100000),
        first_name: 'کاربر مهمان',
        username: 'guest'
      };
    }

    ws.tg = tg;
    ws.platform = platform;

    clients.set(ws, {
      userId: String(tg.id),
      tg,
      platform,
      connId: ws.connId || 'conn_' + Date.now()
    });

    onlineUsers.set(String(tg.id), {
      ws,
      lastSeen: Date.now(),
      platform
    });

    let dbUser = null;
    try {
      if (DB?.users?.upsertUser) {
        dbUser = await DB.users.upsertUser({
          id: tg.id,
          first_name: tg.first_name || '',
          last_name: tg.last_name || '',
          username: tg.username || '',
          platform
        });
      }
    } catch (e) {
      console.warn('[user.init] db warning:', e.message);
    }

    return replyOk(ws, msg.cbid, {
      status: 'ok',
      userId: tg.id,
      user: dbUser || tg
    });

  } catch (err) {
    console.error('[user.init] fatal error:', err);
    return replyOk(ws, msg.cbid, {
      status: 'ok',
      userId: ws.tg?.id || 'unknown'
    });
  }
}

export async function ping(ws, msg) {
  return replyOk(ws, msg.cbid, { pong: true, time: Date.now() });
}

export async function getMe(ws, msg) {
  const info = clients.get(ws);
  const uid = info?.userId || ws.tg?.id;
  if (!uid) {
    return replyErr(ws, msg.cbid, 'UNAUTHORIZED', 'ابتدا لاگین کنید');
  }
  try {
    const user = await DB.users.getUser(uid);
    return replyOk(ws, msg.cbid, { user: user || ws.tg });
  } catch (err) {
    return replyOk(ws, msg.cbid, { user: ws.tg });
  }
}

export default {
  initUser,
  ping,
  getMe
};
