const mongoose = require('mongoose');

const DEFAULT_URI = 'mongodb://127.0.0.1:27017/medilink';
let connectionPromise = null;

const connectDatabase = async ({ exitOnFailure = true } = {}) => {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }
  if (connectionPromise) {
    return connectionPromise;
  }

  try {
    const uri = process.env.MONGODB_URI || DEFAULT_URI;
    connectionPromise = mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });
    const connection = await connectionPromise;

    console.log(
      '[database] ' +
        `MongoDB connected to ${connection.connection.host}/${connection.connection.name}`,
    );

    connectionPromise = null;
    return connection.connection;
  } catch (err) {
    connectionPromise = null;
    console.error(`[database] MongoDB connection failed: ${err.message}`);
    if (exitOnFailure) process.exit(1);
    throw err;
  }
};

const closeDatabase = async () => {
  if (mongoose.connection.readyState === 0) return;
  await mongoose.connection.close();
  connectionPromise = null;
  console.log('[database] MongoDB connection closed');
};

const getDatabaseStatus = () =>
  mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';

module.exports = {
  closeDatabase,
  connectDatabase,
  getDatabaseStatus,
};
