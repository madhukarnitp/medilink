# MediLink Mail Sender API

Standalone Vercel serverless API for sending MediLink emails through Gmail SMTP.

## Folder Structure

```text
mail-sender-api/
  api/
    send-mail.js
  .env.example
  package.json
  README.md
```

## API

`POST /api/send-mail`

Headers:

```http
Content-Type: application/json
x-api-key: <MAIL_API_SECRET>
```

Body:

```json
{
  "to": "user@example.com",
  "subject": "Email subject",
  "html": "<h1>Hello</h1>"
}
```

For Gmail SMTP, use a Google App Password. Your normal Gmail password will not work when 2-Step Verification is enabled.

## Responses

- `200` - Email sent successfully, returns the SMTP message id.
- `400` - Missing `to`, `subject`, or `html`, or `to` is not a valid email address.
- `401` - Missing or invalid `x-api-key`.
- `403` - Browser-originated requests are rejected.
- `405` - Method is not `POST`.
- `429` - Too many requests from the same client.
- `500` - Mail service configuration or SMTP send failure.

## Local Setup

```bash
cd mail-sender-api
npm install
cp .env.example .env
```

Fill `.env`:

```env
MAIL_API_SECRET=make_this_a_long_random_secret
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your-gmail-address@gmail.com
SMTP_PASS=your-google-app-password
MAIL_FROM_EMAIL="MediLink <your-gmail-address@gmail.com>"
```

Run locally:

```bash
npm run dev
```

Local URL:

```text
http://localhost:3000/api/send-mail
```

## Deploy to Vercel

1. Push this `mail-sender-api` folder to GitHub, or import the existing repository in Vercel and set the project root to `mail-sender-api`.
2. In Vercel, add these Environment Variables:

```text
MAIL_API_SECRET
SMTP_HOST
SMTP_PORT
SMTP_SECURE
SMTP_USER
SMTP_PASS
MAIL_FROM_EMAIL
```

3. Deploy the project.
4. Copy the deployed URL, for example:

```text
https://medilink-mail-sender.vercel.app/api/send-mail
```

## Call From MediLink Backend

Keep these values only in your main MediLink backend `.env`:

```env
MAIL_SENDER_API_URL=https://medilink-mail-sender.vercel.app/api/send-mail
MAIL_API_SECRET=the_same_secret_set_in_vercel
```

### Using fetch

```js
async function sendMail({ to, subject, html }) {
  const response = await fetch(process.env.MAIL_SENDER_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.MAIL_API_SECRET
    },
    body: JSON.stringify({ to, subject, html })
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || 'Failed to send email');
  }

  return result;
}
```

### Using axios

```js
import axios from 'axios';

async function sendMail({ to, subject, html }) {
  const { data } = await axios.post(
    process.env.MAIL_SENDER_API_URL,
    { to, subject, html },
    {
      headers: {
        'x-api-key': process.env.MAIL_API_SECRET
      }
    }
  );

  return data;
}
```

## Security Notes

- Do not call this API directly from the frontend.
- Do not store `MAIL_API_SECRET` in frontend `.env` files.
- Do not expose `SMTP_PASS` anywhere except this Vercel mail API project.
- Use a Google App Password for `SMTP_PASS`; do not use your normal Google account password.
- Browser-originated requests are rejected using browser request headers and blocked preflight handling.
- The in-memory rate limit is best-effort on Vercel serverless functions. For stronger abuse protection, add Vercel Firewall, Upstash Redis rate limiting, or another shared rate-limit store.
