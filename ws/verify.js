import crypto from 'crypto';
import { BOT_TOKEN } from '../config.js';

// کش ۵ دقیقه‌ای برای جلوگیری از verify تکراری
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000;
const MAX_AGE = 24 * 60 * 60; // حداکثر ۲۴ ساعت اعتبار

export function verifyInitData(initData) {
  if (!initData || typeof initData !== 'string') return null;

  const cached = cache.get(initData);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.user;
  }

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');

  const dataCheckString = Array.from(params.entries())
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join('\n');

  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(BOT_TOKEN)
    .digest();

  const computedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  if (computedHash !== hash) return null;

  const authDate = parseInt(params.get('auth_date') || '0', 10);
  if (Date.now() / 1000 - authDate > MAX_AGE) return null;

  const userStr = params.get('user');
  if (!userStr) return null;

  let user;
  try { user = JSON.parse(userStr); } catch (e) { return null; }
  if (!user || !user.id) return null;

  cache.set(initData, { user, ts: Date.now() });
  if (cache.size > 10000) {
    const now = Date.now();
    for (const [k, v] of cache) {
      if (now - v.ts > CACHE_TTL) cache.delete(k);
    }
  }
  return user;
}

export function clearVerifyCache() {
  cache.clear();
}
