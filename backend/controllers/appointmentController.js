const Appointment = require('../models/Appointment');
const Doctor = require('../models/Doctor');
const Patient = require('../models/Patient');
const { success, error } = require('../utils/apiResponse');
const { APPOINTMENT_STATUS, ROLES } = require('../utils/constants');
const { createNotification } = require('../utils/notifications');

const ACTIVE_STATUSES = [
  APPOINTMENT_STATUS.REQUESTED,
  APPOINTMENT_STATUS.CONFIRMED,
];

const appointmentPopulate = [
  { path: 'patient', populate: { path: 'userId', select: 'name avatar phone' } },
  { path: 'doctor', populate: { path: 'userId', select: 'name avatar phone' } },
];

exports.createAppointment = async (req, res, next) => {
  try {
    const { doctorId, scheduledFor, durationMinutes = 30, reason } = req.body;
    const appointmentDate = new Date(scheduledFor);

    if (Number.isNaN(appointmentDate.getTime())) {
      return error(res, 'Valid appointment date and time required', 400);
    }
    if (appointmentDate.getTime() < Date.now() + 5 * 60 * 1000) {
      return error(res, 'Appointment must be scheduled at least 5 minutes from now', 400);
    }

    const [patient, doctor] = await Promise.all([
      Patient.findOne({ userId: req.user._id }).populate('userId', 'name avatar'),
      Doctor.findById(doctorId).populate('userId', 'name avatar'),
    ]);

    if (!patient) return error(res, 'Patient profile not found', 404);
    if (!doctor) return error(res, 'Doctor not found', 404);

    const startWindow = new Date(appointmentDate.getTime() - 15 * 60 * 1000);
    const endWindow = new Date(appointmentDate.getTime() + Number(durationMinutes) * 60 * 1000);
    const conflict = await Appointment.findOne({
      doctor: doctor._id,
      status: { $in: ACTIVE_STATUSES },
      scheduledFor: { $gte: startWindow, $lt: endWindow },
    }).lean();

    if (conflict) {
      return error(res, 'Doctor already has an appointment near this time', 409);
    }

    const appointment = await Appointment.create({
      patient: patient._id,
      doctor: doctor._id,
      scheduledFor: appointmentDate,
      durationMinutes,
      reason,
    });

    const populated = await appointment.populate(appointmentPopulate);
    await createNotification({
      user: doctor.userId?._id,
      title: 'New appointment request',
      body: `${patient.userId?.name || 'A patient'} requested ${appointmentDate.toLocaleString('en-IN')}.`,
      type: 'appointment',
      page: 'appointments',
      params: { appointmentId: appointment._id },
    });

    return success(res, populated, 201);
  } catch (err) {
    next(err);
  }
};

exports.getAppointments = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;

    if (req.user.role === ROLES.PATIENT) {
      const patient = await Patient.findOne({ userId: req.user._id }).select('_id').lean();
      if (!patient) return error(res, 'Patient profile not found', 404);
      filter.patient = patient._id;
    } else if (req.user.role === ROLES.DOCTOR) {
      const doctor = await Doctor.findOne({ userId: req.user._id }).select('_id').lean();
      if (!doctor) return error(res, 'Doctor profile not found', 404);
      filter.doctor = doctor._id;
    } else if (req.query.doctorId) {
      filter.doctor = req.query.doctorId;
    }

    const appointments = await Appointment.find(filter)
      .populate(appointmentPopulate)
      .sort({ scheduledFor: 1 })
      .limit(80)
      .lean({ virtuals: true });

    return success(res, appointments);
  } catch (err) {
    next(err);
  }
};

exports.confirmAppointment = async (req, res, next) => {
  try {
    const doctor = await Doctor.findOne({ userId: req.user._id }).select('_id').lean();
    if (!doctor) return error(res, 'Doctor profile not found', 404);

    const appointment = await Appointment.findOne({
      _id: req.params.id,
      doctor: doctor._id,
      status: { $in: ACTIVE_STATUSES },
    }).populate(appointmentPopulate);

    if (!appointment) return error(res, 'Appointment not found or cannot be confirmed', 404);

    appointment.status = APPOINTMENT_STATUS.CONFIRMED;
    appointment.confirmedAt = appointment.confirmedAt || new Date();
    await appointment.save();

    await createNotification({
      user: appointment.patient?.userId?._id,
      title: 'Appointment confirmed',
      body: `${appointment.doctor?.userId?.name || 'Your doctor'} confirmed your appointment.`,
      type: 'appointment',
      page: 'appointments',
      params: { appointmentId: appointment._id },
    });

    return success(res, appointment);
  } catch (err) {
    next(err);
  }
};

exports.cancelAppointment = async (req, res, next) => {
  try {
    const appointment = await Appointment.findById(req.params.id).populate(appointmentPopulate);
    if (!appointment) return error(res, 'Appointment not found', 404);

    const isPatient =
      req.user.role === ROLES.PATIENT &&
      String(appointment.patient?.userId?._id) === String(req.user._id);
    const isDoctor =
      req.user.role === ROLES.DOCTOR &&
      String(appointment.doctor?.userId?._id) === String(req.user._id);
    const isAdmin = req.user.role === ROLES.ADMIN;

    if (!isPatient && !isDoctor && !isAdmin) {
      return error(res, 'Not authorized for this appointment', 403);
    }
    if ([APPOINTMENT_STATUS.COMPLETED, APPOINTMENT_STATUS.CANCELLED].includes(appointment.status)) {
      return error(res, `Appointment is already ${appointment.status}`, 409);
    }

    appointment.status = APPOINTMENT_STATUS.CANCELLED;
    appointment.cancelledAt = new Date();
    appointment.cancelledBy = req.user._id;
    await appointment.save();

    const targetUser =
      req.user.role === ROLES.DOCTOR
        ? appointment.patient?.userId?._id
        : appointment.doctor?.userId?._id;
    await createNotification({
      user: targetUser,
      title: 'Appointment cancelled',
      body: `${req.user.name || 'A participant'} cancelled the appointment.`,
      type: 'appointment',
      page: 'appointments',
      params: { appointmentId: appointment._id },
    });

    return success(res, appointment);
  } catch (err) {
    next(err);
  }
};

exports.updateAppointmentStatus = async (req, res, next) => {
  try {
    const { status, notes } = req.body;
    if (![APPOINTMENT_STATUS.COMPLETED, APPOINTMENT_STATUS.MISSED].includes(status)) {
      return error(res, 'Status must be completed or missed', 400);
    }

    const doctor = await Doctor.findOne({ userId: req.user._id }).select('_id').lean();
    if (!doctor) return error(res, 'Doctor profile not found', 404);

    const appointment = await Appointment.findOne({
      _id: req.params.id,
      doctor: doctor._id,
      status: APPOINTMENT_STATUS.CONFIRMED,
    }).populate(appointmentPopulate);

    if (!appointment) return error(res, 'Confirmed appointment not found', 404);

    appointment.status = status;
    if (notes) appointment.notes = notes;
    await appointment.save();

    await createNotification({
      user: appointment.patient?.userId?._id,
      title: status === APPOINTMENT_STATUS.MISSED ? 'Appointment missed' : 'Appointment completed',
      body:
        status === APPOINTMENT_STATUS.MISSED
          ? 'Your scheduled appointment was marked as missed.'
          : 'Your scheduled appointment was completed.',
      type: 'appointment',
      page: 'appointments',
      params: { appointmentId: appointment._id },
    });

    return success(res, appointment);
  } catch (err) {
    next(err);
  }
};
