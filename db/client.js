import { CF_TOKEN, CF_ACCOUNT, CF_DB } from '../config.js';

const API_URL = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/d1/database/${CF_DB}/query`;

export async function query(sql, params = []) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CF_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ sql, params })
  });
  const data = await res.json();
  if (!data.success) {
    const msg = data.errors?.[0]?.message || 'D1 error';
    console.error('[d1]', msg, '| sql:', sql.slice(0, 80));
    throw new Error(msg);
  }
  const r = data.result?.[0] || {};
  return { results: r.results || [], meta: r.meta || {} };
}

export async function queryOne(sql, params = []) {
  const r = await query(sql, params);
  return r.results[0] || null;
}

export async function count(table, where = '', params = []) {
  const sql = `SELECT COUNT(*) as c FROM ${table}${where ? ' WHERE ' + where : ''}`;
  const r = await query(sql, params);
  return r.results[0]?.c || 0;
}
