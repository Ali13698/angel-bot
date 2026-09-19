import { Bot, InlineKeyboard } from "grammy";
import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";

// ⚠️ از متغیر محیطی Runflare خونده میشه
const BOT_TOKEN = process.env.bot || process.env.BOT_TOKEN;
const WEBAPP_URL = "https://ali13698.github.io/ludo/";
const PORT = process.env.PORT || 3000;

if (!BOT_TOKEN) {
  console.error("BOT_TOKEN is not set!");
  process.exit(1);
}

// ============ EXPRESS ============
const app = express();
app.get("/", (req, res) => res.send("Angel Ludo Server OK"));
app.get("/health", (req, res) => res.json({ ok: true, rooms: rooms.size }));

const httpServer = createServer(app);

// ============ WEBSOCKET ============
const wss = new WebSocketServer({ server: httpServer });

const rooms = new Map();
const clients = new Map();

function generateCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function send(ws, obj) {
  if (ws && ws.readyState === 1) {
    try { ws.send(JSON.stringify(obj)); } catch (e) {}
  }
}

function broadcast(room, obj, except) {
  for (const p of room.players) {
    if (p !== except) send(p, obj);
  }
}

wss.on("connection", (ws) => {
  console.log("[ws] connected");

  ws.on("message", (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    const cbId = msg.cbId;

    if (msg.type === "create_room") {
      let code;
      do { code = generateCode(); } while (rooms.has(code));
      rooms.set(code, { players: [ws], chat: [], state: null });
      clients.set(ws, { code, playerIndex: 0 });
      send(ws, { type: "response", cbId, ok: true, code, playerIndex: 0 });
      console.log("[room] created:", code);
    }

    else if (msg.type === "join_room") {
      const code = (msg.code || "").toUpperCase();
      const room = rooms.get(code);
      if (!room) { send(ws, { type: "response", cbId, ok: false, error: "اتاق پیدا نشد" }); return; }
      if (room.players.length >= 2) { send(ws, { type: "response", cbId, ok: false, error: "اتاق پر است" }); return; }
      room.players.push(ws);
      clients.set(ws, { code, playerIndex: 1 });
      send(ws, { type: "response", cbId, ok: true, code, playerIndex: 1 });
      send(room.players[0], { type: "opponent_joined" });
      if (room.chat.length) send(ws, { type: "chat_history", messages: room.chat });
      console.log("[room] joined:", code);
    }

    else if (msg.type === "game_action") {
      const info = clients.get(ws);
      if (!info) return;
      const room = rooms.get(info.code);
      if (!room) return;
      broadcast(room, { type: "game_action", data: msg.data, from: info.playerIndex }, ws);
    }

    else if (msg.type === "chat_message") {
      const info = clients.get(ws);
      if (!info) return;
      const room = rooms.get(info.code);
      if (!room) return;
      const chatMsg = {
        from: info.playerIndex,
        text: String(msg.text || "").slice(0, 300),
        ts: Date.now()
      };
      room.chat.push(chatMsg);
      if (room.chat.length > 100) room.chat.shift();
      for (const p of room.players) send(p, { type: "chat_message", message: chatMsg });
    }

    else if (msg.type === "emoji") {
      const info = clients.get(ws);
      if (!info) return;
      const room = rooms.get(info.code);
      if (!room) return;
      broadcast(room, { type: "emoji", from: info.playerIndex, emoji: msg.emoji }, ws);
    }

    else if (msg.type === "player_action") {
      const info = clients.get(ws);
      if (!info) return;
      const room = rooms.get(info.code);
      if (!room) return;
      broadcast(room, { type: "player_action", from: info.playerIndex, action: msg.action }, ws);
    }
  });

  ws.on("close", () => {
    const info = clients.get(ws);
    if (info) {
      const room = rooms.get(info.code);
      if (room) {
        broadcast(room, { type: "opponent_left" }, ws);
        rooms.delete(info.code);
        console.log("[room] closed:", info.code);
      }
      clients.delete(ws);
    }
  });
});

httpServer.listen(PORT, () => console.log("Server on port " + PORT));

// ============ TELEGRAM BOT ============
const bot = new Bot(BOT_TOKEN);

bot.command("start", async (ctx) => {
  const kb = new InlineKeyboard().webApp("🎲 بازی منچ", WEBAPP_URL);
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
