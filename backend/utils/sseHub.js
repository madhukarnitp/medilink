const clients = new Map();

const HEARTBEAT_MS = 25000;

const writeEvent = (res, event, data = {}) => {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
};

const registerSseClient = (userId, res) => {
  if (!userId || !res) return () => {};

  const key = userId.toString();
  const userClients = clients.get(key) || new Set();
  userClients.add(res);
  clients.set(key, userClients);

  writeEvent(res, 'connected', {
    connected: true,
    at: new Date().toISOString(),
  });

  const heartbeat = setInterval(() => {
    try {
      writeEvent(res, 'heartbeat', { at: new Date().toISOString() });
    } catch {}
  }, HEARTBEAT_MS);
  heartbeat.unref?.();

  const cleanup = () => {
    clearInterval(heartbeat);
    const current = clients.get(key);
    if (!current) return;
    current.delete(res);
    if (current.size === 0) clients.delete(key);
  };

  res.on('close', cleanup);
  res.on('error', cleanup);

  return cleanup;
};

const sendSseToUser = (userId, event, data = {}) => {
  if (!userId || !event) return 0;

  const userClients = clients.get(userId.toString());
  if (!userClients?.size) return 0;

  let sent = 0;
  for (const res of [...userClients]) {
    try {
      writeEvent(res, event, data);
      sent += 1;
    } catch {
      userClients.delete(res);
    }
  }

  if (userClients.size === 0) clients.delete(userId.toString());
  return sent;
};

const sendSseToAll = (event, data = {}) => {
  let sent = 0;
  for (const userId of [...clients.keys()]) {
    sent += sendSseToUser(userId, event, data);
  }
  return sent;
};

module.exports = {
  registerSseClient,
  sendSseToAll,
  sendSseToUser,
};
