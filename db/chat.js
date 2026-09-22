import { query } from './client.js';

// چت معمولی هیچ‌جا ذخیره نمی‌شه — فقط توی RAM سرور
// این فایل فقط برای موارد زیره:
// ۱. وقتی یه پیام report می‌شه، برای moderation آرشیو می‌کنیم
// ۲. توی فاز ۳ این فایل رو می‌سازیم

// ذخیره پیام آرشیو (فقط پیام گزارش‌شده)
export async function archiveReportedMessage(roomCode, fromUserId, toUserId, kind, cipher, iv) {
  await query(
    `INSERT INTO chat_messages (room_code, from_user_id, to_user_id, kind, cipher, iv)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [roomCode, fromUserId, toUserId || null, kind, cipher || null, iv || null]
  );
}

// گرفتن آرکایو یک اتاق (فقط ادمین)
export async function getArchivedMessages(roomCode, limit = 100) {
  const r = await query(
    `SELECT * FROM chat_messages WHERE room_code = ? ORDER BY created_at DESC LIMIT ?`,
    [roomCode, limit]
  );
  return r.results;
}

// پاک‌سازی آرشیو قدیمی (بیشتر از ۳۰ روز)
export async function cleanupOldArchives() {
  await query(
    `DELETE FROM chat_messages WHERE created_at < strftime('%s','now') - 2592000`
  );
}
