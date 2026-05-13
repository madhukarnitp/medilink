const connectedUsers = new Map();
const roomMembers = new Map();
const consultationCache = new Map();
const typingThrottle = new Map();
const activeCallLocks = new Map();
const activeCallTimers = new Map();

const config = {
  maxConnectionsPerUser:
    parseInt(process.env.REALTIME_MAX_CONNECTIONS_PER_USER, 10) || 3,
  consultationCacheTtlMs:
    parseInt(process.env.REALTIME_CONSULTATION_CACHE_TTL_MS, 10) ||
    5 * 60 * 1000,
  typingTtlMs: 60 * 1000,
  callRequestTtlMs: 2 * 60 * 1000,
  activeCallTtlMs: 2 * 60 * 60 * 1000,
};

const emitToUser = (io, userId, event, data) => {
  const sockets = connectedUsers.get(userId?.toString());
  if (!sockets) return false;

  sockets.forEach((socketId) => io.to(socketId).emit(event, data));
  return true;
};

const isUserOnline = (userId) => connectedUsers.has(userId?.toString());

const getRoomMemberSockets = (roomId, userId) => {
  if (!roomMembers.has(roomId)) roomMembers.set(roomId, new Map());

  const room = roomMembers.get(roomId);
  if (!room.has(userId)) room.set(userId, new Set());

  return room.get(userId);
};

const startStateCleanup = () => {
  const timer = setInterval(() => {
    const now = Date.now();

    for (const [userId, sockets] of connectedUsers.entries()) {
      if (sockets.size === 0) connectedUsers.delete(userId);
    }

    for (const [consultationId, cached] of consultationCache.entries()) {
      if (now - cached.timestamp > config.consultationCacheTtlMs) {
        consultationCache.delete(consultationId);
      }
    }

    for (const [key, timestamp] of typingThrottle.entries()) {
      if (now - timestamp > config.typingTtlMs) {
        typingThrottle.delete(key);
      }
    }

    for (const [userId, lock] of activeCallLocks.entries()) {
      const ttl =
        lock.status === 'requested'
          ? config.callRequestTtlMs
          : config.activeCallTtlMs;
      if (now - lock.updatedAt > ttl) {
        activeCallLocks.delete(userId);
      }
    }
  }, 60_000);

  timer.unref?.();
  return timer;
};

module.exports = {
  activeCallLocks,
  activeCallTimers,
  config,
  connectedUsers,
  consultationCache,
  emitToUser,
  getRoomMemberSockets,
  isUserOnline,
  roomMembers,
  startStateCleanup,
  typingThrottle,
};
