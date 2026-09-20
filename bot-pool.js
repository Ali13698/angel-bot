// ============ BOT POOL ============
// 100 اسم فارسی + آواتار، هر ۳ ساعت تغییر می‌کنن

const NAMES = [
  'آرش','سارا','کیان','نیلوفر','پارسا','رها','آیدا','بهراد','یاسمین','رامین',
  'دنیا','آرمین','هستی','مانی','غزل','کاوه','ترمه','بردیا','پانیذ','سام',
  'نازنین','کوروش','مریم','بابک','نرگس','فرید','لیلا','سیاوش','شیوا','کامیار',
  'الناز','امیر','پریسا','رضا','سمیرا','علی','فاطمه','محمد','مینا','حسین',
  'زهرا','مهدی','نسترن','حامد','شبنم','مسعود','بهاره','فرزاد','هدیه','رضوان',
  'احسان','مرجان','بهرام','شادی','احمد','گلنار','کیانا','پویا','ثنا','آرمان',
  'رویا','شاهین','یکتا','سهیل','بیتا','پیمان','ترانه','فرشید','نیکا','کامران',
  'پگاه','سعید','ملیکا','حمید','روژان','آرین','تارا','بهادر','پرنیان','شایان',
  'دیانا','فرهاد','مهسا','نوید','سوگند','رادین','آتنا','کیهان','ماهان','یلدا',
  'ژاله','زریان','ماندانا','کسری','شراره','رعنا','پیروز','هلیا','آوین','روزبه'
];

const AVATARS = [
  '🧑','👩','🧔','👨','👧','👦','👩‍🦰','👨‍🦱','👩‍🦱','🧑‍🦰',
  '👨‍🦳','👩‍🦳','🧑‍🦱','👨‍🦲','👱','👩‍🦲','🧕','👳','👨‍🎓','👩‍🎓'
];

const BOTS = new Map();
const BOT_COUNT = 80;

function createBot(i) {
  return {
    id: 'bot_' + i,
    name: NAMES[Math.floor(Math.random() * NAMES.length)],
    avatar: AVATARS[Math.floor(Math.random() * AVATARS.length)],
    wins: Math.floor(Math.random() * 40) + 1,
    losses: Math.floor(Math.random() * 25) + 1,
    level: 1 + Math.floor(Math.random() * 5),
    xp: Math.floor(Math.random() * 500),
    busy: false,
    lastRotated: Date.now()
  };
}

for (let i = 0; i < BOT_COUNT; i++) BOTS.set('bot_' + i, createBot(i));

// هر ۳ ساعت: اسم/آواتار عوض می‌شه + آمار طبیعی رشد می‌کنه
setInterval(() => {
  for (const bot of BOTS.values()) {
    if (bot.busy) continue;
    if (Math.random() < 0.35) bot.name = NAMES[Math.floor(Math.random() * NAMES.length)];
    if (Math.random() < 0.35) bot.avatar = AVATARS[Math.floor(Math.random() * AVATARS.length)];
    if (Math.random() < 0.25) bot.wins += 1;
    if (Math.random() < 0.15) bot.losses += 1;
    if (Math.random() < 0.20) {
      bot.xp += 15;
      if (bot.xp >= bot.level * 100) { bot.level += 1; bot.xp = 0; }
    }
    bot.lastRotated = Date.now();
  }
}, 3 * 60 * 60 * 1000);

export const BotPool = {
  pickOne() {
    const avail = [];
    for (const b of BOTS.values()) if (!b.busy) avail.push(b);
    if (!avail.length) return null;
    const bot = avail[Math.floor(Math.random() * avail.length)];
    bot.busy = true;
    return { ...bot };
  },
  release(botId) {
    const b = BOTS.get(botId);
    if (b) b.busy = false;
  },
  recordWin(botId) {
    const b = BOTS.get(botId);
    if (b) { b.wins += 1; b.xp += 20; }
  },
  recordLoss(botId) {
    const b = BOTS.get(botId);
    if (b) { b.losses += 1; b.xp += 5; }
  }
};
