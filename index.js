import { Bot, InlineKeyboard } from "grammy";

const BOT_TOKEN = process.env.BOT_TOKEN;
const WEBAPP_URL = process.env.WEBAPP_URL || "https://ali13698.github.io/ludo/";

if (!BOT_TOKEN) {
  console.error("BOT_TOKEN is not set!");
  process.exit(1);
}

const bot = new Bot(BOT_TOKEN);

bot.command("start", async (ctx) => {
  const kb = new InlineKeyboard().webApp("🎲 بازی منچ", WEBAPP_URL);
  await ctx.reply(
    "🐋 سلام! به ربات آنجل خوش اومدی.\n\nبرای شروع بازی روی دکمه زیر بزن 👇",
    { reply_markup: kb }
  );
});

bot.command("help", async (ctx) => {
  await ctx.reply("دستورات:\n/start - شروع\n/help - راهنما");
});

bot.catch((err) => {
  console.error("Bot error:", err);
});

console.log("Starting bot...");
bot.start({
  onStart: (info) => console.log(`Bot @${info.username} started!`),
});
