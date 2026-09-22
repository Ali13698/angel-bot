import { clients } from '../state.js';
import { replyOk, replyErr } from '../utils.js';
import { DB } from '../../db/index.js';

// ============ SHOP LIST ============
export async function getShop(ws, msg) {
  const info = clients.get(ws);
  if (!info) return replyErr(ws, msg.cbId, 'ابتدا init کنید');

  const items = await DB.shop.getShopItems();
  const inventory = await DB.shop.getInventory(info.userId);
  const ownedIds = new Set(inventory.map(i => i.item_id));

  const list = items.map(it => ({
    ...it,
    owned: ownedIds.has(it.item_id),
    equipped: inventory.find(i => i.item_id === it.item_id)?.equipped === 1
  }));

  replyOk(ws, msg.cbId, { items: list });
}

// ============ BUY ITEM ============
export async function buyItem(ws, msg) {
  const info = clients.get(ws);
  if (!info) return replyErr(ws, msg.cbId, 'ابتدا init کنید');

  const itemId = String(msg.itemId || '').trim();
  if (!itemId) return replyErr(ws, msg.cbId, 'شناسه آیتم خالی');

  const r = await DB.shop.buyItem(info.userId, itemId);
  replyOk(ws, msg.cbId, r);
}

// ============ EQUIP ITEM ============
export async function equipItem(ws, msg) {
  const info = clients.get(ws);
  if (!info) return replyErr(ws, msg.cbId, 'ابتدا init کنید');

  const itemId = String(msg.itemId || '').trim();
  if (!itemId) return replyErr(ws, msg.cbId, 'شناسه آیتم خالی');

  const r = await DB.shop.equipItem(info.userId, itemId);
  replyOk(ws, msg.cbId, r);
}

// ============ INVENTORY ============
export async function getInventory(ws, msg) {
  const info = clients.get(ws);
  if (!info) return replyErr(ws, msg.cbId, 'ابتدا init کنید');

  const inventory = await DB.shop.getInventory(info.userId);
  const equipped = await DB.shop.getEquipped(info.userId);
  replyOk(ws, msg.cbId, { inventory, equipped });
}

// ============ MY EQUIPPED ============
export async function getEquipped(ws, msg) {
  const info = clients.get(ws);
  if (!info) return replyErr(ws, msg.cbId, 'ابتدا init کنید');

  const equipped = await DB.shop.getEquipped(info.userId);
  replyOk(ws, msg.cbId, { equipped });
}

// ============ LEADERBOARDS ============
export async function getLeaderboard(ws, msg) {
  const type = String(msg.type || 'global').slice(0, 16);
  const gameId = String(msg.gameId || 'ludo').slice(0, 32);

  let list = [];
  if (type === 'global') {
    list = await DB.stats.getGlobalLeaderboard(20);
  } else if (type === 'game') {
    list = await DB.stats.getGameLeaderboard(gameId, 20);
  } else if (type === 'liked') {
    list = await DB.social.getTopLiked(20);
  }

  replyOk(ws, msg.cbId, { list, type, gameId });
}

// ============ GAME CONFIG ============
export async function getGames(ws, msg) {
  const r = await DB.query(`SELECT * FROM game_config WHERE is_active = 1`);
  replyOk(ws, msg.cbId, { games: r.results });
}
