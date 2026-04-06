# Virtual Cosmos

A 2D multiplayer “cosmos” where travelers appear on a shared plane, move in real time, and can chat when they are **mutual nearest neighbors** within a proximity radius (assignment V1).

## Behavior (V1)

- **Movement:** WASD or arrow keys; the client sends absolute `(x, y)` on a fixed tick; the server clamps to the world and caps per-tick travel distance.
- **Proximity:** Each player’s nearest neighbor within `PROXIMITY_RADIUS` is computed on the server. A **link** exists only when both players are each other’s nearest in-range neighbor (stable pairwise symmetry).
- **Chat:** When linked, both sockets join the same Socket.IO room; the chat panel opens. Moving apart or a better mutual nearest match tears the room down and hides chat.

Shared tuning lives in `shared/src/index.ts` (world size, radius, speed, tick interval).

## Stack

- **Monorepo** (npm workspaces): `shared/`, `client/`, `server/`
- **Client:** React (Vite), PixiJS, Tailwind CSS, Socket.IO client
- **Server:** Node.js, Express, Socket.IO (in-memory player state; no MongoDB in V1)

## Local development

Requirements: **Node.js 20+**

```bash
npm install
npm run dev
```

- Client: http://localhost:5173 (proxies `/socket.io` to the server)
- Server: http://localhost:3001 (`GET /health`)

Open two browser windows (or one plus a private window) to test movement, proximity, and chat.

## Environment variables

Copy `.env.example` to `.env` in the repo root if you run tooling that reads it; Vite reads `VITE_*` from `client/` or the shell.

| Variable | Where | Purpose |
|----------|--------|---------|
| `VITE_SERVER_URL` | Client **build** | Socket/API origin in production (no trailing slash). Omit in local dev to use the Vite proxy. |
| `PORT` | Server | Listen port (default `3001`) |
| `HOST` | Server | Bind address (default `0.0.0.0` for PaaS) |
| `CLIENT_ORIGIN` | Server | CORS: `true`, `false`, a single origin string, or comma-separated origins for your deployed frontend |

## Deployment (single demo URL per tier)

Recommended split:

1. **Frontend — Vercel or Netlify**  
   - Connect this repository.  
   - Use root **`vercel.json`** (included) so the install runs at the monorepo root and the client build outputs `client/dist`.  
   - Add build env: `VITE_SERVER_URL=https://<your-api-host>` (your Render/Railway URL, **no** trailing slash).

2. **Backend — Render or Railway**  
   - **Root directory:** repository root.  
   - **Build command:** `npm install && npm run build -w server`  
   - **Start command:** `npm run start -w server`  
   - **Env:** `PORT` is usually injected by the platform; set `CLIENT_ORIGIN` to your frontend origin (e.g. `https://your-app.vercel.app`).

After deploy, confirm `GET https://<api>/health` returns JSON and that the browser can open a WebSocket to the same host (Render/Railway expose HTTPS; Socket.IO will upgrade correctly).

### All-in-one on Render (optional)

Build the client, then serve `client/dist` from Express (already supported when `client/dist` exists on disk). One service can host both, at the cost of coupling deploys.

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Concurrent client (Vite) + server (tsx watch) |
| `npm run build` | Production build of client and server |
| `npm start` | Run compiled server (`server/dist`) |

## Before you submit (checklist)

1. **Repository:** Public GitHub repo with this README and clean history (optional: pin a release tag).
2. **Live demo (recommended):** Deploy client + API (see **Deployment**), then add both URLs at the top of the repo description or here:
   - Frontend: `https://…`
   - API: `https://…` (Socket.IO on same host)
3. **Demo video (2–5 minutes):** Show two browsers or two users — movement (WASD / click-to-move), real-time sync, moving together until **Linked** appears, sending chat, then moving apart until chat closes.
4. **Assignment form:** Submit the repo link + video as required by your course (e.g. [submission form](https://forms.gle/GtkmYbjw4FVkrCzB8) if that is still the official link).

**Note:** MongoDB was intentionally omitted for V1; all session state is in-memory on the server (document this if your rubric asks for persistence tradeoffs).

## License

MIT — see [LICENSE](./LICENSE).
