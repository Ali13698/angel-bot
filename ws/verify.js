import crypto from 'crypto';
import { BOT_TOKEN } from '../config.js';

const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000;
const MAX_AGE = 24 * 60 * 60;

function getTokenFor(platform) {
  if (platform === 'bale') return process.env.BALE_TOKEN || null;
  return BOT_TOKEN || null;
}

export function verifyInitData(initData, platform = 'telegram') {
  if (!initData || typeof initData !== 'string') return null;
  if (platform !== 'bale' && platform !== 'telegram') return null;

  const botToken = getTokenFor(platform);
  if (!botToken) {
    console.warn('[verify] token for ' + platform + ' not configured');
    return null;
  }

  const cacheKey = platform + '::' + initData;
  const cached = cache.get(cacheKey);
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
    .update(botToken)
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

  cache.set(cacheKey, { user, ts: Date.now() });
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
