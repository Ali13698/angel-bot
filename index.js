import { Bot, InlineKeyboard } from "grammy";
import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import { DB } from "./db.js";

const BOT_TOKEN = "8880600009:AAHZfl9oP8II9RBuWeAiACsyPU6zHRQNp-k";
const WEBAPP_URL = "https://ali13698.github.io/ludo/";
const PORT = process.env.PORT || 3000;

if (!BOT_TOKEN) {
  console.error("BOT_TOKEN is not set!");
  process.exit(1);
}

// ============ EXPRESS ============
const app = express();
app.get("/", (req, res) => res.send("Angel Ludo Server OK"));
app.get("/health", (req, res) => res.json({ ok: true, rooms: rooms.size, queue: matchQueue.length, online: onlineUsers.size }));

const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer });

const rooms = new Map();
const clients = new Map();
const onlineUsers = new Map();
const matchQueue = [];
const pendingInvites = new Map();

function generateCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}
function generateInviteId() {
  return Math.random().toString(36).substring(2, 10);
}
function send(ws, obj) {
  if (ws && ws.readyState === 1) { try { ws.send(JSON.stringify(obj)); } catch (e) {} }
}
function broadcast(room, obj, except) {
  for (const p of room.players) { if (p.ws !== except) send(p.ws, obj); }
}
function getRoom(code) { return rooms.get(code); }
function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    name: u.display_name || u.first_name || u.username || ('User' + u.id),
    username: u.username,
    avatar: u.avatar || u.photo_url || null,
    wins: u.wins, losses: u.losses, level: u.level
  };
}

wss.on("connection", (ws) => {
  console.log("[ws] connected");

  ws.on("message", (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    const cbId = msg.cbId;

    if (msg.type === "ping") { send(ws, { type: "pong" }); return; }

    if (msg.type === "init_user") {
      const tg = msg.user || {};
      if (!tg.id) { send(ws, { type: "response", cbId, ok: false, error: "شناسه نامعتبر" }); return; }
      const u = DB.upsertUser(tg);
      if (!u.display_name && tg.first_name) DB.setDisplayName(u.id, tg.first_name);
      if (!u.avatar && tg.photo_url) DB.setAvatar(u.id, tg.photo_url);
      const fresh = DB.getUser(u.id);
      clients.set(ws, { userId: u.id, code: null });
      onlineUsers.set(u.id, ws);
      send(ws, { type: "response", cbId, ok: true, user: publicUser(fresh) });
      console.log("[user] init:", u.id);
      return;
    }

    const info = clients.get(ws);
    if (!info) { send(ws, { type: "response", cbId, ok: false, error: "ابتدا init کنید" }); return; }
    const userId = info.userId;

    if (msg.type === "quick_match") {
      const eIdx = matchQueue.findIndex(x => x.ws === ws);
      if (eIdx >= 0) matchQueue.splice(eIdx, 1);
      if (info.code) leaveRoom(ws);

      if (matchQueue.length > 0) {
        const opp = matchQueue.shift();
        if (opp.ws.readyState !== 1) {
          matchQueue.push({ ws, userId, joinedAt: Date.now() });
          send(ws, { type: "response", cbId, ok: true, queued: true });
          return;
        }
        const code = generateCode();
        rooms.set(code, {
          players: [{ ws: opp.ws, userId: opp.userId }, { ws, userId }],
          chat: [], gameState: null, createdAt: Date.now()
        });
        clients.get(opp.ws).code = code;
        info.code = code;
        send(ws, { type: "response", cbId, ok: true, code, playerIndex: 1 });
        send(opp.ws, { type: "match_found", code, playerIndex: 0, opponent: publicUser(DB.getUser(userId)) });
        send(ws, { type: "match_found", code, playerIndex: 1, opponent: publicUser(DB.getUser(opp.userId)) });
        console.log("[match] found:", code);
      } else {
        matchQueue.push({ ws, userId, joinedAt: Date.now() });
        send(ws, { type: "response", cbId, ok: true, queued: true });
        console.log("[match] queued:", userId);
      }
      return;
    }

    if (msg.type === "cancel_match") {
      const idx = matchQueue.findIndex(x => x.ws === ws);
      if (idx >= 0) matchQueue.splice(idx, 1);
      send(ws, { type: "response", cbId, ok: true });
      return;
    }

    if (msg.type === "create_room") {
      if (info.code) leaveRoom(ws);
      let code;
      do { code = generateCode(); } while (rooms.has(code));
      rooms.set(code, { players: [{ ws, userId }], chat: [], gameState: null, createdAt: Date.now() });
      info.code = code;
      send(ws, { type: "response", cbId, ok: true, code, playerIndex: 0 });
      return;
    }

    if (msg.type === "join_room") {
      const code = (msg.code || "").toUpperCase();
      const room = rooms.get(code);
      if (!room) { send(ws, { type: "response", cbId, ok: false, error: "اتاق پیدا نشد" }); return; }
      if (room.players.length >= 2) { send(ws, { type: "response", cbId, ok: false, error: "اتاق پر است" }); return; }
      if (room.players[0].userId === userId) { send(ws, { type: "response", cbId, ok: false, error: "خودت صاحب اتاقی" }); return; }
      if (info.code) leaveRoom(ws);
      room.players.push({ ws, userId });
      info.code = code;
      send(ws, { type: "response", cbId, ok: true, code, playerIndex: 1 });
      send(room.players[0].ws, { type: "match_found", code, playerIndex: 0, opponent: publicUser(DB.getUser(userId)) });
      send(ws, { type: "match_found", code, playerIndex: 1, opponent: publicUser(DB.getUser(room.players[0].userId)) });
      if (room.chat.length) send(ws, { type: "chat_history", messages: room.chat });
      return;
    }

    if (msg.type === "invite_friend") {
      const targetWs = onlineUsers.get(msg.friendId);
      if (!targetWs) { send(ws, { type: "response", cbId, ok: false, error: "این کاربر آنلاین نیست" }); return; }
      const inviteId = generateInviteId();
      pendingInvites.set(inviteId, { from: userId, to: msg.friendId, createdAt: Date.now() });
      send(targetWs, { type: "friend_invite", inviteId, from: publicUser(DB.getUser(userId)) });
      send(ws, { type: "response", cbId, ok: true, inviteId });
      return;
    }

    if (msg.type === "respond_invite") {
      const inv = pendingInvites.get(msg.inviteId);
      if (!inv) { send(ws, { type: "response", cbId, ok: false, error: "دعوت منقضی شده" }); return; }
      if (inv.to !== userId) { send(ws, { type: "response", cbId, ok: false, error: "این دعوت برای تو نیست" }); return; }
      pendingInvites.delete(msg.inviteId);

      if (!msg.accept) {
        const fromWs = onlineUsers.get(inv.from);
        if (fromWs) send(fromWs, { type: "invite_declined", by: publicUser(DB.getUser(userId)) });
        send(ws, { type: "response", cbId, ok: true });
        return;
      }

      const fromWs = onlineUsers.get(inv.from);
      if (!fromWs) { send(ws, { type: "response", cbId, ok: false, error: "فرستنده آفلاین شد" }); return; }
      if (info.code) leaveRoom(ws);
      const info2 = clients.get(fromWs);
      if (info2 && info2.code) leaveRoom(fromWs);

      const code = generateCode();
      rooms.set(code, {
        players: [{ ws: fromWs, userId: inv.from }, { ws, userId: inv.to }],
        chat: [], gameState: null, createdAt: Date.now()
      });
      clients.get(fromWs).code = code;
      info.code = code;
      send(fromWs, { type: "match_found", code, playerIndex: 0, opponent: publicUser(DB.getUser(inv.to)) });
      send(ws, { type: "match_found", code, playerIndex: 1, opponent: publicUser(DB.getUser(inv.from)) });
      send(ws, { type: "response", cbId, ok: true, code });
      return;
    }

    if (msg.type === "game_action") {
      const room = getRoom(info.code);
      if (!room) return;
      broadcast(room, { type: "game_action", data: msg.data }, ws);
      return;
    }

    if (msg.type === "chat_message") {
      const room = getRoom(info.code);
      if (!room) return;
      const text = String(msg.text || "").slice(0, 300);
      if (!text) return;
      const cm = { from: userId, text, ts: Date.now() };
      room.chat.push(cm);
      if (room.chat.length > 100) room.chat.shift();
      for (const p of room.players) send(p.ws, { type: "chat_message", message: cm });
      return;
    }

    if (msg.type === "emoji") {
      const room = getRoom(info.code);
      if (!room) return;
      broadcast(room, { type: "emoji", from: userId, emoji: msg.emoji }, ws);
      return;
    }

    if (msg.type === "game_ended") {
      const room = getRoom(info.code);
      if (!room || room.players.length < 2) return;
      const winner = msg.winnerId;
      const loser = room.players.find(p => p.userId !== winner);
      const winnerP = room.players.find(p => p.userId === winner);
      if (winnerP) DB.addWin(winnerP.userId, 10, 20);
      if (loser) DB.addLoss(loser.userId, 2, 5);
      DB.recordMatch(info.code, room.players[0].userId, room.players[1].userId, winner);
      return;
    }

    if (msg.type === "get_friends") {
      send(ws, { type: "response", cbId, ok: true, friends: DB.getFriends(userId), requests: DB.getPendingRequests(userId) });
      return;
    }
    if (msg.type === "add_friend") {
      const target = DB.getUserByUsername((msg.username || "").replace("@",""));
      if (!target) { send(ws, { type: "response", cbId, ok: false, error: "کاربر پیدا نشد" }); return; }
      const result = DB.sendFriendRequest(userId, target.id);
      if (result.ok && !result.autoAccepted) {
        const tWs = onlineUsers.get(target.id);
        if (tWs) send(tWs, { type: "friend_request", from: publicUser(DB.getUser(userId)) });
      }
      send(ws, { type: "response", cbId, ok: result.ok, error: result.error, autoAccepted: result.autoAccepted });
      return;
    }
    if (msg.type === "accept_friend") {
      DB.acceptFriendRequest(userId, msg.friendId);
      const fWs = onlineUsers.get(msg.friendId);
      if (fWs) send(fWs, { type: "friend_accepted", by: publicUser(DB.getUser(userId)) });
      send(ws, { type: "response", cbId, ok: true });
      return;
    }
    if (msg.type === "remove_friend") {
      DB.removeFriend(userId, msg.friendId);
      send(ws, { type: "response", cbId, ok: true });
      return;
    }
    if (msg.type === "search_users") {
      send(ws, { type: "response", cbId, ok: true, users: DB.searchUsers(msg.query || "", userId) });
      return;
    }
    if (msg.type === "get_leaderboard") {
      send(ws, { type: "response", cbId, ok: true, leaderboard: DB.getLeaderboard(20) });
      return;
    }
    if (msg.type === "get_me") {
      const u = DB.getUser(userId);
      send(ws, { type: "response", cbId, ok: true, user: publicUser(u), raw: u });
      return;
    }
    if (msg.type === "set_avatar") { DB.setAvatar(userId, msg.avatar); send(ws, { type: "response", cbId, ok: true }); return; }
    if (msg.type === "set_name") { DB.setDisplayName(userId, String(msg.name || "").slice(0, 20)); send(ws, { type: "response", cbId, ok: true }); return; }
  });

  ws.on("close", () => {
    const info = clients.get(ws);
    if (info) {
      const qIdx = matchQueue.findIndex(x => x.ws === ws);
      if (qIdx >= 0) matchQueue.splice(qIdx, 1);
      if (info.code) leaveRoom(ws);
      onlineUsers.delete(info.userId);
      clients.delete(ws);
    }
  });
});

function leaveRoom(ws) {
  const info = clients.get(ws);
  if (!info || !info.code) return;
  const room = rooms.get(info.code);
  if (room) { broadcast(room, { type: "opponent_left" }, ws); rooms.delete(info.code); }
  info.code = null;
}

setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    if (room.players.length === 0 || now - room.createdAt > 30 * 60 * 1000) rooms.delete(code);
  }
  for (const [id, inv] of pendingInvites) { if (now - inv.createdAt > 5 * 60 * 1000) pendingInvites.delete(id); }
  for (let i = matchQueue.length - 1; i >= 0; i--) { if (now - matchQueue[i].joinedAt > 5 * 60 * 1000) matchQueue.splice(i, 1); }
}, 60 * 1000);

httpServer.listen(PORT, () => console.log("Server on port " + PORT));

// ============ TELEGRAM BOT ============
const bot = new Bot(BOT_TOKEN);

bot.command("start", async (ctx) => {
  const kb = new InlineKeyboard().webApp("🎲 بازی آنجل", WEBAPP_URL);
  await ctx.reply(
    "🧚 سلام! به ربات آنجل خوش اومدی.\n\nبرای شروع بازی روی دکمه زیر بزن 👇",
    { reply_markup: kb }
  );
});

bot.command("help", async (ctx) => {
  await ctx.reply("دستورات:\n/start - شروع\n/help - راهنما");
});

bot.catch((err) => console.error("Bot error:", err));

bot.start({ onStart: (info) => console.log(`Bot @${info.username} started!`) });
