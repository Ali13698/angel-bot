import { clients } from '../state.js';
import { send, replyOk, replyErr } from '../utils.js';
import { getRoom, broadcast, addChatMessage } from '../rooms.js';
import { DB } from '../../db/index.js';

// ============ GAME ACTION ============
export async function gameAction(ws, msg) {
  const info = clients.get(ws);
  if (!info || !info.code) return;

  const room = getRoom(info.code);
  if (!room) return;

  broadcast(room, {
    type: 'game_action',
    data: msg.data
  }, ws);
}

// ============ CHAT MESSAGE ============
export async function chatMessage(ws, msg) {
  const info = clients.get(ws);
  if (!info || !info.code) return;

  const room = getRoom(info.code);
  if (!room) return;

  const kind = String(msg.kind || 'text').slice(0, 16);
  const text = String(msg.text || '').slice(0, 500);
  if (!text && kind === 'text') return;

  const cm = {
    from: info.userId,
    kind,
    text,
    ts: Date.now()
  };

  addChatMessage(room, cm);

  for (const p of room.players) {
    send(p.ws, { type: 'chat_message', message: cm });
  }
}

// ============ EMOJI ============
export async function emoji(ws, msg) {
  const info = clients.get(ws);
  if (!info || !info.code) return;

  const room = getRoom(info.code);
  if (!room) return;

  const e = String(msg.emoji || '').slice(0, 8);
  if (!e) return;

  broadcast(room, {
    type: 'emoji',
    from: info.userId,
    emoji: e
  }, ws);
}

// ============ REPORT MESSAGE ============
export async function reportMessage(ws, msg) {
  const info = clients.get(ws);
  if (!info) return replyErr(ws, msg.cbId, 'ابتدا init کنید');

  const targetId = parseInt(msg.targetId, 10);
  if (!targetId) return replyErr(ws, msg.cbId, 'شناسه نامعتبر');

  const roomCode = info.code || null;
  const reason = String(msg.reason || '').slice(0, 200);

  const r = await DB.moderation.reportUser(info.userId, targetId, roomCode, reason);
  replyOk(ws, msg.cbId, r);
}

// ============ GAME ENDED ============
export async function gameEnded(ws, msg) {
  const info = clients.get(ws);
  if (!info || !info.code) return;

  const room = getRoom(info.code);
  if (!room) return;

  // فقط یک بار پردازش بشه
  if (room.processed) return;
  room.processed = true;

  const winner = parseInt(msg.winnerId, 10);

  if (room.isBot) {
    const humanId = room.players[0].userId;
    const botId = room.botId;

    let humanResult = 'loss';
    if (winner === humanId) humanResult = 'win';
    else if (winner === -1) humanResult = 'draw';

    const statsResult = await DB.stats.recordGameResult(humanId, room.gameId, humanResult);
    await DB.stats.recordMatch(room.code, humanId, botId, winner === humanId ? humanId : botId, room.gameId);

    // چک referral
    const refR = await DB.economy.rewardReferralOnFirstGame(humanId);
    if (refR.ok) {
      send(room.players[0].ws, { type: 'referral_rewarded', coins: refR.reward });
    }

    // روزانه
    const daily = await DB.economy.recordGamePlayed(humanId);
    send(room.players[0].ws, { type: 'daily_update', ...daily });

    // ارسال نتیجه به کلاینت
    send(room.players[0].ws, {
      type: 'game_result',
      gameId: room.gameId,
      result: humanResult,
      stats: statsResult
    });
    return;
  }

  if (room.players.length < 2) return;

  const p1 = room.players[0].userId;
  const p2 = room.players[1].userId;

  let r1 = 'loss', r2 = 'loss';
  if (winner === p1) { r1 = 'win'; r2 = 'loss'; }
  else if (winner === p2) { r1 = 'loss'; r2 = 'win'; }
  else { r1 = 'draw'; r2 = 'draw'; }

  const s1 = await DB.stats.recordGameResult(p1, room.gameId, r1);
  const s2 = await DB.stats.recordGameResult(p2, room.gameId, r2);

  await DB.stats.recordMatch(room.code, p1, p2, winner, room.gameId);

  // referral + daily برای هر دو
  for (const uid of [p1, p2]) {
    const refR = await DB.economy.referralRewardOnFirstGame
      ? await DB.economy.rewardReferralOnFirstGame(uid)
      : { ok: false };
    if (refR.ok) {
      const targetWs = clients.get(ws);
      // پیدا کردن ws کاربر
      const userWs = room.players.find(p => p.userId === uid);
      if (userWs) send(userWs.ws, { type: 'referral_rewarded', coins: refR.reward });
    }
    const daily = await DB.economy.recordGamePlayed(uid);
    const userWs = room.players.find(p => p.userId === uid);
    if (userWs) send(userWs.ws, { type: 'daily_update', ...daily });
  }

  send(room.players[0].ws, { type: 'game_result', gameId: room.gameId, result: r1, stats: s1 });
  send(room.players[1].ws, { type: 'game_result', gameId: room.gameId, result: r2, stats: s2 });
}
