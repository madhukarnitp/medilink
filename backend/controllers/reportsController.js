const Report = require('../models/Report');
const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');
const { success, error, paginate } = require('../utils/apiResponse');
const { PAGINATION } = require('../utils/constants');

/**
 * GET /api/reports/:patientId
 * Get reports for a specific patient (doctor only)
 */
exports.getReports = async (req, res, next) => {
  try {
    const { patientId } = req.params;
    const page = Math.max(parseInt(req.query.page, 10) || PAGINATION.DEFAULT_PAGE, 1);
    const limit = Math.min(parseInt(req.query.limit, 10) || PAGINATION.DEFAULT_LIMIT, PAGINATION.MAX_LIMIT);
    const skip = (page - 1) * limit;

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

    const [reports, total] = await Promise.all([
      Report.find({ patient: patientId, doctor: doctor._id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('doctor', 'userId')
        .populate('patient', 'userId')
        .lean(),
      Report.countDocuments({ patient: patientId, doctor: doctor._id }),
    ]);

    return paginate(res, reports, total, page, limit);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/reports/:patientId
 * Add a report for a patient (doctor only)
 */
exports.addReport = async (req, res, next) => {
  try {
    const { patientId } = req.params;
    const { type, title, description, results, date, isCritical } = req.body;

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

    const report = new Report({
      patient: patientId,
      doctor: doctor._id,
      type,
      title,
      description,
      results,
      filePath: req.file?.path, // If file upload is implemented
      date: date || new Date(),
      isCritical: isCritical || false,
    });

    await report.save();
    await report.populate('doctor', 'userId');

    return success(res, report, 201);
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/reports/:id
 * Update a report (doctor only)
 */
exports.updateReport = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const doctor = await Doctor.findOne({ userId: req.user._id });
    if (!doctor) return error(res, 'Doctor profile not found', 404);

    const report = await Report.findOneAndUpdate(
      { _id: id, doctor: doctor._id },
      { $set: updates },
      { new: true, runValidators: true }
    ).populate('doctor', 'userId');

    if (!report) return error(res, 'Report not found or access denied', 404);

    return success(res, report);
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/reports/:id
 * Delete a report (doctor only)
 */
exports.deleteReport = async (req, res, next) => {
  try {
    const { id } = req.params;

    const doctor = await Doctor.findOne({ userId: req.user._id });
    if (!doctor) return error(res, 'Doctor profile not found', 404);

    const report = await Report.findOneAndDelete({ _id: id, doctor: doctor._id });
    if (!report) return error(res, 'Report not found or access denied', 404);

    return success(res, { message: 'Report deleted' });
  } catch (err) {
    next(err);
  }
};