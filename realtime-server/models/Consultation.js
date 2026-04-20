const mongoose = require('mongoose');
const { CONSULTATION_STATUS } = require('../utils/constants');

const consultationSchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
    },
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(CONSULTATION_STATUS),
      default: CONSULTATION_STATUS.PENDING,
    },
    reason: {
      type: String,
      trim: true,
    },
    roomId: {
      type: String,
      required: true,
    },
    startedAt: Date,
    endedAt: Date,
  },
  { timestamps: true, strict: false },
);

consultationSchema.index({ roomId: 1 });
consultationSchema.index({ patient: 1, status: 1 });
consultationSchema.index({ doctor: 1, status: 1 });

module.exports =
  mongoose.models.Consultation || mongoose.model('Consultation', consultationSchema);
