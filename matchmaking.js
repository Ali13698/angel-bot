import { BotPool } from './bot-pool.js';

// صف انتظار + تطبیق با ربات بعد از N ثانیه
export const Matchmaker = {
  queue: [],

  // کاربر به صف اضافه می‌شه
  // onMatch(type, entryA, entryB) → type: 'human' | 'bot'
  add(ws, userId, onMatch) {
    // اگه خودش قبلاً بوده، حذف
    this.remove(ws);

    const entry = { ws, userId, joinedAt: Date.now(), timeoutId: null, onMatch };
    this.queue.push(entry);

    // اگه یکی دیگه توی صف هست → تطبیق انسانی
    if (this.queue.length >= 2) {
      const a = this.queue.shift();
      const b = this.queue.shift();
      if (a.timeoutId) clearTimeout(a.timeoutId);
      if (b.timeoutId) clearTimeout(b.timeoutId);
      a.onMatch('human', a, b);
      b.onMatch('human', b, a);
      return;
    }

    // تنهاست → بعد از ۵-۱۰ ثانیه با ربات تطبیق بده
    const delay = 5000 + Math.random() * 5000;
    entry.timeoutId = setTimeout(() => {
      const idx = this.queue.indexOf(entry);
      if (idx < 0) return; // قبلاً تطبیق خورده یا رفته
      this.queue.splice(idx, 1);
      const bot = BotPool.pickOne();
      if (bot) {
        entry.onMatch('bot', entry, bot);
      } else {
        // هیچ رباتی آزاد نبود → برگرد به صف
        this.queue.push(entry);
      }
    }, delay);
  },

  remove(ws) {
    const idx = this.queue.findIndex(x => x.ws === ws);
    if (idx >= 0) {
      if (this.queue[idx].timeoutId) clearTimeout(this.queue[idx].timeoutId);
      this.queue.splice(idx, 1);
    }
  },

  size() { return this.queue.length; }
};
