import { query, execute } from '../../db/index.js';

export async function initUser(ws, msg) {
  const { cbid, payload } = msg;
  const initData = payload?.initData || payload?.init_data;

  if (!initData) {
    return ws.send(JSON.stringify({ type: 'init_user_response', cbid, ok: false, error: 'NO_INIT_DATA' }));
  }

  try {
    const urlParams = new URLSearchParams(initData);
    const userRaw = urlParams.get('user');
    const tgUser = JSON.parse(userRaw);
    const telegramId = String(tgUser.id);

    let user = await query('SELECT * FROM users WHERE telegram_id = ?', [telegramId]);

    if (!user || user.length === 0) {
      await execute('INSERT INTO users (telegram_id, username, first_name, created_at) VALUES (?, ?, ?, ?)', 
        [telegramId, tgUser.username || '', tgUser.first_name || '', Date.now()]);
      user = await query('SELECT * FROM users WHERE telegram_id = ?', [telegramId]);
    }

    const currentUser = Array.isArray(user) ? user[0] : user;
    ws.userId = currentUser.id;

    ws.send(JSON.stringify({ type: 'init_user_response', cbid, ok: true, data: { user: currentUser } }));
  } catch (err) {
    console.error('[user.initUser] Error:', err);
    ws.send(JSON.stringify({ type: 'init_user_response', cbid, ok: false, error: 'SERVER_ERROR' }));
  }
}

export async function ping(ws, msg) {
  ws.send(JSON.stringify({ type: 'pong', cbid: msg.cbid, timestamp: Date.now() }));
}

export async function getMe(ws, msg) {
  const user = await query('SELECT * FROM users WHERE id = ?', [ws.userId]);
  ws.send(JSON.stringify({ type: 'get_me_response', cbid: msg.cbid, ok: true, data: user[0] }));
}
