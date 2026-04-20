module.exports = {
  ROLES: {
    PATIENT: 'patient',
    DOCTOR: 'doctor',
    ADMIN: 'admin',
  },

  CONSULTATION_STATUS: {
    PENDING: 'pending',
    ACTIVE: 'active',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
  },

  SOCKET_EVENTS: {
    JOIN_CONSULTATION: 'joinConsultation',
    SEND_MESSAGE: 'sendMessage',
    RECEIVE_MESSAGE: 'receiveMessage',
    TYPING: 'typing',
    STOP_TYPING: 'stopTyping',
    DOCTOR_ONLINE: 'doctorOnline',
    DOCTOR_OFFLINE: 'doctorOffline',
    CONSULTATION_ENDED: 'consultationEnded',
    ERROR: 'error',
  },
};
