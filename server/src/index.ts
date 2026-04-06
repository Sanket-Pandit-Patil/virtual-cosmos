import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  DISPLAY_NAME_MAX_LENGTH,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from "@virtual-cosmos/shared";

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
  });

  socket.on("disconnect", () => {
    if (!players.has(socket.id)) return;
    players.delete(socket.id);
    io.emit("player:left", { id: socket.id });
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
