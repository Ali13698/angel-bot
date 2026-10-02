import { clients } from '../state.js';

export async function debugLog(ws, msg) {
  const info = clients.get(ws);
  const userId = info && info.userId;
  const platform = info && info.platform;
  const data = msg && msg.data ? msg.data : {};
  console.log('[CLIENT]', platform || '?', userId || '?', JSON.stringify(data));
}
