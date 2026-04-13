const Notification = require('../models/Notification');
const { success, error } = require('../utils/apiResponse');

exports.getNotifications = async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 30, 1), 80);
    const [items, unread] = await Promise.all([
      Notification.find({ user: req.user._id })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean(),
      Notification.countDocuments({ user: req.user._id, readAt: null }),
    ]);

    return success(res, { items, unread });
  } catch (err) {
    next(err);
  }
};

exports.markRead = async (req, res, next) => {
  try {
    const item = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { readAt: new Date() },
      { new: true }
    ).lean();

    if (!item) return error(res, 'Notification not found', 404);
    return success(res, item);
  } catch (err) {
    next(err);
  }
};

exports.markAllRead = async (req, res, next) => {
  try {
    await Notification.updateMany(
      { user: req.user._id, readAt: null },
      { readAt: new Date() }
    );
    return success(res, { message: 'Notifications marked as read' });
  } catch (err) {
    next(err);
  }
};

exports.deleteNotification = async (req, res, next) => {
  try {
    const deleted = await Notification.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id,
    }).lean();

    if (!deleted) return error(res, 'Notification not found', 404);
    return success(res, { message: 'Notification removed' });
  } catch (err) {
    next(err);
  }
};

exports.clearNotifications = async (req, res, next) => {
  try {
    await Notification.deleteMany({ user: req.user._id });
    return success(res, { message: 'Notifications cleared' });
  } catch (err) {
    next(err);
  }
};
