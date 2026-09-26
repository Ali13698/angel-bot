export const BOT_TOKEN = process.env.token;
export const BALE_TOKEN = process.env.BALE_TOKEN;
export const WEBAPP_URL = 'https://nomi98.com/';
export const BALE_WEBAPP_URL = 'https://nomi98.ir/';
export const PORT = process.env.PORT || 3000;

const DB_TYPE = (process.env.DB_TYPE || 'd1').toLowerCase();
const usePg = DB_TYPE === 'postgres' || DB_TYPE === 'pg';

export const CF_TOKEN = process.env.cftoken || process.env.cf_token;
export const CF_ACCOUNT = process.env.cfaccount || process.env.cf_account;
export const CF_DB = process.env.cfdb || process.env.cf_db;

export const PGHOST = process.env.PGHOST || '127.0.0.1';
export const PGPORT = parseInt(process.env.PGPORT || '5432', 10);
export const PGUSER = process.env.PGUSER || 'angel';
export const PGPASSWORD = process.env.PGPASSWORD;
export const PGDATABASE = process.env.PGDATABASE || 'angel_db';

export const DB_TYPE_EXPORT = usePg ? 'postgres' : 'd1';

export const REQUIRED_CHANNEL = process.env.REQUIRED_CHANNEL || null;

export const REFERRAL_REWARD = 50;
export const DAILY_GAMES_FOR_REWARD = 3;
export const DAILY_REWARD_COINS = 30;
export const SPIN_COOLDOWN = 86400;
export const LIKE_COIN_REWARD = 1;
export const LIKE_DAILY_CAP = 20;
export const RENAME_COST = 50;

export const RANKS = [
  { min: 25, name: 'Captain' },
  { min: 20, name: 'Expert' },
  { min: 15, name: 'Master' },
  { min: 10, name: 'Pro' },
  { min: 7, name: 'Gamer' },
  { min: 5, name: 'Beginner' },
  { min: 3, name: 'Rookie' },
  { min: 1, name: 'Newbie' }
];

export const SPIN_PRIZES = [
  { coins: 5, w: 30 }, { coins: 10, w: 25 }, { coins: 25, w: 20 },
  { coins: 50, w: 15 }, { coins: 100, w: 7 }, { coins: 200, w: 2 }, { coins: 500, w: 1 }
];

export function rankForLevel(l) {
  for (const r of RANKS) if (l >= r.min) return r.name;
  return 'Newbie';
}

export function xpForNextLevel(l) {
  return Math.floor(100 * Math.pow(l, 1.5));
}

export function randomCode(len = 8) {
  const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < len; i++) s += c[Math.floor(Math.random() * c.length)];
  return s;
}

const ADJ = ['بی‌ادب', 'بی‌رحم', 'بی‌فکر', 'خوش‌شانس', 'خوش‌قلب', 'سرزنده', 'دیوانه', 'مغرور', 'مکار', 'شیطون'];
const NOUN = ['شاهزاده', 'شوالیه', 'ستاره', 'قلب', 'دنیای', 'کهکشان', 'افسانه', 'قهرمان', 'جنگجو', 'جادوگر'];

export function randomGName() {
  const a = ADJ[Math.floor(Math.random() * ADJ.length)];
  const n = NOUN[Math.floor(Math.random() * NOUN.length)];
  return `${a}_${n}${Math.floor(1000 + Math.random() * 9000)}`;
}

if (!BOT_TOKEN) { console.error('[config] BOT_TOKEN missing'); process.exit(1); }
if (!usePg && (!CF_TOKEN || !CF_ACCOUNT || !CF_DB)) {
  console.error('[config] CF env missing (needed for D1 mode)');
  process.exit(1);
}
if (usePg && !PGPASSWORD) {
  console.error('[config] PGPASSWORD missing (needed for PostgreSQL mode)');
  process.exit(1);
}
if (!BALE_TOKEN) { console.warn('[config] BALE_TOKEN missing — Bale bot disabled'); }

console.log('[config] loaded | DB:', usePg ? 'postgres' : 'd1', '| Bale:', !!BALE_TOKEN);
