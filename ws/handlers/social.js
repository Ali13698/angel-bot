import { clients } from '../state.js';
import { replyOk, replyErr, publicUser } from '../utils.js';
import { DB } from '../../db/index.js';

// ============ FRIENDS ============
export async function getFriends(ws, msg) {
  const info = clients.get(ws);
  if (!info) return replyErr(ws, msg.cbId, 'ابتدا init کنید');

  const friends = await DB.social.getFriends(info.userId);
  const requests = await DB.social.getPendingRequests(info.userId);
  replyOk(ws, msg.cbId, { friends, requests });
}

export async function addFriend(ws, msg) {
  const info = clients.get(ws);
  if (!info) return replyErr(ws, msg.cbId, 'ابتدا init کنید');

  const username = String(msg.username || '').replace('@', '').trim();
  if (!username) return replyErr(ws, msg.cbId, 'نام کاربری خالی');

  let target = await DB.users.getUserByGameUsername(username);
  if (!target) target = await DB.users.getUserByUsername(username);
  if (!target) return replyErr(ws, msg.cbId, 'کاربر پیدا نشد');

  const r = await DB.social.sendFriendRequest(info.userId, target.id);

  if (r.ok && !r.autoAccepted) {
    // اطلاع به کاربر مقصد (اگه آنلاینه)
    const { onlineUsers } = await import('../state.js');
    const tWs = onlineUsers.get(target.id);
    if (tWs) {
      const me = await DB.users.getUser(info.userId);
      const { send } = await import('../utils.js');
      send(tWs, { type: 'friend_request', from: publicUser(me) });
    }
  }

  replyOk(ws, msg.cbId, r);
}

export async function acceptFriend(ws, msg) {
  const info = clients.get(ws);
  if (!info) return replyErr(ws, msg.cbId, 'ابتدا init کنید');

  const friendId = parseInt(msg.friendId, 10);
  if (!friendId) return replyErr(ws, msg.cbId, 'شناسه نامعتبر');

  await DB.social.acceptFriendRequest(info.userId, friendId);

  const { onlineUsers } = await import('../state.js');
  const { send } = await import('../utils.js');
  const fWs = onlineUsers.get(friendId);
  if (fWs) {
    const me = await DB.users.getUser(info.userId);
    send(fWs, { type: 'friend_accepted', by: publicUser(me) });
  }

  replyOk(ws, msg.cbId);
}

export async function removeFriend(ws, msg) {
  const info = clients.get(ws);
  if (!info) return replyErr(ws, msg.cbId, 'ابتدا init کنید');

  const friendId = parseInt(msg.friendId, 10);
  if (!friendId) return replyErr(ws, msg.cbId, 'شناسه نامعتبر');

  await DB.social.removeFriend(info.userId, friendId);
  replyOk(ws, msg.cbId);
}

// ============ SEARCH ============
export async function searchUsers(ws, msg) {
  const info = clients.get(ws);
  if (!info) return replyErr(ws, msg.cbId, 'ابتدا init کنید');

  const q = String(msg.query || '').trim();
  if (q.length < 2) return replyErr(ws, msg.cbId, 'حداقل ۲ حرف');

  const users = await DB.users.searchUsers(q, info.userId);
  replyOk(ws, msg.cbId, { users });
}

// ============ LIKES ============
export async function likeUser(ws, msg) {
  const info = clients.get(ws);
  if (!info) return replyErr(ws, msg.cbId, 'ابتدا init کنید');

  const targetId = parseInt(msg.userId, 10);
  if (!targetId) return replyErr(ws, msg.cbId, 'شناسه نامعتبر');

  const r = await DB.social.likeUser(info.userId, targetId);
  replyOk(ws, msg.cbId, r);
}

export async function getTopLiked(ws, msg) {
  const list = await DB.social.getTopLiked(20);
  replyOk(ws, msg.cbId, { list });
}

// ============ BLOCKS ============
export async function blockUser(ws, msg) {
  const info = clients.get(ws);
  if (!info) return replyErr(ws, msg.cbId, 'ابتدا init کنید');

  const targetId = parseInt(msg.userId, 10);
  if (!targetId) return replyErr(ws, msg.cbId, 'شناسه نامعتبر');

  const r = await DB.social.blockUser(info.userId, targetId);
  replyOk(ws, msg.cbId, r);
}

export async function unblockUser(ws, msg) {
  const info = clients.get(ws);
  if (!info) return replyErr(ws, msg.cbId, 'ابتدا init کنید');

  const targetId = parseInt(msg.userId, 10);
  if (!targetId) return replyErr(ws, msg.cbId, 'شناسه نامعتبر');

  const r = await DB.social.unblockUser(info.userId, targetId);
  replyOk(ws, msg.cbId, r);
}
