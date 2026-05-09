# MediLink Deployment

MediLink is deployed as separate services. Do not deploy the repository root as a single production service.

## Backend API

Use this service root directory:

```text
backend
```

Render settings:

```text
Runtime: Node
Build command: npm install
Start command: npm start
Health check path: /api/health
```

Railway settings:

```text
Root directory: backend
Start command: npm start
Health check path: /api/health
```

Required environment variables are listed in `backend/.env.example`.

## Realtime Server

Use this service root directory:

```text
realtime-server
```

Render settings:

```text
Runtime: Node
Build command: npm install
Start command: npm start
Health check path: /health
```

Railway settings:

```text
Root directory: realtime-server
Start command: npm start
Health check path: /health
```

Required environment variables are listed in `realtime-server/.env.example`.

Keep `JWT_SECRET`, `MONGODB_URI`, and `REALTIME_INTERNAL_SECRET` aligned between the backend and realtime services.

## Frontend

Use this service root directory:

```text
frontend
```

Render static site settings:

```text
Build command: npm install && npm run build
Publish directory: dist
```

Vercel settings:

```text
Framework preset: Vite
Build command: npm run build
Output directory: dist
```

Required environment variables are listed in `frontend/.env.example`.
