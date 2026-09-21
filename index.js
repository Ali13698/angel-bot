import { Bot, InlineKeyboard, Keyboard } from "grammy";
import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import { DB, initTables } from "./d1.js";
import { Matchmaker } from "./matchmaking.js";
import { BotPool } from "./bot-pool.js";

const BOT_TOKEN = process.env.token;
const WEBAPP_URL = "https://nomi98.com/";
const PORT = process.env.PORT || 3000;

if (!BOT_TOKEN) {
  console.error("BOT_TOKEN is not set!");
  process.exit(1);
}

const app = express();
app.get("/", (req, res) => res.send("Angel Ludo Server OK"));
app.get("/health", (req, res) => res.json({
  ok: true,
  rooms: rooms.size,
  queue: Matchmaker.size(),
  online: onlineUsers.size
}));

const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer });

const rooms = new Map();
const clients = new Map();
const onlineUsers = new Map();
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

  ws.on("message", async (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    const cbId = msg.cbId;

    try {

    if (msg.type === "ping") { send(ws, { type: "pong" }); return; }

    if (msg.type === "init_user") {
      const tg = msg.user || {};
      if (!tg.id) { send(ws, { type: "response", cbId, ok: false, error: "شناسه نامعتبر" }); return; }
      const u = await DB.upsertUser(tg);
      if (!u.display_name && tg.first_name) await DB.setDisplayName(u.id, tg.first_name);
      if (!u.avatar && tg.photo_url) await DB.setAvatar(u.id, tg.photo_url);
      const fresh = await DB.getUser(u.id);
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
      if (info.code) leaveRoom(ws);

      Matchmaker.add(ws, userId, (type, myEntry, oppEntry) => {
        if (type === 'human') {
          if (myEntry.userId !== userId) return;
          const a = myEntry;
          const b = oppEntry;
          const code = generateCode();
          rooms.set(code, {
            players: [{ ws: a.ws, userId: a.userId }, { ws: b.ws, userId: b.userId }],
            chat: [], gameState: null, createdAt: Date.now()
          });
          clients.get(a.ws).code = code;
          clients.get(b.ws).code = code;
          send(a.ws, { type: "response", cbId: a._cbId, ok: true, code, playerIndex: 0 });
          send(b.ws, { type: "response", cbId: b._cbId, ok: true, code, playerIndex: 1 });
          DB.getUser(b.userId).then(u2 => {
            DB.getUser(a.userId).then(u1 => {
              send(a.ws, { type: "match_found", code, playerIndex: 0, opponent: publicUser(u2) });
              send(b.ws, { type: "match_found", code, playerIndex: 1, opponent: publicUser(u1) });
            });
          });
        } else if (type === 'bot') {
          const bot = oppEntry;
          const humanWs = myEntry.ws;
          const humanId = myEntry.userId;
          const code = generateCode();
          rooms.set(code, {
            players: [{ ws: humanWs, userId: humanId }],
            chat: [], gameState: null,
            createdAt: Date.now(),
            botOpponent: bot, botId: bot.id
          });
          clients.get(humanWs).code = code;
          send(humanWs, {
            type: "match_found", code, playerIndex: 0,
            opponent: {
              id: bot.id, name: bot.name, avatar: bot.avatar,
              wins: bot.wins, losses: bot.losses, level: bot.level, isBot: true
            }
          });
        }
      });

      const entry = Matchmaker.queue.find(x => x.ws === ws);
      if (entry) entry._cbId = cbId;
      send(ws, { type: "response", cbId, ok: true, queued: true });
      return;
    }

    if (msg.type === "cancel_match") {
      Matchmaker.remove(ws);
      send(ws, { type: "response", cbId, ok: true });
      return;
    }

    if (msg.type === "leave_room") {
      if (info.code) leaveRoom(ws);
      send(ws, { type: "response", cbId, ok: true });
      return;
    }

    if (msg.type === "create_room") {
      if (info.code) leaveRoom(ws);
      let code;
      do { code = generateCode(); } while (rooms.has(code));
      rooms.set(code, {
        players: [{ ws, userId }],
        chat: [], gameState: null, createdAt: Date.now()
      });
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
      const p1 = await DB.getUser(room.players[0].userId);
      const p2 = await DB.getUser(userId);
      send(room.players[0].ws, { type: "match_found", code, playerIndex: 0, opponent: publicUser(p2) });
      send(ws, { type: "match_found", code, playerIndex: 1, opponent: publicUser(p1) });
      if (room.chat.length) send(ws, { type: "chat_history", messages: room.chat });
      return;
    }

    if (msg.type === "invite_friend") {
      const targetWs = onlineUsers.get(msg.friendId);
      if (!targetWs) { send(ws, { type: "response", cbId, ok: false, error: "این کاربر آنلاین نیست" }); return; }
      const inviteId = generateInviteId();
      pendingInvites.set(inviteId, { from: userId, to: msg.friendId, createdAt: Date.now() });
      const fromUser = await DB.getUser(userId);
      send(targetWs, { type: "friend_invite", inviteId, from: publicUser(fromUser) });
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
        if (fromWs) {
          const u = await DB.getUser(userId);
          send(fromWs, { type: "invite_declined", by: publicUser(u) });
        }
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
      const u1 = await DB.getUser(inv.from);
      const u2 = await DB.getUser(inv.to);
      send(fromWs, { type: "match_found", code, playerIndex: 0, opponent: publicUser(u2) });
      send(ws, { type: "match_found", code, playerIndex: 1, opponent: publicUser(u1) });
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
      if (!room) return;
      const winner = msg.winnerId;
      if (room.botOpponent) {
        const botId = room.botId;
        const humanId = room.players[0].userId;
        if (winner === humanId) { await DB.addWin(humanId, 10, 20); BotPool.recordLoss(botId); }
        else if (winner === botId) { await DB.addLoss(humanId, 2, 5); BotPool.recordWin(botId); }
        await DB.recordMatch(info.code, humanId, 0, winner);
        BotPool.release(botId);
        return;
      }
      if (room.players.length < 2) return;
      const loser = room.players.find(p => p.userId !== winner);
      const winnerP = room.players.find(p => p.userId === winner);
      if (winnerP) await DB.addWin(winnerP.userId, 10, 20);
      if (loser) await DB.addLoss(loser.userId, 2, 5);
      await DB.recordMatch(info.code, room.players[0].userId, room.players[1].userId, winner);
      return;
    }

    if (msg.type === "get_friends") {
      const friends = await DB.getFriends(userId);
      const requests = await DB.getPendingRequests(userId);
      send(ws, { type: "response", cbId, ok: true, friends, requests });
      return;
    }
    if (msg.type === "add_friend") {
      const target = await DB.getUserByUsername((msg.username || "").replace("@", ""));
      if (!target) { send(ws, { type: "response", cbId, ok: false, error: "کاربر پیدا نشد" }); return; }
      const result = await DB.sendFriendRequest(userId, target.id);
      if (result.ok && !result.autoAccepted) {
        const tWs = onlineUsers.get(target.id);
        if (tWs) {
          const me = await DB.getUser(userId);
          send(tWs, { type: "friend_request", from: publicUser(me) });
        }
      }
      send(ws, { type: "response", cbId, ok: result.ok, error: result.error, autoAccepted: result.autoAccepted });
      return;
    }
    if (msg.type === "accept_friend") {
      await DB.acceptFriendRequest(userId, msg.friendId);
      const fWs = onlineUsers.get(msg.friendId);
      if (fWs) {
        const me = await DB.getUser(userId);
        send(fWs, { type: "friend_accepted", by: publicUser(me) });
      }
      send(ws, { type: "response", cbId, ok: true });
      return;
    }
    if (msg.type === "remove_friend") {
      await DB.removeFriend(userId, msg.friendId);
      send(ws, { type: "response", cbId, ok: true });
      return;
    }
    if (msg.type === "search_users") {
      const users = await DB.searchUsers(msg.query || "", userId);
      send(ws, { type: "response", cbId, ok: true, users });
      return;
    }
    if (msg.type === "get_leaderboard") {
      const leaderboard = await DB.getLeaderboard(20);
      send(ws, { type: "response", cbId, ok: true, leaderboard });
      return;
    }
    if (msg.type === "get_me") {
      const u = await DB.getUser(userId);
      send(ws, { type: "response", cbId, ok: true, user: publicUser(u), raw: u });
      return;
    }
    if (msg.type === "set_avatar") { await DB.setAvatar(userId, msg.avatar); send(ws, { type: "response", cbId, ok: true }); return; }
    if (msg.type === "set_name") { await DB.setDisplayName(userId, String(msg.name || "").slice(0, 20)); send(ws, { type: "response", cbId, ok: true }); return; }

    } catch (err) {
      console.error("[ws] handler error:", err);
      send(ws, { type: "response", cbId, ok: false, error: "خطای داخلی سرور" });
    }
  });

  ws.on("close", () => {
    const info = clients.get(ws);
    if (info) {
      Matchmaker.remove(ws);
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
  if (room) {
    broadcast(room, { type: "opponent_left" }, ws);
    if (room.botId) BotPool.release(room.botId);
    rooms.delete(info.code);
  }
  info.code = null;
}

setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    if (room.players.length === 0 || now - room.createdAt > 30 * 60 * 1000) {
      if (room.botId) BotPool.release(room.botId);
      rooms.delete(code);
    }
  }
  for (const [id, inv] of pendingInvites) { if (now - inv.createdAt > 5 * 60 * 1000) pendingInvites.delete(id); }
}, 60 * 1000);

httpServer.listen(PORT, () => console.log("Server on port " + PORT));

const bot = new Bot(BOT_TOKEN);

bot.command("start", async (ctx) => {
  const kb = new InlineKeyboard().webApp("🎮 بازی آنجل", WEBAPP_URL);
  const replyKb = new Keyboard()
    .text("🎮 شروع بازی")
    .resized()
    .persistent();
  await ctx.reply(
    "🧚 سلام! به ربات آنجل خوش اومدی.\n\nبرای شروع روی دکمه زیر بزن 👇",
    { reply_markup: replyKb }
  );
  await ctx.reply(
    "🎲 برای باز کردن بازی، روی دکمه زیر کلیک کن:",
    { reply_markup: kb }
  );
});

bot.hears("🎮 شروع بازی", async (ctx) => {
  const kb = new InlineKeyboard().webApp("🎮 بازی آنجل", WEBAPP_URL);
  await ctx.reply("🎲 بازی رو باز کن:", { reply_markup: kb });
});

bot.command("help", async (ctx) => {
  await ctx.reply("دستورات:\n/start - شروع\n/help - راهنما\n\n🎮 روی دکمه «شروع بازی» پایین صفحه بزن تا بازی باز شه.");
});

bot.catch((err) => console.error("Bot error:", err));

(async () => {
  try {
    await initTables();
    console.log("[init] D1 tables ready");
  } catch (e) {
    console.error("[init] D1 init failed:", e);
  }
  bot.start({ onStart: (info) => console.log(`Bot @${info.username} started!`) });
})();
