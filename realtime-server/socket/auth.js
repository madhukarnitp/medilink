const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authenticateSocket = async (socket) => {
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
  if (!token) throw new Error('Authentication token required');
  if (!process.env.JWT_SECRET) {
    throw new Error('Realtime JWT_SECRET is not configured');
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (!user || !user.isActive) throw new Error('User not found or inactive');
    return user;
  } catch (err) {
    if (err.name === 'TokenExpiredError') throw new Error('Token expired');
    if (err.name === 'JsonWebTokenError') {
      throw new Error(`Invalid token: ${err.message}`);
    }
    throw err;
  }
};

module.exports = { authenticateSocket };
