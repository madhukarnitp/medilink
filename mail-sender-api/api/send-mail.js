import nodemailer from 'nodemailer';

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 30;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const rateLimitStore = new Map();
let transporter;

function json(res, statusCode, payload) {
  return res.status(statusCode).json(payload);
}

function getClientKey(req) {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return forwardedFor.split(',')[0].trim();
  }

  return req.socket?.remoteAddress || 'unknown';
}

function isRateLimited(clientKey) {
  const now = Date.now();
  const entry = rateLimitStore.get(clientKey);

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(clientKey, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS
    });
    return false;
  }

  entry.count += 1;
  return entry.count > RATE_LIMIT_MAX_REQUESTS;
}

function isBrowserRequest(req) {
  return Boolean(req.headers.origin || req.headers.referer || req.headers['sec-fetch-site']);
}

function isMissingString(value) {
  return typeof value !== 'string' || value.trim().length === 0;
}

function isValidEmail(value) {
  return typeof value === 'string' && EMAIL_PATTERN.test(value.trim());
}

function getSmtpConfig() {
  return {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 465),
    secure: String(process.env.SMTP_SECURE ?? 'true').toLowerCase() !== 'false',
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.MAIL_FROM_EMAIL
  };
}

function getTransporter(config) {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.pass
      }
    });
  }

  return transporter;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    return json(res, 403, {
      success: false,
      message: 'Browser requests are not allowed'
    });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, {
      success: false,
      message: 'Method not allowed'
    });
  }

  if (isBrowserRequest(req)) {
    return json(res, 403, {
      success: false,
      message: 'Browser requests are not allowed'
    });
  }

  const clientKey = getClientKey(req);
  if (isRateLimited(clientKey)) {
    return json(res, 429, {
      success: false,
      message: 'Too many requests. Please try again later.'
    });
  }

  const configuredSecret = process.env.MAIL_API_SECRET;
  const requestSecret = req.headers['x-api-key'];

  if (!configuredSecret || requestSecret !== configuredSecret) {
    return json(res, 401, {
      success: false,
      message: 'Unauthorized'
    });
  }

  const { to, subject, html } = req.body || {};

  if (isMissingString(to) || isMissingString(subject) || isMissingString(html)) {
    return json(res, 400, {
      success: false,
      message: 'to, subject, and html are required'
    });
  }

  if (!isValidEmail(to)) {
    return json(res, 400, {
      success: false,
      message: 'to must be a valid email address'
    });
  }

  const smtpConfig = getSmtpConfig();
  const missing = ['user', 'pass', 'from'].filter((key) => !smtpConfig[key]);

  if (missing.length) {
    return json(res, 500, {
      success: false,
      message: 'Mail service is not configured'
    });
  }

  const mailer = getTransporter(smtpConfig);

  try {
    const info = await mailer.sendMail({
      from: smtpConfig.from,
      to: to.trim(),
      subject: subject.trim(),
      html
    });

    return json(res, 200, {
      success: true,
      message: 'Email sent successfully',
      id: info.messageId
    });
  } catch (error) {
    console.error('SMTP mail send error:', {
      name: error?.name,
      message: error?.message,
      code: error?.code,
      command: error?.command,
      responseCode: error?.responseCode
    });
    return json(res, 500, {
      success: false,
      message: 'Failed to send email'
    });
  }
}
