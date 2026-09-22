import { query, queryOne } from './client.js';
import { addCoins } from './coins.js';
import {
  REFERRAL_REWARD,
  DAILY_GAMES_FOR_REWARD,
  DAILY_REWARD_COINS,
  SPIN_COOLDOWN,
  SPIN_PRIZES
} from '../config.js';

// ============ REFERRAL ============
export async function attachReferrer(newUserId, refCode) {
  if (!refCode) return { ok: false };
  const ref = await queryOne(`SELECT id FROM users WHERE referral_code = ?`, [refCode]);
  if (!ref || ref.id === newUserId) return { ok: false };

  const me = await queryOne(`SELECT referred_by FROM users WHERE id = ?`, [newUserId]);
  if (me && me.referred_by) return { ok: false, error: 'قبلاً معرفی شده' };

  await query(`UPDATE users SET referred_by = ? WHERE id = ?`, [ref.id, newUserId]);
  try {
    await query(
      `INSERT OR IGNORE INTO referrals (referrer_id, referred_id) VALUES (?, ?)`,
      [ref.id, newUserId]
    );
  } catch (e) {}
  return { ok: true, referrerId: ref.id };
}

export async function rewardReferralOnFirstGame(userId) {
  const u = await queryOne(
    `SELECT referred_by, referral_rewarded FROM users WHERE id = ?`,
    [userId]
  );
  if (!u || !u.referred_by || u.referral_rewarded) return { ok: false };

  await query(`UPDATE users SET referral_rewarded = 1 WHERE id = ?`, [userId]);
  await query(
    `UPDATE users SET referrals_count = referrals_count + 1 WHERE id = ?`,
    [u.referred_by]
  );

  await addCoins(userId, REFERRAL_REWARD, 'ref_reward');
  await addCoins(u.referred_by, REFERRAL_REWARD, 'ref_bonus');

  return { ok: true, reward: REFERRAL_REWARD };
}

export async function getReferralStats(userId) {
  const me = await queryOne(
    `SELECT referral_code, referrals_count FROM users WHERE id = ?`,
    [userId]
  );
  const list = await query(
    `SELECT r.referred_id, r.created_at, u.game_username, u.avatar, u.photo_url, u.created_at as joined_at
     FROM referrals r
     LEFT JOIN users u ON u.id = r.referred_id
     WHERE r.referrer_id = ?
     ORDER BY r.created_at DESC
     LIMIT 50`,
    [userId]
  );
  return {
    code: me ? me.referral_code : null,
    count: me ? me.referrals_count : 0,
    list: list.results
  };
}

// ============ DAILY / QUEST ============
async function todayTehran() {
  const r = await queryOne(`SELECT date('now', '+3 hours', '+30 minutes') as d`);
  return r.d;
}

export async function getDaily(userId) {
  const today = await todayTehran();
  let d = await queryOne(
    `SELECT * FROM daily_progress WHERE user_id = ? AND date = ?`,
    [userId, today]
  );
  if (d) return d;
  await query(`INSERT INTO daily_progress (user_id, date) VALUES (?, ?)`, [userId, today]);
  return { user_id: userId, date: today, games_played: 0, games_rewarded: 0, spin_at: 0 };
}

export async function recordGamePlayed(userId) {
  const d = await getDaily(userId);
  const count = (d.games_played || 0) + 1;
  let reward = 0;
  let rewarded = d.games_rewarded || 0;

  if (count >= DAILY_GAMES_FOR_REWARD && rewarded === 0) {
    reward = DAILY_REWARD_COINS;
    rewarded = 1;
    await addCoins(userId, reward, 'daily_quest');
  }

  await query(
    `UPDATE daily_progress SET games_played = ?, games_rewarded = ?
     WHERE user_id = ? AND date = ?`,
    [count, rewarded, userId, d.date]
  );

  return {
    gamesPlayed: count,
    dailyGoal: DAILY_GAMES_FOR_REWARD,
    reward,
    rewardGiven: reward > 0
  };
}

// ============ SPIN WHEEL ============
export async function spinWheel(userId) {
  const d = await getDaily(userId);
  const now = Math.floor(Date.now() / 1000);

  if (d.spin_at && now - d.spin_at < SPIN_COOLDOWN) {
    return {
      ok: false,
      error: 'هنوز وقت نشده',
      remaining: SPIN_COOLDOWN - (now - d.spin_at)
    };
  }

  const total = SPIN_PRIZES.reduce((s, p) => s + p.w, 0);
  let r = Math.random() * total;
  let prize = SPIN_PRIZES[0];
  for (const p of SPIN_PRIZES) {
    r -= p.w;
    if (r <= 0) { prize = p; break; }
  }

  await query(
    `UPDATE daily_progress SET spin_at = ? WHERE user_id = ? AND date = ?`,
    [now, userId, d.date]
  );
  await addCoins(userId, prize.coins, 'spin_wheel');

  return { ok: true, coins: prize.coins };
}

// ============ DISCOUNT CODES ============
export async function redeemCode(userId, code) {
  const c = String(code || '').trim().toUpperCase();
  if (!c) return { ok: false, error: 'کد خالی' };

  const dc = await queryOne(`SELECT * FROM discount_codes WHERE code = ?`, [c]);
  if (!dc) return { ok: false, error: 'کد نامعتبر' };
  if (dc.expires_at && dc.expires_at < Math.floor(Date.now() / 1000)) {
    return { ok: false, error: 'منقضی شده' };
  }
  if (dc.max_uses > 0 && dc.used_count >= dc.max_uses) {
    return { ok: false, error: 'ظرفیت پر شده' };
  }

  try {
    await query(
      `INSERT INTO code_redemptions (user_id, code) VALUES (?, ?)`,
      [userId, c]
    );
  } catch (e) {
    return { ok: false, error: 'قبلاً استفاده کرده‌ای' };
  }

  await query(`UPDATE discount_codes SET used_count = used_count + 1 WHERE code = ?`, [c]);
  await addCoins(userId, dc.coins, 'code:' + c);

  return { ok: true, coins: dc.coins };
}

export async function createCode(code, coins, maxUses = 0, expiresAt = null) {
  const c = String(code || '').trim().toUpperCase();
  if (!c) return { ok: false, error: 'کد خالی' };
  await query(
    `INSERT OR REPLACE INTO discount_codes (code, coins, max_uses, expires_at)
     VALUES (?, ?, ?, ?)`,
    [c, coins, maxUses, expiresAt]
  );
  return { ok: true };
}

export async function listCodes() {
  const r = await query(`SELECT * FROM discount_codes ORDER BY created_at DESC LIMIT 100`);
  return r.results;
     }
