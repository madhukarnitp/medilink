const Vital = require('../models/Vital');
const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');
const { success, error, paginate } = require('../utils/apiResponse');
const { PAGINATION } = require('../utils/constants');

/**
 * GET /api/vitals/:patientId
 * Get vitals for a specific patient (doctor only)
 */
exports.getVitals = async (req, res, next) => {
  try {
    const { patientId } = req.params;
    const page = Math.max(parseInt(req.query.page, 10) || PAGINATION.DEFAULT_PAGE, 1);
    const limit = Math.min(parseInt(req.query.limit, 10) || PAGINATION.DEFAULT_LIMIT, PAGINATION.MAX_LIMIT);
    const skip = (page - 1) * limit;

    const doctor = await Doctor.findOne({ userId: req.user._id });
    if (!doctor) return error(res, 'Doctor profile not found', 404);

    const patient = await Patient.findById(patientId);
    if (!patient) return error(res, 'Patient not found', 404);

    // Check if doctor has access to this patient (has consultations)
    const Consultation = require('../models/Consultation');
    const hasAccess = await Consultation.findOne({
      doctor: doctor._id,
      patient: patient._id,
    });
    if (!hasAccess) return error(res, 'Access denied', 403);

    const [vitals, total] = await Promise.all([
      Vital.find({ patient: patientId, doctor: doctor._id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('doctor', 'userId')
        .populate('patient', 'userId')
        .lean(),
      Vital.countDocuments({ patient: patientId, doctor: doctor._id }),
    ]);

    return paginate(res, vitals, total, page, limit);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/vitals/:patientId
 * Add vital signs for a patient (doctor only)
 */
exports.addVital = async (req, res, next) => {
  try {
    const { patientId } = req.params;
    const { bloodPressure, heartRate, temperature, weight, height, oxygenSaturation, respiratoryRate, notes } = req.body;

    const doctor = await Doctor.findOne({ userId: req.user._id });
    if (!doctor) return error(res, 'Doctor profile not found', 404);

    const patient = await Patient.findById(patientId);
    if (!patient) return error(res, 'Patient not found', 404);

    // Check if doctor has access to this patient
    const Consultation = require('../models/Consultation');
    const hasAccess = await Consultation.findOne({
      doctor: doctor._id,
      patient: patient._id,
    });
    if (!hasAccess) return error(res, 'Access denied', 403);

    const vital = new Vital({
      patient: patientId,
      doctor: doctor._id,
      bloodPressure,
      heartRate,
      temperature,
      weight,
      height,
      oxygenSaturation,
      respiratoryRate,
      notes,
    });

    await vital.save();
    await vital.populate('doctor', 'userId');

    return success(res, vital, 201);
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/vitals/:id
 * Update a vital record (doctor only)
 */
exports.updateVital = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const doctor = await Doctor.findOne({ userId: req.user._id });
    if (!doctor) return error(res, 'Doctor profile not found', 404);

    const vital = await Vital.findOneAndUpdate(
      { _id: id, doctor: doctor._id },
      { $set: updates },
      { new: true, runValidators: true }
    ).populate('doctor', 'userId');

    if (!vital) return error(res, 'Vital record not found or access denied', 404);

    return success(res, vital);
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/vitals/:id
 * Delete a vital record (doctor only)
 */
exports.deleteVital = async (req, res, next) => {
  try {
    const { id } = req.params;

    const doctor = await Doctor.findOne({ userId: req.user._id });
    if (!doctor) return error(res, 'Doctor profile not found', 404);

    const vital = await Vital.findOneAndDelete({ _id: id, doctor: doctor._id });
    if (!vital) return error(res, 'Vital record not found or access denied', 404);

    return success(res, { message: 'Vital record deleted' });
  } catch (err) {
    next(err);
  }
};