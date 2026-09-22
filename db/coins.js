import { query, queryOne } from './client.js';

export async function getCoins(userId) {
  const r = await queryOne(`SELECT coins FROM users WHERE id = ?`, [userId]);
  return r ? r.coins : 0;
}

export async function addCoins(userId, amount, reason = 'manual', meta = null) {
  await query(`UPDATE users SET coins = coins + ? WHERE id = ?`, [amount, userId]);
  await query(
    `INSERT INTO transactions (user_id, amount, reason, meta) VALUES (?, ?, ?, ?)`,
    [userId, amount, reason, meta]
  );
  return await getCoins(userId);
}

export async function spendCoins(userId, amount, reason = 'purchase') {
  const me = await queryOne(`SELECT coins FROM users WHERE id = ?`, [userId]);
  if (!me) return { ok: false, error: 'کاربر پیدا نشد' };
  if (me.coins < amount) return { ok: false, error: 'سکه کافی نیست' };

  await query(`UPDATE users SET coins = coins - ? WHERE id = ?`, [amount, userId]);
  await query(
    `INSERT INTO transactions (user_id, amount, reason) VALUES (?, ?, ?)`,
    [userId, -amount, reason]
  );
  return { ok: true, coins: me.coins - amount };
}

export async function getTransactions(userId, limit = 30) {
  const r = await query(
    `SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`,
    [userId, limit]
  );
  return r.results;
}

export async function getBalanceSummary(userId) {
  const [totalIn, totalOut] = await Promise.all([
    queryOne(`SELECT COALESCE(SUM(amount),0) as s FROM transactions WHERE user_id = ? AND amount > 0`, [userId]),
    queryOne(`SELECT COALESCE(SUM(amount),0) as s FROM transactions WHERE user_id = ? AND amount < 0`, [userId])
  ]);
  return {
    totalEarned: totalIn ? totalIn.s : 0,
    totalSpent: Math.abs(totalOut ? totalOut.s : 0)
  };
}
