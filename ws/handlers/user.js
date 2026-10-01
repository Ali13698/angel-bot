import { clients, onlineUsers } from '../state.js';
import { send, publicUser, replyOk, replyErr } from '../utils.js';
import { verifyInitDataAuto } from '../verify.js';
import { DB } from '../../db/index.js';

export async function ping(ws) {
  send(ws, { type: 'pong' });
}

export async function initUser(ws, msg) {
  let tg = null;
  let platform = null;

  if (msg.initData) {
    const verified = verifyInitDataAuto(msg.initData);
    if (verified) {
      tg = verified.user;
      platform = verified.platform;
      if (msg.platform && msg.platform !== verified.platform) {
        console.warn('[WS] platform mismatch | claimed:', msg.platform, '| actual:', verified.platform);
      }
    }
  }

  if (!tg && process.env.ALLOW_DEV_LOGIN === 'true' && msg.user && msg.user.id) {
    tg = msg.user;
    platform = msg.platform === 'bale' ? 'bale' : 'telegram';
    console.warn('[WS] DEV LOGIN — احراز هویت غیرفعال');
  }

  if (!tg || !tg.id) {
    console.warn('[WS] init_user rejected | claimed:', msg.platform || '?', '| initDataLen:', (msg.initData || '').length);
    return replyErr(ws, msg.cbid, 'احراز هویت نامعتبر');
  }

  const u = await DB.users.upsertUser(tg);

  const ban = await DB.moderation.checkBan(u.id);
  if (ban.banned) {
    return send(ws, {
      type: 'banned',
      permanent: !!ban.permanent,
      remainingDays: ban.remainingDays || 0,
      expiresAt: ban.expiresAt || 0,
      extended: !!ban.extended
    });
  }

  const prevWs = onlineUsers.get(u.id);
  if (prevWs && prevWs !== ws && prevWs.readyState === 1) {
    try { prevWs.close(); } catch (e) {}
  }

  clients.set(ws, { userId: u.id, code: null, gameId: null, platform: platform });
  onlineUsers.set(u.id, ws);

  await DB.users.touchActiveDay(u.id);
  const fresh = await DB.users.getUser(u.id);

  replyOk(ws, msg.cbid, {
    user: publicUser(fresh),
    coins: fresh.coins,
    referral_code: fresh.referral_code,
    platform: platform
  });

  console.log('[WS] init_user', u.id, '|', platform);
}

export async function getMe(ws, msg) {
  const info = clients.get(ws);
  if (!info) return replyErr(ws, msg.cbid, 'ابتدا init کنید');

  const u = await DB.users.getUser(info.userId);
  if (!u) return replyErr(ws, msg.cbid, 'کاربر یافت نشد');

  replyOk(ws, msg.cbid, { user: publicUser(u), coins: u.coins });
}

export async function getProfile(ws, msg) {
  const targetId = parseInt(msg.userId, 10);
  if (!targetId) return replyErr(ws, msg.cbid, 'شناسه نامعتبر');

  const profile = await DB.users.getPublicProfile(targetId);
  if (!profile) return replyErr(ws, msg.cbid, 'کاربر یافت نشد');

  profile.stats = await DB.stats.getAllGameStats(targetId);

  replyOk(ws, msg.cbid, { profile });
}

export async function setAvatar(ws, msg) {
  const info = clients.get(ws);
  if (!info) return;
  const avatar = String(msg.avatar || '').slice(0, 8);
  if (!avatar) return replyErr(ws, msg.cbid, 'آواتار خالی');
  await DB.users.setAvatar(info.userId, avatar);
  replyOk(ws, msg.cbid);
}

export async function setName(ws, msg) {
  const info = clients.get(ws);
  if (!info) return;
  const name = String(msg.name || '').slice(0, 30);
  if (!name) return replyErr(ws, msg.cbid, 'نام خالی');
  await DB.users.setDisplayName(info.userId, name);
  replyOk(ws, msg.cbid);
}

export async function setGameUsername(ws, msg) {
  const info = clients.get(ws);
  if (!info) return;
  const r = await DB.users.setGameUsername(info.userId, msg.username || '');
  replyOk(ws, msg.cbid, r);
}

export async function changeGameUsername(ws, msg) {
  const info = clients.get(ws);
  if (!info) return;
  const r = await DB.users.changeGameUsername(info.userId, msg.username || '');
  replyOk(ws, msg.cbid, r);
}
