import { Bot, InlineKeyboard, Keyboard } from 'grammy';
import { DB } from '../db/index.js';

const BALE_TOKEN = process.env.BALE_TOKEN;
const BALE_WEBAPP_URL = process.env.BALE_WEBAPP_URL || 'https://nomi98.ir';

export function startBaleBot() {
  if (!BALE_TOKEN) {
    console.warn('[bale] BALE_TOKEN not set — bot disabled');
    return null;
  }

  const bot = new Bot(BALE_TOKEN, {
    client: { apiRoot: 'https://tapi.bale.ai' }
  });

  bot.command('start', async (ctx) => {
    const userId = ctx.from.id;
    const payload = (ctx.match || '').trim();

    const tg = {
      id: userId,
      username: ctx.from.username,
      first_name: ctx.from.first_name,
      last_name: ctx.from.last_name
    };

    await DB.users.upsertUser(tg);

    if (payload.startsWith('REF_')) {
      const code = payload.slice(4).toUpperCase();
      const r = await DB.economy.attachReferrer(userId, code);
      if (r.ok) await ctx.reply('🎁 کد معرفی ثبت شد!');
    }

    await sendMainMenu(ctx);
  });

  bot.hears('🎮 شروع بازی', async (ctx) => {
    await ctx.reply('🎲 بازی رو باز کن:', { reply_markup: mainInlineKb() });
  });

  bot.command('help', async (ctx) => {
    await ctx.reply('🧚 ربات آنجل\n\n/start — شروع\n/help — راهنما\n/me — پروفایل من');
  });

  bot.command('me', async (ctx) => {
    const u = await DB.users.getUser(ctx.from.id);
    if (!u) return ctx.reply('ابتدا /start بزن');
    await ctx.reply(
      `👤 نام: ${u.game_username || '—'}\n💰 سکه: ${u.coins}\n🏆 برد: ${u.wins}\n❌ باخت: ${u.losses}\n⭐ سطح: ${u.level}\n🔗 کد معرفی: ${u.referral_code || '—'}`
    );
  });

  bot.catch((err) => {
    console.error('[bale bot error]', err);
  });

  bot.start({
    onStart: (info) => console.log('[bale] bot @' + (info.username || '') + ' started')
  });

  return bot;
}

function mainInlineKb() {
  return new InlineKeyboard().webApp('🎮 بازی آنجل', BALE_WEBAPP_URL);
}

async function sendMainMenu(ctx) {
  const kb = new Keyboard().text('🎮 شروع بازی').resized();
  await ctx.reply('🧚 سلام! برای شروع روی دکمه زیر بزن 👇', { reply_markup: kb });
  await ctx.reply('🎲 برای باز کردن بازی، روی دکمه زیر کلیک کن:', { reply_markup: mainInlineKb() });
}
