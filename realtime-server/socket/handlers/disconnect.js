const { clearConsultationCallLocks } = require('../callLocks');
const { connectedUsers, roomMembers } = require('../state');

const registerDisconnectHandler = ({ socket, user, userId }) => {
  socket.on('disconnect', async (reason) => {
    console.log(
      `[realtime] Client disconnected: user=${userId}, socket=${socket.id}, reason=${reason}`,
    );

    const roomId = socket.consultationRoomId;
    if (roomId && roomMembers.has(roomId)) {
      const room = roomMembers.get(roomId);
      const memberSockets = room.get(userId);

      if (memberSockets) memberSockets.delete(socket.id);

      if (memberSockets && memberSockets.size === 0) {
        room.delete(userId);
        clearConsultationCallLocks(socket.consultationId);
        socket.to(roomId).emit('peerLeft', {
          consultationId: socket.consultationId,
          roomId,
          userId: user._id,
          name: user.name,
          role: user.role,
        });
      }

      if (room.size === 0) roomMembers.delete(roomId);
    }

    const sockets = connectedUsers.get(userId);
    if (sockets) {
      sockets.delete(socket.id);
      if (sockets.size === 0) connectedUsers.delete(userId);
    }
  });
};

module.exports = { registerDisconnectHandler };
