const path = require('path');
const http = require('http');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { Server } = require('socket.io');

dotenv.config({ path: path.resolve(__dirname, '.env') });

const {
  closeDatabase,
  connectDatabase,
  getDatabaseStatus,
} = require('./config/database');
const { registerSocketHandlers, emitToUser } = require('./socket/handlers');
const ioInstance = require('./socket/ioInstance');

const app = express();
let server = null;
let io = null;

const parseCsv = (value) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const allowedOrigins = parseCsv(
  process.env.REALTIME_ALLOWED_ORIGINS ||
    process.env.ALLOWED_ORIGINS ||
    'http://localhost:3000,http://localhost:5173',
);

const corsOptions = {
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`Realtime CORS blocked: ${origin}`));
  },
  credentials: true,
};

const getInternalSecret = () => process.env.REALTIME_INTERNAL_SECRET || '';

const requireInternalSecret = (req, res, next) => {
  const expected = getInternalSecret();
  const provided = req.get('x-realtime-secret');

  if (!expected) {
    return res.status(503).json({
      success: false,
      message: 'Realtime internal bridge is not configured',
    });
  }

  if (provided !== expected) {
    return res.status(401).json({
      success: false,
      message: 'Invalid realtime bridge secret',
    });
  }

  return next();
};

const createRealtimeServer = () => {
  server = http.createServer(app);

  io = new Server(server, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: parseInt(process.env.REALTIME_PING_TIMEOUT_MS, 10) || 30000,
    pingInterval: parseInt(process.env.REALTIME_PING_INTERVAL_MS, 10) || 25000,
    maxHttpBufferSize: parseInt(process.env.REALTIME_MAX_BUFFER_SIZE, 10) || 1e6,
    allowEIO3: false,
    transports: ['websocket', 'polling'],
    connectTimeout: parseInt(process.env.REALTIME_CONNECT_TIMEOUT_MS, 10) || 10000,
  });

  registerSocketHandlers(io);
  ioInstance.set(io);

  return server;
};

app.disable('etag');
app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));

app.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'medilink-realtime',
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    db: getDatabaseStatus(),
    allowedOrigins,
  });
});

app.get('/realtime/health', (req, res) => {
  res.redirect(307, '/health');
});

app.post('/internal/emit', requireInternalSecret, (req, res) => {
  if (!io) {
    return res.status(503).json({
      success: false,
      message: 'Realtime server is not initialized',
    });
  }

  const { target = {}, event, data } = req.body || {};
  const { type, id } = target;

  if (!event || typeof event !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'Event name is required',
    });
  }

  const payload = data ?? {};

  if (type === 'user') {
    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'User target id is required',
      });
    }

    emitToUser(io, id, event, payload);
    return res.json({ success: true, target: 'user', event });
  }

  if (type === 'room') {
    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Room target id is required',
      });
    }

    io.to(id).emit(event, payload);
    return res.json({ success: true, target: 'room', event });
  }

  if (type === 'broadcast') {
    io.emit(event, payload);
    return res.json({ success: true, target: 'broadcast', event });
  }

  return res.status(400).json({
    success: false,
    message: 'Target type must be user, room, or broadcast',
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Realtime route ${req.originalUrl} not found`,
  });
});

const shutdown = async (signal) => {
  console.log(`[realtime] ${signal} received. Starting graceful shutdown.`);

  if (server) {
    server.close(async () => {
      await closeDatabase();
      console.log('[realtime] HTTP server closed');
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000);
    return;
  }

  await closeDatabase();
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (err) => {
  console.error(`[realtime] Unhandled rejection: ${err.message}`);
  shutdown('unhandledRejection');
});

const PORT = parseInt(process.env.PORT || process.env.REALTIME_PORT, 10) || 5002;

if (require.main === module) {
  createRealtimeServer();
  connectDatabase().then(() => {
    server.listen(PORT, () => {
      const env = process.env.NODE_ENV || 'development';
      console.log(`[realtime] MediLink realtime server started in ${env} mode`);
      console.log(`[realtime] Socket.IO: http://localhost:${PORT}`);
      console.log(`[realtime] Health check: http://localhost:${PORT}/health`);
    });
  });
}

module.exports = { app, createRealtimeServer };
