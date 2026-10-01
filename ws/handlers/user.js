import { replyErr, replyOk } from '../utils.js';
import { onlineUsers } from '../state.js';
import { DB } from '../../db/index.js';

export async function initUser(ws, msg) {
  try {
    let { tg, platform } = ws;

    if (!tg && msg.user && msg.user.id) {
      tg = msg.user;
      platform = msg.platform === 'bale' ? 'bale' : 'telegram';
      ws.tg = tg;
      ws.platform = platform;
    }

    if (!tg || !tg.id) {
      return replyErr(ws, msg.cbid, 'UNAUTHORIZED', 'اطلاعات کاربر نامعتبر است');
    }

    // ثبت یا به‌روزرسانی کاربر در دیتابیس
    let dbUser = null;
    try {
      dbUser = await DB.users.upsertUser({
        id: tg.id,
        first_name: tg.first_name || '',
        last_name: tg.last_name || '',
        username: tg.username || '',
        platform: platform || 'telegram'
      });
    } catch (e) {
      console.warn('[user.init] DB upsert warning:', e.message);
    }

    // ثبت در لیست کاربران آنلاین
    onlineUsers.set(String(tg.id), {
      ws,
      lastSeen: Date.now(),
      platform: platform || 'telegram'
    });

    return replyOk(ws, msg.cbid, {
      status: 'ok',
      userId: tg.id,
      user: dbUser || tg
    });
  } catch (err) {
    console.error('[user.init] Error:', err);
    return replyErr(ws, msg.cbid, 'SERVER_ERROR', 'خطای سرور');
  }
}

export async function ping(ws, msg) {
  return replyOk(ws, msg.cbid, { pong: true, time: Date.now() });
}

export async function getMe(ws, msg) {
  if (!ws.tg?.id) {
    return replyErr(ws, msg.cbid, 'UNAUTHORIZED', 'کاربر احراز هویت نشده است');
  }
  try {
    const user = await DB.users.getUser(ws.tg.id);
    return replyOk(ws, msg.cbid, { user });
  } catch (err) {
    return replyErr(ws, msg.cbid, 'DB_ERROR', err.message);
  }
}

export default {
  initUser,
  ping,
  getMe
};
