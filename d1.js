// ============ Cloudflare D1 Client (HTTP API) ============
const CF_TOKEN = process.env.cftoken;
const CF_ACCOUNT = process.env.cfaccount;
const CF_DB = process.env.cfdb;

if (!CF_TOKEN || !CF_ACCOUNT || !CF_DB) {
  console.error("[d1] Missing env vars: cftoken / cfaccount / cfdb");
  console.error("[d1] Check:", {
    hasToken: !!CF_TOKEN,
    hasAccount: !!CF_ACCOUNT,
    hasDb: !!CF_DB
  });
}

const API_URL = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/d1/database/${CF_DB}/query`;

async function query(sql, params = []) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${CF_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ sql, params })
  });
  const data = await res.json();
  if (!data.success) {
    const msg = data.errors?.[0]?.message || "D1 error";
    console.error("[d1] error:", msg);
    throw new Error(msg);
  }
  const r = data.result?.[0] || {};
  return {
    results: r.results || [],
    meta: r.meta || {}
  };
}

// ============ ساخت جداول ============
export async function initTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      username TEXT,
      first_name TEXT,
      last_name TEXT,
      photo_url TEXT,
      avatar TEXT,
      display_name TEXT,
      coins INTEGER DEFAULT 0,
      wins INTEGER DEFAULT 0,
      losses INTEGER DEFAULT 0,
      level INTEGER DEFAULT 1,
      xp INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (strftime('%s','now')),
      last_seen INTEGER DEFAULT (strftime('%s','now'))
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS friends (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      friend_id INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at INTEGER DEFAULT (strftime('%s','now')),
      UNIQUE(user_id, friend_id)
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_friends_user ON friends(user_id, status)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_friends_friend ON friends(friend_id, status)`);
  await query(`
    CREATE TABLE IF NOT EXISTS matches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_code TEXT,
      player1 INTEGER,
      player2 INTEGER,
      winner INTEGER,
      started_at INTEGER,
      ended_at INTEGER
    )
  `);
  console.log("[d1] tables ready");
}

// ============ DB API ============
export const DB = {
  async upsertUser(tg) {
    await query(
      `INSERT INTO users (id, username, first_name, last_name, photo_url, last_seen)
       VALUES (?, ?, ?, ?, ?, strftime('%s','now'))
       ON CONFLICT(id) DO UPDATE SET
         username = excluded.username,
         first_name = excluded.first_name,
         last_name = excluded.last_name,
         photo_url = excluded.photo_url,
         last_seen = strftime('%s','now')`,
      [tg.id, tg.username || null, tg.first_name || "", tg.last_name || null, tg.photo_url || null]
    );
    return this.getUser(tg.id);
  },

  async getUser(id) {
    const r = await query(`SELECT * FROM users WHERE id = ?`, [id]);
    return r.results[0] || null;
  },

  async getUserByUsername(username) {
    const r = await query(`SELECT * FROM users WHERE username = ?`, [username]);
    return r.results[0] || null;
  },

  async setAvatar(id, avatar) {
    await query(`UPDATE users SET avatar = ? WHERE id = ?`, [avatar, id]);
  },

  async setDisplayName(id, name) {
    await query(`UPDATE users SET display_name = ? WHERE id = ?`, [name, id]);
  },

  async addWin(id, coins = 10, xp = 20) {
    await query(`UPDATE users SET wins = wins + 1, coins = coins + ?, xp = xp + ? WHERE id = ?`, [coins, xp, id]);
  },

  async addLoss(id, coins = 2, xp = 5) {
    await query(`UPDATE users SET losses = losses + 1, coins = coins + ?, xp = xp + ? WHERE id = ?`, [coins, xp, id]);
  },

  async recordMatch(roomCode, p1, p2, winner) {
    await query(
      `INSERT INTO matches (room_code, player1, player2, winner, started_at, ended_at)
       VALUES (?, ?, ?, ?, strftime('%s','now'), strftime('%s','now'))`,
      [roomCode, p1, p2, winner]
    );
  },

  async sendFriendRequest(userId, friendId) {
    if (userId === friendId) return { ok: false, error: "خودت رو نمی‌تونی اضافه کنی" };

    const ex = await query(`SELECT * FROM friends WHERE user_id = ? AND friend_id = ?`, [userId, friendId]);
    if (ex.results[0]) {
      if (ex.results[0].status === "accepted") return { ok: false, error: "قبلاً دوستید" };
      return { ok: false, error: "قبلاً درخواست فرستادی" };
    }

    const rev = await query(`SELECT * FROM friends WHERE user_id = ? AND friend_id = ?`, [friendId, userId]);
    if (rev.results[0] && rev.results[0].status === "pending") {
      await this.acceptFriendRequest(userId, friendId);
      return { ok: true, autoAccepted: true };
    }

    await query(`INSERT INTO friends (user_id, friend_id, status) VALUES (?, ?, 'pending')`, [userId, friendId]);
    return { ok: true };
  },

  async acceptFriendRequest(userId, friendId) {
    await query(`UPDATE friends SET status = 'accepted' WHERE user_id = ? AND friend_id = ?`, [friendId, userId]);
    const rev = await query(`SELECT * FROM friends WHERE user_id = ? AND friend_id = ?`, [userId, friendId]);
    if (!rev.results[0]) {
      await query(`INSERT INTO friends (user_id, friend_id, status) VALUES (?, ?, 'accepted')`, [userId, friendId]);
    } else {
      await query(`UPDATE friends SET status = 'accepted' WHERE user_id = ? AND friend_id = ?`, [userId, friendId]);
    }
    return { ok: true };
  },

  async getFriends(userId) {
    const r = await query(
      `SELECT u.id, u.username, u.first_name, u.display_name, u.avatar, u.photo_url,
              u.wins, u.losses, u.level, f.status
       FROM friends f JOIN users u ON u.id = f.friend_id
       WHERE f.user_id = ? AND f.status = 'accepted'
       ORDER BY u.last_seen DESC`,
      [userId]
    );
    return r.results;
  },

  async getPendingRequests(userId) {
    const r = await query(
      `SELECT u.id, u.username, u.first_name, u.display_name, u.avatar, u.photo_url
       FROM friends f JOIN users u ON u.id = f.user_id
       WHERE f.friend_id = ? AND f.status = 'pending'
       ORDER BY f.created_at DESC`,
      [userId]
    );
    return r.results;
  },

  async removeFriend(userId, friendId) {
    await query(
      `DELETE FROM friends WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)`,
      [userId, friendId, friendId, userId]
    );
    return { ok: true };
  },

  async getLeaderboard(limit = 20) {
    const r = await query(
      `SELECT id, username, first_name, display_name, avatar, photo_url, wins, losses, level
       FROM users WHERE wins > 0
       ORDER BY wins DESC, level DESC LIMIT ?`,
      [limit]
    );
    return r.results;
  },

  async searchUsers(query_, excludeId = 0) {
    const q = "%" + query_ + "%";
    const r = await query(
      `SELECT id, username, first_name, display_name, avatar, photo_url, wins, losses, level
       FROM users WHERE id != ? AND (username LIKE ? OR first_name LIKE ? OR display_name LIKE ?)
       LIMIT 20`,
      [excludeId, q, q, q]
    );
    return r.results;
  },

  // ============ حذف کاربر (برای تست/ادمین) ============
  async deleteUser(id) {
    await query(`DELETE FROM matches WHERE player1 = ? OR player2 = ?`, [id, id]);
    await query(`DELETE FROM friends WHERE user_id = ? OR friend_id = ?`, [id, id]);
    await query(`DELETE FROM users WHERE id = ?`, [id]);
    console.log("[d1] user deleted:", id);
    return { ok: true };
  },

  // ============ حذف همه‌ی رکوردها (پاک‌سازی) ============
  async wipeAll() {
    await query(`DELETE FROM matches`);
    await query(`DELETE FROM friends`);
    await query(`DELETE FROM users`);
    console.log("[d1] all data wiped");
    return { ok: true };
  },

  // ============ آمار کلی ============
  async stats() {
    const users = await query(`SELECT COUNT(*) as c FROM users`);
    const friends = await query(`SELECT COUNT(*) as c FROM friends`);
    const matches = await query(`SELECT COUNT(*) as c FROM matches`);
    return {
      users: users.results[0]?.c || 0,
      friends: friends.results[0]?.c || 0,
      matches: matches.results[0]?.c || 0
    };
  }
};
