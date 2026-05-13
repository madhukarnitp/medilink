const { getCachedConsultation, userCanAccessConsultation } = require('../consultationAccess');
const {
  clearConsultationCallLocks,
  emitCallReset,
  markConsultationCallActive,
} = require('../callLocks');
const { emitToUser } = require('../state');

const registerSignalingHandlers = ({ socket, user, forwardToRoom }) => {
  socket.on('webrtc:ice', ({ roomId, candidate } = {}) => {
    if (candidate) forwardToRoom('webrtc:ice-candidate', { roomId, candidate });
  });

  socket.on('webrtc:ice-candidate', ({ roomId, candidate } = {}) => {
    if (candidate) forwardToRoom('webrtc:ice-candidate', { roomId, candidate });
  });

  socket.on('webrtc:offer', ({ roomId, offer } = {}) => {
    if (offer) forwardToRoom('webrtc:offer', { roomId, offer });
  });

  socket.on('webrtc:answer', ({ roomId, answer, consultationId } = {}) => {
    if (!answer) return;
    markConsultationCallActive(consultationId || socket.consultationId);
    forwardToRoom('webrtc:answer', { roomId, answer, consultationId });
  });

  const notifyCallEnded = async ({ roomId, consultationId } = {}) => {
    const activeConsultationId = consultationId || socket.consultationId;
    const payload = {
      consultationId: activeConsultationId,
      roomId: roomId || socket.consultationRoomId,
      from: user._id,
      name: user.name,
    };

    forwardToRoom('webrtc:call-ended', payload);
    clearConsultationCallLocks(activeConsultationId);

    if (!activeConsultationId) return;

    try {
      const consultation = await getCachedConsultation(activeConsultationId);
      if (!consultation) return;

      const access = userCanAccessConsultation(user, consultation);
      if (!access.isPatient && !access.isDoctor) return;

      const targetUserId = access.isPatient
        ? access.doctorUserId
        : access.patientUserId;
      if (targetUserId) {
        emitCallReset(socket.server, [user._id, targetUserId], {
          consultationId: activeConsultationId,
          roomId: payload.roomId,
          reason: 'ended',
          from: user._id,
        });
        emitToUser(socket.server, targetUserId, 'webrtc:call-ended', payload);
      }
    } catch (err) {
      console.error(`[realtime] Call-ended notification failed: ${err.message}`);
    }
  };

  socket.on('webrtc:ended', notifyCallEnded);
  socket.on('webrtc:call-ended', notifyCallEnded);

  socket.on('webrtc:media-toggle', ({ roomId, video, audio } = {}) => {
    forwardToRoom('webrtc:media-toggle', { roomId, video, audio });
  });
};

module.exports = { registerSignalingHandlers };
