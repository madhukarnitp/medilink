const request = require('supertest');
const mongoose = require('mongoose');
const { app } = require('../server');
const Notification = require('../models/Notification');

const MONGO_URI = process.env.MONGODB_URI_TEST || 'mongodb://localhost:27017/medilink_test';

jest.setTimeout(20000);

let token;
let userId;
let notificationId;

beforeAll(async () => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(MONGO_URI);
  }

  const res = await request(app).post('/api/auth/register').send({
    name: 'Notify Patient',
    email: 'notify.patient@test.com',
    password: 'password123',
    role: 'patient',
  });
  token = res.body.data.token;
  userId = res.body.data.user._id;
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
});

describe('Notifications API', () => {
  beforeEach(async () => {
    const item = await Notification.create({
      user: userId,
      title: 'Saved notification',
      body: 'This should survive refresh',
      type: 'message',
      page: 'consultation',
      params: { consultationId: new mongoose.Types.ObjectId().toString() },
    });
    notificationId = item._id.toString();
  });

  afterEach(async () => {
    await Notification.deleteMany({});
  });

  it('lists persisted notifications for the current user', async () => {
    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.unread).toBe(1);
    expect(res.body.data.items[0]._id).toBe(notificationId);
  });

  it('marks and clears notifications', async () => {
    const readRes = await request(app)
      .put(`/api/notifications/${notificationId}/read`)
      .set('Authorization', `Bearer ${token}`);

    expect(readRes.statusCode).toBe(200);
    expect(readRes.body.data.readAt).toBeTruthy();

    const clearRes = await request(app)
      .delete('/api/notifications')
      .set('Authorization', `Bearer ${token}`);

    expect(clearRes.statusCode).toBe(200);
    expect(await Notification.countDocuments({ user: userId })).toBe(0);
  });
});
