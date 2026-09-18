import { Bot, InlineKeyboard } from "grammy";
import express from "express";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";

const BOT_TOKEN = "8880600009:AAH3BnAlcdaHfBoHYybqtA8rRIndwg3_O6s";
const WEBAPP_URL = "https://ali13698.github.io/ludo/";
const PORT = process.env.PORT || 3000;

const app = express();
app.get("/", (req, res) => res.send("Angel Ludo Server OK"));

const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

const rooms = new Map();

function generateCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

io.on("connection", (socket) => {
  console.log("[socket] connected:", socket.id);

  socket.on("create_room", (_, cb) => {
    let code;
    do { code = generateCode(); } while (rooms.has(code));
    rooms.set(code, { players: [socket.id] });
    socket.join(code);
    socket.data.roomCode = code;
    console.log("[room] created:", code);
    if (cb) cb({ ok: true, code, playerIndex: 0 });
  });

  socket.on("join_room", ({ code }, cb) => {
    code = (code || "").toUpperCase();
    const room = rooms.get(code);
    if (!room) return cb && cb({ ok: false, error: "اتاق پیدا نشد" });
    if (room.players.length >= 2) return cb && cb({ ok: false, error: "اتاق پر است" });
    room.players.push(socket.id);
    socket.join(code);
    socket.data.roomCode = code;
    io.to(code).emit("opponent_joined");
    console.log("[room] joined:", code);
    if (cb) cb({ ok: true, code, playerIndex: 1 });
  });

  socket.on("game_action", (payload) => {
    const code = socket.data.roomCode;
    if (!code) return;
    socket.to(code).emit("game_action", payload);
  });

  socket.on("disconnect", () => {
    const code = socket.data.roomCode;
    if (code && rooms.has(code)) {
      socket.to(code).emit("opponent_left");
      rooms.delete(code);
      console.log("[room] closed:", code);
    }
  });
});

httpServer.listen(PORT, () => console.log("Server on port " + PORT));

const bot = new Bot(BOT_TOKEN);

bot.command("start", async (ctx) => {
  const kb = new InlineKeyboard().webApp("🎲 بازی منچ", WEBAPP_URL);
  await ctx.reply(
    "🐋 سلام! به ربات آنجل خوش اومدی.\n\nبرای شروع بازی روی دکمه زیر بزن 👇",
    { reply_markup: kb }
  );
});

bot.command("help", async (ctx) => {
  await ctx.reply("دستورات:\n/start - شروع\n/help - راهنما");
});

bot.catch((err) => console.error("Bot error:", err));

bot.start({ onStart: (info) => console.log(`Bot @${info.username} started!`) });
