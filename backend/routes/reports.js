const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const {
  getReports,
  addReport,
  updateReport,
  deleteReport,
} = require('../controllers/reportsController');
const { protect, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { ROLES } = require('../utils/constants');

const reportRules = [
  body('type').isIn(['Blood Test', 'X-Ray', 'MRI', 'CT Scan', 'Ultrasound', 'ECG', 'Other']).withMessage('Invalid report type'),
  body('title').isLength({ min: 1, max: 100 }).withMessage('Title is required and cannot exceed 100 characters'),
  body('description').optional().isLength({ max: 1000 }).withMessage('Description cannot exceed 1000 characters'),
  body('results').optional().isLength({ max: 2000 }).withMessage('Results cannot exceed 2000 characters'),
  body('date').optional().isISO8601().withMessage('Invalid date format'),
  body('isCritical').optional().isBoolean().withMessage('isCritical must be boolean'),
];

const idRules = [
  param('patientId').isMongoId().withMessage('Invalid patient ID'),
  param('id').optional().isMongoId().withMessage('Invalid report ID'),
];

// ── Doctor-only routes ────────────────────────────────────────────────────────
router.get('/:patientId', protect, authorize(ROLES.DOCTOR), idRules, validate, getReports);
router.post('/:patientId', protect, authorize(ROLES.DOCTOR), idRules, reportRules, validate, addReport);
router.put('/:id', protect, authorize(ROLES.DOCTOR), [param('id').isMongoId().withMessage('Invalid report ID')], reportRules, validate, updateReport);
router.delete('/:id', protect, authorize(ROLES.DOCTOR), [param('id').isMongoId().withMessage('Invalid report ID')], validate, deleteReport);

module.exports = router;