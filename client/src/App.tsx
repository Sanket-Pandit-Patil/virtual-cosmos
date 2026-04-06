import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import {
  clampToWorld,
  DISPLAY_NAME_MAX_LENGTH,
  MAX_DELTA_PER_TICK,
  PLAYER_RADIUS,
  POSITION_TICK_MS,
} from "@virtual-cosmos/shared";
import { ChatPanel } from "./components/ChatPanel";
import { CosmicCanvas } from "./components/CosmicCanvas";
import type { ChatRow } from "./types/chat";
import type { Player } from "./types";

type ProximityLink = {
  peerId: string;
  roomId: string;
  displayName: string;
  closing?: boolean;
};

function socketBaseUrl(): string | undefined {
  const env = import.meta.env.VITE_SERVER_URL;
  if (env) return env.replace(/\/$/, "");
  if (import.meta.env.DEV) return undefined;
  return undefined;
}

/** True when focus is in a field where WASD should type, not move. */
function isEditableFocused(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "TEXTAREA") return true;
  if (tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  if (tag === "INPUT") {
    const type = (target as HTMLInputElement).type.toLowerCase();
    return ["text", "search", "email", "password", "url", "tel", "number"].includes(
      type
    );
  }
  return false;
}

export function App() {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);
  const [selfId, setSelfId] = useState<string | null>(null);
  const [players, setPlayers] = useState<Map<string, Player>>(new Map());
  const [proximityLink, setProximityLink] = useState<ProximityLink | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatRow[]>([]);

  const playersRef = useRef(players);
  const selfIdRef = useRef(selfId);
  const proximityLinkRef = useRef(proximityLink);
  /** Avoid duplicate system lines when proximity:disconnect and player:left both arrive. */
  const proximityEndHandledRef = useRef(false);
  const keysRef = useRef<Set<string>>(new Set());
  const moveTargetRef = useRef<{ x: number; y: number } | null>(null);

  playersRef.current = players;
  selfIdRef.current = selfId;
  proximityLinkRef.current = proximityLink;

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
      const cur = proximityLinkRef.current;
      if (cur?.peerId === payload.id && !cur.closing) {
        if (!proximityEndHandledRef.current) {
          proximityEndHandledRef.current = true;
          setChatMessages((prev) => [
            ...prev,
            {
              kind: "system",
              id: `left-${Date.now()}`,
              variant: "peer_left",
              text: `${cur.displayName} left the cosmos.`,
              ts: Date.now(),
            },
          ]);
        }
      }
      setProximityLink((c) =>
        c?.peerId === payload.id ? { ...c, closing: true } : c
      );
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
      proximityEndHandledRef.current = false;
      setChatMessages([
        {
          kind: "system",
          id: `connect-${Date.now()}`,
          variant: "connect",
          text: `Connected to ${payload.displayName}.`,
          ts: Date.now(),
        },
      ]);
      setProximityLink({ ...payload, closing: false });
    };

    const onProximityDisconnect = (payload: { peerId: string }) => {
      const cur = proximityLinkRef.current;
      if (!cur || cur.peerId !== payload.peerId) return;
      if (!cur.closing && !proximityEndHandledRef.current) {
        proximityEndHandledRef.current = true;
        setChatMessages((prev) => [
          ...prev,
          {
            kind: "system",
            id: `disconnect-${Date.now()}`,
            variant: "disconnect",
            text: `Disconnected from ${cur.displayName}.`,
            ts: Date.now(),
          },
        ]);
      }
      setProximityLink({ ...cur, closing: true });
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
      proximityEndHandledRef.current = false;
      setProximityLink(null);
      setChatMessages([]);
      socket.disconnect();
    };
  }, [socket, name]);

  useEffect(() => {
    if (!socket) return;
    const onChat = (m: {
      fromId: string;
      fromName: string;
      text: string;
      ts?: number;
    }) => {
      setChatMessages((prev) => [
        ...prev,
        {
          kind: "user" as const,
          fromId: m.fromId,
          fromName: m.fromName,
          text: m.text,
          ts: typeof m.ts === "number" ? m.ts : Date.now(),
        },
      ]);
    };
    socket.on("chat:message", onChat);
    return () => {
      socket.off("chat:message", onChat);
    };
  }, [socket]);

  useEffect(() => {
    if (!proximityLink?.closing) return;
    const t = window.setTimeout(() => {
      proximityEndHandledRef.current = false;
      setProximityLink(null);
      setChatMessages([]);
    }, 2800);
    return () => window.clearTimeout(t);
  }, [proximityLink?.closing, proximityLink?.roomId]);

  useEffect(() => {
    if (!socket || !selfId) return;

    const movementKeys = new Set([
      "w",
      "a",
      "s",
      "d",
      "arrowup",
      "arrowdown",
      "arrowleft",
      "arrowright",
    ]);

    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (movementKeys.has(k) && isEditableFocused(e.target)) {
        return;
      }
      if (movementKeys.has(k)) {
        e.preventDefault();
        moveTargetRef.current = null;
      }
      keysRef.current.add(k);
    };
    const up = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key.toLowerCase());
    };

    window.addEventListener("keydown", down, { capture: true });
    window.addEventListener("keyup", up, { capture: true });

    const tick = () => {
      if (!socket.connected) return;
      const sid = selfIdRef.current;
      if (!sid) return;
      const map = playersRef.current;
      const self = map.get(sid);
      if (!self) return;

      const k = keysRef.current;
      let ix = 0;
      let iy = 0;
      const keyMove =
        k.has("w") ||
        k.has("arrowup") ||
        k.has("s") ||
        k.has("arrowdown") ||
        k.has("a") ||
        k.has("arrowleft") ||
        k.has("d") ||
        k.has("arrowright");

      if (keyMove) {
        moveTargetRef.current = null;
        if (k.has("w") || k.has("arrowup")) iy -= 1;
        if (k.has("s") || k.has("arrowdown")) iy += 1;
        if (k.has("a") || k.has("arrowleft")) ix -= 1;
        if (k.has("d") || k.has("arrowright")) ix += 1;
      } else if (moveTargetRef.current) {
        const t = moveTargetRef.current;
        const dx = t.x - self.x;
        const dy = t.y - self.y;
        const dist = Math.hypot(dx, dy);
        const arrive = PLAYER_RADIUS * 2.5;
        if (dist <= arrive) {
          moveTargetRef.current = null;
          return;
        }
        ix = dx / dist;
        iy = dy / dist;
      } else {
        return;
      }

      const len = Math.hypot(ix, iy);
      if (len < 1e-6) return;

      ix /= len;
      iy /= len;

      const nx = self.x + ix * MAX_DELTA_PER_TICK;
      const ny = self.y + iy * MAX_DELTA_PER_TICK;
      const c = clampToWorld(nx, ny);
      socket.emit("player:move", c);
    };

    const intervalId = window.setInterval(tick, POSITION_TICK_MS);

    return () => {
      window.removeEventListener("keydown", down, { capture: true });
      window.removeEventListener("keyup", up, { capture: true });
      window.clearInterval(intervalId);
      keysRef.current.clear();
      moveTargetRef.current = null;
    };
  }, [socket, selfId]);

  const onWorldClick = useCallback((x: number, y: number) => {
    const c = clampToWorld(x, y);
    moveTargetRef.current = { x: c.x, y: c.y };
  }, []);

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
            {players.size} traveler{players.size === 1 ? "" : "s"} online · WASD / arrows / click to move
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 text-right text-xs">
          <p className="text-slate-400">
            You: <span className="text-teal-300">{name.trim()}</span>
          </p>
          {proximityLink && !proximityLink.closing ? (
            <p className="rounded-md border border-teal-500/40 bg-teal-500/10 px-2 py-1 text-teal-200">
              Linked: <span className="font-medium">{proximityLink.displayName}</span>
            </p>
          ) : proximityLink?.closing ? (
            <p className="rounded-md border border-amber-500/35 bg-amber-500/10 px-2 py-1 text-amber-100/90">
              Chat ending…
            </p>
          ) : (
            <p className="text-slate-500">No proximity link</p>
          )}
        </div>
      </header>
      <main className="flex min-h-0 flex-1 flex-col gap-4 p-4 lg:flex-row">
        <div
          className="min-h-0 min-w-0 flex-1 rounded-xl outline-none ring-offset-2 ring-offset-cosmos-void focus-visible:ring-2 focus-visible:ring-teal-500/50"
          tabIndex={0}
          role="application"
          aria-label="Cosmos playfield. Click a destination or use WASD or arrow keys to move."
        >
          <CosmicCanvas
            players={players}
            selfId={selfId}
            linkedPeerId={
              proximityLink && !proximityLink.closing ? proximityLink.peerId : null
            }
            onWorldClick={onWorldClick}
          />
        </div>
        {proximityLink && selfId && socket ? (
          <div className="flex max-h-[40vh] min-h-[220px] shrink-0 flex-col lg:max-h-none lg:min-h-0 lg:w-80">
            <ChatPanel
              key={proximityLink.roomId}
              socket={socket}
              link={proximityLink}
              selfId={selfId}
              messages={chatMessages}
            />
          </div>
        ) : null}
      </main>
    </div>
  );
}
