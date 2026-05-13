require('../models/Doctor');
require('../models/Patient');

const Consultation = require('../models/Consultation');
const { CONSULTATION_STATUS, SOCKET_EVENTS } = require('../utils/constants');
const { config, consultationCache } = require('./state');

const asId = (value) => {
  if (!value) return null;
  if (value._id) return value._id.toString();
  return value.toString();
};

const sameId = (left, right) => asId(left) === asId(right);

const getUserIdFromProfile = (profile) => {
  const userId = profile?.userId;
  return userId?._id || userId;
};

const setCachedConsultation = (consultationId, consultation) => {
  if (!consultationId || !consultation) return;
  consultationCache.set(consultationId.toString(), {
    data: consultation,
    timestamp: Date.now(),
  });
};

const fetchConsultation = async (consultationId) => {
  const consultation = await Consultation.findById(consultationId)
    .populate({
      path: 'patient',
      select: 'userId',
      populate: { path: 'userId', select: 'name avatar' },
    })
    .populate({
      path: 'doctor',
      select: 'userId specialization',
      populate: { path: 'userId', select: 'name avatar' },
    })
    .lean();

  setCachedConsultation(consultationId, consultation);
  return consultation;
};

const getCachedConsultation = async (consultationId, { fresh = false } = {}) => {
  const cacheKey = consultationId?.toString();
  const cached = cacheKey ? consultationCache.get(cacheKey) : null;

  if (
    !fresh &&
    cached &&
    Date.now() - cached.timestamp < config.consultationCacheTtlMs
  ) {
    return cached.data;
  }

  return fetchConsultation(consultationId);
};

const userCanAccessConsultation = (user, consultation) => {
  const patientUserId = getUserIdFromProfile(consultation?.patient);
  const doctorUserId = getUserIdFromProfile(consultation?.doctor);

  return {
    isPatient: user.role === 'patient' && sameId(patientUserId, user._id),
    isDoctor: user.role === 'doctor' && sameId(doctorUserId, user._id),
    patientUserId,
    doctorUserId,
  };
};

const requireActiveConsultation = async (socket, consultationId) => {
  let consultation = await getCachedConsultation(consultationId);
  if (consultation && consultation.status !== CONSULTATION_STATUS.ACTIVE) {
    consultation = await getCachedConsultation(consultationId, { fresh: true });
  }

  if (!consultation || consultation.status !== CONSULTATION_STATUS.ACTIVE) {
    socket.emit(SOCKET_EVENTS.ERROR, { message: 'Consultation is not active' });
    return null;
  }

  const access = userCanAccessConsultation(socket.user, consultation);
  if (!access.isPatient && !access.isDoctor) {
    socket.emit(SOCKET_EVENTS.ERROR, {
      message: 'Not authorized for this consultation',
    });
    return null;
  }

  return { consultation, access };
};

module.exports = {
  getCachedConsultation,
  requireActiveConsultation,
  userCanAccessConsultation,
};
