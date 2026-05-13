const mongoose = require('mongoose');
const { CONSULTATION_STATUS, SOCKET_EVENTS } = require('../../utils/constants');
const { getCachedConsultation, userCanAccessConsultation } = require('../consultationAccess');
const { getRoomMemberSockets, roomMembers } = require('../state');

const registerRoomHandlers = ({ socket, user, userId }) => {
  socket.on(SOCKET_EVENTS.JOIN_CONSULTATION, async ({ consultationId } = {}, ack) => {
    try {
      if (!consultationId || !mongoose.Types.ObjectId.isValid(consultationId)) {
        const payload = { message: 'Invalid consultation room' };
        socket.emit(SOCKET_EVENTS.ERROR, payload);
        if (typeof ack === 'function') ack({ ok: false, ...payload });
        return;
      }

      const consultation = await getCachedConsultation(consultationId, {
        fresh: true,
      });
      if (!consultation) {
        const payload = { message: 'Consultation not found' };
        socket.emit(SOCKET_EVENTS.ERROR, payload);
        if (typeof ack === 'function') ack({ ok: false, ...payload });
        return;
      }

      if (
        consultation.status !== CONSULTATION_STATUS.PENDING &&
        consultation.status !== CONSULTATION_STATUS.ACTIVE
      ) {
        const payload = {
          message: 'Consultation is no longer available for calling',
        };
        socket.emit(SOCKET_EVENTS.ERROR, payload);
        if (typeof ack === 'function') ack({ ok: false, ...payload });
        return;
      }

      const access = userCanAccessConsultation(user, consultation);
      if (!access.isPatient && !access.isDoctor) {
        const payload = { message: 'Not authorized for this consultation' };
        socket.emit(SOCKET_EVENTS.ERROR, payload);
        if (typeof ack === 'function') ack({ ok: false, ...payload });
        return;
      }

      const roomId = consultation.roomId || consultation._id.toString();
      socket.join(roomId);
      socket.consultationRoomId = roomId;
      socket.consultationId = consultation._id.toString();

      const memberSockets = getRoomMemberSockets(roomId, userId);
      const isFirstSocketInRoom = memberSockets.size === 0;
      memberSockets.add(socket.id);

      socket.emit('joinedConsultation', {
        consultationId: consultation._id,
        roomId,
      });
      if (typeof ack === 'function') {
        ack({ ok: true, consultationId: consultation._id, roomId });
      }

      if (isFirstSocketInRoom) {
        socket.to(roomId).emit('peerJoined', {
          consultationId: consultation._id,
          userId: user._id,
          name: user.name,
          role: user.role,
        });
      }

      if (isFirstSocketInRoom && roomMembers.get(roomId).size === 2) {
        socket.to(roomId).emit('readyForCall', {
          consultationId: consultation._id,
          roomId,
        });
        socket.emit('readyForCall', {
          consultationId: consultation._id,
          roomId,
        });
      }
    } catch (err) {
      console.error(`[realtime] Join consultation failed: ${err.message}`);
      const payload = { message: err.message || 'Failed to join consultation' };
      socket.emit(SOCKET_EVENTS.ERROR, payload);
      if (typeof ack === 'function') ack({ ok: false, ...payload });
    }
  });
};

module.exports = { registerRoomHandlers };
