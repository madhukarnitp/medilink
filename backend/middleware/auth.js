const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { error } = require('../utils/apiResponse');

const getBearerToken = (req) => {
  if (req.headers.authorization?.startsWith('Bearer ')) {
    return req.headers.authorization.split(' ')[1];
  }
  return null;
};

const attachUserFromToken = async (token, req, res, next) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return error(res, 'User not found', 401);
    }
    if (!user.isActive) {
      return error(res, 'Account is deactivated', 401);
    }

    req.user = user;
    return next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return error(res, 'Token expired — please log in again', 401);
    }
    return error(res, 'Invalid token', 401);
  }
};

/**
 * Protect route — verifies JWT and attaches req.user
 */
const protect = async (req, res, next) => {
  const token = getBearerToken(req) || req.cookies?.token;

  if (!token) {
    return error(res, 'Not authorized — no token provided', 401);
  }

  return attachUserFromToken(token, req, res, next);
};

/**
 * Authorize specific roles
 * @param {...string} roles
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return error(res, `Role '${req.user.role}' is not authorized for this action`, 403);
    }
    next();
  };
};

/**
 * Optional auth — attaches user if token present, but doesn't block
 */
const optionalAuth = async (req, res, next) => {
  const token = getBearerToken(req);
  if (!token) return next();

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-password');
  } catch (_) {
    // ignore
  }
  next();
};

const protectEventStream = async (req, res, next) => {
  const token = getBearerToken(req) || req.query?.token || req.cookies?.token;
  if (!token) {
    return error(res, 'Not authorized — no token provided', 401);
  }

  return attachUserFromToken(token, req, res, next);
};

module.exports = { protect, authorize, optionalAuth, protectEventStream };
