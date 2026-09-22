import { query, queryOne } from './client.js';

// ============ REPORTS ============
export async function reportUser(reporterId, targetId, roomCode, reason) {
  if (reporterId === targetId) return { ok: false, error: 'خودت رو نمی‌تونی گزارش کنی' };

  // اگه گزارش‌دهنده خودش ban هست، گزارشش شمرده نمی‌شه
  const me = await queryOne(`SELECT banned_until FROM users WHERE id = ?`, [reporterId]);
  if (me && me.banned_until > Math.floor(Date.now() / 1000)) {
    return { ok: false, error: 'شما مسدود هستید' };
  }

  // هر ۲۴ ساعت فقط یک بار می‌تونه یک نفر رو گزارش کنه
  const recent = await queryOne(
    `SELECT 1 FROM reports
     WHERE reporter_id = ? AND target_id = ?
       AND created_at > strftime('%s','now') - 86400
     LIMIT 1`,
    [reporterId, targetId]
  );
  if (recent) return { ok: false, error: 'قبلاً امروز گزارش کردی' };

  await query(
    `INSERT INTO reports (reporter_id, target_id, room_code, reason) VALUES (?, ?, ?, ?)`,
    [reporterId, targetId, roomCode || null, String(reason || '').slice(0, 200)]
  );

  // شمارش کل گزارش‌های این کاربر
  const total = await queryOne(
    `SELECT COUNT(*) as c FROM reports WHERE target_id = ?`,
    [targetId]
  );
  const totalCount = total ? total.c : 0;

  // تعیین سطح ban
  let banLevel = 0, banDays = 0;
  if (totalCount >= 9) { banLevel = 3; banDays = 0; }
  else if (totalCount >= 6) { banLevel = 2; banDays = 10; }
  else if (totalCount >= 3) { banLevel = 1; banDays = 3; }

  let banned = false;
  if (banLevel > 0) {
    const existing = await queryOne(`SELECT * FROM bans WHERE user_id = ?`, [targetId]);
    const curLevel = existing ? existing.level : 0;
    if (banLevel > curLevel) {
      const now = Math.floor(Date.now() / 1000);
      const isPerm = banLevel >= 3 ? 1 : 0;
      const expires = isPerm ? 0 : now + banDays * 86400;
      const unbanGames = isPerm ? 0 : 5;

      await query(
        `INSERT OR REPLACE INTO bans
         (user_id, level, reason, banned_at, expires_at, is_permanent, unban_games_needed)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [targetId, banLevel, 'گزارش‌های متعدد', now, expires, isPerm, unbanGames]
      );
      await query(`UPDATE users SET banned_until = ? WHERE id = ?`, [expires, targetId]);
      banned = true;
    }
  }

  return {
    ok: true,
    totalReports: totalCount,
    banned,
    banLevel,
    banDays,
    permanent: banLevel >= 3
  };
}

export async function getReportsAgainst(userId, limit = 50) {
  const r = await query(
    `SELECT r.*, u.game_username as reporter_name
     FROM reports r
     LEFT JOIN users u ON u.id = r.reporter_id
     WHERE r.target_id = ?
     ORDER BY r.created_at DESC
     LIMIT ?`,
    [userId, limit]
  );
  return r.results;
}

// ============ BANS ============
export async function checkBan(userId) {
  const ban = await queryOne(`SELECT * FROM bans WHERE user_id = ?`, [userId]);
  if (!ban) return { banned: false };

  const now = Math.floor(Date.now() / 1000);

  if (ban.is_permanent) {
    return { banned: true, permanent: true, ban };
  }

  if (ban.expires_at > now) {
    return {
      banned: true,
      expiresAt: ban.expires_at,
      remainingDays: Math.ceil((ban.expires_at - now) / 86400),
      ban
    };
  }

  // منقضی شده — چک کن آیا ۵ بازی در روز انجام داده
  if (ban.unban_games_needed > 0) {
    const today = await queryOne(`SELECT date('now', '+3 hours', '+30 minutes') as d`);
    const daily = await queryOne(
      `SELECT games_played FROM daily_progress WHERE user_id = ? AND date = ?`,
      [userId, today.d]
    );
    const played = daily ? daily.games_played : 0;
    if (played < ban.unban_games_needed) {
      // تمدید ۳ روز
      const newExpires = now + 3 * 86400;
      await query(`UPDATE bans SET expires_at = ? WHERE user_id = ?`, [newExpires, userId]);
      await query(`UPDATE users SET banned_until = ? WHERE id = ?`, [newExpires, userId]);
      return {
        banned: true,
        expiresAt: newExpires,
        extended: true,
        remainingDays: 3,
        ban
      };
    }
  }

  // پاک‌سازی
  await query(`DELETE FROM bans WHERE user_id = ?`, [userId]);
  await query(`UPDATE users SET banned_until = 0 WHERE id = ?`, [userId]);
  return { banned: false };
}

export async function manualBan(userId, level, reason) {
  const now = Math.floor(Date.now() / 1000);
  let days = 3;
  if (level === 2) days = 10;
  if (level >= 3) days = 0;
  const isPerm = level >= 3 ? 1 : 0;
  const expires = isPerm ? 0 : now + days * 86400;

  await query(
    `INSERT OR REPLACE INTO bans
     (user_id, level, reason, banned_at, expires_at, is_permanent, unban_games_needed)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [userId, level, reason || 'دستی', now, expires, isPerm, isPerm ? 0 : 5]
  );
  await query(`UPDATE users SET banned_until = ? WHERE id = ?`, [expires, userId]);
  return { ok: true };
}

export async function unbanUser(userId) {
  await query(`DELETE FROM bans WHERE user_id = ?`, [userId]);
  await query(`UPDATE users SET banned_until = 0 WHERE id = ?`, [userId]);
  return { ok: true };
}

export async function listBans(limit = 100) {
  const r = await query(
    `SELECT b.*, u.game_username
     FROM bans b
     LEFT JOIN users u ON u.id = b.user_id
     ORDER BY b.banned_at DESC
     LIMIT ?`,
    [limit]
  );
  return r.results;
    }
