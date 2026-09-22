import { query, queryOne } from './client.js';
import { randomGName, randomCode, RENAME_COST } from '../config.js';

export async function upsertUser(tg) {
  await query(
    `INSERT INTO users (id, username, first_name, last_name, photo_url, last_seen)
     VALUES (?, ?, ?, ?, ?, strftime('%s','now'))
     ON CONFLICT(id) DO UPDATE SET
       username = excluded.username,
       first_name = excluded.first_name,
       last_name = excluded.last_name,
       photo_url = excluded.photo_url,
       last_seen = strftime('%s','now')`,
    [tg.id, tg.username || null, tg.first_name || '', tg.last_name || null, tg.photo_url || null]
  );

  let u = await getUser(tg.id);

  if (u && !u.game_username) {
    for (let i = 0; i < 5; i++) {
      try {
        await query(`UPDATE users SET game_username = ? WHERE id = ? AND game_username IS NULL`, [randomGName(), tg.id]);
        break;
      } catch (e) {}
    }
  }

  if (u && !u.referral_code) {
    for (let i = 0; i < 5; i++) {
      try {
        await query(`UPDATE users SET referral_code = ? WHERE id = ? AND referral_code IS NULL`, [randomCode(8), tg.id]);
        break;
      } catch (e) {}
    }
  }

  return await getUser(tg.id);
}

export async function getUser(id) {
  return await queryOne(`SELECT * FROM users WHERE id = ?`, [id]);
}

export async function getUserByUsername(username) {
  return await queryOne(`SELECT * FROM users WHERE username = ?`, [username]);
}

export async function getUserByGameUsername(gname) {
  return await queryOne(`SELECT * FROM users WHERE game_username = ?`, [gname]);
}

export async function setGameUsername(userId, gname) {
  const c = String(gname || '').trim().slice(0, 24);
  if (!/^[\u0600-\u06FFa-zA-Z0-9_]{3,24}$/.test(c)) {
    return { ok: false, error: 'نامعتبر (۳-۲۴ حرف فارسی/انگلیسی/عدد/آندرلاین)' };
  }
  const existing = await getUserByGameUsername(c);
  if (existing && existing.id !== userId) return { ok: false, error: 'این نام قبلاً گرفته شده' };
  const me = await getUser(userId);
  if (me && me.game_username_locked) return { ok: false, error: 'قبلاً تنظیم شده' };
  await query(`UPDATE users SET game_username = ?, game_username_locked = 1 WHERE id = ?`, [c, userId]);
  return { ok: true };
}

export async function changeGameUsername(userId, gname) {
  const c = String(gname || '').trim().slice(0, 24);
  if (!/^[\u0600-\u06FFa-zA-Z0-9_]{3,24}$/.test(c)) return { ok: false, error: 'نامعتبر' };
  const existing = await getUserByGameUsername(c);
  if (existing && existing.id !== userId) return { ok: false, error: 'گرفته شده' };

  const me = await getUser(userId);
  if (!me) return { ok: false, error: 'کاربر پیدا نشد' };
  if (me.coins < RENAME_COST) return { ok: false, error: `سکه کافی نیست (${RENAME_COST})` };

  await query(`UPDATE users SET coins = coins - ? WHERE id = ?`, [RENAME_COST, userId]);
  await query(`UPDATE users SET game_username = ? WHERE id = ?`, [c, userId]);
  await query(`INSERT INTO transactions (user_id, amount, reason) VALUES (?, ?, 'rename')`, [userId, -RENAME_COST]);

  return { ok: true, coins: me.coins - RENAME_COST };
}

export async function setAvatar(userId, avatar) {
  await query(`UPDATE users SET avatar = ? WHERE id = ?`, [avatar, userId]);
}

export async function setDisplayName(userId, name) {
  await query(`UPDATE users SET display_name = ? WHERE id = ?`, [String(name || '').slice(0, 30), userId]);
}

export async function setProfileColor(userId, color) {
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) return { ok: false, error: 'رنگ نامعتبر' };
  await query(`UPDATE users SET profile_color = ? WHERE id = ?`, [color, userId]);
  return { ok: true };
}

export async function setProfileBanner(userId, bannerId) {
  await query(`UPDATE users SET profile_banner = ? WHERE id = ?`, [bannerId, userId]);
}

export async function touchActiveDay(userId) {
  const r = await query(`SELECT date('now', '+3 hours', '+30 minutes') as d`);
  const today = r.results[0].d;
  const me = await getUser(userId);
  if (!me) return;
  if (me.last_active_date === today) return;

  const yesterdayDate = new Date(Date.now() - 86400000);
  const yesterdayStr = yesterdayDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Tehran' });

  let streak = me.streak_days || 0;
  if (me.last_active_date === yesterdayStr) streak++;
  else streak = 1;

  await query(
    `UPDATE users SET last_active_date = ?, streak_days = ?, active_days = active_days + 1 WHERE id = ?`,
    [today, streak, userId]
  );
}

export async function getPublicProfile(userId) {
  const u = await getUser(userId);
  if (!u) return null;
  return {
    id: u.id,
    game_username: u.game_username,
    avatar: u.avatar || u.photo_url,
    display_name: u.display_name,
    profile_color: u.profile_color,
    profile_banner: u.profile_banner,
    name_effect: u.name_effect,
    coins: u.coins,
    wins: u.wins,
    losses: u.losses,
    level: u.level,
    likes_count: u.likes_count,
    streak_days: u.streak_days,
    active_days: u.active_days,
    created_at: u.created_at
  };
}

export async function searchUsers(q, excludeId = 0) {
  const like = '%' + String(q || '').slice(0, 30) + '%';
  const r = await query(
    `SELECT id, username, game_username, first_name, display_name, avatar, photo_url,
            wins, losses, level, likes_count, profile_color
     FROM users
     WHERE id != ? AND (username LIKE ? OR game_username LIKE ? OR first_name LIKE ? OR display_name LIKE ?)
     LIMIT 20`,
    [excludeId, like, like, like, like]
  );
  return r.results;
}
