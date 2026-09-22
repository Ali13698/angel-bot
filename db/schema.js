import { query } from './client.js';

export async function initTables() {
  await query(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY, username TEXT, first_name TEXT, last_name TEXT, photo_url TEXT,
    avatar TEXT, display_name TEXT,
    coins INTEGER DEFAULT 0, wins INTEGER DEFAULT 0, losses INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1, xp INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (strftime('%s','now')),
    last_seen INTEGER DEFAULT (strftime('%s','now'))
  )`);

  const userAlters = [
    `ALTER TABLE users ADD COLUMN game_username TEXT`,
    `ALTER TABLE users ADD COLUMN game_username_locked INTEGER DEFAULT 0`,
    `ALTER TABLE users ADD COLUMN profile_color TEXT DEFAULT '#8b5cf6'`,
    `ALTER TABLE users ADD COLUMN profile_banner TEXT DEFAULT 'default'`,
    `ALTER TABLE users ADD COLUMN name_effect TEXT`,
    `ALTER TABLE users ADD COLUMN referral_code TEXT`,
    `ALTER TABLE users ADD COLUMN referred_by INTEGER`,
    `ALTER TABLE users ADD COLUMN referrals_count INTEGER DEFAULT 0`,
    `ALTER TABLE users ADD COLUMN referral_rewarded INTEGER DEFAULT 0`,
    `ALTER TABLE users ADD COLUMN streak_days INTEGER DEFAULT 0`,
    `ALTER TABLE users ADD COLUMN last_active_date TEXT`,
    `ALTER TABLE users ADD COLUMN likes_count INTEGER DEFAULT 0`,
    `ALTER TABLE users ADD COLUMN active_days INTEGER DEFAULT 0`,
    `ALTER TABLE users ADD COLUMN banned_until INTEGER DEFAULT 0`
  ];
  for (const a of userAlters) {
    try { await query(a); } catch(e) {
      if (!/duplicate column/i.test(e.message)) console.log('[schema]', e.message);
    }
  }

  await query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_u_gname ON users(game_username) WHERE game_username IS NOT NULL`);
  await query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_u_ref ON users(referral_code) WHERE referral_code IS NOT NULL`);

  await query(`CREATE TABLE IF NOT EXISTS user_game_stats (
    user_id INTEGER NOT NULL, game_id TEXT NOT NULL,
    wins INTEGER DEFAULT 0, losses INTEGER DEFAULT 0, draws INTEGER DEFAULT 0,
    games_played INTEGER DEFAULT 0, level INTEGER DEFAULT 1, xp INTEGER DEFAULT 0,
    PRIMARY KEY (user_id, game_id)
  )`);
  await query(`CREATE INDEX IF NOT EXISTS idx_ugs_user ON user_game_stats(user_id)`);

  await query(`CREATE TABLE IF NOT EXISTS game_config (
    game_id TEXT PRIMARY KEY, name TEXT, name_fa TEXT,
    min_players INTEGER, max_players INTEGER,
    has_bot INTEGER DEFAULT 1, is_active INTEGER DEFAULT 1,
    icon TEXT, color TEXT
  )`);
  await query(`INSERT OR IGNORE INTO game_config (game_id,name,name_fa,min_players,max_players,icon,color) VALUES ('ludo','Ludo','منچ',2,4,'🎲','#ef4444')`);
  await query(`INSERT OR IGNORE INTO game_config (game_id,name,name_fa,min_players,max_players,icon,color) VALUES ('backgammon','Backgammon','تخته نرد',2,2,'🎯','#3b82f6')`);
  await query(`INSERT OR IGNORE INTO game_config (game_id,name,name_fa,min_players,max_players,icon,color) VALUES ('dots','Dots','نقطه و خط',2,2,'📐','#10b981')`);
  await query(`INSERT OR IGNORE INTO game_config (game_id,name,name_fa,min_players,max_players,icon,color) VALUES ('football','Football','فوتبال سوکر',2,2,'⚽','#22c55e')`);

  await query(`CREATE TABLE IF NOT EXISTS shop_items (
    item_id TEXT PRIMARY KEY, item_type TEXT NOT NULL,
    name_fa TEXT NOT NULL, price_coins INTEGER NOT NULL,
    preview TEXT, meta TEXT, is_active INTEGER DEFAULT 1, is_premium INTEGER DEFAULT 0
  )`);
  const seeds = [
    ['banner_default','banner','بنر ساده',0,'linear-gradient(135deg,#1e293b,#334155)',null,0],
    ['banner_sunset','banner','غروب',150,'linear-gradient(135deg,#f97316,#dc2626)',null,0],
    ['banner_ocean','banner','اقیانوس',150,'linear-gradient(135deg,#0ea5e9,#1e40af)',null,0],
    ['banner_forest','banner','جنگل',200,'linear-gradient(135deg,#10b981,#065f46)',null,0],
    ['banner_galaxy','banner','کهکشان',350,'linear-gradient(135deg,#7c3aed,#db2777)',null,0],
    ['banner_gold','banner','طلایی',500,'linear-gradient(135deg,#fbbf24,#b45309)',null,1],
    ['color_purple','profile_color','بنفش',100,'#8b5cf6',null,0],
    ['color_red','profile_color','سرخ',100,'#ef4444',null,0],
    ['color_blue','profile_color','آبی',100,'#3b82f6',null,0],
    ['color_gold','profile_color','طلایی',200,'#fbbf24',null,0],
    ['dice_gold','dice_skin','تاس طلایی',300,null,'{"color":"#fbbf24"}',0],
    ['dice_neon','dice_skin','تاس نئون',400,null,'{"color":"#a855f7"}',0],
    ['board_desert','board_skin','زمین صحرا',500,null,'{"theme":"desert"}',0],
    ['board_space','board_skin','زمین فضایی',600,null,'{"theme":"space"}',0],
    ['piece_crystal','piece_skin','مهره کریستال',400,null,'{"style":"crystal"}',0],
    ['piece_fire','piece_skin','مهره آتش',450,null,'{"style":"fire"}',0]
  ];
  for (const it of seeds) {
    await query(`INSERT OR IGNORE INTO shop_items (item_id,item_type,name_fa,price_coins,preview,meta,is_premium) VALUES (?,?,?,?,?,?,?)`, it);
  }

  await query(`CREATE TABLE IF NOT EXISTS inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL,
    item_id TEXT NOT NULL, item_type TEXT NOT NULL, equipped INTEGER DEFAULT 0,
    acquired_at INTEGER DEFAULT (strftime('%s','now')),
    UNIQUE(user_id, item_id)
  )`);
  await query(`CREATE INDEX IF NOT EXISTS idx_inv_user ON inventory(user_id, item_type)`);

  await query(`CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL,
    amount INTEGER NOT NULL, reason TEXT, meta TEXT,
    created_at INTEGER DEFAULT (strftime('%s','now'))
  )`);
  await query(`CREATE INDEX IF NOT EXISTS idx_tx_user ON transactions(user_id, created_at DESC)`);

  await query(`CREATE TABLE IF NOT EXISTS referrals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    referrer_id INTEGER NOT NULL, referred_id INTEGER NOT NULL UNIQUE,
    created_at INTEGER DEFAULT (strftime('%s','now'))
  )`);

  await query(`CREATE TABLE IF NOT EXISTS daily_progress (
    user_id INTEGER NOT NULL, date TEXT NOT NULL,
    games_played INTEGER DEFAULT 0, games_rewarded INTEGER DEFAULT 0,
    spin_at INTEGER DEFAULT 0,
    PRIMARY KEY (user_id, date)
  )`);

  await query(`CREATE TABLE IF NOT EXISTS discount_codes (
    code TEXT PRIMARY KEY, coins INTEGER NOT NULL,
    max_uses INTEGER DEFAULT 0, used_count INTEGER DEFAULT 0,
    expires_at INTEGER, created_at INTEGER DEFAULT (strftime('%s','now'))
  )`);
  await query(`CREATE TABLE IF NOT EXISTS code_redemptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, code TEXT NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s','now')), UNIQUE(user_id, code)
  )`);

  await query(`CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT, room_code TEXT NOT NULL,
    from_user_id INTEGER NOT NULL, to_user_id INTEGER,
    kind TEXT DEFAULT 'text', cipher TEXT, iv TEXT,
    created_at INTEGER DEFAULT (strftime('%s','now'))
  )`);
  await query(`CREATE INDEX IF NOT EXISTS idx_chat_room ON chat_messages(room_code, created_at DESC)`);

  await query(`CREATE TABLE IF NOT EXISTS matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT, room_code TEXT, game_id TEXT DEFAULT 'ludo',
    player1 INTEGER, player2 INTEGER, winner INTEGER,
    started_at INTEGER, ended_at INTEGER
  )`);
  await query(`CREATE INDEX IF NOT EXISTS idx_match_players ON matches(player1, player2)`);

  await query(`CREATE TABLE IF NOT EXISTS friends (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, friend_id INTEGER NOT NULL,
    status TEXT DEFAULT 'pending', created_at INTEGER DEFAULT (strftime('%s','now')),
    UNIQUE(user_id, friend_id)
  )`);
  await query(`CREATE INDEX IF NOT EXISTS idx_fr_u ON friends(user_id, status)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_fr_f ON friends(friend_id, status)`);

  await query(`CREATE TABLE IF NOT EXISTS likes (
    id INTEGER PRIMARY KEY AUTOINCREMENT, from_user_id INTEGER NOT NULL,
    to_user_id INTEGER NOT NULL, created_at INTEGER DEFAULT (strftime('%s','now')),
    UNIQUE(from_user_id, to_user_id)
  )`);
  await query(`CREATE INDEX IF NOT EXISTS idx_likes_to ON likes(to_user_id)`);

  await query(`CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT, reporter_id INTEGER NOT NULL,
    target_id INTEGER NOT NULL, room_code TEXT, reason TEXT,
    created_at INTEGER DEFAULT (strftime('%s','now'))
  )`);
  await query(`CREATE INDEX IF NOT EXISTS idx_rep_target ON reports(target_id, created_at DESC)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_rep_reporter ON reports(reporter_id, target_id, created_at DESC)`);

  await query(`CREATE TABLE IF NOT EXISTS bans (
    user_id INTEGER PRIMARY KEY, level INTEGER DEFAULT 1, reason TEXT,
    banned_at INTEGER, expires_at INTEGER,
    is_permanent INTEGER DEFAULT 0, unban_games_needed INTEGER DEFAULT 0
  )`);

  await query(`CREATE TABLE IF NOT EXISTS blocks (
    from_user_id INTEGER NOT NULL, to_user_id INTEGER NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s','now')),
    PRIMARY KEY (from_user_id, to_user_id)
  )`);

  console.log('[db] schema ready ✅');
}
