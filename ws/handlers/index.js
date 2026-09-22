import { clients } from '../state.js';
import { send } from '../utils.js';

// user
import * as user from './user.js';
// lobby
import * as lobby from './lobby.js';
// game
import * as game from './game.js';
// social
import * as social from './social.js';
// economy
import * as economy from './economy.js';
// shop
import * as shop from './shop.js';

// نقشه: type → [handler, needAuth]
const routes = {
  // --- system ---
  'ping':               [user.ping, false],
  'init_user':          [user.initUser, false],

  // --- user ---
  'get_me':             [user.getMe, true],
  'get_profile':        [user.getProfile, true],
  'set_avatar':         [user.setAvatar, true],
  'set_name':           [user.setName, true],
  'set_game_username':  [user.setGameUsername, true],
  'change_game_username': [user.changeGameUsername, true],

  // --- lobby / match ---
  'quick_match':        [lobby.quickMatch, true],
  'cancel_match':       [lobby.cancelMatch, true],
  'leave_room':         [lobby.leave, true],
  'create_room':        [lobby.createPrivateRoom, true],
  'join_room':          [lobby.joinPrivateRoom, true],
  'invite_friend':      [lobby.inviteFriend, true],
  'respond_invite':     [lobby.respondInvite, true],
  'queue_info':         [lobby.queueInfo, true],

  // --- game ---
  'game_action':        [game.gameAction, true],
  'chat_message':       [game.chatMessage, true],
  'emoji':              [game.emoji, true],
  'report_message':     [game.reportMessage, true],
  'game_ended':         [game.gameEnded, true],

  // --- social ---
  'get_friends':        [social.getFriends, true],
  'add_friend':         [social.addFriend, true],
  'accept_friend':      [social.acceptFriend, true],
  'remove_friend':      [social.removeFriend, true],
  'search_users':       [social.searchUsers, true],
  'like_user':          [social.likeUser, true],
  'get_top_liked':      [social.getTopLiked, true],
  'block_user':         [social.blockUser, true],
  'unblock_user':       [social.unblockUser, true],

  // --- economy ---
  'get_referral':       [economy.getReferral, true],
  'get_daily':          [economy.getDaily, true],
  'spin':               [economy.spin, true],
  'redeem_code':        [economy.redeemCode, true],
  'get_transactions':   [economy.getTransactions, true],
  'get_coins':          [economy.getCoins, true],

  // --- shop ---
  'get_shop':           [shop.getShop, true],
  'buy_item':           [shop.buyItem, true],
  'equip_item':         [shop.equipItem, true],
  'get_inventory':      [shop.getInventory, true],
  'get_equipped':       [shop.getEquipped, true],
  'get_leaderboard':    [shop.getLeaderboard, true],
  'get_games':          [shop.getGames, true]
};

export async function dispatch(ws, msg) {
  const type = msg && msg.type;
  if (!type) return;

  const route = routes[type];
  if (!route) {
    if (msg.cbId) {
      send(ws, { type: 'response', cbId: msg.cbId, ok: false, error: 'نوع پیام ناشناخته: ' + type });
    }
    return;
  }

  const [handler, needAuth] = route;

  if (needAuth) {
    const info = clients.get(ws);
    if (!info || !info.userId) {
      if (msg.cbId) {
        send(ws, { type: 'response', cbId: msg.cbId, ok: false, error: 'ابتدا init کنید' });
      }
      return;
    }
  }

  try {
    await handler(ws, msg);
  } catch (err) {
    console.error(`[handler:${type}]`, err);
    if (msg.cbId) {
      send(ws, { type: 'response', cbId: msg.cbId, ok: false, error: 'خطای داخلی سرور' });
    }
  }
}

export function getRoutes() {
  return Object.keys(routes);
}
