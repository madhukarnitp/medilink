const Notification = require('../models/Notification');

async function createNotification({ user, title, body, type = 'general', page, params }) {
  if (!user || !title) return null;

  try {
    return await Notification.create({
      user,
      title,
      body,
      type,
      page,
      params,
    });
  } catch (err) {
    console.warn(`[notifications] Notification persistence failed: ${err.message}`);
    return null;
  }
}

module.exports = { createNotification };
