const { authenticateSocket } = require('./auth');
const { registerConnectionHandlers } = require('./connection');
const { emitToUser, isUserOnline, startStateCleanup } = require('./state');

let cleanupStarted = false;

const registerSocketHandlers = (io) => {
  io.use(async (socket, next) => {
    try {
      socket.user = await authenticateSocket(socket);
      next();
    } catch (err) {
      console.warn(`[realtime] Socket authentication failed: ${err.message}`);
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    registerConnectionHandlers(io, socket);
  });

  if (!cleanupStarted) {
    startStateCleanup();
    cleanupStarted = true;
  }
};

module.exports = {
  emitToUser,
  isUserOnline,
  registerSocketHandlers,
};
