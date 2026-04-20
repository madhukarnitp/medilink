const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const {
  getVitals,
  addVital,
  updateVital,
  deleteVital,
} = require('../controllers/vitalsController');
const { protect, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { ROLES } = require('../utils/constants');

const vitalRules = [
  body('bloodPressure.systolic').optional().isFloat({ min: 0 }).withMessage('Systolic must be positive'),
  body('bloodPressure.diastolic').optional().isFloat({ min: 0 }).withMessage('Diastolic must be positive'),
  body('heartRate').optional().isFloat({ min: 0 }).withMessage('Heart rate must be positive'),
  body('temperature.value').optional().isFloat({ min: 0 }).withMessage('Temperature must be positive'),
  body('weight').optional().isFloat({ min: 0 }).withMessage('Weight must be positive'),
  body('height').optional().isFloat({ min: 0 }).withMessage('Height must be positive'),
  body('oxygenSaturation').optional().isFloat({ min: 0, max: 100 }).withMessage('Oxygen saturation must be 0-100'),
  body('respiratoryRate').optional().isFloat({ min: 0 }).withMessage('Respiratory rate must be positive'),
  body('notes').optional().isLength({ max: 500 }).withMessage('Notes cannot exceed 500 characters'),
];

const idRules = [
  param('patientId').isMongoId().withMessage('Invalid patient ID'),
  param('id').optional().isMongoId().withMessage('Invalid vital ID'),
];

// ── Doctor-only routes ────────────────────────────────────────────────────────
router.get('/:patientId', protect, authorize(ROLES.DOCTOR), idRules, validate, getVitals);
router.post('/:patientId', protect, authorize(ROLES.DOCTOR), idRules, vitalRules, validate, addVital);
router.put('/:id', protect, authorize(ROLES.DOCTOR), [param('id').isMongoId().withMessage('Invalid vital ID')], vitalRules, validate, updateVital);
router.delete('/:id', protect, authorize(ROLES.DOCTOR), [param('id').isMongoId().withMessage('Invalid vital ID')], validate, deleteVital);

module.exports = router;