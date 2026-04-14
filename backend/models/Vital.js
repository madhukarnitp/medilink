const mongoose = require('mongoose');

const vitalSchema = new mongoose.Schema(
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
    bloodPressure: {
      systolic: {
        type: Number,
        min: 0,
      },
      diastolic: {
        type: Number,
        min: 0,
      },
    },
    heartRate: {
      type: Number,
      min: 0,
    },
    temperature: {
      value: {
        type: Number,
        min: 0,
      },
      unit: {
        type: String,
        enum: ['Celsius', 'Fahrenheit'],
        default: 'Celsius',
      },
    },
    weight: {
      type: Number,
      min: 0,
    },
    height: {
      type: Number,
      min: 0,
    },
    oxygenSaturation: {
      type: Number,
      min: 0,
      max: 100,
    },
    respiratoryRate: {
      type: Number,
      min: 0,
    },
    notes: {
      type: String,
      maxlength: 500,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Vital', vitalSchema);