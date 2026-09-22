const rooms = new Map();

function genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function createRoom(gameId, players, options = {}) {
  let code;
  do { code = genCode(); } while (rooms.has(code));

  const room = {
    code,
    gameId,
    players,
    options,
    createdAt: Date.now(),
    chat: [],
    state: {},
    isBot: options.isBot || false,
    botInfo: options.botInfo || null,
    botId: options.botId || null,
    gameStarted: false
  };

  rooms.set(code, room);
  console.log(`[rooms] created ${code} (${gameId}) with ${players.length} player(s)`);
  return room;
}

export function getRoom(code) {
  return rooms.get(code) || null;
}

export function getRoomByWs(ws) {
  for (const room of rooms.values()) {
    if (room.players.some(p => p.ws === ws)) return room;
  }
  return null;
}

export function getRoomByUser(userId) {
  for (const room of rooms.values()) {
    if (room.players.some(p => p.userId === userId)) return room;
  }
  return null;
}

export function deleteRoom(code) {
  rooms.delete(code);
}

export function removePlayerFromRoom(ws) {
  const room = getRoomByWs(ws);
  if (!room) return null;

  room.players = room.players.filter(p => p.ws !== ws);

  if (room.players.length === 0) {
    deleteRoom(room.code);
    return { room, empty: true };
  }
  return { room, empty: false };
}

export function send(ws, obj) {
  if (ws && ws.readyState === 1) {
    try { ws.send(JSON.stringify(obj)); } catch (e) {}
  }
}

export function broadcast(room, msg, exceptWs = null) {
  for (const p of room.players) {
    if (p.ws === exceptWs) continue;
    send(p.ws, msg);
  }
}

export function addChatMessage(room, msg) {
  room.chat.push(msg);
  if (room.chat.length > 200) room.chat.shift();
}

export function roomCount() { return rooms.size; }

export function getAllRooms() { return rooms; }

// پاکسازی اتاق‌های idle (بیشتر از ۳۰ دقیقه)
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    if (now - room.createdAt > 30 * 60 * 1000) {
      rooms.delete(code);
      console.log(`[rooms] cleanup ${code}`);
    }
  }
}, 5 * 60 * 1000);
