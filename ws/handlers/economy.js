import { clients } from '../state.js';
import { replyOk, replyErr } from '../utils.js';
import { DB } from '../../db/index.js';

// ============ REFERRAL ============
export async function getReferral(ws, msg) {
  const info = clients.get(ws);
  if (!info) return replyErr(ws, msg.cbId, 'ابتدا init کنید');

  const stats = await DB.economy.getReferralStats(info.userId);
  replyOk(ws, msg.cbId, stats);
}

// ============ DAILY ============
export async function getDaily(ws, msg) {
  const info = clients.get(ws);
  if (!info) return replyErr(ws, msg.cbId, 'ابتدا init کنید');

  const daily = await DB.economy.getDaily(info.userId);
  const now = Math.floor(Date.now() / 1000);
  const canSpin = !daily.spin_at || (now - daily.spin_at >= 86400);
  const nextSpinIn = canSpin ? 0 : (86400 - (now - daily.spin_at));

  replyOk(ws, msg.cbId, {
    gamesPlayed: daily.games_played || 0,
    gamesRewarded: daily.games_rewarded || 0,
    dailyGoal: 3,
    canSpin,
    nextSpinIn
  });
}

// ============ SPIN WHEEL ============
export async function spin(ws, msg) {
  const info = clients.get(ws);
  if (!info) return replyErr(ws, msg.cbId, 'ابتدا init کنید');

  const r = await DB.economy.spinWheel(info.userId);
  replyOk(ws, msg.cbId, r);
}

// ============ DISCOUNT CODES ============
export async function redeemCode(ws, msg) {
  const info = clients.get(ws);
  if (!info) return replyErr(ws, msg.cbId, 'ابتدا init کنید');

  const code = String(msg.code || '').trim();
  if (!code) return replyErr(ws, msg.cbId, 'کد خالی');

  const r = await DB.economy.redeemCode(info.userId, code);
  replyOk(ws, msg.cbId, r);
}

// ============ TRANSACTIONS ============
export async function getTransactions(ws, msg) {
  const info = clients.get(ws);
  if (!info) return replyErr(ws, msg.cbId, 'ابتدا init کنید');

  const txs = await DB.coins.getTransactions(info.userId, 30);
  const summary = await DB.coins.getBalanceSummary(info.userId);
  replyOk(ws, msg.cbId, { transactions: txs, summary });
}

// ============ GET COINS ============
export async function getCoins(ws, msg) {
  const info = clients.get(ws);
  if (!info) return replyErr(ws, msg.cbId, 'ابتدا init کنید');

  const coins = await DB.coins.getCoins(info.userId);
  replyOk(ws, msg.cbId, { coins });
}
