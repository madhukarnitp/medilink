const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Doctor = require('../models/Doctor');
require('../models/Patient');
const Consultation = require('../models/Consultation');
const Message = require('../models/Message');
const { SOCKET_EVENTS, CONSULTATION_STATUS } = require('../utils/constants');
const { createNotification } = require('../utils/notifications');

const connectedUsers = new Map();
const roomMembers = new Map();
const consultationCache = new Map();
const typingThrottle = new Map();

const MAX_CONNECTIONS_PER_USER =
  parseInt(process.env.REALTIME_MAX_CONNECTIONS_PER_USER, 10) || 3;
const CACHE_TTL = parseInt(process.env.REALTIME_CONSULTATION_CACHE_TTL_MS, 10) || 5 * 60 * 1000;

const asId = (value) => {
  if (!value) return null;
  if (value._id) return value._id.toString();
  return value.toString();
};

const sameId = (left, right) => asId(left) === asId(right);

const getUserIdFromProfile = (profile) => {
  const userId = profile?.userId;
  return userId?._id || userId;
};

const setCachedConsultation = (consultationId, consultation) => {
  if (!consultationId || !consultation) return;
  consultationCache.set(consultationId.toString(), {
    data: consultation,
    timestamp: Date.now(),
  });
};

const fetchConsultation = async (consultationId) => {
  const consultation = await Consultation.findById(consultationId)
    .populate({
      path: 'patient',
      select: 'userId',
      populate: { path: 'userId', select: 'name avatar' },
    })
    .populate({
      path: 'doctor',
      select: 'userId specialization',
      populate: { path: 'userId', select: 'name avatar' },
    })
    .lean();

  setCachedConsultation(consultationId, consultation);
  return consultation;
};

const getCachedConsultation = async (consultationId, { fresh = false } = {}) => {
  const cacheKey = consultationId?.toString();
  const cached = cacheKey ? consultationCache.get(cacheKey) : null;

  if (!fresh && cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  return fetchConsultation(consultationId);
};

const getRoomMemberSockets = (roomId, userId) => {
  if (!roomMembers.has(roomId)) {
    roomMembers.set(roomId, new Map());
  }

  const room = roomMembers.get(roomId);
  if (!room.has(userId)) {
    room.set(userId, new Set());
  }

  return room.get(userId);
};

const authenticateSocket = async (socket) => {
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
  if (!token) throw new Error('Authentication token required');
  if (!process.env.JWT_SECRET) throw new Error('Realtime JWT_SECRET is not configured');

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (!user || !user.isActive) throw new Error('User not found or inactive');
    return user;
  } catch (err) {
    if (err.name === 'TokenExpiredError') throw new Error('Token expired');
    if (err.name === 'JsonWebTokenError') throw new Error(`Invalid token: ${err.message}`);
    throw err;
  }
};

const userCanAccessConsultation = (user, consultation) => {
  const patientUserId = getUserIdFromProfile(consultation?.patient);
  const doctorUserId = getUserIdFromProfile(consultation?.doctor);

  return {
    isPatient: user.role === 'patient' && sameId(patientUserId, user._id),
    isDoctor: user.role === 'doctor' && sameId(doctorUserId, user._id),
    patientUserId,
    doctorUserId,
  };
};

const requireActiveConsultation = async (socket, consultationId) => {
  let consultation = await getCachedConsultation(consultationId);
  if (consultation && consultation.status !== CONSULTATION_STATUS.ACTIVE) {
    consultation = await getCachedConsultation(consultationId, { fresh: true });
  }

  if (!consultation || consultation.status !== CONSULTATION_STATUS.ACTIVE) {
    socket.emit(SOCKET_EVENTS.ERROR, { message: 'Consultation is not active' });
    return null;
  }

  const access = userCanAccessConsultation(socket.user, consultation);
  if (!access.isPatient && !access.isDoctor) {
    socket.emit(SOCKET_EVENTS.ERROR, { message: 'Not authorized for this consultation' });
    return null;
  }

  return { consultation, access };
};

const emitToUser = (io, userId, event, data) => {
  const sockets = connectedUsers.get(userId.toString());
  if (!sockets) return false;

  sockets.forEach((socketId) => io.to(socketId).emit(event, data));
  return true;
};

const emitDoctorPresence = (io, user, online) => {
  const payload = {
    doctorUserId: user._id,
    online,
    lastSeen: online ? undefined : new Date(),
  };
  io.emit(online ? SOCKET_EVENTS.DOCTOR_ONLINE : SOCKET_EVENTS.DOCTOR_OFFLINE, payload);
};

const setDoctorPresence = async (io, user, online) => {
  try {
    const update = online
      ? { online: true }
      : { online: false, lastSeen: new Date() };
    await Doctor.findOneAndUpdate({ userId: user._id }, update);
    emitDoctorPresence(io, user, online);
  } catch (err) {
    console.error(`[realtime] Doctor presence update failed: ${err.message}`);
  }
};

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

  io.on('connection', async (socket) => {
    const user = socket.user;
    const userId = user._id.toString();
    const userSockets = connectedUsers.get(userId) || new Set();

    if (userSockets.size >= MAX_CONNECTIONS_PER_USER) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'Maximum connections reached' });
      socket.disconnect();
      return;
    }

    userSockets.add(socket.id);
    connectedUsers.set(userId, userSockets);

    console.log(`[realtime] Client connected: user=${userId}, role=${user.role}, socket=${socket.id}`);

    if (user.role === 'doctor') setDoctorPresence(io, user, true);

    socket.on(SOCKET_EVENTS.JOIN_CONSULTATION, async ({ consultationId } = {}) => {
      try {
        const consultation = await getCachedConsultation(consultationId, { fresh: true });
        if (!consultation) {
          return socket.emit(SOCKET_EVENTS.ERROR, { message: 'Consultation not found' });
        }

        if (
          consultation.status !== CONSULTATION_STATUS.PENDING &&
          consultation.status !== CONSULTATION_STATUS.ACTIVE
        ) {
          return socket.emit(SOCKET_EVENTS.ERROR, {
            message: 'Consultation is no longer available for calling',
          });
        }

        const access = userCanAccessConsultation(user, consultation);
        if (!access.isPatient && !access.isDoctor) {
          return socket.emit(SOCKET_EVENTS.ERROR, {
            message: 'Not authorized for this consultation',
          });
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

        if (isFirstSocketInRoom) {
          socket.to(roomId).emit('peerJoined', {
            consultationId: consultation._id,
            userId: user._id,
            name: user.name,
            role: user.role,
          });
        }

        if (isFirstSocketInRoom && roomMembers.get(roomId).size === 2) {
          io.to(roomId).emit('readyForCall', {
            consultationId: consultation._id,
            roomId,
          });
        }
      } catch (err) {
        console.error(`[realtime] Join consultation failed: ${err.message}`);
        socket.emit(SOCKET_EVENTS.ERROR, { message: 'Failed to join consultation' });
      }
    });

    socket.on(SOCKET_EVENTS.SEND_MESSAGE, async ({ consultationId, text, attachmentUrl, attachmentType, roomId } = {}) => {
      try {
        if (!text && !attachmentUrl) {
          return socket.emit(SOCKET_EVENTS.ERROR, {
            message: 'Message must have text or attachment',
          });
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

        const populated = await Message.findById(message._id).populate('sender', 'name avatar');
        const targetRoom = roomId || active.consultation.roomId || active.consultation._id.toString();
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
    });

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

    socket.on('webrtc:ice', ({ roomId, candidate } = {}) => {
      if (candidate) forwardToRoom('webrtc:ice-candidate', { roomId, candidate });
    });

    socket.on('webrtc:ice-candidate', ({ roomId, candidate } = {}) => {
      if (candidate) forwardToRoom('webrtc:ice-candidate', { roomId, candidate });
    });

    socket.on('webrtc:offer', ({ roomId, offer } = {}) => {
      if (offer) forwardToRoom('webrtc:offer', { roomId, offer });
    });

    socket.on('webrtc:answer', ({ roomId, answer } = {}) => {
      if (answer) forwardToRoom('webrtc:answer', { roomId, answer });
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

      if (!activeConsultationId) return;

      try {
        const consultation = await getCachedConsultation(activeConsultationId);
        if (!consultation) return;

        const access = userCanAccessConsultation(user, consultation);
        if (!access.isPatient && !access.isDoctor) return;

        const targetUserId = access.isPatient ? access.doctorUserId : access.patientUserId;
        if (targetUserId) emitToUser(io, targetUserId, 'webrtc:call-ended', payload);
      } catch (err) {
        console.error(`[realtime] Call-ended notification failed: ${err.message}`);
      }
    };

    socket.on('webrtc:ended', notifyCallEnded);
    socket.on('webrtc:call-ended', notifyCallEnded);

    socket.on('webrtc:media-toggle', ({ roomId, video, audio } = {}) => {
      forwardToRoom('webrtc:media-toggle', { roomId, video, audio });
    });

    socket.on('videoCall:request', async ({ consultationId } = {}) => {
      try {
        const active = await requireActiveConsultation(socket, consultationId);
        if (!active) return;

        const targetUserId = active.access.isPatient
          ? active.access.doctorUserId
          : active.access.patientUserId;

        if (!targetUserId) {
          return socket.emit(SOCKET_EVENTS.ERROR, { message: 'Call recipient not found' });
        }

        const consultation = active.consultation;
        const roomId = consultation.roomId || consultation._id.toString();
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
          params: { consultationId: consultation._id, mode: 'call', autoAcceptCall: true },
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

    socket.on('disconnect', async (reason) => {
      console.log(`[realtime] Client disconnected: user=${userId}, socket=${socket.id}, reason=${reason}`);

      const roomId = socket.consultationRoomId;
      if (roomId && roomMembers.has(roomId)) {
        const room = roomMembers.get(roomId);
        const memberSockets = room.get(userId);

        if (memberSockets) {
          memberSockets.delete(socket.id);
        }

        if (memberSockets && memberSockets.size === 0) {
          room.delete(userId);
          socket.to(roomId).emit('peerLeft', {
            consultationId: socket.consultationId,
            roomId,
            userId: user._id,
            name: user.name,
            role: user.role,
          });
        }

        if (room.size === 0) {
          roomMembers.delete(roomId);
        }
      }

      const sockets = connectedUsers.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          connectedUsers.delete(userId);
          if (user.role === 'doctor') setDoctorPresence(io, user, false);
        }
      }
    });
  });
};

const cleanupTimer = setInterval(() => {
  const now = Date.now();

  for (const [userId, sockets] of connectedUsers.entries()) {
    if (sockets.size === 0) connectedUsers.delete(userId);
  }

  for (const [consultationId, cached] of consultationCache.entries()) {
    if (now - cached.timestamp > CACHE_TTL) {
      consultationCache.delete(consultationId);
    }
  }

  for (const [key, timestamp] of typingThrottle.entries()) {
    if (now - timestamp > 60000) {
      typingThrottle.delete(key);
    }
  }
}, 60000);

cleanupTimer.unref?.();

const isUserOnline = (userId) => connectedUsers.has(userId.toString());

module.exports = {
  emitToUser,
  isUserOnline,
  registerSocketHandlers,
};
