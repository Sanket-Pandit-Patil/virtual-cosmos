import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  clampToWorld,
  DISPLAY_NAME_MAX_LENGTH,
  MAX_DELTA_PER_TICK,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from "@virtual-cosmos/shared";
import { syncProximityPairs } from "./proximity.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3001;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? true;

const app = express();
app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: CLIENT_ORIGIN, methods: ["GET", "POST"] },
});

type PublicPlayer = {
  id: string;
  displayName: string;
  x: number;
  y: number;
};

const players = new Map<string, PublicPlayer>();
const activeProximityPairs = new Set<string>();

function randomSpawn(): { x: number; y: number } {
  const margin = 80;
  return {
    x: margin + Math.random() * (WORLD_WIDTH - 2 * margin),
    y: margin + Math.random() * (WORLD_HEIGHT - 2 * margin),
  };
}

function sanitizeName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim().slice(0, DISPLAY_NAME_MAX_LENGTH);
  return t.length > 0 ? t : null;
}

function applyMovement(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number
): { x: number; y: number } {
  const clamped = clampToWorld(toX, toY);
  let nx = clamped.x;
  let ny = clamped.y;
  const dx = nx - fromX;
  const dy = ny - fromY;
  const len = Math.hypot(dx, dy);
  if (len > MAX_DELTA_PER_TICK && len > 0) {
    const s = MAX_DELTA_PER_TICK / len;
    nx = fromX + dx * s;
    ny = fromY + dy * s;
  }
  return clampToWorld(nx, ny);
}

io.on("connection", (socket) => {
  socket.on("player:join", (payload: { displayName?: string }) => {
    if (players.has(socket.id)) return;
    const displayName = sanitizeName(payload?.displayName);
    if (!displayName) {
      socket.emit("player:join_error", { message: "Invalid display name." });
      return;
    }
    const { x, y } = randomSpawn();
    const id = socket.id;
    const player: PublicPlayer = { id, displayName, x, y };
    players.set(id, player);
    socket.broadcast.emit("player:joined", player);
    socket.emit("world:state", {
      selfId: id,
      players: Array.from(players.values()),
    });
    syncProximityPairs(io, players, activeProximityPairs);
  });

  socket.on("player:move", (payload: { x?: unknown; y?: unknown }) => {
    const p = players.get(socket.id);
    if (!p) return;
    if (typeof payload?.x !== "number" || typeof payload?.y !== "number") return;
    if (!Number.isFinite(payload.x) || !Number.isFinite(payload.y)) return;
    const next = applyMovement(p.x, p.y, payload.x, payload.y);
    p.x = next.x;
    p.y = next.y;
    io.emit("player:moved", { id: socket.id, x: p.x, y: p.y });
    syncProximityPairs(io, players, activeProximityPairs);
  });

  socket.on("disconnect", () => {
    if (!players.has(socket.id)) return;
    players.delete(socket.id);
    io.emit("player:left", { id: socket.id });
    syncProximityPairs(io, players, activeProximityPairs);
  });
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

const clientDist = path.join(__dirname, "../../client/dist");
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

httpServer.listen(PORT, () => {
  console.log(`[cosmos] server http://localhost:${PORT}`);
});
