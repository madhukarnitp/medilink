const express = require('express');
const { param } = require('express-validator');
const {
  clearNotifications,
  deleteNotification,
  getNotifications,
  markAllRead,
  markRead,
} = require('../controllers/notificationController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

const idRules = [param('id').isMongoId().withMessage('Invalid notification ID')];

router.use(protect);

router.get('/', getNotifications);
router.put('/read-all', markAllRead);
router.delete('/', clearNotifications);
router.put('/:id/read', idRules, validate, markRead);
router.delete('/:id', idRules, validate, deleteNotification);

module.exports = router;
