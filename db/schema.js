import { query } from './client.js';
import { CF_ACCOUNT, CF_DB, CF_TOKEN } from '../config.js';

async function safe(sql, params = []) {
  try { await query(sql, params); }
  catch (e) { console.log('[skip]', e.message.slice(0, 80)); }
}

async function columnExists(table, column) {
  try {
    const r = await query(`PRAGMA table_info(${table})`);
    return r.results.some(c => c.name === column);
  } catch (e) { return false; }
}

export async function initTables() {
  // ══════════ DIAGNOSTIC ══════════
  console.log('══════ [DIAG START] ══════');
  console.log('[diag] account_id  =', CF_ACCOUNT);
  console.log('[diag] database_id =', CF_DB);
  console.log('[diag] token_last6 =', (CF_TOKEN || '').slice(-6));
  console.log('[diag] NOW         =', new Date().toISOString());

  try {
    const tables = await query(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`);
    console.log('[diag] tables =', tables.results.map(t => t.name).join(', '));
  } catch (e) { console.log('[diag] tables err:', e.message); }

  try {
    const cols = await query(`PRAGMA table_info(users)`);
    const names = cols.results.map(c => c.name);
    console.log('[diag] users columns =', names.join(', '));
    console.log('[diag] has game_username =', names.includes('game_username'));
    console.log('[diag] total columns =', names.length);
  } catch (e) { console.log('[diag] pragma err:', e.message); }
  console.log('══════ [DIAG END] ══════');
  // ═════════════════════════════════

  await safe(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY, username TEXT, first_name TEXT, last_name TEXT, photo_url TEXT,
    avatar TEXT, display_name TEXT,
    coins INTEGER DEFAULT 0, wins INTEGER DEFAULT 0, losses INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1, xp INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (strftime('%s','now')),
    last_seen INTEGER DEFAULT (strftime('%s','now'))
  )`);

  const alters = [
    ['game_username', `ALTER TABLE users ADD COLUMN game_username TEXT`],
    ['game_username_locked', `ALTER TABLE users ADD COLUMN game_username_locked INTEGER DEFAULT 0`],
    ['profile_color', `ALTER TABLE users ADD COLUMN profile_color TEXT DEFAULT '#8b5cf6'`],
    ['profile_banner', `ALTER TABLE users ADD COLUMN profile_banner TEXT DEFAULT 'default'`],
    ['name_effect', `ALTER TABLE users ADD COLUMN name_effect TEXT`],
    ['referral_code', `ALTER TABLE users ADD COLUMN referral_code TEXT`],
    ['referred_by', `ALTER TABLE users ADD COLUMN referred_by INTEGER`],
    ['referrals_count', `ALTER TABLE users ADD COLUMN referrals_count INTEGER DEFAULT 0`],
    ['referral_rewarded', `ALTER TABLE users ADD COLUMN referral_rewarded INTEGER DEFAULT 0`],
    ['streak_days', `ALTER TABLE users ADD COLUMN streak_days INTEGER DEFAULT 0`],
    ['last_active_date', `ALTER TABLE users ADD COLUMN last_active_date TEXT`],
    ['likes_count', `ALTER TABLE users ADD COLUMN likes_count INTEGER DEFAULT 0`],
    ['active_days', `ALTER TABLE users ADD COLUMN active_days INTEGER DEFAULT 0`],
    ['banned_until', `ALTER TABLE users ADD COLUMN banned_until INTEGER DEFAULT 0`]
  ];
  for (const [col, sql] of alters) {
    const has = await columnExists('users', col);
    if (!has) {
      console.log('[schema] adding column:', col);
      await safe(sql);
    }
  }

  if (await columnExists('users', 'game_username')) {
    await safe(`CREATE UNIQUE INDEX IF NOT EXISTS idx_u_gname ON users(game_username)`);
  }
  if (await columnExists('users', 'referral_code')) {
    await safe(`CREATE UNIQUE INDEX IF NOT EXISTS idx_u_ref ON users(referral_code)`);
  }

  await safe(`CREATE TABLE IF NOT EXISTS user_game_stats (
    user_id INTEGER NOT NULL, game_id TEXT NOT NULL,
    wins INTEGER DEFAULT 0, losses INTEGER DEFAULT 0, draws INTEGER DEFAULT 0,
    games_played INTEGER DEFAULT 0, level INTEGER DEFAULT 1, xp INTEGER DEFAULT 0,
    PRIMARY KEY (user_id, game_id)
  )`);

  await safe(`CREATE TABLE IF NOT EXISTS game_config (
    game_id TEXT PRIMARY KEY, name TEXT, name_fa TEXT,
    min_players INTEGER, max_players INTEGER,
    has_bot INTEGER DEFAULT 1, is_active INTEGER DEFAULT 1,
    icon TEXT, color TEXT
  )`);
  await safe(`INSERT OR IGNORE INTO game_config (game_id,name,name_fa,min_players,max_players,icon,color) VALUES ('ludo','Ludo','منچ',2,4,'🎲','#ef4444')`);
  await safe(`INSERT OR IGNORE INTO game_config (game_id,name,name_fa,min_players,max_players,icon,color) VALUES ('backgammon','Backgammon','تخته نرد',2,2,'🎯','#3b82f6')`);
  await safe(`INSERT OR IGNORE INTO game_config (game_id,name,name_fa,min_players,max_players,icon,color) VALUES ('dots','Dots','نقطه و خط',2,2,'📐','#10b981')`);
  await safe(`INSERT OR IGNORE INTO game_config (game_id,name,name_fa,min_players,max_players,icon,color) VALUES ('football','Football','فوتبال سوکر',2,2,'⚽','#22c55e')`);

  await safe(`CREATE TABLE IF NOT EXISTS shop_items (
    item_id TEXT PRIMARY KEY, item_type TEXT NOT NULL,
    name_fa TEXT NOT NULL, price_coins INTEGER NOT NULL,
    preview TEXT, meta TEXT, is_active INTEGER DEFAULT 1, is_premium INTEGER DEFAULT 0
  )`);

  await safe(`CREATE TABLE IF NOT EXISTS inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL,
    item_id TEXT NOT NULL, item_type TEXT NOT NULL, equipped INTEGER DEFAULT 0,
    acquired_at INTEGER DEFAULT (strftime('%s','now')),
    UNIQUE(user_id, item_id)
  )`);

  await safe(`CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL,
    amount INTEGER NOT NULL, reason TEXT, meta TEXT,
    created_at INTEGER DEFAULT (strftime('%s','now'))
  )`);

  await safe(`CREATE TABLE IF NOT EXISTS referrals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    referrer_id INTEGER NOT NULL, referred_id INTEGER NOT NULL UNIQUE,
    created_at INTEGER DEFAULT (strftime('%s','now'))
  )`);

  await safe(`CREATE TABLE IF NOT EXISTS daily_progress (
    user_id INTEGER NOT NULL, date TEXT NOT NULL,
    games_played INTEGER DEFAULT 0, games_rewarded INTEGER DEFAULT 0,
    spin_at INTEGER DEFAULT 0,
    PRIMARY KEY (user_id, date)
  )`);

  await safe(`CREATE TABLE IF NOT EXISTS discount_codes (
    code TEXT PRIMARY KEY, coins INTEGER NOT NULL,
    max_uses INTEGER DEFAULT 0, used_count INTEGER DEFAULT 0,
    expires_at INTEGER, created_at INTEGER DEFAULT (strftime('%s','now'))
  )`);
  await safe(`CREATE TABLE IF NOT EXISTS code_redemptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, code TEXT NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s','now')), UNIQUE(user_id, code)
  )`);

  await safe(`CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT, room_code TEXT NOT NULL,
    from_user_id INTEGER NOT NULL, to_user_id INTEGER,
    kind TEXT DEFAULT 'text', cipher TEXT, iv TEXT,
    created_at INTEGER DEFAULT (strftime('%s','now'))
  )`);

  await safe(`CREATE TABLE IF NOT EXISTS likes (
    id INTEGER PRIMARY KEY AUTOINCREMENT, from_user_id INTEGER NOT NULL,
    to_user_id INTEGER NOT NULL, created_at INTEGER DEFAULT (strftime('%s','now')),
    UNIQUE(from_user_id, to_user_id)
  )`);

  await safe(`CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT, reporter_id INTEGER NOT NULL,
    target_id INTEGER NOT NULL, room_code TEXT, reason TEXT,
    created_at INTEGER DEFAULT (strftime('%s','now'))
  )`);

  await safe(`CREATE TABLE IF NOT EXISTS bans (
    user_id INTEGER PRIMARY KEY, level INTEGER DEFAULT 1, reason TEXT,
    banned_at INTEGER, expires_at INTEGER,
    is_permanent INTEGER DEFAULT 0, unban_games_needed INTEGER DEFAULT 0
  )`);

  await safe(`CREATE TABLE IF NOT EXISTS blocks (
    from_user_id INTEGER NOT NULL, to_user_id INTEGER NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s','now')),
    PRIMARY KEY (from_user_id, to_user_id)
  )`);

  console.log('[db] schema ready ✅');
}
