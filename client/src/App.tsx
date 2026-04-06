import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import {
  clampToWorld,
  DISPLAY_NAME_MAX_LENGTH,
  MAX_DELTA_PER_TICK,
  POSITION_TICK_MS,
} from "@virtual-cosmos/shared";
import { ChatPanel } from "./components/ChatPanel";
import { CosmicCanvas } from "./components/CosmicCanvas";
import type { Player } from "./types";

type ProximityLink = {
  peerId: string;
  roomId: string;
  displayName: string;
};

function socketBaseUrl(): string | undefined {
  const env = import.meta.env.VITE_SERVER_URL;
  if (env) return env.replace(/\/$/, "");
  if (import.meta.env.DEV) return undefined;
  return undefined;
}

export function App() {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);
  const [selfId, setSelfId] = useState<string | null>(null);
  const [players, setPlayers] = useState<Map<string, Player>>(new Map());
  const [proximityLink, setProximityLink] = useState<ProximityLink | null>(null);

  const playersRef = useRef(players);
  const selfIdRef = useRef(selfId);
  const keysRef = useRef<Set<string>>(new Set());

  playersRef.current = players;
  selfIdRef.current = selfId;

  const socket = useMemo<Socket | null>(() => {
    if (!joined) return null;
    return io(socketBaseUrl(), {
      path: "/socket.io",
      transports: ["websocket", "polling"],
      autoConnect: false,
    });
  }, [joined]);

  useEffect(() => {
    if (!socket) return;

    const onState = (payload: { selfId: string; players: Player[] }) => {
      setSelfId(payload.selfId);
      setPlayers(new Map(payload.players.map((p) => [p.id, p])));
      setError(null);
    };

    const onJoined = (p: Player) => {
      setPlayers((prev) => new Map(prev).set(p.id, { ...p }));
    };

    const onLeft = (payload: { id: string }) => {
      setProximityLink((cur) => (cur?.peerId === payload.id ? null : cur));
      setPlayers((prev) => {
        const next = new Map(prev);
        next.delete(payload.id);
        return next;
      });
    };

    const onMoved = (payload: { id: string; x: number; y: number }) => {
      setPlayers((prev) => {
        const next = new Map(prev);
        const cur = next.get(payload.id);
        if (cur) {
          next.set(payload.id, { ...cur, x: payload.x, y: payload.y });
        }
        return next;
      });
    };

    const onJoinErr = (payload: { message?: string }) => {
      setError(payload.message ?? "Could not join.");
      setJoined(false);
    };

    const onProximityConnect = (payload: ProximityLink) => {
      setProximityLink(payload);
    };

    const onProximityDisconnect = (payload: { peerId: string }) => {
      setProximityLink((cur) => (cur?.peerId === payload.peerId ? null : cur));
    };

    socket.on("world:state", onState);
    socket.on("player:joined", onJoined);
    socket.on("player:left", onLeft);
    socket.on("player:moved", onMoved);
    socket.on("player:join_error", onJoinErr);
    socket.on("proximity:connect", onProximityConnect);
    socket.on("proximity:disconnect", onProximityDisconnect);
    socket.connect();
    socket.emit("player:join", { displayName: name.trim() });

    return () => {
      socket.off("world:state", onState);
      socket.off("player:joined", onJoined);
      socket.off("player:left", onLeft);
      socket.off("player:moved", onMoved);
      socket.off("player:join_error", onJoinErr);
      socket.off("proximity:connect", onProximityConnect);
      socket.off("proximity:disconnect", onProximityDisconnect);
      setProximityLink(null);
      socket.disconnect();
    };
  }, [socket, name]);

  useEffect(() => {
    if (!socket) return;

    const down = (e: KeyboardEvent) => {
      keysRef.current.add(e.key.toLowerCase());
    };
    const up = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key.toLowerCase());
    };

    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);

    const tick = () => {
      const sid = selfIdRef.current;
      if (!sid || !socket.connected) return;
      const map = playersRef.current;
      const self = map.get(sid);
      if (!self) return;

      const k = keysRef.current;
      let ix = 0;
      let iy = 0;
      if (k.has("w") || k.has("arrowup")) iy -= 1;
      if (k.has("s") || k.has("arrowdown")) iy += 1;
      if (k.has("a") || k.has("arrowleft")) ix -= 1;
      if (k.has("d") || k.has("arrowright")) ix += 1;

      const len = Math.hypot(ix, iy);
      if (len < 1e-6) return;

      ix /= len;
      iy /= len;

      const nx = self.x + ix * MAX_DELTA_PER_TICK;
      const ny = self.y + iy * MAX_DELTA_PER_TICK;
      const c = clampToWorld(nx, ny);
      socket.emit("player:move", c);
    };

    let intervalId: number | undefined;
    const startTick = () => {
      if (intervalId !== undefined) window.clearInterval(intervalId);
      intervalId = window.setInterval(tick, POSITION_TICK_MS);
    };

    socket.on("connect", startTick);
    if (socket.connected) startTick();

    return () => {
      socket.off("connect", startTick);
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      if (intervalId !== undefined) window.clearInterval(intervalId);
    };
  }, [socket]);

  const enter = useCallback(() => {
    const t = name.trim();
    if (!t) {
      setError("Enter a display name.");
      return;
    }
    setError(null);
    setJoined(true);
  }, [name]);

  if (!joined) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-cosmos-mist/60 p-8 shadow-xl backdrop-blur">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-white">
            Virtual Cosmos
          </h1>
          <p className="mt-2 text-sm text-cosmos-dim">
            Proximity-based space. Enter your name to spawn in the world.
          </p>
          <label className="mt-6 block text-xs font-medium uppercase tracking-wide text-slate-400">
            Display name
          </label>
          <input
            className="mt-2 w-full rounded-lg border border-white/10 bg-cosmos-void/80 px-3 py-2.5 text-sm outline-none ring-teal-400/30 focus:border-teal-400/50 focus:ring-2"
            maxLength={DISPLAY_NAME_MAX_LENGTH}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Alex"
            onKeyDown={(e) => e.key === "Enter" && enter()}
          />
          {error && (
            <p className="mt-2 text-sm text-red-400" role="alert">
              {error}
            </p>
          )}
          <button
            type="button"
            className="mt-6 w-full rounded-lg bg-teal-500/90 py-2.5 text-sm font-semibold text-cosmos-void transition hover:bg-teal-400"
            onClick={enter}
          >
            Enter cosmos
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-4 border-b border-white/10 px-4 py-3">
        <div>
          <h1 className="font-display text-lg font-semibold text-white">Virtual Cosmos</h1>
          <p className="text-xs text-cosmos-dim">
            {players.size} traveler{players.size === 1 ? "" : "s"} online · WASD / arrows to move
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 text-right text-xs">
          <p className="text-slate-400">
            You: <span className="text-teal-300">{name.trim()}</span>
          </p>
          {proximityLink ? (
            <p className="rounded-md border border-teal-500/40 bg-teal-500/10 px-2 py-1 text-teal-200">
              Linked: <span className="font-medium">{proximityLink.displayName}</span>
            </p>
          ) : (
            <p className="text-slate-500">No proximity link</p>
          )}
        </div>
      </header>
      <main className="flex min-h-0 flex-1 flex-col gap-4 p-4 lg:flex-row">
        <div className="min-h-0 min-w-0 flex-1">
          <CosmicCanvas players={players} selfId={selfId} />
        </div>
        {proximityLink && selfId && socket ? (
          <div className="flex max-h-[40vh] min-h-[220px] shrink-0 flex-col lg:max-h-none lg:min-h-0 lg:w-80">
            <ChatPanel key={proximityLink.roomId} socket={socket} link={proximityLink} selfId={selfId} />
          </div>
        ) : null}
      </main>
    </div>
  );
}
