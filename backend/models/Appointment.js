const mongoose = require('mongoose');
const { APPOINTMENT_STATUS } = require('../utils/constants');

const appointmentSchema = new mongoose.Schema(
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
    scheduledFor: {
      type: Date,
      required: true,
    },
    durationMinutes: {
      type: Number,
      default: 30,
      min: 10,
      max: 120,
    },
    reason: {
      type: String,
      trim: true,
      maxlength: 300,
    },
    status: {
      type: String,
      enum: Object.values(APPOINTMENT_STATUS),
      default: APPOINTMENT_STATUS.REQUESTED,
    },
    confirmedAt: Date,
    cancelledAt: Date,
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 500,
    },
  },
  { timestamps: true }
);

appointmentSchema.index({ patient: 1, scheduledFor: -1 });
appointmentSchema.index({ doctor: 1, scheduledFor: -1 });
appointmentSchema.index({ doctor: 1, scheduledFor: 1, status: 1 });

module.exports = mongoose.model('Appointment', appointmentSchema);
