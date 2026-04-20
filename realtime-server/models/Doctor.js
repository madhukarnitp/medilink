const mongoose = require('mongoose');

const doctorSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    specialization: {
      type: String,
      default: 'General Physician',
    },
    online: {
      type: Boolean,
      default: false,
    },
    lastSeen: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true, strict: false },
);

module.exports = mongoose.models.Doctor || mongoose.model('Doctor', doctorSchema);
