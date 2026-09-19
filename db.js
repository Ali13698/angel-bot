import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const DB_PATH = process.env.DB_PATH || '/app/data/angel.db';

// اطمینان از وجود پوشه
const dir = path.dirname(DB_PATH);
try { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); } catch (e) {}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// ============ ساخت جداول ============
db.exec(`
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
);

CREATE TABLE IF NOT EXISTS friends (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  friend_id INTEGER NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at INTEGER DEFAULT (strftime('%s','now')),
  UNIQUE(user_id, friend_id)
);

CREATE INDEX IF NOT EXISTS idx_friends_user ON friends(user_id, status);
CREATE INDEX IF NOT EXISTS idx_friends_friend ON friends(friend_id, status);

CREATE TABLE IF NOT EXISTS matches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_code TEXT,
  player1 INTEGER,
  player2 INTEGER,
  winner INTEGER,
  started_at INTEGER,
  ended_at INTEGER
);
`);

// ============ API ============
export const DB = {
  // ---- کاربر ----
  upsertUser(tg) {
    db.prepare(`
      INSERT INTO users (id, username, first_name, last_name, photo_url, last_seen)
      VALUES (@id, @username, @first_name, @last_name, @photo_url, strftime('%s','now'))
      ON CONFLICT(id) DO UPDATE SET
        username = excluded.username,
        first_name = excluded.first_name,
        last_name = excluded.last_name,
        photo_url = excluded.photo_url,
        last_seen = strftime('%s','now')
    `).run({
      id: tg.id,
      username: tg.username || null,
      first_name: tg.first_name || '',
      last_name: tg.last_name || null,
      photo_url: tg.photo_url || null
    });
    return this.getUser(tg.id);
  },

  getUser(id) {
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  },

  getUserByUsername(username) {
    return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  },

  setAvatar(id, avatar) {
    db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(avatar, id);
  },

  setDisplayName(id, name) {
    db.prepare('UPDATE users SET display_name = ? WHERE id = ?').run(name, id);
  },

  // ---- آمار ----
  addWin(id, coins, xp) {
    coins = coins || 10; xp = xp || 20;
    db.prepare('UPDATE users SET wins = wins + 1, coins = coins + ?, xp = xp + ? WHERE id = ?')
      .run(coins, xp, id);
  },

  addLoss(id, coins, xp) {
    coins = coins || 2; xp = xp || 5;
    db.prepare('UPDATE users SET losses = losses + 1, coins = coins + ?, xp = xp + ? WHERE id = ?')
      .run(coins, xp, id);
  },

  recordMatch(roomCode, p1, p2, winner) {
    const now = Math.floor(Date.now() / 1000);
    db.prepare(`
      INSERT INTO matches (room_code, player1, player2, winner, started_at, ended_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(roomCode, p1, p2, winner, now, now);
  },

  // ---- دوستان ----
  sendFriendRequest(userId, friendId) {
    if (userId === friendId) return { ok: false, error: 'خودت رو نمی‌تونی اضافه کنی' };
    const existing = db.prepare(
      'SELECT * FROM friends WHERE user_id = ? AND friend_id = ?'
    ).get(userId, friendId);
    if (existing) {
      if (existing.status === 'accepted') return { ok: false, error: 'قبلاً دوستید' };
      return { ok: false, error: 'قبلاً درخواست فرستادی' };
    }
    // چک کن طرف مقابل قبلاً درخواست فرستاده؟
    const rev = db.prepare(
      'SELECT * FROM friends WHERE user_id = ? AND friend_id = ?'
    ).get(friendId, userId);
    if (rev && rev.status === 'pending') {
      // قبول خودکار
      this.acceptFriendRequest(userId, friendId);
      return { ok: true, autoAccepted: true };
    }
    db.prepare('INSERT INTO friends (user_id, friend_id, status) VALUES (?, ?, ?)')
      .run(userId, friendId, 'pending');
    return { ok: true };
  },

  acceptFriendRequest(userId, friendId) {
    db.prepare('UPDATE friends SET status = ? WHERE user_id = ? AND friend_id = ?')
      .run('accepted', friendId, userId);
    const rev = db.prepare(
      'SELECT * FROM friends WHERE user_id = ? AND friend_id = ?'
    ).get(userId, friendId);
    if (!rev) {
      db.prepare('INSERT INTO friends (user_id, friend_id, status) VALUES (?, ?, ?)')
        .run(userId, friendId, 'accepted');
    } else {
      db.prepare('UPDATE friends SET status = ? WHERE user_id = ? AND friend_id = ?')
        .run('accepted', userId, friendId);
    }
    return { ok: true };
  },

  getFriends(userId) {
    return db.prepare(`
      SELECT u.id, u.username, u.first_name, u.display_name, u.avatar, u.photo_url,
             u.wins, u.losses, u.level, f.status
      FROM friends f
      JOIN users u ON u.id = f.friend_id
      WHERE f.user_id = ? AND f.status = 'accepted'
      ORDER BY u.last_seen DESC
    `).all(userId);
  },

  getPendingRequests(userId) {
    return db.prepare(`
      SELECT u.id, u.username, u.first_name, u.display_name, u.avatar, u.photo_url
      FROM friends f
      JOIN users u ON u.id = f.user_id
      WHERE f.friend_id = ? AND f.status = 'pending'
      ORDER BY f.created_at DESC
    `).all(userId);
  },

  removeFriend(userId, friendId) {
    db.prepare('DELETE FROM friends WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)')
      .run(userId, friendId, friendId, userId);
    return { ok: true };
  },

  // ---- لیدربورد ----
  getLeaderboard(limit) {
    limit = limit || 20;
    return db.prepare(`
      SELECT id, username, first_name, display_name, avatar, photo_url, wins, losses, level
      FROM users
      WHERE wins > 0
      ORDER BY wins DESC, level DESC
      LIMIT ?
    `).all(limit);
  },

  // ---- جستجو ----
  searchUsers(query, excludeId) {
    const q = '%' + query + '%';
    return db.prepare(`
      SELECT id, username, first_name, display_name, avatar, photo_url, wins, losses, level
      FROM users
      WHERE id != ? AND (username LIKE ? OR first_name LIKE ? OR display_name LIKE ?)
      LIMIT 20
    `).all(excludeId || 0, q, q, q);
  }
};

export default db;
