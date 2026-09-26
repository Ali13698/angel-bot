import * as d1 from './client-d1.js';
import * as pgClient from './client-pg.js';

const DB_TYPE = (process.env.DB_TYPE || 'd1').toLowerCase();
const usePg = DB_TYPE === 'postgres' || DB_TYPE === 'pg';

const impl = usePg ? pgClient : d1;

export const query = impl.query;
export const queryOne = impl.queryOne;
export const count = impl.count;

console.log('[db-client] using', usePg ? 'PostgreSQL' : 'D1');
