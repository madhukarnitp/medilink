const Notification = require('../models/Notification');
const { sendSseToUser } = require('./sseHub');

async function createNotification({
  user,
  title,
  body,
  type = 'general',
  page,
  params,
  emit = true,
  event = 'notification',
}) {
  if (!user || !title) return null;

  try {
    const notification = await Notification.create({
      user,
      title,
      body,
      type,
      page,
      params,
    });

    if (emit) {
      const payload =
        typeof notification.toObject === 'function'
          ? notification.toObject()
          : notification;
      sendSseToUser(user, event, payload);
    }

    return notification;
  } catch (err) {
    console.warn(`[notifications] Notification persistence failed: ${err.message}`);
    return null;
  }
}

module.exports = { createNotification };
