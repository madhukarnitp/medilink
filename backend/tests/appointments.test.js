const request = require('supertest');
const mongoose = require('mongoose');
const { app } = require('../server');
const Appointment = require('../models/Appointment');
const Doctor = require('../models/Doctor');
const Notification = require('../models/Notification');

const MONGO_URI = process.env.MONGODB_URI_TEST || 'mongodb://localhost:27017/medilink_test';

jest.setTimeout(20000);

let patientToken;
let doctorToken;
let doctorUserId;
let doctorProfileId;
let appointmentId;

beforeAll(async () => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(MONGO_URI);
  }

  const patientRes = await request(app).post('/api/auth/register').send({
    name: 'Appointment Patient',
    email: 'appointment.patient@test.com',
    password: 'password123',
    role: 'patient',
  });
  patientToken = patientRes.body.data.token;

  const doctorRes = await request(app).post('/api/auth/register').send({
    name: 'Dr. Appointment',
    email: 'appointment.doctor@test.com',
    password: 'password123',
    role: 'doctor',
    specialization: 'General Physician',
    qualification: 'MBBS',
    regNo: 'APPT-DR-001',
    price: 500,
  });
  doctorToken = doctorRes.body.data.token;
  doctorUserId = doctorRes.body.data.user._id;

  const doctor = await Doctor.findOne({ userId: doctorUserId });
  doctorProfileId = doctor._id.toString();
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
});

afterEach(async () => {
  await Appointment.deleteMany({});
  await Notification.deleteMany({});
});

describe('Appointments API', () => {
  it('lets patients request appointments and notifies doctors', async () => {
    const scheduledFor = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const res = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({
        doctorId: doctorProfileId,
        scheduledFor,
        reason: 'Follow-up visit',
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.data.status).toBe('requested');
    expect(res.body.data.doctor._id).toBe(doctorProfileId);
    appointmentId = res.body.data._id;

    const notification = await Notification.findOne({ user: doctorUserId });
    expect(notification.title).toBe('New appointment request');
  });

  it('lets doctors confirm requested appointments', async () => {
    const created = await Appointment.create({
      doctor: doctorProfileId,
      patient: (await getPatientProfile())._id,
      scheduledFor: new Date(Date.now() + 25 * 60 * 60 * 1000),
      reason: 'Confirm test',
    });

    const res = await request(app)
      .put(`/api/appointments/${created._id}/confirm`)
      .set('Authorization', `Bearer ${doctorToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.status).toBe('confirmed');
    expect(res.body.data.confirmedAt).toBeTruthy();
  });

  it('blocks conflicting doctor slots', async () => {
    const scheduledFor = new Date(Date.now() + 26 * 60 * 60 * 1000);
    await Appointment.create({
      doctor: doctorProfileId,
      patient: (await getPatientProfile())._id,
      scheduledFor,
    });

    const res = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({
        doctorId: doctorProfileId,
        scheduledFor: scheduledFor.toISOString(),
        reason: 'Conflict test',
      });

    expect(res.statusCode).toBe(409);
  });
});

async function getPatientProfile() {
  const Patient = require('../models/Patient');
  const User = require('../models/User');
  const user = await User.findOne({ email: 'appointment.patient@test.com' });
  return Patient.findOne({ userId: user._id });
}
