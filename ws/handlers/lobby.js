import { clients, onlineUsers, pendingInvites } from '../state.js';
import { send, publicUser, generateInviteId, leaveRoom as leaveRoomUtil, replyOk, replyErr } from '../utils.js';
import { createRoom, getRoom } from '../rooms.js';
import { addToQueue, removeFromQueue, isInQueue, queueSize, getQueueForGame } from '../matchmaker.js';
import { DB } from '../../db/index.js';

// ============ QUICK MATCH ============
export async function quickMatch(ws, msg) {
  const info = clients.get(ws);
  if (!info) return replyErr(ws, msg.cbid, 'ابتدا init کنید');

  if (info.code) {
    return replyErr(ws, msg.cbid, 'شما در حال بازی هستید');
  }

  const gameId = String(msg.gameId || 'ludo').slice(0, 32);
  const userId = info.userId;
  const platform = info.platform || 'telegram';

  console.log('[lobby] quickMatch', {
    userId,
    platform,
    gameId,
    queueKey: gameId + '::' + platform
  });

  removeFromQueue(ws);

  addToQueue(gameId, { ws, userId, platform, cbid: msg.cbid }, async (type, me, opp) => {
    if (type === 'human') {
      await onHumanMatch(gameId, me, opp);
    } else if (type === 'bot') {
      await onBotMatch(gameId, me);
    }
  });

  replyOk(ws, msg.cbid, { queued: true, gameId });
}

async function onHumanMatch(gameId, a, b) {
  if (!a || !b || a.userId === b.userId) return;

  const ainfo = clients.get(a.ws);
  const binfo = clients.get(b.ws);

  if (!ainfo || !binfo) return;
  if (a.ws.readyState !== 1 || b.ws.readyState !== 1) return;

  if (ainfo.code || binfo.code) {
    console.warn('[lobby] duplicate match ignored A=' + ainfo.code + ' B=' + binfo.code);
    return;
  }

  if (ainfo.platform !== binfo.platform) {
    console.warn('[lobby] cross-platform match rejected A=' + ainfo.platform + ' B=' + binfo.platform);
    return;
  }

  let u1 = null;
  let u2 = null;
  try {
    u1 = await DB.users.getUser(a.userId);
    u2 = await DB.users.getUser(b.userId);
  } catch (dbErr) {
    console.error('[lobby] DB lookup failed', dbErr);
  }
  if (!u1) u1 = { id: a.userId, game_username: 'Player ' + a.userId };
  if (!u2) u2 = { id: b.userId, game_username: 'Player ' + b.userId };

  if (a.ws.readyState !== 1 || b.ws.readyState !== 1) {
    console.warn('[lobby] WS closed during DB lookup, match aborted');
    if (a.ws.readyState === 1) {
      const ai = clients.get(a.ws);
      if (ai && !ai.code) {
        addToQueue(gameId, { ws: a.ws, userId: a.userId, platform: ainfo.platform }, async (type, me, opp) => {
          if (type === 'human') await onHumanMatch(gameId, me, opp);
          else if (type === 'bot') await onBotMatch(gameId, me);
        });
      }
    }
    if (b.ws.readyState === 1) {
      const bi = clients.get(b.ws);
      if (bi && !bi.code) {
        addToQueue(gameId, { ws: b.ws, userId: b.userId, platform: binfo.platform }, async (type, me, opp) => {
          if (type === 'human') await onHumanMatch(gameId, me, opp);
          else if (type === 'bot') await onBotMatch(gameId, me);
        });
      }
    }
    return;
  }

  try {
    const room = createRoom(gameId, [
      { ws: a.ws, userId: a.userId },
      { ws: b.ws, userId: b.userId }
    ], { platform: ainfo.platform || 'telegram' });

    ainfo.code = room.code;
    ainfo.gameId = gameId;
    binfo.code = room.code;
    binfo.gameId = gameId;

    console.log('[lobby] human room created', room.code, 'for', a.userId, 'and', b.userId);

    send(a.ws, {
      type: 'match_found',
      code: room.code,
      gameId,
      playerIndex: 0,
      opponent: publicUser(u2)
    });
    send(b.ws, {
      type: 'match_found',
      code: room.code,
      gameId,
      playerIndex: 1,
      opponent: publicUser(u1)
    });

    console.log('[lobby] match_found sent for', room.code);
  } catch (e) {
    ainfo.code = null;
    binfo.code = null;
    console.error('[lobby] onHumanMatch error', e);
  }
}

async function onBotMatch(gameId, me) {
  const info = clients.get(me.ws);
  if (!info) return;
  if (info.code) return;

  const botData = makeBotProfile();
  const room = createRoom(gameId, [
    { ws: me.ws, userId: me.userId }
  ], {
    isBot: true,
    botInfo: botData,
    botId: botData.id,
    platform: info.platform || 'telegram'
  });

  info.code = room.code;
  info.gameId = gameId;

  console.log('[lobby] bot room created', room.code, 'for', me.userId);

  send(me.ws, {
    type: 'match_found',
    code: room.code,
    gameId,
    playerIndex: 0,
    opponent: {
      id: botData.id,
      name: botData.name,
      game_username: botData.name,
      avatar: botData.avatar,
      wins: botData.wins,
      losses: botData.losses,
      level: botData.level,
      isBot: true
    }
  });
}

const BOT_NAMES = ['آرمین', 'پارسا', 'نادر', 'آیدا', 'رها', 'لیلا', 'کیان', 'سارا', 'آرش'];
const BOT_AVATARS = ['🦊', '🐯', '🦁', '🐸', '🐼', '🐨', '🦄', '🐧', '🐻'];

function makeBotProfile() {
  const i = Math.floor(Math.random() * BOT_NAMES.length);
  return {
    id: 90000000 + Math.floor(Math.random() * 10000000),
    name: BOT_NAMES[i],
    avatar: BOT_AVATARS[i],
    wins: 10 + Math.floor(Math.random() * 100),
    losses: 5 + Math.floor(Math.random() * 50),
    level: 1 + Math.floor(Math.random() * 8),
    isBot: true
  };
}

// ============ CANCEL MATCH ============
export async function cancelMatch(ws, msg) {
  const removed = removeFromQueue(ws);
  replyOk(ws, msg.cbid, { removed });
}

// ============ LEAVE ROOM ============
export async function leaveRoom(ws, msg) {
  const info = clients.get(ws);
  if (info && info.code) leaveRoomUtil(ws);
  replyOk(ws, msg.cbid);
}

// ============ CREATE ROOM ============
export async function createPrivateRoom(ws, msg) {
  const info = clients.get(ws);
  if (!info) {
    console.log('[lobby] createPrivateRoom no-auth ws=' + (ws && ws.readyState));
    return replyErr(ws, msg.cbid, 'ابتدا init کنید');
  }

  const gameId = String(msg.gameId || 'ludo').slice(0, 32);
  if (info.code) leaveRoomUtil(ws);

  const room = createRoom(gameId, [{ ws, userId: info.userId }], {
    platform: info.platform || 'telegram'
  });
  info.code = room.code;
  info.gameId = gameId;

  console.log('[lobby] createPrivateRoom', {
    userId: info.userId,
    platform: info.platform || 'telegram',
    code: room.code,
    wsReadyState: ws && ws.readyState
  });

  replyOk(ws, msg.cbid, { code: room.code, playerIndex: 0, gameId });
}

// ============ JOIN ROOM ============
export async function joinPrivateRoom(ws, msg) {
  const info = clients.get(ws);
  if (!info) {
    console.log('[lobby] joinPrivateRoom no-auth ws=' + (ws && ws.readyState));
    return replyErr(ws, msg.cbid, 'ابتدا init کنید');
  }

  const code = String(msg.code || '').toUpperCase().trim();
  if (!code) return replyErr(ws, msg.cbid, 'کد خالی');

  const room = getRoom(code);
  if (!room) {
    console.log('[lobby] joinPrivateRoom not-found', { userId: info.userId, code });
    return replyErr(ws, msg.cbid, 'اتاق پیدا نشد');
  }

  const platform = info.platform || 'telegram';
  if (room.platform !== platform) {
    console.log('[lobby] joinPrivateRoom wrong-platform', { userId: info.userId, code, roomPlat: room.platform, userPlat: platform });
    return replyErr(ws, msg.cbid, 'این اتاق متعلق به پلتفرم دیگری است');
  }

  if (room.players.length >= 2) return replyErr(ws, msg.cbid, 'اتاق پر است');
  if (room.players[0].userId === info.userId) return replyErr(ws, msg.cbid, 'خودت صاحب اتاقی');

  if (info.code) leaveRoomUtil(ws);

  room.players.push({ ws, userId: info.userId });
  info.code = code;
  info.gameId = room.gameId;

  console.log('[lobby] joinPrivateRoom', {
    userId: info.userId,
    platform: platform,
    code,
    playerCount: room.players.length,
    ownerId: room.players[0].userId,
    ownerReadyState: room.players[0].ws && room.players[0].ws.readyState,
    joinerReadyState: ws && ws.readyState
  });

  const p1 = await DB.users.getUser(room.players[0].userId);
  const p2 = await DB.users.getUser(info.userId);

  send(room.players[0].ws, {
    type: 'match_found',
    code,
    gameId: room.gameId,
    playerIndex: 0,
    opponent: publicUser(p2)
  });
  send(ws, {
    type: 'match_found',
    code,
    gameId: room.gameId,
    playerIndex: 1,
    opponent: publicUser(p1)
  });

  console.log('[lobby] joinPrivateRoom match_found sent for', code);

  replyOk(ws, msg.cbid, { code, playerIndex: 1 });
}

// ============ INVITE FRIEND ============
export async function inviteFriend(ws, msg) {
  const info = clients.get(ws);
  if (!info) return replyErr(ws, msg.cbid, 'ابتدا init کنید');

  const friendId = parseInt(msg.friendId, 10);
  if (!friendId) return replyErr(ws, msg.cbid, 'شناسه نامعتبر');

  const targetWs = onlineUsers.get(friendId);
  if (!targetWs) return replyErr(ws, msg.cbid, 'این کاربر آنلاین نیست');

  const targetInfo = clients.get(targetWs);
  const platform = info.platform || 'telegram';
  if (!targetInfo || (targetInfo.platform || 'telegram') !== platform) {
    return replyErr(ws, msg.cbid, 'کاربر در پلتفرم دیگری است');
  }

  const gameId = String(msg.gameId || 'ludo').slice(0, 32);
  const inviteId = generateInviteId();
  pendingInvites.set(inviteId, {
    from: info.userId,
    to: friendId,
    gameId,
    platform,
    createdAt: Date.now()
  });

  const fromUser = await DB.users.getUser(info.userId);
  send(targetWs, {
    type: 'friend_invite',
    inviteId,
    gameId,
    from: publicUser(fromUser)
  });
  replyOk(ws, msg.cbid, { inviteId });
}

// ============ RESPOND INVITE ============
export async function respondInvite(ws, msg) {
  const info = clients.get(ws);
  if (!info) {
    console.log('[lobby] respondInvite no-auth ws=' + (ws && ws.readyState));
    return replyErr(ws, msg.cbid, 'ابتدا init کنید');
  }

  const inv = pendingInvites.get(msg.inviteId);
  if (!inv) return replyErr(ws, msg.cbid, 'دعوت منقضی شده');
  if (inv.to !== info.userId) return replyErr(ws, msg.cbid, 'این دعوت برای تو نیست');

  pendingInvites.delete(msg.inviteId);

  if (!msg.accept) {
    const fromWs = onlineUsers.get(inv.from);
    if (fromWs) {
      const u = await DB.users.getUser(info.userId);
      send(fromWs, { type: 'invite_declined', by: publicUser(u) });
    }
    return replyOk(ws, msg.cbid);
  }

  const fromWs = onlineUsers.get(inv.from);
  if (!fromWs) return replyErr(ws, msg.cbid, 'فرستنده آفلاین شد');

  const fromInfo = clients.get(fromWs);
  const platform = info.platform || 'telegram';

  if (
    !fromInfo ||
    (fromInfo.platform || 'telegram') !== platform ||
    (inv.platform || 'telegram') !== platform
  ) {
    return replyErr(ws, msg.cbid, 'این دعوت متعلق به پلتفرم دیگری است');
  }

  if (info.code) leaveRoomUtil(ws);
  if (fromInfo && fromInfo.code) leaveRoomUtil(fromWs);

  let u1 = null;
  let u2 = null;
  try {
    u1 = await DB.users.getUser(inv.from);
    u2 = await DB.users.getUser(info.userId);
  } catch (dbErr) {
    console.error('[lobby] respondInvite DB lookup failed', dbErr);
  }
  if (!u1) u1 = { id: inv.from, game_username: 'Player ' + inv.from };
  if (!u2) u2 = { id: info.userId, game_username: 'Player ' + info.userId };

  if (fromWs.readyState !== 1 || ws.readyState !== 1) {
    console.warn('[lobby] respondInvite WS closed during DB lookup, aborted');
    return replyErr(ws, msg.cbid, 'ارتباط قطع شد');
  }

  const room = createRoom(inv.gameId || 'ludo', [
    { ws: fromWs, userId: inv.from },
    { ws: ws, userId: inv.to }
  ], { platform });

  const fi = clients.get(fromWs);
  if (fi) { fi.code = room.code; fi.gameId = room.gameId; }
  info.code = room.code;
  info.gameId = room.gameId;

  console.log('[lobby] respondInvite', {
    code: room.code,
    platform,
    fromUserId: inv.from,
    toUserId: info.userId,
    fromReadyState: fromWs && fromWs.readyState,
    toReadyState: ws && ws.readyState
  });

  send(fromWs, {
    type: 'match_found',
    code: room.code,
    gameId: room.gameId,
    playerIndex: 0,
    opponent: publicUser(u2)
  });
  send(ws, {
    type: 'match_found',
    code: room.code,
    gameId: room.gameId,
    playerIndex: 1,
    opponent: publicUser(u1)
  });
  console.log('[lobby] respondInvite match_found sent for', room.code);

  replyOk(ws, msg.cbid, { code: room.code });
}

// ============ QUEUE STATS ============
export async function queueInfo(ws, msg) {
  const info = clients.get(ws);
  if (!info) return replyErr(ws, msg.cbid, 'ابتدا init کنید');

  const platform = info.platform || 'telegram';
  const stats = getQueueForGame(String(msg.gameId || 'ludo'), platform);
  replyOk(ws, msg.cbid, { size: stats.length, total: queueSize() });
}

// ============ CLEANUP INVITES ============
setInterval(() => {
  const now = Date.now();
  for (const [id, inv] of pendingInvites) {
    if (now - inv.createdAt > 5 * 60 * 1000) pendingInvites.delete(id);
  }
}, 60 * 1000);
