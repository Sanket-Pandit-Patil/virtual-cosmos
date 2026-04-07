# Virtual Cosmos

**Real-time 2D multiplayer space** with **proximity-gated chat**: travelers move on a shared canvas; when two players are each other’s nearest neighbor inside a radius, they link, get a private chat room, and see shared UI—while everyone else still sees that link on the map.

<p align="center">
  <a href="https://virtual-cosmos-client-khrk.vercel.app/"><strong>Live app →</strong></a>
  &nbsp;·&nbsp;
  <a href="https://github.com/Sanket-Pandit-Patil/virtual-cosmos"><strong>Source</strong></a>
  &nbsp;·&nbsp;
  <a href="https://virtual-cosmos-nu9l.onrender.com/health"><strong>API health</strong></a>
</p>

| | URL |
|---|-----|
| **Frontend** | [virtual-cosmos-client-khrk.vercel.app](https://virtual-cosmos-client-khrk.vercel.app/) |
| **API (Socket.IO + REST)** | [virtual-cosmos-nu9l.onrender.com](https://virtual-cosmos-nu9l.onrender.com) |
| **Health check** | [`GET /health`](https://virtual-cosmos-nu9l.onrender.com/health) → `{"ok":true}` |

> **Try it:** open the live app in **two browsers** (or one + incognito), enter names, move close until **Linked** appears, then chat. Add a **third** window to see spectator lines and badges **without** the chat panel.

---

## Contents

- [Highlights](#highlights)
- [How it works](#how-it-works)
- [Stack & structure](#stack--structure)
- [Local development](#local-development)
- [Environment variables](#environment-variables)
- [Deployment](#deployment)
- [Assignment checklist](#assignment-checklist)
- [License](#license)

---

## Highlights

- **Authoritative server** — World bounds, speed cap, and proximity logic run on Node; clients send intent, server validates.
- **Mutual nearest-neighbor links** — A chat link exists only when *A*’s nearest in range is *B* and *B*’s nearest in range is *A* (symmetric, stable pairs).
- **Fair spectator UX** — `proximity:pairs` + `world:state.proximityPairs` sync **all** active pairs: orange connector lines, rings on both avatars (**green** ring on *your* avatar when you’re linked, **orange** on others), header badges like `Name ↔ Name connected` for third parties—**chat UI only for the linked pair**.
- **Session chat memory** — In-memory transcript per pair room; reconnecting the same two tabs can restore `history` on `proximity:connect` (new socket IDs after full page refresh start a new pairing key).
- **Polished canvas** — PixiJS playfield, procedural avatars, name labels, proximity ring for self, smoothed remote positions.

---

## How it works

1. **Join** — Socket emits `player:join` with display name; server assigns spawn and broadcasts state.
2. **Move** — Client sends clamped positions on a timer; server enforces `MAX_DELTA_PER_TICK` and world limits.
3. **Proximity** — Server recomputes desired pair set each tick; **set up** joins a Socket.IO room and emits `proximity:connect` to both; **tear down** emits `proximity:disconnect` and leaves the room.
4. **Chat** — Messages go to the room only if the socket is a member (`chat:message` + `roomId`).
5. **Broadcast pairs** — On any pair change, server emits `proximity:pairs` so every client updates lines and rings.

Tuning constants (`WORLD_*`, `PLAYER_RADIUS`, `PROXIMITY_RADIUS`, `MAX_SPEED`, tick ms) live in [`shared/src/index.ts`](./shared/src/index.ts).

---

## Stack & structure

| Layer | Choices |
|--------|---------|
| **Monorepo** | npm workspaces: `shared`, `client`, `server` |
| **Client** | React 18, Vite 6, TypeScript, Tailwind, **PixiJS 8**, Socket.IO client |
| **Server** | Node 20+, Express, **Socket.IO**, CORS from env |
| **Shared** | TypeScript constants + `clampToWorld` consumed by both tiers |

```
virtual-cosmos/
├── client/          # Vite + React + Pixi canvas
├── server/          # Express + Socket.IO (compiles to server/dist)
├── shared/          # @virtual-cosmos/shared
├── vercel.json      # Deploy root = repo (npm run build -w client)
├── client/vercel.json   # Deploy root = client/ (cd .. && …)
└── .nvmrc           # Node 20 for Vercel
```

**Persistence (V1):** Deliberately **no database**—players and chat history are **in-memory** for simplicity and fast iteration; document this tradeoff for rubrics that ask about durability.

---

## Local development

**Requirements:** Node.js **20+**

```bash
git clone https://github.com/Sanket-Pandit-Patil/virtual-cosmos.git
cd virtual-cosmos
npm install
npm run dev
```

| Service | URL |
|---------|-----|
| Client | [http://localhost:5173](http://localhost:5173) — proxies `/socket.io` → server |
| Server | [http://localhost:3001](http://localhost:3001) — [`/health`](http://localhost:3001/health) |

Use **two** windows for movement + chat; a **third** for spectator behavior.

---

## Environment variables

| Variable | Where | Purpose |
|----------|--------|---------|
| `VITE_SERVER_URL` | **Vercel** (build) | Production API origin, e.g. `https://virtual-cosmos-nu9l.onrender.com` — **no trailing slash**, spelling must be exact (`URL` not `UR`). |
| `CLIENT_ORIGIN` | **Render** | CORS + Socket.IO: your Vercel origin, e.g. `https://virtual-cosmos-client-khrk.vercel.app` |
| `PORT` / `HOST` | Server | `PORT` usually set by the host; `HOST` defaults to `0.0.0.0` |

Copy [`.env.example`](./.env.example) for local reference.

---

## Deployment

Production layout used for the **live demo** above:

| Tier | Platform | Notes |
|------|-----------|--------|
| **Frontend** | [Vercel](https://vercel.com) | Monorepo: leave **Root Directory** empty **or** set to `client` and rely on [`client/vercel.json`](./client/vercel.json). Set **`VITE_SERVER_URL`** to the Render URL. |
| **Backend** | [Render](https://render.com) | Root: repo root. Build: `npm install && npm run build -w server`. Start: `npm run start -w server`. |

**Render free tier:** first request after idle may take ~30–60s while the service wakes.

**Health checks:** `/health` and `/health/` both return JSON (see [`server/src/index.ts`](./server/src/index.ts)).

**Optional:** Run `npm run build` (client + server) on one host and let Express serve `client/dist` when present—single deploy, coupled releases.

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Client + server in watch mode |
| `npm run build` | Production build of client and server |
| `npm start` | Run compiled server (`server/dist`) |

---

## Assignment checklist

1. **Repo** — Public: [github.com/Sanket-Pandit-Patil/virtual-cosmos](https://github.com/Sanket-Pandit-Patil/virtual-cosmos)
2. **Live demo** — [virtual-cosmos-client-khrk.vercel.app](https://virtual-cosmos-client-khrk.vercel.app/) + API [virtual-cosmos-nu9l.onrender.com](https://virtual-cosmos-nu9l.onrender.com)
3. **Video (2–5 min)** — Two users: move, link, chat, unlink; optional third client as spectator.
4. **Course form** — Submit repo + video per instructions (e.g. [submission form](https://forms.gle/GtkmYbjw4FVkrCzB8) if still current).

---

## License

MIT — see [LICENSE](./LICENSE).
