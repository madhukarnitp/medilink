const {
  activeCallLocks,
  activeCallTimers,
  emitToUser,
} = require('./state');

const getCallLock = (userId) => activeCallLocks.get(userId?.toString());

const setCallLock = (userId, lock) => {
  if (!userId) return;
  activeCallLocks.set(userId.toString(), {
    ...lock,
    updatedAt: Date.now(),
  });
};

const clearConsultationCallLocks = (consultationId) => {
  if (!consultationId) return;
  const id = consultationId.toString();
  const timer = activeCallTimers.get(id);
  if (timer) {
    clearTimeout(timer);
    activeCallTimers.delete(id);
  }

  for (const [userId, lock] of activeCallLocks.entries()) {
    if (lock.consultationId === id) activeCallLocks.delete(userId);
  }
};

const emitCallReset = (io, userIds = [], payload = {}) => {
  const sent = new Set();
  userIds
    .filter(Boolean)
    .map((userId) => userId.toString())
    .forEach((userId) => {
      if (sent.has(userId)) return;
      sent.add(userId);
      emitToUser(io, userId, 'videoCall:reset', {
        ...payload,
        resetAt: payload.resetAt || new Date(),
      });
    });
};

const resetConsultationCallState = ({
  io,
  consultationId,
  userIds = [],
  reason = 'reset',
  extra = {},
}) => {
  if (!consultationId) return;
  const id = consultationId.toString();
  clearConsultationCallLocks(id);
  emitCallReset(io, userIds, {
    consultationId: id,
    reason,
    ...extra,
  });
};

const emitCallError = (socket, code, message) => {
  socket.emit('error', { code, message });
};

const markConsultationCallActive = (consultationId) => {
  if (!consultationId) return;
  const id = consultationId.toString();
  const timer = activeCallTimers.get(id);
  if (timer) {
    clearTimeout(timer);
    activeCallTimers.delete(id);
  }

  for (const [userId, lock] of activeCallLocks.entries()) {
    if (lock.consultationId === id) {
      activeCallLocks.set(userId, {
        ...lock,
        status: 'active',
        updatedAt: Date.now(),
      });
    }
  }
};

const scheduleCallRequestTimeout = (
  io,
  consultationId,
  callerUserId,
  targetUserId,
) => {
  if (!consultationId) return;
  const id = consultationId.toString();
  const existingTimer = activeCallTimers.get(id);
  if (existingTimer) clearTimeout(existingTimer);

  const timer = setTimeout(() => {
    const callerLock = getCallLock(callerUserId);
    const targetLock = getCallLock(targetUserId);
    const requestStillPending =
      callerLock?.consultationId === id &&
      targetLock?.consultationId === id &&
      callerLock?.status === 'requested' &&
      targetLock?.status === 'requested';

    if (!requestStillPending) {
      activeCallTimers.delete(id);
      return;
    }

    const payload = {
      consultationId: id,
      reason: 'unanswered',
      timedOutAt: new Date(),
    };

    resetConsultationCallState({
      io,
      consultationId: id,
      userIds: [callerUserId, targetUserId],
      reason: 'timeout',
      extra: { timeoutReason: 'unanswered' },
    });
    emitToUser(io, callerUserId, 'videoCall:timeout', payload);
    emitToUser(io, targetUserId, 'videoCall:timeout', payload);
  }, 30_000);

  timer.unref?.();
  activeCallTimers.set(id, timer);
};

module.exports = {
  clearConsultationCallLocks,
  emitCallError,
  emitCallReset,
  getCallLock,
  markConsultationCallActive,
  resetConsultationCallState,
  scheduleCallRequestTimeout,
  setCallLock,
};
