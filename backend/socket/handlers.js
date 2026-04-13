const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Doctor = require('../models/Doctor');
const Consultation = require('../models/Consultation');
const Message = require('../models/Message');
const { SOCKET_EVENTS, CONSULTATION_STATUS } = require('../utils/constants');
const { createNotification } = require('../utils/notifications');

// Track connected users: userId -> Set of socketIds
// Track room members:    roomId -> Map<userId, Set<socketId>>
const connectedUsers = new Map();
const roomMembers    = new Map();

// Connection limits and caching
const MAX_CONNECTIONS_PER_USER = 3;
const consultationCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const typingThrottle = new Map();

const setCachedConsultation = (consultationId, consultation) => {
  if (!consultationId || !consultation) return;
  consultationCache.set(consultationId.toString(), {
    data: consultation,
    timestamp: Date.now()
  });
};

const fetchConsultation = async (consultationId) => {
  const consultation = await Consultation.findById(consultationId)
    .populate('patient', 'userId')
    .populate('doctor', 'userId')
    .lean();

  setCachedConsultation(consultationId, consultation);
  return consultation;
};

const getCachedConsultation = async (consultationId, { fresh = false } = {}) => {
  const cacheKey = consultationId?.toString();
  const cached = cacheKey ? consultationCache.get(cacheKey) : null;
  if (!fresh && cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    return cached.data;
  }

  return fetchConsultation(consultationId);
};

const getRefId = (value) => value?._id || value;

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
  const token = socket.handshake.query?.token || socket.handshake.auth?.token;
  if (!token) throw new Error('Authentication token required');

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (!user || !user.isActive) throw new Error('User not found or inactive');
    return user;
  } catch (err) {
    throw new Error('Invalid token');
  }
};

const registerSocketHandlers = (io) => {
  // Middleware: authenticate all connections
  io.use(async (socket, next) => {
    try {
      socket.user = await authenticateSocket(socket);
      next();
    } catch (err) {
      console.warn(`[socket] Authentication failed: ${err.message}`);
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', async (socket) => {
    const user = socket.user;
    console.log(`[socket] Client connected: user=${user._id}, role=${user.role}, socket=${socket.id}`);

    // Limit connections per user
    const userSockets = connectedUsers.get(user._id.toString()) || new Set();
    if (userSockets.size >= MAX_CONNECTIONS_PER_USER) {
      socket.emit('error', { message: 'Maximum connections reached' });
      socket.disconnect();
      return;
    }
    
    userSockets.add(socket.id);
    connectedUsers.set(user._id.toString(), userSockets);

    // Mark doctor online
    if (user.role === 'doctor') {
      await Doctor.findOneAndUpdate({ userId: user._id }, { online: true });
      io.emit(SOCKET_EVENTS.DOCTOR_ONLINE, { doctorUserId: user._id });
    }

    // ── Join consultation room ─────────────────────────────────────────────
    socket.on(SOCKET_EVENTS.JOIN_CONSULTATION, async ({ consultationId } = {}) => {
      try {
        console.log(`[socket] Join consultation requested: user=${user._id}, consultation=${consultationId}`);
        
        const consultation = await getCachedConsultation(consultationId);

        if (!consultation) {
          console.warn(`[socket] Consultation room not found: consultation=${consultationId}`);
          return socket.emit('error', { message: 'Consultation not found' });
        }

        if (
          consultation.status !== CONSULTATION_STATUS.PENDING &&
          consultation.status !== CONSULTATION_STATUS.ACTIVE
        ) {
          return socket.emit('error', { message: 'Consultation is no longer available for calling' });
        }

        // Verify access
        const isPatient = user.role === 'patient' && 
          consultation.patient?.userId?.equals(user._id);
        const isDoctor = user.role === 'doctor' && 
          consultation.doctor?.userId?.equals(user._id);
        
        if (!isPatient && !isDoctor) {
          console.warn(`[socket] Unauthorized consultation room access: user=${user._id}, consultation=${consultationId}`);
          return socket.emit('error', { message: 'Not authorized for this consultation' });
        }

        // Use roomId or fallback to consultation ID
        const roomId = consultation.roomId || consultation._id.toString();
        
        socket.join(roomId);
        socket.consultationRoomId = roomId;
        socket.consultationId = consultationId;

        // Track room occupancy
        const userId = user._id.toString();
        const memberSockets = getRoomMemberSockets(roomId, userId);
        const isFirstSocketInRoom = memberSockets.size === 0;
        memberSockets.add(socket.id);

        console.log(`[socket] Consultation room joined: room=${roomId}, members=${roomMembers.get(roomId).size}`);
        
        // Confirm join
        socket.emit('joinedConsultation', { roomId, consultationId });

        // Notify other party
        if (isFirstSocketInRoom) {
          socket.to(roomId).emit('peerJoined', {
            userId: user._id,
            name: user.name,
            role: user.role,
          });
        }

        // Both parties ready
        if (isFirstSocketInRoom && roomMembers.get(roomId).size === 2) {
          console.log(`[socket] Consultation room ready for WebRTC: room=${roomId}`);
          io.to(roomId).emit('readyForCall');
        }

      } catch (err) {
        console.error(`[socket] Join consultation failed: ${err.message}`);
        socket.emit('error', { message: 'Failed to join consultation' });
      }
    });

    // ── Send message ──────────────────────────────────────────────────────
    socket.on(SOCKET_EVENTS.SEND_MESSAGE, async ({ consultationId, text, attachmentUrl, attachmentType, roomId } = {}) => {
      try {
        if (!text && !attachmentUrl) {
          return socket.emit('error', { message: 'Message must have text or attachment' });
        }

        let consultation = await getCachedConsultation(consultationId);
        if (consultation && consultation.status !== CONSULTATION_STATUS.ACTIVE) {
          consultation = await getCachedConsultation(consultationId, { fresh: true });
        }
        if (!consultation || consultation.status !== CONSULTATION_STATUS.ACTIVE) {
          return socket.emit('error', { message: 'Consultation is not active' });
        }

        const message = await Message.create({
          consultation: consultationId,
          sender: user._id,
          senderRole: user.role,
          text: text || undefined,
          attachmentUrl: attachmentUrl || undefined,
          attachmentType: attachmentType || undefined,
        });

        const populated = await Message.findById(message._id)
          .populate('sender', 'name avatar');

        const targetRoom = roomId || consultation.roomId || consultation._id.toString();
        io.to(targetRoom).emit(SOCKET_EVENTS.RECEIVE_MESSAGE, populated);

        const patientUserId = consultation.patient?.userId;
        const doctorUserId = consultation.doctor?.userId;
        const targetUserId = user.role === 'patient' ? doctorUserId : patientUserId;
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
        
        console.log(`[socket] Message delivered: room=${targetRoom}, sender=${user._id}`);
      } catch (err) {
        console.error(`[socket] Message delivery failed: ${err.message}`);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // ── Typing indicators ─────────────────────────────────────────────────
    socket.on(SOCKET_EVENTS.TYPING, ({ consultationId, roomId } = {}) => {
      const key = `${user._id}-${consultationId}`;
      const now = Date.now();
      const lastTyped = typingThrottle.get(key);
      
      if (!lastTyped || (now - lastTyped) > 500) { // Throttle to 500ms
        typingThrottle.set(key, now);
        const room = roomId || socket.consultationRoomId;
        if (room) {
          socket.to(room).emit(SOCKET_EVENTS.TYPING, { 
            userId: user._id, 
            name: user.name 
          });
        }
      }
    });

    socket.on(SOCKET_EVENTS.STOP_TYPING, ({ roomId } = {}) => {
      const room = roomId || socket.consultationRoomId;
      if (room) {
        socket.to(room).emit(SOCKET_EVENTS.STOP_TYPING, { userId: user._id });
      }
    });

    // ── WebRTC Signaling ──────────────────────────────────────────────────
    socket.on('webrtc:ice', ({ roomId: emitRoomId, candidate } = {}) => {
      const room = emitRoomId || socket.consultationRoomId;
      if (room && candidate) {
        socket.to(room).emit('webrtc:ice-candidate', { candidate, from: user._id });
      }
    });

    socket.on('webrtc:offer', ({ roomId: emitRoomId, offer } = {}) => {
      const room = emitRoomId || socket.consultationRoomId;
      if (room && offer) {
        socket.to(room).emit('webrtc:offer', { offer, from: user._id });
        console.log(`[socket] WebRTC offer forwarded: room=${room}`);
      }
    });

    socket.on('webrtc:answer', ({ roomId: emitRoomId, answer } = {}) => {
      const room = emitRoomId || socket.consultationRoomId;
      if (room && answer) {
        socket.to(room).emit('webrtc:answer', { answer, from: user._id });
        console.log(`[socket] WebRTC answer forwarded: room=${room}`);
      }
    });

    const notifyCallEnded = async ({ roomId: emitRoomId, consultationId } = {}) => {
      const room = emitRoomId || socket.consultationRoomId;
      const activeConsultationId = consultationId || socket.consultationId;
      const payload = {
        consultationId: activeConsultationId,
        from: user._id,
        name: user.name,
      };

      if (room) {
        socket.to(room).emit('webrtc:call-ended', payload);
      }

      if (!activeConsultationId) {
        console.log(`[socket] Call-ended signal sent to room=${room || 'unknown'}`);
        return;
      }

      try {
        const consultation = await getCachedConsultation(activeConsultationId);
        if (!consultation) return;

        const patientUserId = consultation.patient?.userId;
        const doctorUserId = consultation.doctor?.userId;
        const isPatient = user.role === 'patient' && patientUserId?.equals(user._id);
        const isDoctor = user.role === 'doctor' && doctorUserId?.equals(user._id);
        if (!isPatient && !isDoctor) return;

        const targetUserId = isPatient ? doctorUserId : patientUserId;
        if (targetUserId) emitToUser(io, targetUserId, 'webrtc:call-ended', payload);
      } catch (err) {
        console.error(`[socket] Call-ended notification failed: ${err.message}`);
      }
    };

    socket.on('webrtc:ended', async ({ roomId: emitRoomId, consultationId } = {}) => {
      await notifyCallEnded({ roomId: emitRoomId, consultationId });
      console.log('[socket] Call-ended signal sent through legacy event');
    });

    socket.on('webrtc:ice-candidate', ({ roomId: emitRoomId, candidate } = {}) => {
      const room = emitRoomId || socket.consultationRoomId;
      if (room && candidate) {
        socket.to(room).emit('webrtc:ice-candidate', { candidate, from: user._id });
      }
    });

    socket.on('webrtc:call-ended', async ({ roomId: emitRoomId, consultationId } = {}) => {
      await notifyCallEnded({ roomId: emitRoomId, consultationId });
      console.log('[socket] Call-ended signal sent');
    });

    socket.on('webrtc:media-toggle', ({ roomId: emitRoomId, video, audio } = {}) => {
      const room = emitRoomId || socket.consultationRoomId;
      if (room) {
        socket.to(room).emit('webrtc:media-toggle', { 
          from: user._id, 
          video, 
          audio 
        });
      }
    });

    socket.on('videoCall:request', async ({ consultationId } = {}) => {
      try {
        let consultation = await getCachedConsultation(consultationId);
        if (!consultation) {
          return socket.emit('error', { message: 'Consultation not found' });
        }

        if (consultation.status !== CONSULTATION_STATUS.ACTIVE) {
          consultation = await getCachedConsultation(consultationId, { fresh: true });
        }

        if (consultation.status !== CONSULTATION_STATUS.ACTIVE) {
          return socket.emit('error', { message: 'Consultation is not active' });
        }

        const patientUserId = getRefId(consultation.patient?.userId);
        const doctorUserId = getRefId(consultation.doctor?.userId);
        const isPatient = user.role === 'patient' && patientUserId?.equals(user._id);
        const isDoctor = user.role === 'doctor' && doctorUserId?.equals(user._id);

        if (!isPatient && !isDoctor) {
          return socket.emit('error', { message: 'Not authorized for this consultation' });
        }

        const targetUserId = isPatient ? doctorUserId : patientUserId;
        const callerName = user.name || (isPatient ? 'Patient' : 'Doctor');
        const roomId = consultation.roomId || consultation._id.toString();
        const payload = {
          consultationId: consultation._id,
          roomId,
          from: {
            userId: user._id,
            name: callerName,
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

        if (!targetUserId) {
          return socket.emit('error', { message: 'Call recipient not found' });
        }

        emitToUser(io, targetUserId, 'videoCall:incoming', payload);
        socket.emit('videoCall:requested', payload);
        await createNotification({
          user: targetUserId,
          title: 'Incoming video call',
          body: `${callerName} is calling you now.`,
          type: 'video_call',
          page: 'consultation',
          params: { consultationId: consultation._id, mode: 'call', autoAcceptCall: true },
        });
        console.log(`[socket] Video call request sent: consultation=${consultation._id}, caller=${user._id}`);
      } catch (err) {
        console.error(`[socket] Video call request failed: ${err.message}`);
        socket.emit('error', { message: 'Failed to request video call' });
      }
    });

    socket.on('videoCall:decline', async ({ consultationId } = {}) => {
      try {
        const consultation = await getCachedConsultation(consultationId);
        if (!consultation) return;

        const patientUserId = consultation.patient?.userId;
        const doctorUserId = consultation.doctor?.userId;
        const isPatient = user.role === 'patient' && patientUserId?.equals(user._id);
        const isDoctor = user.role === 'doctor' && doctorUserId?.equals(user._id);
        if (!isPatient && !isDoctor) return;

        const targetUserId = isPatient ? doctorUserId : patientUserId;
        if (!targetUserId) return;
        emitToUser(io, targetUserId, 'videoCall:declined', {
          consultationId: consultation._id,
          from: {
            userId: user._id,
            name: user.name,
            role: user.role,
          },
        });
        await createNotification({
          user: targetUserId,
          title: 'Video call declined',
          body: `${user.name} declined the video call.`,
          type: 'video_call_declined',
          page: 'consultation',
          params: { consultationId: consultation._id, mode: 'chat' },
        });
      } catch (err) {
        console.error(`[socket] Video call decline failed: ${err.message}`);
      }
    });

    // ── Disconnect ────────────────────────────────────────────────────────
    socket.on('disconnect', async (reason) => {
      console.log(`[socket] Client disconnected: user=${user._id}, socket=${socket.id}, reason=${reason}`);
      
      const roomId = socket.consultationRoomId;
      if (roomId && roomMembers.has(roomId)) {
        const room = roomMembers.get(roomId);
        const memberSockets = room.get(user._id.toString());

        if (memberSockets) {
          memberSockets.delete(socket.id);
        }

        if (memberSockets && memberSockets.size === 0) {
          room.delete(user._id.toString());

          // Notify room members only when the user truly leaves the room
          socket.to(roomId).emit('peerLeft', {
            consultationId: socket.consultationId,
            userId: user._id,
            name: user.name,
          });
        }

        if (room.size === 0) {
          roomMembers.delete(roomId);
          console.log(`[socket] Consultation room emptied: room=${roomId}`);
        }
      }

      // Clean up user socket tracking
      const userSockets = connectedUsers.get(user._id.toString());
      if (userSockets) {
        userSockets.delete(socket.id);
        
        // If no more sockets, mark doctor offline
        if (userSockets.size === 0 && user.role === 'doctor') {
          await Doctor.findOneAndUpdate(
            { userId: user._id }, 
            { online: false, lastSeen: new Date() }
          );
          io.emit(SOCKET_EVENTS.DOCTOR_OFFLINE, { doctorUserId: user._id });
          connectedUsers.delete(user._id.toString());
        }
      }
    });
  });
};

// Periodic cleanup of stale connections and cache
setInterval(() => {
  const now = Date.now();
  
  // Clean up empty socket sets
  for (const [userId, sockets] of connectedUsers.entries()) {
    if (sockets.size === 0) {
      connectedUsers.delete(userId);
    }
  }
  
  // Clean up expired cache entries
  for (const [consultationId, cached] of consultationCache.entries()) {
    if ((now - cached.timestamp) > CACHE_TTL) {
      consultationCache.delete(consultationId);
    }
  }
  
  // Clean up old typing throttles (older than 1 minute)
  for (const [key, timestamp] of typingThrottle.entries()) {
    if ((now - timestamp) > 60000) {
      typingThrottle.delete(key);
    }
  }
}, 60000); // Clean every minute

const isUserOnline = (userId) => connectedUsers.has(userId.toString());

const emitToUser = (io, userId, event, data) => {
  const sockets = connectedUsers.get(userId.toString());
  if (sockets) {
    sockets.forEach((socketId) => io.to(socketId).emit(event, data));
  }
};

module.exports = { registerSocketHandlers, isUserOnline, emitToUser };
