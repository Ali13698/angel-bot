import { replyErr, replyOk } from '../utils.js';
import { clients, onlineUsers } from '../state.js';

export default async function handleUser(ws, msg) {
    const { type } = msg;

    if (type === 'user.init') {
        let { tg, platform } = ws;

        // اطلاعات کاربر ارسالی استفاده کن اگر initData موجود نبود
        if (!tg && msg.user && msg.user.id) {
            tg = msg.user;
            platform = msg.platform === 'bale' ? 'bale' : 'telegram';
            
            // ذخیره در دیتای سوکت برای استفاده‌های بعدی
            ws.tg = tg;
            ws.platform = platform;
        }

        // اگر هنوز کاربر مشخص نشد، رد کن
        if (!tg || !tg.id) {
            return replyErr(ws, msg.cbid, 'نامعتبر');
        }

        // ثبت کاربر در لیست آنلاین‌ها
        onlineUsers.set(tg.id, {
            ws,
            lastSeen: Date.now(),
            platform: platform
        });

        console.log(`[USER] Initialized: ${tg.first_name} (${tg.id}) on ${platform}`);
        
        return replyOk(ws, msg.cbid, {
            user: tg,
            platform: platform
        });
    }
}
