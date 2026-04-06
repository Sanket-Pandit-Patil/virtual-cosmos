import { FormEvent, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { CHAT_MESSAGE_MAX_LENGTH } from "@virtual-cosmos/shared";

export type ChatMessage = {
  fromId: string;
  fromName: string;
  text: string;
  ts: number;
};

type ProximityLink = {
  peerId: string;
  roomId: string;
  displayName: string;
};

type Props = {
  socket: Socket;
  link: ProximityLink;
  selfId: string;
};

export function ChatPanel({ socket, link, selfId }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onMsg = (m: ChatMessage) => {
      setMessages((prev) => [...prev, m].slice(-200));
    };
    socket.on("chat:message", onMsg);
    return () => {
      socket.off("chat:message", onMsg);
    };
  }, [socket]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = (e: FormEvent) => {
    e.preventDefault();
    const t = draft.trim();
    if (!t) return;
    socket.emit("chat:message", { roomId: link.roomId, text: t });
    setDraft("");
  };

  return (
    <aside className="flex w-full min-h-0 flex-col rounded-xl border border-white/10 bg-cosmos-mist/90 shadow-lg backdrop-blur sm:w-80">
      <div className="border-b border-white/10 px-3 py-2">
        <p className="font-display text-sm font-semibold text-white">Proximity chat</p>
        <p className="text-xs text-cosmos-dim">With {link.displayName}</p>
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-2 text-sm">
        {messages.length === 0 && (
          <p className="text-xs text-slate-500">Say hello — you are in range.</p>
        )}
        {messages.map((m, i) => {
          const mine = m.fromId === selfId;
          return (
            <div
              key={`${m.ts}-${i}-${m.fromId}`}
              className={`flex flex-col ${mine ? "items-end" : "items-start"}`}
            >
              <span className="text-[10px] uppercase tracking-wide text-slate-500">
                {mine ? "You" : m.fromName}
              </span>
              <p
                className={`mt-0.5 max-w-[95%] rounded-lg px-2.5 py-1.5 ${
                  mine
                    ? "bg-teal-500/25 text-teal-50"
                    : "bg-white/5 text-slate-200"
                }`}
              >
                {m.text}
              </p>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      <form
        onSubmit={send}
        className="border-t border-white/10 p-2"
      >
        <div className="flex gap-2">
          <input
            className="min-w-0 flex-1 rounded-lg border border-white/10 bg-cosmos-void/80 px-2 py-2 text-sm outline-none ring-teal-400/20 focus:border-teal-400/40 focus:ring-2"
            placeholder="Message…"
            maxLength={CHAT_MESSAGE_MAX_LENGTH}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            aria-label="Chat message"
          />
          <button
            type="submit"
            className="shrink-0 rounded-lg bg-teal-500/90 px-3 py-2 text-sm font-semibold text-cosmos-void hover:bg-teal-400"
          >
            Send
          </button>
        </div>
      </form>
    </aside>
  );
}
