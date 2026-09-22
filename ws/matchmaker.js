const queues = new Map(); // gameId → array

const BOT_DELAY_MIN = 5000;
const BOT_DELAY_MAX = 10000;

function getQueue(gameId) {
  if (!queues.has(gameId)) queues.set(gameId, []);
  return queues.get(gameId);
}

export function addToQueue(gameId, entry, onMatch) {
  removeFromQueue(entry.ws);

  const queue = getQueue(gameId);

  entry.gameId = gameId;
  entry.onMatch = onMatch;
  entry.joinedAt = Date.now();
  entry.timeoutId = null;

  queue.push(entry);

  if (queue.length >= 2) {
    const a = queue.shift();
    const b = queue.shift();
    if (a.timeoutId) clearTimeout(a.timeoutId);
    if (b.timeoutId) clearTimeout(b.timeoutId);
    try { a.onMatch('human', a, b); } catch (e) { console.error('[mm human a]', e); }
    try { b.onMatch('human', b, a); } catch (e) { console.error('[mm human b]', e); }
    return { matched: true, type: 'human' };
  }

  const delay = BOT_DELAY_MIN + Math.random() * (BOT_DELAY_MAX - BOT_DELAY_MIN);
  entry.timeoutId = setTimeout(() => {
    const idx = queue.indexOf(entry);
    if (idx < 0) return;
    queue.splice(idx, 1);
    try { entry.onMatch('bot', entry, null); } catch (e) { console.error('[mm bot]', e); }
  }, delay);

  return { matched: false, type: 'waiting', delay };
}

export function removeFromQueue(ws) {
  for (const queue of queues.values()) {
    const idx = queue.findIndex(x => x.ws === ws);
    if (idx >= 0) {
      if (queue[idx].timeoutId) clearTimeout(queue[idx].timeoutId);
      queue.splice(idx, 1);
      return true;
    }
  }
  return false;
}

export function queueSize(gameId = null) {
  if (gameId) return (queues.get(gameId) || []).length;
  let total = 0;
  for (const q of queues.values()) total += q.length;
  return total;
}

export function getQueueStats() {
  const out = {};
  for (const [gameId, queue] of queues) out[gameId] = queue.length;
  return out;
}

export function isInQueue(ws) {
  for (const queue of queues.values()) {
    if (queue.some(x => x.ws === ws)) return true;
  }
  return false;
}

export function getQueueForGame(gameId) {
  return getQueue(gameId);
        }
