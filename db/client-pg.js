import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  host: process.env.PGHOST || '127.0.0.1',
  port: parseInt(process.env.PGPORT || '5432', 10),
  user: process.env.PGUSER || 'angel',
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE || 'angel_db',
  max: 10,
  idleTimeoutMillis: 30000,
});

pool.on('error', (e) => console.error('[pg] pool error:', e.message));

function translateSQL(sql) {
  let s = sql;
  let onConflict = false;

  s = s.replace(/strftime\(\s*'%s'\s*,\s*'now'\s*\)/gi, "(EXTRACT(EPOCH FROM NOW()))::INTEGER");

  if (/INSERT\s+OR\s+IGNORE\s+INTO/i.test(s)) {
    s = s.replace(/INSERT\s+OR\s+IGNORE\s+INTO/gi, 'INSERT INTO');
    onConflict = true;
  }

  s = s.replace(/INTEGER\s+PRIMARY\s+KEY\s+AUTOINCREMENT/gi, 'SERIAL PRIMARY KEY');

  const pragma = s.match(/PRAGMA\s+table_info\(([^)]+)\)/i);
  if (pragma) {
    const table = pragma[1].trim().replace(/['"`]/g, '');
    s = `SELECT column_name AS name FROM information_schema.columns WHERE table_name = '${table}' AND table_schema = 'public'`;
  }

  if (/FROM\s+sqlite_master/i.test(s)) {
    s = s.replace(/SELECT\s+name\s+FROM\s+sqlite_master\s+WHERE\s+type='table'\s+ORDER\s+BY\s+name/i,
      "SELECT tablename AS name FROM pg_tables WHERE schemaname='public' ORDER BY tablename");
  }

  return { sql: s, onConflict };
}

function convertPlaceholders(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => '$' + (++i));
}

export async function query(sql, params = []) {
  const { sql: translated, onConflict } = translateSQL(sql);
  let finalSql = convertPlaceholders(translated);
  if (onConflict) finalSql += ' ON CONFLICT DO NOTHING';

  try {
    const res = await pool.query(finalSql, params);
    return { results: res.rows || [], meta: { rowCount: res.rowCount } };
  } catch (e) {
    console.error('[pg]', e.message, '| sql:', sql.slice(0, 80));
    throw e;
  }
}

export async function queryOne(sql, params = []) {
  const r = await query(sql, params);
  return r.results[0] || null;
}

export async function count(table, where = '', params = []) {
  const sql = `SELECT COUNT(*)::int as c FROM ${table}${where ? ' WHERE ' + where : ''}`;
  const r = await query(sql, params);
  return r.results[0]?.c || 0;
    }
