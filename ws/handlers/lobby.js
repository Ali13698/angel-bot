import { clients, onlineUsers, pendingInvites } from '../state.js';
import {
  send, publicUser, generateInviteId,
  leaveRoom, replyOk, replyErr
} from '../utils.js';
import { createRoom, getRoom } from '../rooms.js';
import {
  addToQueue, removeFromQueue, queueSize, getQueueForGame
} from '../matchmaker.js';
import { DB } from '../../db/index.js';

// ============ QUICK MATCH ============
export async function quickMatch(ws, msg) {
  const info = clients.get(ws);
  if (!info) return replyErr(ws, msg.cbId, 'ابتدا init کنید');

  const gameId = String(msg.gameId || 'ludo').slice(0, 32);
  const userId = info.userId;

  if (info.code) leaveRoom(ws);
  removeFromQueue(ws);

  addToQueue(gameId, { ws, userId, cbId: msg.cbId }, async (type, me, opp) => {
    if (type === 'human') {
      if (me.userId !== userId) return;
      await onHumanMatch(gameId, me, opp);
    } else if (type === 'bot') {
      await onBotMatch(gameId, me);
    }
  });

  // جواب به کاربر که وارد صف شد
  replyOk(ws, msg.cbId, { queued: true, gameId });
}

async function onHumanMatch(gameId, a, b) {
  const room = createRoom(gameId, [
    { ws: a.ws, userId: a.userId },
    { ws: b.ws, userId: b.userId }
  ]);

  const aInfo = clients.get(a.ws);
  const bInfo = clients.get(b.ws);
  if (aInfo) { aInfo.code = room.code; aInfo.gameId = gameId; }
  if (bInfo) { bInfo.code = room.code; bInfo.gameId = gameId; }

  const u1 = await DB.users.getUser(a.userId);
  const u2 = await DB.users.getUser(b.userId);

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
}

async function onBotMatch(gameId, me) {
  const botData = makeBotProfile();
  const room = createRoom(gameId, [
    { ws: me.ws, userId: me.userId }
  ], {
    isBot: true,
    botInfo: botData,
    botId: botData.id
  });

  const info = clients.get(me.ws);
  if (info) { info.code = room.code; info.gameId = gameId; }

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

const BOT_NAMES = ['آرش','سارا','کیان','نیلوفر','پارسا','رها','آیدا','بهراد','یاسمین','رامین'];
const BOT_AVATARS = ['🧑','👩','🧔','👧','👨','👩‍🦰','👩‍🦱','🧑‍🦱','👩‍🦳','👨‍🦰'];

function makeBotProfile() {
  const i = Math.floor(Math.random() * BOT_NAMES.length);
  return {
    id: 900000000 + Math.floor(Math.random() * 100000000),
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
  replyOk(ws, msg.cbId, { removed });
}

// ============ LEAVE ROOM ============
export async function leave(ws, msg) {
  const info = clients.get(ws);
  if (info && info.code) leaveRoom(ws);
  replyOk(ws, msg.cbId);
}

// ============ CREATE ROOM ============
export async function createPrivateRoom(ws, msg) {
  const info = clients.get(ws);
  if (!info) return replyErr(ws, msg.cbId, 'ابتدا init کنید');

  const gameId = String(msg.gameId || 'ludo').slice(0, 32);
  if (info.code) leaveRoom(ws);

  const room = createRoom(gameId, [{ ws, userId: info.userId }]);
  info.code = room.code;
  info.gameId = gameId;

  replyOk(ws, msg.cbId, { code: room.code, playerIndex: 0, gameId });
}

// ============ JOIN ROOM ============
export async function joinPrivateRoom(ws, msg) {
  const info = clients.get(ws);
  if (!info) return replyErr(ws, msg.cbId, 'ابتدا init کنید');

  const code = String(msg.code || '').toUpperCase().trim();
  if (!code) return replyErr(ws, msg.cbId, 'کد خالی');

  const room = getRoom(code);
  if (!room) return replyErr(ws, msg.cbId, 'اتاق پیدا نشد');
  if (room.players.length >= 2) return replyErr(ws, msg.cbId, 'اتاق پر است');
  if (room.players[0].userId === info.userId) return replyErr(ws, msg.cbId, 'خودت صاحب اتاقی');

  if (info.code) leaveRoom(ws);

  room.players.push({ ws, userId: info.userId });
  info.code = code;
  info.gameId = room.gameId;

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
  replyOk(ws, msg.cbId, { code, playerIndex: 1 });
}

// ============ INVITE FRIEND ============
export async function inviteFriend(ws, msg) {
  const info = clients.get(ws);
  if (!info) return replyErr(ws, msg.cbId, 'ابتدا init کنید');

  const friendId = parseInt(msg.friendId, 10);
  if (!friendId) return replyErr(ws, msg.cbId, 'شناسه نامعتبر');

  const targetWs = onlineUsers.get(friendId);
  if (!targetWs) return replyErr(ws, msg.cbId, 'این کاربر آنلاین نیست');

  const gameId = String(msg.gameId || 'ludo').slice(0, 32);
  const inviteId = generateInviteId();

  pendingInvites.set(inviteId, {
    from: info.userId,
    to: friendId,
    gameId,
    createdAt: Date.now()
  });

  const fromUser = await DB.users.getUser(info.userId);
  send(targetWs, {
    type: 'friend_invite',
    inviteId,
    gameId,
    from: publicUser(fromUser)
  });
  replyOk(ws, msg.cbId, { inviteId });
}

// ============ RESPOND INVITE ============
export async function respondInvite(ws, msg) {
  const info = clients.get(ws);
  if (!info) return replyErr(ws, msg.cbId, 'ابتدا init کنید');

  const inv = pendingInvites.get(msg.inviteId);
  if (!inv) return replyErr(ws, msg.cbId, 'دعوت منقضی شده');
  if (inv.to !== info.userId) return replyErr(ws, msg.cbId, 'این دعوت برای تو نیست');

  pendingInvites.delete(msg.inviteId);

  if (!msg.accept) {
    const fromWs = onlineUsers.get(inv.from);
    if (fromWs) {
      const u = await DB.users.getUser(info.userId);
      send(fromWs, { type: 'invite_declined', by: publicUser(u) });
    }
    return replyOk(ws, msg.cbId);
  }

  const fromWs = onlineUsers.get(inv.from);
  if (!fromWs) return replyErr(ws, msg.cbId, 'فرستنده آفلاین شد');

  if (info.code) leaveRoom(ws);
  const fromInfo = clients.get(fromWs);
  if (fromInfo && fromInfo.code) leaveRoom(fromWs);

  const room = createRoom(inv.gameId || 'ludo', [
    { ws: fromWs, userId: inv.from },
    { ws, userId: inv.to }
  ]);

  const fi = clients.get(fromWs);
  if (fi) { fi.code = room.code; fi.gameId = room.gameId; }
  info.code = room.code;
  info.gameId = room.gameId;

  const u1 = await DB.users.getUser(inv.from);
  const u2 = await DB.users.getUser(inv.to);

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
  replyOk(ws, msg.cbId, { code: room.code });
}

// ============ QUEUE STATS ============
export async function queueInfo(ws, msg) {
  const stats = getQueueForGame(String(msg.gameId || 'ludo'));
  replyOk(ws, msg.cbId, { size: stats.length, total: queueSize() });
}

// ============ CLEANUP INVITES ============
setInterval(() => {
  const now = Date.now();
  for (const [id, inv] of pendingInvites) {
    if (now - inv.createdAt > 5 * 60 * 1000) pendingInvites.delete(id);
  }
}, 60 * 1000);
