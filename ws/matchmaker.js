const queues = new Map();

const BOT_DELAY_MIN = 5000;
const BOT_DELAY_MAX = 10000;

function queueKey(gameId, platform) {
  return gameId + '::' + (platform || 'telegram');
}

function getQueue(gameId, platform) {
  const key = queueKey(gameId, platform);
  if (!queues.has(key)) queues.set(key, []);
  return queues.get(key);
}

function scheduleBotTimeout(queue, entry) {
  if (entry.timeoutId) return;
  const delay = BOT_DELAY_MIN + Math.random() * (BOT_DELAY_MAX - BOT_DELAY_MIN);
  entry.timeoutId = setTimeout(() => {
    entry.timeoutId = null;
    const idx = queue.indexOf(entry);
    if (idx < 0 || entry.matched) return;

    console.log('[mm] bot timeout fired key=' + queueKey(entry.gameId, entry.platform) + ' userId=' + entry.userId);

    entry.matched = true;
    queue.splice(idx, 1);
    Promise.resolve()
      .then(() => entry.onMatch('bot', entry, null))
      .catch((e) => {
        entry.matched = false;
        console.error('[mm bot]', e);
      });
  }, delay);
}

export function addToQueue(gameId, entry, onMatch) {
  removeFromQueue(entry.ws);

  const queue = getQueue(gameId, entry.platform);

  console.log('[mm] addToQueue key=' + queueKey(gameId, entry.platform) + ' userId=' + entry.userId + ' platform=' + (entry.platform || '?'));

  entry.gameId = gameId;
  entry.onMatch = onMatch;
  entry.joinedAt = Date.now();
  entry.timeoutId = null;
  entry.matched = false;

  queue.push(entry);

  if (queue.length >= 2) {
    const a = queue.shift();
    const b = queue.shift();

    if (a.matched || b.matched) {
      for (const candidate of [a, b]) {
        if (!candidate.matched) {
          queue.push(candidate);
          scheduleBotTimeout(queue, candidate);
        } else if (candidate.timeoutId) {
          clearTimeout(candidate.timeoutId);
          candidate.timeoutId = null;
        }
      }
      return { matched: false, type: 'waiting' };
    }

    if (a.timeoutId) { clearTimeout(a.timeoutId); a.timeoutId = null; }
    if (b.timeoutId) { clearTimeout(b.timeoutId); b.timeoutId = null; }
    a.matched = true;
    b.matched = true;
    Promise.resolve()
      .then(() => a.onMatch('human', a, b))
      .catch((e) => {
        a.matched = false;
        b.matched = false;
        console.error('[mm human]', e);
      });
    return { matched: true, type: 'human' };
  }

  scheduleBotTimeout(queue, entry);

  const delay = BOT_DELAY_MIN;
  return { matched: false, type: 'waiting', delay };
}

export function removeFromQueue(ws) {
  for (const queue of queues.values()) {
    const idx = queue.findIndex(x => x.ws === ws);
    if (idx >= 0) {
      const entry = queue[idx];
      if (entry.timeoutId) {
        clearTimeout(entry.timeoutId);
        entry.timeoutId = null;
      }
      if (entry.matched) return false;
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

export function getQueueForGame(gameId, platform) {
  return getQueue(gameId, platform);
}
