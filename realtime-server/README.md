# MediLink Realtime Server

This service owns Socket.IO traffic for chat, presence, consultation room joins, call events, and WebRTC signaling. The actual WebRTC audio/video media still flows peer-to-peer unless you add TURN/SFU infrastructure later.

It is deployable as its own app from the `realtime-server/` folder. It does not need to import files from `backend/`; it only needs the same MongoDB database and JWT secret.

## Local Development

```bash
npm run dev --prefix realtime-server
```

Default URL:

```text
http://localhost:5002
```

For local development, create `realtime-server/.env` from `.env.example`. Keep `JWT_SECRET`, `MONGODB_URI`, and `REALTIME_INTERNAL_SECRET` aligned with the API server values.

## Separate Hosting

On your realtime hosting provider, set the app root/base directory to:

```text
realtime-server
```

Use this start command:

```bash
npm start
```

Required environment variables:

```env
NODE_ENV=production
MONGODB_URI=mongodb+srv://...
JWT_SECRET=same-secret-as-backend
ALLOWED_ORIGINS=https://your-frontend-domain.com
REALTIME_INTERNAL_SECRET=same-shared-secret-as-backend
```

If your host does not inject `PORT`, add `REALTIME_PORT=5002` or the port required by that provider.

On the API backend host, set:

```env
REALTIME_SERVER_URL=https://your-realtime-domain.com
REALTIME_INTERNAL_SECRET=same-shared-secret-as-realtime
```

On the frontend host, set:

```env
VITE_REALTIME_URL=https://your-realtime-domain.com
```

## Internal Bridge

The main API sends REST-originated realtime events to:

```text
POST /internal/emit
```

Requests must include:

```text
x-realtime-secret: <REALTIME_INTERNAL_SECRET>
```

Clients should not call this endpoint directly.
