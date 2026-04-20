const DEFAULT_DEVELOPMENT_REALTIME_URL = 'http://localhost:5002';
const BRIDGE_TIMEOUT_MS = parseInt(process.env.REALTIME_BRIDGE_TIMEOUT_MS, 10) || 1200;

const trimTrailingSlash = (value) => value.replace(/\/+$/, '');

const getRealtimeUrl = () => {
  const configured = process.env.REALTIME_SERVER_URL;

  if (configured) return trimTrailingSlash(configured);
  if ((process.env.NODE_ENV || 'development') === 'development') {
    return DEFAULT_DEVELOPMENT_REALTIME_URL;
  }
  return '';
};

const getBridgeSecret = () => process.env.REALTIME_INTERNAL_SECRET || '';

const postRealtimeEmit = async ({ target, event, data }) => {
  const realtimeUrl = getRealtimeUrl();
  const secret = getBridgeSecret();

  if (!realtimeUrl || !secret || process.env.NODE_ENV === 'test' || typeof fetch !== 'function') {
    return false;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), BRIDGE_TIMEOUT_MS);

  try {
    const response = await fetch(`${realtimeUrl}/internal/emit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-realtime-secret': secret,
      },
      body: JSON.stringify({ target, event, data }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Realtime bridge returned ${response.status}`);
    }

    return true;
  } finally {
    clearTimeout(timeout);
  }
};

const emitRealtime = async ({ target, event, data }) => {
  if (!target?.type || !event) return false;
  return postRealtimeEmit({ target, event, data });
};

const emitToRealtimeUser = (userId, event, data) => {
  if (!userId) return Promise.resolve(false);
  return emitRealtime({
    target: { type: 'user', id: userId.toString() },
    event,
    data,
  });
};

const emitToRealtimeRoom = (roomId, event, data) => {
  if (!roomId) return Promise.resolve(false);
  return emitRealtime({
    target: { type: 'room', id: roomId.toString() },
    event,
    data,
  });
};

const emitToRealtimeBroadcast = (event, data) => {
  return emitRealtime({
    target: { type: 'broadcast' },
    event,
    data,
  });
};

module.exports = {
  emitToRealtimeBroadcast,
  emitToRealtimeRoom,
  emitToRealtimeUser,
};
