# Virtual Cosmos

A 2D multiplayer “cosmos” where travelers appear on a shared plane, move in real time, and can chat when they are **mutual nearest neighbors** within a proximity radius (assignment V1).

## Stack

- **Monorepo** (npm workspaces): `shared/`, `client/`, `server/`
- **Client:** React (Vite), PixiJS, Tailwind CSS, Socket.IO client
- **Server:** Node.js, Express, Socket.IO
- **Shared:** world size, radius, speed limits, tick constants

## Local development

Requirements: **Node.js 20+**

```bash
npm install
npm run dev
```

- Client: http://localhost:5173 (proxies Socket.IO to the server)
- Server: http://localhost:3001 (`/health`)

Open two browser windows to verify multiple users.

## Environment

| Variable | Where | Purpose |
|----------|--------|---------|
| `VITE_SERVER_URL` | Client build | Socket/API origin in production (e.g. `https://your-api.onrender.com`) |
| `PORT` | Server | Listen port (default `3001`) |
| `CLIENT_ORIGIN` | Server | CORS origin(s) or `true` for reflect request origin |
