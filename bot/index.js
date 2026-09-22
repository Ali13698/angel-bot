import { Bot, InlineKeyboard, Keyboard } from 'grammy';
import { BOT_TOKEN, WEBAPP_URL, REQUIRED_CHANNEL } from '../config.js';
import { DB } from '../db/index.js';

const bot = new Bot(BOT_TOKEN);

// کش عضویت (۵ دقیقه)
const memberCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

async function isMember(userId) {
  if (!REQUIRED_CHANNEL) return true;

  const cached = memberCache.get(userId);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.ok;

  try {
    const m = await bot.api.getChatMember(REQUIRED_CHANNEL, userId);
    const ok = ['creator', 'administrator', 'member'].includes(m.status);
    memberCache.set(userId, { ok, ts: Date.now() });
    return ok;
  } catch (e) {
    console.warn('[bot] membership check fail:', e.message);
    // اگه خطا داد، اجازه بده (fail-open)
    return true;
  }
}

function joinKeyboard() {
  const ch = REQUIRED_CHANNEL.startsWith('@') ? REQUIRED_CHANNEL.slice(1) : REQUIRED_CHANNEL;
  return new InlineKeyboard()
    .url('📢 عضویت در کانال', `https://t.me/${ch}`).row()
    .text('✅ عضو شدم', 'check_member');
}

export function startBot() {
  bot.command('start', async (ctx) => {
    const userId = ctx.from.id;
    const payload = (ctx.match || '').trim();

    // چک عضویت
    const member = await isMember(userId);
    if (!member) {
      await ctx.reply(
        '🧚 برای استفاده از آنجل، ابتدا در کانال ما عضو شوید:',
        { reply_markup: joinKeyboard() }
      );
      return;
    }

    // init کاربر در DB
    const tg = {
      id: userId,
      username: ctx.from.username,
      first_name: ctx.from.first_name,
      last_name: ctx.from.last_name
    };
    const u = await DB.users.upsertUser(tg);

    // referral: /start REF_xxxxx
    if (payload.startsWith('REF_')) {
      const code = payload.slice(4).toUpperCase();
      const r = await DB.economy.attachReferrer(userId, code);
      if (r.ok) {
        await ctx.reply('🎁 کد معرفی ثبت شد! بعد از اولین بازی، هدیه دریافت می‌کنی.');
      }
    }

    await sendMainMenu(ctx);
  });

  bot.callbackQuery('check_member', async (ctx) => {
    await ctx.answerCallbackQuery();
    const userId = ctx.from.id;
    memberCache.delete(userId);
    const ok = await isMember(userId);
    if (ok) {
      await ctx.reply('✅ عالی! حالا می‌تونی بازی کنی 👇', { reply_markup: mainInlineKb() });
    } else {
      await ctx.answerCallbackQuery({ text: '❌ هنوز عضو نیستی', show_alert: true });
    }
  });

  bot.hears('🎮 شروع بازی', async (ctx) => {
    const member = await isMember(ctx.from.id);
    if (!member) {
      await ctx.reply('🧚 ابتدا در کانال عضو شو:', { reply_markup: joinKeyboard() });
      return;
    }
    await ctx.reply('🎲 بازی رو باز کن:', { reply_markup: mainInlineKb() });
  });

  bot.command('help', async (ctx) => {
    await ctx.reply(
      '🧚 ربات آنجل\n\n' +
      '/start — شروع\n' +
      '/help — راهنما\n' +
      '/me — پروفایل من\n\n' +
      '🎮 برای بازی، روی دکمه «شروع بازی» بزن.'
    );
  });

  bot.command('me', async (ctx) => {
    const u = await DB.users.getUser(ctx.from.id);
    if (!u) return ctx.reply('ابتدا /start بزن');
    await ctx.reply(
      `👤 نام: ${u.game_username || '—'}\n` +
      `💰 سکه: ${u.coins}\n` +
      `🏆 برد: ${u.wins}\n` +
      `❌ باخت: ${u.losses}\n` +
      `⭐ سطح: ${u.level}\n` +
      `🔗 کد معرفی: ${u.referral_code || '—'}`
    );
  });

  bot.catch((err) => {
    console.error('[bot error]', err);
  });

  bot.start({
    onStart: (info) => console.log(`[bot] @${info.username} started`)
  });

  return bot;
}

function mainInlineKb() {
  return new InlineKeyboard().webApp('🎮 بازی آنجل', WEBAPP_URL);
}

async function sendMainMenu(ctx) {
  const kb = new Keyboard()
    .text('🎮 شروع بازی')
    .resized()
    .persistent();

  await ctx.reply(
    '🧚 سلام! به ربات آنجل خوش اومدی.\n\nبرای شروع روی دکمه زیر بزن 👇',
    { reply_markup: kb }
  );
  await ctx.reply('🎲 برای باز کردن بازی، روی دکمه زیر کلیک کن:', {
    reply_markup: mainInlineKb()
  });
}
