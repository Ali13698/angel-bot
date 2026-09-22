import { clients } from './state.js';
import { getRoom, deleteRoom, broadcast as broadcastToRoom } from './rooms.js';

export function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    name: u.display_name || u.first_name || u.username || ('User' + u.id),
    game_username: u.game_username,
    username: u.username,
    avatar: u.avatar || u.photo_url || null,
    profile_color: u.profile_color,
    profile_banner: u.profile_banner,
    name_effect: u.name_effect,
    wins: u.wins,
    losses: u.losses,
    level: u.level,
    coins: u.coins,
    likes_count: u.likes_count,
    isBot: !!u.isBot
  };
}

export function send(ws, obj) {
  if (ws && ws.readyState === 1) {
    try { ws.send(JSON.stringify(obj)); } catch (e) {}
  }
}

export function generateInviteId() {
  return Math.random().toString(36).substring(2, 10);
}

export function leaveRoom(ws) {
  const info = clients.get(ws);
  if (!info || !info.code) return;

  const room = getRoom(info.code);
  if (room) {
    broadcastToRoom(room, { type: 'opponent_left' }, ws);
    deleteRoom(info.code);
  }

  info.code = null;
  info.gameId = null;
}

export function reply(ws, cbId, data) {
  send(ws, { type: 'response', cbId, ...data });
}

export function replyOk(ws, cbId, data = {}) {
  send(ws, { type: 'response', cbId, ok: true, ...data });
}

export function replyErr(ws, cbId, error) {
  send(ws, { type: 'response', cbId, ok: false, error });
}
