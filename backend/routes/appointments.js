const express = require('express');
const { body, param } = require('express-validator');
const {
  cancelAppointment,
  confirmAppointment,
  createAppointment,
  getAppointments,
  updateAppointmentStatus,
} = require('../controllers/appointmentController');
const { protect, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { ROLES } = require('../utils/constants');

const router = express.Router();

const idRules = [param('id').isMongoId().withMessage('Invalid appointment ID')];
const createRules = [
  body('doctorId').isMongoId().withMessage('Valid doctor ID required'),
  body('scheduledFor').isISO8601().withMessage('Valid schedule date required'),
  body('durationMinutes').optional().isInt({ min: 10, max: 120 }),
  body('reason').optional().isLength({ max: 300 }),
];
const statusRules = [
  body('status').isIn(['completed', 'missed']).withMessage('Status must be completed or missed'),
  body('notes').optional().isLength({ max: 500 }),
];

router.use(protect);

router.get('/', getAppointments);
router.post('/', authorize(ROLES.PATIENT), createRules, validate, createAppointment);
router.put('/:id/confirm', authorize(ROLES.DOCTOR), idRules, validate, confirmAppointment);
router.put('/:id/cancel', idRules, validate, cancelAppointment);
router.put('/:id/status', authorize(ROLES.DOCTOR), idRules, statusRules, validate, updateAppointmentStatus);

module.exports = router;
