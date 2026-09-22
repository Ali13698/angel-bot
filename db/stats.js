import { query, queryOne } from './client.js';
import { rankForLevel, xpForNextLevel } from '../config.js';

export async function getGameStats(userId, gameId) {
  const r = await queryOne(
    `SELECT * FROM user_game_stats WHERE user_id = ? AND game_id = ?`,
    [userId, gameId]
  );
  if (r) return r;

  await query(
    `INSERT INTO user_game_stats (user_id, game_id) VALUES (?, ?)`,
    [userId, gameId]
  );
  return {
    user_id: userId,
    game_id: gameId,
    wins: 0, losses: 0, draws: 0,
    games_played: 0,
    level: 1, xp: 0
  };
}

export async function getAllGameStats(userId) {
  const r = await query(
    `SELECT * FROM user_game_stats WHERE user_id = ? ORDER BY games_played DESC`,
    [userId]
  );
  return r.results.map(s => ({
    ...s,
    rank: rankForLevel(s.level),
    xp_next: xpForNextLevel(s.level)
  }));
}

export async function recordGameResult(userId, gameId, result) {
  // result: 'win' | 'loss' | 'draw'
  const s = await getGameStats(userId, gameId);

  let xpGain = 5, coinGain = 2;
  let wins = s.wins, losses = s.losses, draws = s.draws;

  if (result === 'win') { xpGain = 20; coinGain = 10; wins++; }
  else if (result === 'draw') { xpGain = 10; coinGain = 5; draws++; }
  else { xpGain = 5; coinGain = 2; losses++; }

  const played = s.games_played + 1;
  let xp = s.xp + xpGain;
  let level = s.level;
  let levelUps = 0;

  while (xp >= xpForNextLevel(level)) {
    xp -= xpForNextLevel(level);
    level++;
    levelUps++;
  }

  await query(
    `UPDATE user_game_stats
     SET wins = ?, losses = ?, draws = ?, games_played = ?, xp = ?, level = ?
     WHERE user_id = ? AND game_id = ?`,
    [wins, losses, draws, played, xp, level, userId, gameId]
  );

  // سکه پاداش برد/باخت
  await query(`UPDATE users SET coins = coins + ? WHERE id = ?`, [coinGain, userId]);
  await query(
    `INSERT INTO transactions (user_id, amount, reason, meta) VALUES (?, ?, 'game_result', ?)`,
    [userId, coinGain, JSON.stringify({ gameId, result })]
  );

  return {
    gameId,
    result,
    level,
    levelUps,
    xp,
    xpNext: xpForNextLevel(level),
    rank: rankForLevel(level),
    wins, losses, draws, gamesPlayed: played,
    coinsEarned: coinGain
  };
}

export async function getGameLeaderboard(gameId, limit = 20) {
  const r = await query(
    `SELECT u.id, u.game_username, u.avatar, u.photo_url, u.profile_color,
            s.level, s.wins, s.losses, s.draws, s.games_played
     FROM user_game_stats s
     JOIN users u ON u.id = s.user_id
     WHERE s.game_id = ? AND s.wins > 0
     ORDER BY s.level DESC, s.wins DESC
     LIMIT ?`,
    [gameId, limit]
  );
  return r.results.map(x => ({
    ...x,
    rank: rankForLevel(x.level),
    winrate: x.games_played > 0 ? Math.round((x.wins / x.games_played) * 100) : 0
  }));
}

export async function getGlobalLeaderboard(limit = 20) {
  const r = await query(
    `SELECT id, username, game_username, first_name, display_name, avatar, photo_url,
            wins, losses, level, coins, likes_count, profile_color, profile_banner
     FROM users
     WHERE wins > 0
     ORDER BY wins DESC, level DESC
     LIMIT ?`,
    [limit]
  );
  return r.results;
}

export async function recordMatch(roomCode, p1, p2, winner, gameId = 'ludo') {
  await query(
    `INSERT INTO matches (room_code, game_id, player1, player2, winner, started_at, ended_at)
     VALUES (?, ?, ?, ?, ?, strftime('%s','now'), strftime('%s','now'))`,
    [roomCode, gameId, p1, p2, winner]
  );
}

export async function hasPlayedTogether(u1, u2) {
  const r = await queryOne(
    `SELECT 1 FROM matches
     WHERE (player1 = ? AND player2 = ?) OR (player1 = ? AND player2 = ?)
     LIMIT 1`,
    [u1, u2, u2, u1]
  );
  return !!r;
}

export async function getUserMatches(userId, limit = 30) {
  const r = await query(
    `SELECT * FROM matches
     WHERE player1 = ? OR player2 = ?
     ORDER BY ended_at DESC
     LIMIT ?`,
    [userId, userId, limit]
  );
  return r.results;
}
