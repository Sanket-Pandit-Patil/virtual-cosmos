import { useCallback, useEffect, useMemo, useState } from "react";
import { io, Socket } from "socket.io-client";
import { DISPLAY_NAME_MAX_LENGTH } from "@virtual-cosmos/shared";
import { CosmicCanvas } from "./components/CosmicCanvas";
import type { Player } from "./types";

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
      setPlayers((prev) => {
        const next = new Map(prev);
        next.delete(payload.id);
        return next;
      });
    };

    const onJoinErr = (payload: { message?: string }) => {
      setError(payload.message ?? "Could not join.");
      setJoined(false);
    };

    socket.on("world:state", onState);
    socket.on("player:joined", onJoined);
    socket.on("player:left", onLeft);
    socket.on("player:join_error", onJoinErr);
    socket.connect();
    socket.emit("player:join", { displayName: name.trim() });

    return () => {
      socket.off("world:state", onState);
      socket.off("player:joined", onJoined);
      socket.off("player:left", onLeft);
      socket.off("player:join_error", onJoinErr);
      socket.disconnect();
    };
  }, [socket, name]);

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
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-white/10 px-4 py-3">
        <div>
          <h1 className="font-display text-lg font-semibold text-white">Virtual Cosmos</h1>
          <p className="text-xs text-cosmos-dim">
            {players.size} traveler{players.size === 1 ? "" : "s"} online
          </p>
        </div>
        <div className="text-right text-xs text-slate-400">
          You: <span className="text-teal-300">{name.trim()}</span>
        </div>
      </header>
      <main className="min-h-0 flex-1 p-4">
        <CosmicCanvas players={players} selfId={selfId} />
      </main>
    </div>
  );
}
