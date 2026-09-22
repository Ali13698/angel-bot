// نقطه ورود واحد به لایه دیتابیس
// هر جایی که DB لازم داری، این رو import کن:
//   import { DB } from '../db/index.js';
//   await DB.users.getUser(id);

import * as users from './users.js';
import * as coins from './coins.js';
import * as stats from './stats.js';
import * as client from './client.js';
import { initTables } from './schema.js';

export const DB = {
  // client
  query: client.query,
  queryOne: client.queryOne,
  count: client.count,

  // users
  users,
  // coins
  coins,
  // stats
  stats,

  // init
  initTables
};

export { initTables };
