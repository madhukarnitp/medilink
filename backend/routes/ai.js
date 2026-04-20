const express = require('express');
const { body } = require('express-validator');
const { medibotChat } = require('../controllers/aiController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

router.post(
  '/medibot',
  protect,
  [
    body('message')
      .trim()
      .isLength({ min: 1, max: 1200 })
      .withMessage('Message must be between 1 and 1200 characters'),
    body('history').optional().isArray({ max: 10 }),
  ],
  validate,
  medibotChat,
);

module.exports = router;
