const Message = require('../../models/Message');
const { SOCKET_EVENTS } = require('../../utils/constants');
const { createNotification } = require('../../utils/notifications');
const { requireActiveConsultation } = require('../consultationAccess');
const { typingThrottle } = require('../state');

const registerMessageHandlers = ({ io, socket, user, userId }) => {
  socket.on(
    SOCKET_EVENTS.SEND_MESSAGE,
    async ({ consultationId, text, attachmentUrl, attachmentType, roomId } = {}) => {
      try {
        if (!text && !attachmentUrl) {
          socket.emit(SOCKET_EVENTS.ERROR, {
            message: 'Message must have text or attachment',
          });
          return;
        }

        const active = await requireActiveConsultation(socket, consultationId);
        if (!active) return;

        const message = await Message.create({
          consultation: consultationId,
          sender: user._id,
          senderRole: user.role,
          text: text || undefined,
          attachmentUrl: attachmentUrl || undefined,
          attachmentType: attachmentType || undefined,
        });

        const populated = await Message.findById(message._id).populate(
          'sender',
          'name avatar',
        );
        const targetRoom =
          roomId || active.consultation.roomId || active.consultation._id.toString();
        io.to(targetRoom).emit(SOCKET_EVENTS.RECEIVE_MESSAGE, populated);

        const targetUserId = active.access.isPatient
          ? active.access.doctorUserId
          : active.access.patientUserId;

        if (targetUserId) {
          await createNotification({
            user: targetUserId,
            title: `New message from ${user.name}`,
            body: text || 'Open MediLink to view the message.',
            type: 'message',
            page: 'consultation',
            params: { consultationId },
          });
        }
      } catch (err) {
        console.error(`[realtime] Message delivery failed: ${err.message}`);
        socket.emit(SOCKET_EVENTS.ERROR, { message: 'Failed to send message' });
      }
    },
  );

  socket.on(SOCKET_EVENTS.TYPING, ({ consultationId, roomId } = {}) => {
    const key = `${userId}-${consultationId}`;
    const lastTyped = typingThrottle.get(key);

    if (!lastTyped || Date.now() - lastTyped > 500) {
      typingThrottle.set(key, Date.now());
      const room = roomId || socket.consultationRoomId;
      if (room) {
        socket.to(room).emit(SOCKET_EVENTS.TYPING, {
          consultationId: consultationId || socket.consultationId,
          userId: user._id,
          name: user.name,
        });
      }
    }
  });

  socket.on(SOCKET_EVENTS.STOP_TYPING, ({ roomId } = {}) => {
    const room = roomId || socket.consultationRoomId;
    if (room) {
      socket.to(room).emit(SOCKET_EVENTS.STOP_TYPING, {
        consultationId: socket.consultationId,
        userId: user._id,
      });
    }
  });
};

module.exports = { registerMessageHandlers };
