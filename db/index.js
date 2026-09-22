import * as users from './users.js';
import * as coins from './coins.js';
import * as stats from './stats.js';
import * as economy from './economy.js';
import * as social from './social.js';
import * as moderation from './moderation.js';
import * as shop from './shop.js';
import * as chat from './chat.js';
import * as client from './client.js';
import { initTables } from './schema.js';

export const DB = {
  // raw client
  query: client.query,
  queryOne: client.queryOne,
  count: client.count,

  // modules
  users,
  coins,
  stats,
  economy,
  social,
  moderation,
  shop,
  chat,

  // init
  initTables
};

export { initTables };
