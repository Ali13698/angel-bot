import { query, queryOne } from './client.js';
import { spendCoins } from './coins.js';

// ============ CATALOG ============
export async function getShopItems() {
  const r = await query(
    `SELECT * FROM shop_items WHERE is_active = 1 ORDER BY item_type, price_coins`
  );
  return r.results;
}

export async function getShopItemsByType(type) {
  const r = await query(
    `SELECT * FROM shop_items WHERE is_active = 1 AND item_type = ? ORDER BY price_coins`,
    [type]
  );
  return r.results;
}

export async function getShopItem(itemId) {
  return await queryOne(`SELECT * FROM shop_items WHERE item_id = ?`, [itemId]);
}

// ============ BUY ============
export async function buyItem(userId, itemId) {
  const item = await getShopItem(itemId);
  if (!item) return { ok: false, error: 'آیتم پیدا نشد' };

  const inv = await queryOne(
    `SELECT id FROM inventory WHERE user_id = ? AND item_id = ?`,
    [userId, itemId]
  );
  if (inv) return { ok: false, error: 'قبلاً خریداری شده' };

  const sp = await spendCoins(userId, item.price_coins, 'buy:' + itemId);
  if (!sp.ok) return { ok: false, error: sp.error };

  await query(
    `INSERT INTO inventory (user_id, item_id, item_type, equipped) VALUES (?, ?, ?, 1)`,
    [userId, itemId, item.item_type]
  );

  // آن‌اکیپ بقیه آیتم‌های هم‌نوع
  await query(
    `UPDATE inventory SET equipped = 0
     WHERE user_id = ? AND item_type = ? AND item_id != ?`,
    [userId, item.item_type, itemId]
  );

  await applyEquip(userId, item);

  return { ok: true, coins: sp.coins, item };
}

export async function applyEquip(userId, item) {
  if (item.item_type === 'banner') {
    await query(`UPDATE users SET profile_banner = ? WHERE id = ?`, [item.item_id, userId]);
  } else if (item.item_type === 'profile_color') {
    await query(`UPDATE users SET profile_color = ? WHERE id = ?`, [item.preview, userId]);
  } else if (item.item_type === 'name_effect') {
    await query(`UPDATE users SET name_effect = ? WHERE id = ?`, [item.item_id, userId]);
  }
}

// ============ EQUIP ============
export async function equipItem(userId, itemId) {
  const item = await getShopItem(itemId);
  if (!item) return { ok: false, error: 'آیتم نیست' };

  const inv = await queryOne(
    `SELECT id FROM inventory WHERE user_id = ? AND item_id = ?`,
    [userId, itemId]
  );
  if (!inv) return { ok: false, error: 'این آیتم رو نداری' };

  await query(
    `UPDATE inventory SET equipped = 0 WHERE user_id = ? AND item_type = ?`,
    [userId, item.item_type]
  );
  await query(
    `UPDATE inventory SET equipped = 1 WHERE user_id = ? AND item_id = ?`,
    [userId, itemId]
  );

  await applyEquip(userId, item);
  return { ok: true };
}

// ============ INVENTORY ============
export async function getInventory(userId) {
  const r = await query(
    `SELECT i.*, s.name_fa, s.preview, s.meta, s.price_coins, s.is_premium
     FROM inventory i
     JOIN shop_items s ON s.item_id = i.item_id
     WHERE i.user_id = ?
     ORDER BY i.acquired_at DESC`,
    [userId]
  );
  return r.results;
}

export async function getEquipped(userId) {
  const r = await query(
    `SELECT i.item_id, i.item_type, i.equipped,
            s.name_fa, s.preview, s.meta
     FROM inventory i
     JOIN shop_items s ON s.item_id = i.item_id
     WHERE i.user_id = ? AND i.equipped = 1`,
    [userId]
  );
  return r.results;
}

export async function getEquippedByType(userId, type) {
  const r = await queryOne(
    `SELECT i.item_id, s.preview, s.meta
     FROM inventory i
     JOIN shop_items s ON s.item_id = i.item_id
     WHERE i.user_id = ? AND i.item_type = ? AND i.equipped = 1
     LIMIT 1`,
    [userId, type]
  );
  return r;
}

export async function hasItem(userId, itemId) {
  const r = await queryOne(
    `SELECT 1 FROM inventory WHERE user_id = ? AND item_id = ? LIMIT 1`,
    [userId, itemId]
  );
  return !!r;
    }
