import { FormEvent, useEffect, useRef } from "react";
import type { Socket } from "socket.io-client";
import { CHAT_MESSAGE_MAX_LENGTH } from "@virtual-cosmos/shared";
import type { ChatRow } from "../types/chat";

type ProximityLink = {
  peerId: string;
  roomId: string;
  displayName: string;
  closing?: boolean;
};

type Props = {
  socket: Socket;
  link: ProximityLink;
  selfId: string;
  messages: ChatRow[];
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const a = parts[0][0] ?? "";
    const b = parts[parts.length - 1][0] ?? "";
    return (a + b).toUpperCase();
  }
  return name.trim().slice(0, 2).toUpperCase() || "?";
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ChatPanel({ socket, link, selfId, messages }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const disabled = Boolean(link.closing);

  useEffect(() => {
    if (!disabled) {
      inputRef.current?.focus();
    }
  }, [link.roomId, disabled]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = (e: FormEvent) => {
    e.preventDefault();
    if (disabled) return;
    const input = inputRef.current;
    const t = input?.value.trim() ?? "";
    if (!t) return;
    socket.emit("chat:message", { roomId: link.roomId, text: t });
    if (input) input.value = "";
  };

  return (
    <aside
      className={`flex w-full min-h-0 flex-col rounded-xl border border-white/10 bg-cosmos-mist/90 shadow-lg backdrop-blur transition-opacity duration-300 sm:w-80 ${
        disabled ? "opacity-75" : ""
      }`}
    >
      <div className="border-b border-white/10 px-3 py-2">
        <p className="font-display text-sm font-semibold text-white">Proximity chat</p>
        <p className="text-xs text-cosmos-dim">
          {disabled ? "Connection ended" : `With ${link.displayName}`}
        </p>
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-2 text-sm">
        {messages.length === 0 && (
          <p className="text-xs text-slate-500">Say hello — you are in range.</p>
        )}
        {messages.map((row, i) => {
          if (row.kind === "system") {
            const tone =
              row.variant === "connect"
                ? "border-teal-500/30 bg-teal-500/10 text-teal-100/90"
                : row.variant === "disconnect"
                  ? "border-amber-500/25 bg-amber-500/10 text-amber-100/90"
                  : "border-slate-600/40 bg-slate-500/10 text-slate-300";
            return (
              <div
                key={row.id}
                className={`rounded-lg border px-2.5 py-2 text-center text-xs ${tone}`}
                role="status"
              >
                <p>{row.text}</p>
                <p className="mt-1 font-mono text-[10px] opacity-60">{formatTime(row.ts)}</p>
              </div>
            );
          }

          const mine = row.fromId === selfId;
          const ini = initials(row.fromName);
          return (
            <div
              key={`${row.ts}-${i}-${row.fromId}`}
              className={`flex gap-2 ${mine ? "flex-row-reverse" : "flex-row"}`}
            >
              <div
                className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                  mine
                    ? "bg-teal-500/35 text-teal-100"
                    : "bg-slate-600/50 text-slate-200"
                }`}
                aria-hidden
              >
                {ini}
              </div>
              <div className={`flex min-w-0 flex-col ${mine ? "items-end" : "items-start"}`}>
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-slate-500">
                  <span>{mine ? "You" : row.fromName}</span>
                  <span className="font-mono normal-case opacity-70">{formatTime(row.ts)}</span>
                </div>
                <p
                  className={`mt-0.5 max-w-[min(100%,220px)] rounded-lg px-2.5 py-1.5 ${
                    mine
                      ? "bg-teal-500/25 text-teal-50"
                      : "bg-white/5 text-slate-200"
                  }`}
                >
                  {row.text}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={send} className="border-t border-white/10 p-2">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            className="min-w-0 flex-1 rounded-lg border border-white/10 bg-cosmos-void/80 px-2 py-2 text-sm outline-none transition enabled:ring-teal-400/20 focus-visible:border-teal-400/40 focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50"
            placeholder={disabled ? "Chat closed" : "Message…"}
            maxLength={CHAT_MESSAGE_MAX_LENGTH}
            disabled={disabled}
            aria-label="Chat message"
          />
          <button
            type="submit"
            disabled={disabled}
            className="shrink-0 rounded-lg bg-teal-500/90 px-3 py-2 text-sm font-semibold text-cosmos-void transition enabled:hover:bg-teal-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Send
          </button>
        </div>
      </form>
    </aside>
  );
}
