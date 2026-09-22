import * as users from './users.js';
import * as coins from './coins.js';
import * as stats from './stats.js';
import * as economy from './economy.js';
import * as social from './social.js';
import * as moderation from './moderation.js';
import * as client from './client.js';
import { initTables } from './schema.js';

export const DB = {
  query: client.query,
  queryOne: client.queryOne,
  count: client.count,
  users,
  coins,
  stats,
  economy,
  social,
  moderation,
  initTables
};

export { initTables };
