import { query, queryOne } from './client.js';
import { addCoins } from './coins.js';
import { LIKE_COIN_REWARD, LIKE_DAILY_CAP } from '../config.js';

// ============ FRIENDS ============
export async function sendFriendRequest(userId, friendId) {
  if (userId === friendId) return { ok: false, error: 'خودت رو نمی‌تونی اضافه کنی' };

  const ex = await queryOne(
    `SELECT status FROM friends WHERE user_id = ? AND friend_id = ?`,
    [userId, friendId]
  );
  if (ex) {
    if (ex.status === 'accepted') return { ok: false, error: 'قبلاً دوستید' };
    return { ok: false, error: 'قبلاً درخواست فرستادی' };
  }

  const rev = await queryOne(
    `SELECT status FROM friends WHERE user_id = ? AND friend_id = ?`,
    [friendId, userId]
  );
  if (rev && rev.status === 'pending') {
    await acceptFriendRequest(userId, friendId);
    return { ok: true, autoAccepted: true };
  }

  await query(
    `INSERT INTO friends (user_id, friend_id, status) VALUES (?, ?, 'pending')`,
    [userId, friendId]
  );
  return { ok: true };
}

export async function acceptFriendRequest(userId, friendId) {
  await query(
    `UPDATE friends SET status = 'accepted' WHERE user_id = ? AND friend_id = ?`,
    [friendId, userId]
  );
  const rev = await queryOne(
    `SELECT id FROM friends WHERE user_id = ? AND friend_id = ?`,
    [userId, friendId]
  );
  if (!rev) {
    await query(
      `INSERT INTO friends (user_id, friend_id, status) VALUES (?, ?, 'accepted')`,
      [userId, friendId]
    );
  } else {
    await query(
      `UPDATE friends SET status = 'accepted' WHERE user_id = ? AND friend_id = ?`,
      [userId, friendId]
    );
  }
  return { ok: true };
}

export async function removeFriend(userId, friendId) {
  await query(
    `DELETE FROM friends
     WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)`,
    [userId, friendId, friendId, userId]
  );
  return { ok: true };
}

export async function getFriends(userId) {
  const r = await query(
    `SELECT u.id, u.username, u.game_username, u.first_name, u.display_name,
            u.avatar, u.photo_url, u.wins, u.losses, u.level, u.coins,
            u.likes_count, u.profile_color, u.profile_banner, f.status
     FROM friends f
     JOIN users u ON u.id = f.friend_id
     WHERE f.user_id = ? AND f.status = 'accepted'
     ORDER BY u.last_seen DESC`,
    [userId]
  );
  return r.results;
}

export async function getPendingRequests(userId) {
  const r = await query(
    `SELECT u.id, u.username, u.game_username, u.first_name, u.display_name,
            u.avatar, u.photo_url
     FROM friends f
     JOIN users u ON u.id = f.user_id
     WHERE f.friend_id = ? AND f.status = 'pending'
     ORDER BY f.created_at DESC`,
    [userId]
  );
  return r.results;
}

export async function areFriends(u1, u2) {
  const r = await queryOne(
    `SELECT 1 FROM friends
     WHERE ((user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?))
       AND status = 'accepted'
     LIMIT 1`,
    [u1, u2, u2, u1]
  );
  return !!r;
}

// ============ LIKES ============
export async function likeUser(fromId, toId) {
  if (fromId === toId) return { ok: false, error: 'خودت رو نمی‌تونی لایک کنی' };

  const common = await queryOne(
    `SELECT 1 FROM matches
     WHERE (player1 = ? AND player2 = ?) OR (player1 = ? AND player2 = ?)
     LIMIT 1`,
    [fromId, toId, toId, fromId]
  );
  if (!common) return { ok: false, error: 'باید قبلاً با هم بازی کرده باشید' };

  try {
    await query(
      `INSERT INTO likes (from_user_id, to_user_id) VALUES (?, ?)`,
      [fromId, toId]
    );
  } catch (e) {
    return { ok: false, error: 'قبلاً لایک کردی' };
  }

  await query(`UPDATE users SET likes_count = likes_count + 1 WHERE id = ?`, [toId]);

  // پاداش سکه به دریافت‌کننده (با سقف روزانه)
  const today = await queryOne(`SELECT date('now', '+3 hours', '+30 minutes') as d`);
  const todayLikes = await queryOne(
    `SELECT COUNT(*) as c FROM likes
     WHERE to_user_id = ?
       AND date(created_at, 'unixepoch', '+3 hours', '+30 minutes') = ?`,
    [toId, today.d]
  );
  if ((todayLikes ? todayLikes.c : 0) <= LIKE_DAILY_CAP) {
    await addCoins(toId, LIKE_COIN_REWARD, 'like_received');
  }

  return { ok: true };
}

export async function getLikesReceived(userId) {
  const r = await queryOne(`SELECT COUNT(*) as c FROM likes WHERE to_user_id = ?`, [userId]);
  return r ? r.c : 0;
}

export async function hasLiked(fromId, toId) {
  const r = await queryOne(
    `SELECT 1 FROM likes WHERE from_user_id = ? AND to_user_id = ? LIMIT 1`,
    [fromId, toId]
  );
  return !!r;
}

export async function getTopLiked(limit = 20) {
  const r = await query(
    `SELECT id, game_username, avatar, photo_url, profile_color, profile_banner,
            likes_count, wins, level
     FROM users
     WHERE likes_count > 0
     ORDER BY likes_count DESC
     LIMIT ?`,
    [limit]
  );
  return r.results;
}

// ============ BLOCKS ============
export async function blockUser(fromId, toId) {
  if (fromId === toId) return { ok: false, error: 'خودت رو نمی‌تونی بلاک کنی' };
  await query(
    `INSERT OR IGNORE INTO blocks (from_user_id, to_user_id) VALUES (?, ?)`,
    [fromId, toId]
  );
  return { ok: true };
}

export async function unblockUser(fromId, toId) {
  await query(
    `DELETE FROM blocks WHERE from_user_id = ? AND to_user_id = ?`,
    [fromId, toId]
  );
  return { ok: true };
}

export async function isBlocked(u1, u2) {
  const r = await queryOne(
    `SELECT 1 FROM blocks
     WHERE (from_user_id = ? AND to_user_id = ?) OR (from_user_id = ? AND to_user_id = ?)
     LIMIT 1`,
    [u1, u2, u2, u1]
  );
  return !!r;
}

export async function getBlockedList(userId) {
  const r = await query(
    `SELECT u.id, u.game_username, u.avatar, u.photo_url
     FROM blocks b
     JOIN users u ON u.id = b.to_user_id
     WHERE b.from_user_id = ?`,
    [userId]
  );
  return r.results;
    }
