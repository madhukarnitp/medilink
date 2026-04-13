const crypto = require('crypto');

const getSecret = () =>
  process.env.PRESCRIPTION_VERIFY_SECRET ||
  process.env.JWT_SECRET ||
  'medilink-dev-prescription-verification-secret';

const getDateValue = (value) => {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  const time = date.getTime();
  return Number.isNaN(time) ? '' : String(time);
};

const getPayload = (prescription) =>
  [
    prescription._id?.toString() || '',
    prescription.rxId || '',
    getDateValue(prescription.createdAt),
  ].join('.');

const createPrescriptionVerificationToken = (prescription) =>
  crypto
    .createHmac('sha256', getSecret())
    .update(getPayload(prescription))
    .digest('hex');

const isValidPrescriptionVerificationToken = (prescription, token = '') => {
  if (!/^[a-f0-9]{64}$/i.test(token)) return false;

  const expected = Buffer.from(createPrescriptionVerificationToken(prescription), 'hex');
  const received = Buffer.from(token, 'hex');
  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
};

const addPublicVerification = (prescription) => {
  if (!prescription) return prescription;
  const plain =
    typeof prescription.toObject === 'function'
      ? prescription.toObject({ virtuals: true })
      : prescription;
  const token = createPrescriptionVerificationToken(plain);

  return {
    ...plain,
    publicVerification: {
      token,
      path: `/verify/prescription/${plain._id}?token=${token}`,
    },
  };
};

module.exports = {
  addPublicVerification,
  createPrescriptionVerificationToken,
  isValidPrescriptionVerificationToken,
};
