const { SOCKET_EVENTS } = require('../../utils/constants');
const { createNotification } = require('../../utils/notifications');
const { requireActiveConsultation } = require('../consultationAccess');
const {
  emitCallError,
  emitCallReset,
  getCallLock,
  resetConsultationCallState,
  scheduleCallRequestTimeout,
  setCallLock,
} = require('../callLocks');
const { emitToUser } = require('../state');

const registerCallHandlers = ({ io, socket, user, userId }) => {
  socket.on('videoCall:request', async ({ consultationId } = {}) => {
    try {
      const active = await requireActiveConsultation(socket, consultationId);
      if (!active) return;

      const targetUserId = active.access.isPatient
        ? active.access.doctorUserId
        : active.access.patientUserId;

      if (!targetUserId) {
        emitCallError(socket, 'USER_BUSY', 'Call recipient not found');
        return;
      }

      const existingCallerLock = getCallLock(userId);
      if (existingCallerLock) {
        const isSameConsultation =
          existingCallerLock.consultationId === consultationId.toString();
        emitCallError(
          socket,
          isSameConsultation ? 'DUPLICATE_REQUEST' : 'CALL_ALREADY_ACTIVE',
          isSameConsultation
            ? 'A call request is already waiting'
            : 'A call is already active',
        );
        return;
      }

      if (getCallLock(targetUserId)) {
        emitCallError(socket, 'USER_BUSY', 'The other person is busy on another call');
        return;
      }

      const consultation = active.consultation;
      const roomId = consultation.roomId || consultation._id.toString();
      emitCallReset(io, [targetUserId], {
        consultationId: consultation._id,
        roomId,
        reason: 'new-request',
        from: user._id,
      });

      const lock = {
        consultationId: consultation._id.toString(),
        roomId,
        status: 'requested',
      };

      setCallLock(userId, lock);
      setCallLock(targetUserId, lock);
      scheduleCallRequestTimeout(io, consultation._id, userId, targetUserId);

      const payload = {
        consultationId: consultation._id,
        roomId,
        from: {
          userId: user._id,
          name: user.name || (active.access.isPatient ? 'Patient' : 'Doctor'),
          role: user.role,
        },
        patient: {
          name: consultation.patient?.userId?.name,
          avatar: consultation.patient?.userId?.avatar,
        },
        doctor: {
          name: consultation.doctor?.userId?.name,
          avatar: consultation.doctor?.userId?.avatar,
        },
        reason: consultation.reason,
        requestedAt: new Date(),
      };

      emitToUser(io, targetUserId, 'videoCall:incoming', payload);
      socket.emit('videoCall:requested', payload);

      await createNotification({
        user: targetUserId,
        title: 'Incoming video call',
        body: `${payload.from.name} is calling you now.`,
        type: 'video_call',
        page: 'consultation',
        params: {
          consultationId: consultation._id,
          mode: 'call',
          autoAcceptCall: true,
        },
      });
    } catch (err) {
      console.error(`[realtime] Video call request failed: ${err.message}`);
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'Failed to request video call' });
    }
  });

  socket.on('videoCall:decline', async ({ consultationId } = {}) => {
    try {
      const active = await requireActiveConsultation(socket, consultationId);
      if (!active) return;

      const targetUserId = active.access.isPatient
        ? active.access.doctorUserId
        : active.access.patientUserId;
      if (!targetUserId) return;

      const payload = {
        consultationId: active.consultation._id,
        from: {
          userId: user._id,
          name: user.name,
          role: user.role,
        },
      };

      resetConsultationCallState({
        io,
        consultationId: active.consultation._id,
        userIds: [userId, targetUserId],
        reason: 'declined',
        extra: { from: user._id },
      });
      socket.emit('videoCall:declined', payload);
      emitToUser(io, targetUserId, 'videoCall:declined', payload);

      await createNotification({
        user: targetUserId,
        title: 'Video call declined',
        body: `${user.name} declined the video call.`,
        type: 'video_call_declined',
        page: 'consultation',
        params: { consultationId: active.consultation._id, mode: 'chat' },
      });
    } catch (err) {
      console.error(`[realtime] Video call decline failed: ${err.message}`);
    }
  });

  socket.on('videoCall:accept', async ({ consultationId } = {}) => {
    try {
      const active = await requireActiveConsultation(socket, consultationId);
      if (!active) return;

      const targetUserId = active.access.isPatient
        ? active.access.doctorUserId
        : active.access.patientUserId;
      if (!targetUserId) return;

      emitToUser(io, targetUserId, 'videoCall:accepted', {
        consultationId: active.consultation._id,
        roomId: active.consultation.roomId || active.consultation._id.toString(),
        from: {
          userId: user._id,
          name: user.name,
          role: user.role,
        },
        acceptedAt: new Date(),
      });
    } catch (err) {
      console.error(`[realtime] Video call accept failed: ${err.message}`);
    }
  });
};

module.exports = { registerCallHandlers };
