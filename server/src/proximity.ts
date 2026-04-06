import type { Server } from "socket.io";
import { PROXIMITY_RADIUS } from "@virtual-cosmos/shared";
import { getChatHistory } from "./chatHistory.js";

export type PlayerState = {
  id: string;
  displayName: string;
  x: number;
  y: number;
};

function distance(a: PlayerState, b: PlayerState): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function pairKey(a: string, b: string): string {
  return a < b ? `${a}\0${b}` : `${b}\0${a}`;
}

function chatRoomFromKey(key: string): string {
  return `chat:${key}`;
}

function nearestInRadius(self: PlayerState, list: PlayerState[]): string | null {
  let best: string | null = null;
  let bestDist = Infinity;
  for (const o of list) {
    if (o.id === self.id) continue;
    const d = distance(self, o);
    if (d >= PROXIMITY_RADIUS) continue;
    if (d < bestDist) {
      bestDist = d;
      best = o.id;
    }
  }
  return best;
}

export function computeDesiredPairKeys(players: Map<string, PlayerState>): Set<string> {
  const list = Array.from(players.values());
  const nearest = new Map<string, string | null>();
  for (const p of list) {
    nearest.set(p.id, nearestInRadius(p, list));
  }
  const out = new Set<string>();
  for (const p of list) {
    const n = nearest.get(p.id);
    if (!n) continue;
    if (nearest.get(n) === p.id) {
      out.add(pairKey(p.id, n));
    }
  }
  return out;
}

export function syncProximityPairs(
  io: Server,
  players: Map<string, PlayerState>,
  activePairs: Set<string>
): void {
  const desired = computeDesiredPairKeys(players);
  for (const key of [...activePairs]) {
    if (!desired.has(key)) {
      const [a, b] = key.split("\0");
      tearDownPair(io, a, b);
      activePairs.delete(key);
    }
  }
  for (const key of desired) {
    if (!activePairs.has(key)) {
      const [a, b] = key.split("\0");
      setUpPair(io, players, a, b);
      activePairs.add(key);
    }
  }
}

function setUpPair(
  io: Server,
  players: Map<string, PlayerState>,
  a: string,
  b: string
): void {
  const key = pairKey(a, b);
  const room = chatRoomFromKey(key);
  io.sockets.sockets.get(a)?.join(room);
  io.sockets.sockets.get(b)?.join(room);
  const pa = players.get(a);
  const pb = players.get(b);
  const history = getChatHistory(room);
  io.to(a).emit("proximity:connect", {
    peerId: b,
    roomId: room,
    displayName: pb?.displayName ?? "Traveler",
    history,
  });
  io.to(b).emit("proximity:connect", {
    peerId: a,
    roomId: room,
    displayName: pa?.displayName ?? "Traveler",
    history,
  });
}

function tearDownPair(io: Server, a: string, b: string): void {
  const key = pairKey(a, b);
  const room = chatRoomFromKey(key);
  io.sockets.sockets.get(a)?.leave(room);
  io.sockets.sockets.get(b)?.leave(room);
  io.to(a).emit("proximity:disconnect", { peerId: b, roomId: room });
  io.to(b).emit("proximity:disconnect", { peerId: a, roomId: room });
}
