import * as userHandlers from './user.js';

const routes = {
  'init_user': [userHandlers.initUser, false],
  'ping': [userHandlers.ping, false],
  'get_me': [userHandlers.getMe, true]
};

export async function dispatch(ws, msg) {
  const [handler, requireAuth] = routes[msg.type] || [];

  if (typeof handler !== 'function') {
    console.error(`[handler] Invalid handler for type: ${msg.type}`);
    return;
  }

  if (requireAuth && !ws.userId) {
    return ws.send(JSON.stringify({ type: 'error', cbid: msg.cbid, error: 'UNAUTHORIZED' }));
  }

  await handler(ws, msg);
}
