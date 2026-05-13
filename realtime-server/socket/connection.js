const { SOCKET_EVENTS } = require('../utils/constants');
const { registerCallHandlers } = require('./handlers/calls');
const { registerDisconnectHandler } = require('./handlers/disconnect');
const { registerMessageHandlers } = require('./handlers/messages');
const { registerRoomHandlers } = require('./handlers/rooms');
const { registerSignalingHandlers } = require('./handlers/signaling');
const { config, connectedUsers } = require('./state');

const registerConnectionHandlers = (io, socket) => {
  const user = socket.user;
  const userId = user._id.toString();
  const userSockets = connectedUsers.get(userId) || new Set();

  if (userSockets.size >= config.maxConnectionsPerUser) {
    socket.emit(SOCKET_EVENTS.ERROR, { message: 'Maximum connections reached' });
    socket.disconnect();
    return;
  }

  userSockets.add(socket.id);
  connectedUsers.set(userId, userSockets);

  console.log(
    `[realtime] Client connected: user=${userId}, role=${user.role}, socket=${socket.id}`,
  );

  const forwardToRoom = (event, payload = {}) => {
    const room = payload.roomId || socket.consultationRoomId;
    if (!room) return false;

    socket.to(room).emit(event, {
      ...payload,
      consultationId: payload.consultationId || socket.consultationId,
      from: user._id,
    });
    return true;
  };

  const context = { forwardToRoom, io, socket, user, userId };

  registerRoomHandlers(context);
  registerMessageHandlers(context);
  registerSignalingHandlers(context);
  registerCallHandlers(context);
  registerDisconnectHandler(context);
};

module.exports = { registerConnectionHandlers };
