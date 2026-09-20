// اسم‌های دخترانه با فونت‌های مختلف
const FEMALE_NAMES = [
  '𝓢𝓪𝓻𝓪', '𝓝𝓲𝓵𝓸𝓸𝓯𝓪𝓻', '𝓐𝓲𝓭𝓪', '𝓡𝓪𝓱𝓪', '𝓨𝓪𝓼𝓶𝓲𝓷',
  '𝓚𝓲𝓶𝓲𝓪', '𝓝𝓲𝓴𝓲', '𝓢𝓪𝓷𝓪', '𝓢𝓮𝓽𝓪𝓻𝓮', '𝓑𝓪𝓻𝓪𝓷',
  '𝓜𝓸𝓷𝓪', '𝓓𝓸𝓷𝔂𝓪', '𝓗𝓪𝓼𝓽𝓲', '𝓖𝓱𝓪𝔃𝓪𝓵', '𝓣𝓪𝓻𝓮𝓶𝓮',
  '𝔑𝔞𝔷𝔞𝔫𝔦𝔫', '𝔐𝔞𝔯𝔶𝔞𝔪', '𝔑𝔞𝔯𝔤𝔢𝔰', '𝔏𝔢𝔦𝔩𝔞', '𝔖𝔥𝔦𝔳𝔞',
  '𝔈𝔩𝔫𝔞𝔷', '𝔓𝔞𝔯𝔦𝔰𝔞', '𝔖𝔞𝔪𝔦𝔯𝔞', '𝔉𝔞𝔱𝔢𝔪𝔢', '𝔐𝔦𝔫𝔞',
  'Ⓢⓗⓐⓑⓝⓐⓜ', 'Ⓜⓐⓡⓙⓐⓝ', 'Ⓚⓘⓐⓝⓐ', 'Ⓡⓞⓨⓐ', 'Ⓨⓔⓚⓣⓐ',
  'Ⓜⓔⓛⓘⓚⓐ', 'Ⓣⓐⓡⓐ', 'Ⓟⓐⓡⓝⓘⓐⓝ', 'Ⓓⓘⓐⓝⓐ', 'Ⓐⓣⓔⓝⓐ',
  '𝕐𝕒𝕝𝕕𝕒', 'ℤ𝕙𝕒𝕝𝕖𝕙', '𝕄𝕒𝕟𝕕𝕒𝕟𝕒', '𝕊𝕙𝕒𝕣𝕒𝕣𝕖𝕙', '𝕂𝕚𝕒𝕟𝕒',
  'ℍ𝕖𝕝𝕚𝕒', '𝔸𝕧𝕚𝕟', '𝕊𝕠𝕘𝕒𝕟𝕕', '𝔹𝕚𝕥𝕒', 'ℕ𝕚𝕜𝕒',
  '✿Sara✿', '♡Donya♡', '★Nika★', '✧Yas✧', '❀Roya❀',
  '𝑲𝒊𝒎𝒊𝒂', '𝑴𝒆𝒍𝒊𝒌𝒂', '𝑺𝒂𝒏𝒂', '𝑨𝒊𝒅𝒂', '𝑹𝒂𝒉𝒂',
  '𝕽𝖔𝖏𝖆𝖓', '𝕻𝖊𝖌𝖆𝖍', '𝕿𝖗𝖆𝖓𝖊𝖍', '𝕾𝖍𝖆𝖉𝖎', '𝕲𝖔𝖑𝖓𝖆𝖗',
  '🌸Bahar🌸', '✨Tara✨', '💫Sana💫', '🌺Setare🌺', '🌙Yasmin🌙'
];

// اسم‌های پسرانه با فونت‌های مختلف
const MALE_NAMES = [
  '𝓐𝓻𝓪𝓼𝓱', '𝓚𝓲𝓪𝓷', '𝓟𝓪𝓻𝓼𝓪', '𝓑𝓪𝓱𝓻𝓪𝓭', '𝓡𝓪𝓶𝓲𝓷',
  '𝓐𝓻𝓶𝓲𝓷', '𝓜𝓪𝓷𝓲', '𝓚𝓪𝓿𝓮𝓱', '𝓑𝓪𝓻𝓭𝓲𝓪', '𝓢𝓪𝓶',
  '𝓚𝓸𝓾𝓻𝓸𝓼𝓱', '𝓑𝓪𝓫𝓪𝓴', '𝓕𝓪𝓻𝓲𝓭', '𝓢𝓲𝓪𝓿𝓪𝓼𝓱', '𝓚𝓪𝓶𝔂𝓪𝓻',
  '𝔄𝔪𝔦𝔯', 'ℜ𝔢𝔷𝔞', '𝔄𝔩𝔦', '𝔐𝔬𝔥𝔞𝔪𝔪𝔞𝔡', 'ℌ𝔬𝔰𝔰𝔢𝔦𝔫',
  '𝔐𝔢𝔥𝔡𝔦', 'ℌ𝔞𝔪𝔢𝔡', '𝔐𝔞𝔰𝔬𝔲𝔡', '𝔉𝔞𝔯𝔷𝔞𝔡', '𝔈𝔥𝔰𝔞𝔫',
  'Ⓑⓐⓗⓡⓐⓜ', 'Ⓐⓗⓜⓐⓓ', 'Ⓟⓞⓤⓨⓐ', 'Ⓐⓡⓜⓐⓝ', 'Ⓢⓗⓐⓗⓘⓝ',
  'Ⓢⓞⓗⓔⓘⓛ', 'Ⓟⓔⓨⓜⓐⓝ', 'Ⓕⓐⓡⓢⓗⓘⓓ', 'Ⓚⓐⓜⓡⓐⓝ', 'Ⓢⓐⓔⓔⓓ',
  'ℍ𝕒𝕞𝕚𝕕', '𝔸𝕣𝕚𝕒𝕟', '𝔹𝕒𝕙𝕒𝕕𝕠𝕣', '𝕊𝕙𝕒𝕪𝕒𝕟', '𝔽𝕒𝕣𝕙𝕒𝕕',
  'ℕ𝕒𝕧𝕚𝕕', 'ℝ𝕒𝕕𝕚𝕟', '𝕂𝕖𝕪𝕙𝕒𝕟', '𝕄𝕒𝕙𝕒𝕒𝕟', 'ℤ𝕒𝕣𝕪𝕒𝕟',
  '✪Arash✪', '♛Kian♛', '★Parsa★', '✧Siavash✧', '⚡Arian⚡',
  '𝑲𝒂𝒗𝒆𝒉', '𝑺𝒂𝒎', '𝑩𝒂𝒃𝒂𝒌', '𝑭𝒂𝒓𝒊𝒅', '𝑹𝒂𝒎𝒊𝒏',
  '𝕶𝖆𝖘𝖗𝖆', '𝕻𝖎𝖗𝖔𝖔𝖟', '𝕽𝖔𝖔𝖟𝖇𝖊𝖍', '𝕾𝖔𝖍𝖊𝖎𝖑', '𝕻𝖔𝖚𝖞𝖆',
  '🔥Bahram🔥', '⚔️Kourosh⚔️', '🎯Navid🎯', '🏆Shahin🏆', '💪Mehdi💪'
];

const FEMALE_AVATARS = ['👩','👧','👩‍🦰','👩‍🦱','👩‍🦳','👩‍🦲','👱‍♀️','🧕','👩‍🎓','👩‍🏫','👩‍🎤','👩‍🎨'];
const MALE_AVATARS = ['🧑','👨','🧔','👦','👨‍🦰','👨‍🦱','👨‍🦳','👨‍🦲','👱‍♂️','👳','👨‍🎓','👨‍🏫','👨‍💼','👨‍🎤'];

const BOTS = new Map();
const BOT_COUNT = 80;

function pickNameAndAvatar() {
  const isFemale = Math.random() < 0.5;
  if (isFemale) {
    const name = FEMALE_NAMES[Math.floor(Math.random() * FEMALE_NAMES.length)];
    const avatar = FEMALE_AVATARS[Math.floor(Math.random() * FEMALE_AVATARS.length)];
    return { name, avatar };
  } else {
    const name = MALE_NAMES[Math.floor(Math.random() * MALE_NAMES.length)];
    const avatar = MALE_AVATARS[Math.floor(Math.random() * MALE_AVATARS.length)];
    return { name, avatar };
  }
}

function createBot(i) {
  const pick = pickNameAndAvatar();
  return {
    id: 'bot_' + i,
    name: pick.name,
    avatar: pick.avatar,
    wins: Math.floor(Math.random() * 40) + 1,
    losses: Math.floor(Math.random() * 25) + 1,
    level: 1 + Math.floor(Math.random() * 5),
    xp: Math.floor(Math.random() * 500),
    busy: false,
    lastRotated: Date.now()
  };
}

for (let i = 0; i < BOT_COUNT; i++) BOTS.set('bot_' + i, createBot(i));

// هر ۳ ساعت: اسم/آواتار عوض می‌شه
setInterval(() => {
  for (const bot of BOTS.values()) {
    if (bot.busy) continue;
    if (Math.random() < 0.35) {
      const pick = pickNameAndAvatar();
      bot.name = pick.name;
      bot.avatar = pick.avatar;
    }
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
  },
  count() { return BOTS.size; }
};
