"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import Image from "next/image";
import type { Socket } from "socket.io-client";
import { MESSAGE_MAX_LENGTH } from "@/lib/config";
import { Panel, Badge, Button } from "@/components/ui";
import { SendIcon } from "@/components/ui/icons";

export interface ChatMessage {
  id: string;
  roomId: string;
  userId: string;
  userDisplayName: string;
  userAvatarUrl: string | null;
  content: string;
  type: "TEXT" | "REACTION" | "SYSTEM" | "GIPHY";
  createdAt: string; // ISO
  deletedAt?: string | null; // ISO
}

interface ChatPanelProps {
  roomId: string;
  socket: Socket | null;
  currentUserId: string;
  /** Host-level toggle. If false, nobody can send (UI also reads-only.) */
  chatEnabled: boolean;
  /** Per-member host restriction. If true, this user can read but not send. */
  isChatRestricted: boolean;
  /** Bumps on every socket (re)join; epoch ≥ 2 triggers a gap-healing refetch. */
  syncEpoch: number;
}

// If the user is within this many pixels of the bottom of the scroll
// container, we count them as "at the bottom" and auto-scroll on new
// messages. Otherwise we leave them alone — they're scrolled up reading
// older history.
const AT_BOTTOM_THRESHOLD_PX = 80;

export function ChatPanel({
  roomId,
  socket,
  currentUserId,
  chatEnabled,
  isChatRestricted,
  syncEpoch,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [historyStatus, setHistoryStatus] = useState<"idle" | "loading" | "loaded" | "error">(
    "idle",
  );
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const listRef = useRef<HTMLDivElement | null>(null);
  // Whether the viewport was at the bottom BEFORE the latest message arrived.
  // We capture this synchronously on each render via useLayoutEffect so that
  // the auto-scroll decision uses pre-mutation scroll position.
  const wasAtBottomRef = useRef(true);

  // ── Initial history fetch ────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setHistoryStatus("loading");
    setHistoryError(null);
    fetch(`/api/rooms/${roomId}/messages`)
      .then(async (res) => {
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error ?? `Failed (${res.status})`);
        }
        return res.json() as Promise<{ messages: ChatMessage[] }>;
      })
      .then((data) => {
        if (cancelled) return;
        setMessages(data.messages);
        setHistoryStatus("loaded");
        // Always scroll to bottom on initial load.
        requestAnimationFrame(() => scrollToBottom(listRef.current));
      })
      .catch((err) => {
        if (cancelled) return;
        setHistoryStatus("error");
        setHistoryError(err instanceof Error ? err.message : "Failed to load chat");
      });
    return () => {
      cancelled = true;
    };
  }, [roomId]);

  // ── Live message subscription ────────────────────────────────────
  useEffect(() => {
    if (!socket) return;
    const onMessage = (m: ChatMessage) => {
      setMessages((prev) => {
        // Dedupe — if the sender's own ack arrived before the broadcast (or
        // vice versa, depending on the transport), we'd see the same id twice.
        if (prev.some((x) => x.id === m.id)) return prev;
        return [...prev, m];
      });
    };
    socket.on("chat:message", onMessage);
    return () => {
      socket.off("chat:message", onMessage);
    };
  }, [socket]);

  // ── Heal chat gaps after a reconnect ─────────────────────────────
  // Messages broadcast while the socket was down are never replayed, so on a
  // reconnect (syncEpoch ≥ 2) we refetch the recent window and merge by id.
  // Epoch ≤ 1 is the initial load, already covered by the history effect.
  useEffect(() => {
    if (syncEpoch <= 1) return;
    let cancelled = false;
    fetch(`/api/rooms/${roomId}/messages`)
      .then((res) =>
        res.ok ? (res.json() as Promise<{ messages: ChatMessage[] }>) : Promise.reject(),
      )
      .then((data) => {
        if (cancelled) return;
        setMessages((prev) => mergeMessagesById(prev, data.messages));
      })
      .catch(() => {
        /* transient — the next reconnect or a manual refresh will heal */
      });
    return () => {
      cancelled = true;
    };
  }, [syncEpoch, roomId]);

  // ── Auto-scroll on new message ───────────────────────────────────
  // Capture scroll position BEFORE the DOM update for this render commits,
  // so the next layout effect can use the pre-update position.
  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;
    wasAtBottomRef.current = isAtBottom(el);
  });

  // After the message list mutates, if we were at the bottom before, stay there.
  useEffect(() => {
    if (!wasAtBottomRef.current) return;
    scrollToBottom(listRef.current);
  }, [messages.length]);

  // ── Send ─────────────────────────────────────────────────────────
  const send = useCallback(() => {
    const content = input.trim();
    if (!content) return;
    if (!socket) {
      setSendError("Not connected to chat server");
      return;
    }
    if (!chatEnabled) {
      setSendError("Chat is disabled in this room");
      return;
    }
    if (isChatRestricted) {
      setSendError("You are restricted from sending in this room");
      return;
    }

    setSending(true);
    setSendError(null);
    socket.emit(
      "chat:send",
      { roomId, content },
      (ack: { ok: boolean; error?: string }) => {
        setSending(false);
        if (ack?.ok) {
          setInput("");
        } else {
          setSendError(
            ack?.error === "slow_down"
              ? "Slow down — you're sending too fast"
              : ack?.error ?? "Failed to send",
          );
        }
      },
    );
  }, [input, socket, roomId, chatEnabled, isChatRestricted]);

  const onSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      send();
    },
    [send],
  );

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      // Enter sends; Shift+Enter newline.
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        send();
      }
    },
    [send],
  );

  const canSend =
    chatEnabled && !isChatRestricted && !!socket && !sending && input.trim().length > 0;

  return (
    <Panel
      title="Chat"
      icon={<SendIcon size={15} />}
      action={
        !chatEnabled ? (
          <Badge tone="muted">Disabled</Badge>
        ) : isChatRestricted ? (
          <Badge tone="default">Read-only</Badge>
        ) : null
      }
      flush
      className="h-full min-h-0"
      bodyClassName="flex flex-1 min-h-0 flex-col p-3 gap-2"
    >
      <div
        ref={listRef}
        className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-2"
        aria-live="polite"
      >
        {historyStatus === "loading" && (
          <p className="text-xs text-muted">Loading messages…</p>
        )}
        {historyStatus === "error" && (
          <p className="text-xs text-danger">{historyError ?? "Failed to load chat"}</p>
        )}
        {historyStatus === "loaded" && messages.length === 0 && (
          <p className="text-xs text-muted">No messages yet. Say hi 👋</p>
        )}
        {messages.map((m) => (
          <MessageRow key={m.id} message={m} isOwn={m.userId === currentUserId} />
        ))}
      </div>

      <form onSubmit={onSubmit} className="space-y-1 shrink-0">
        <textarea
          className="input resize-none"
          rows={2}
          placeholder={
            !chatEnabled
              ? "Chat is disabled in this room"
              : isChatRestricted
                ? "You are restricted from chat"
                : "Type a message… (Enter to send, Shift+Enter for newline)"
          }
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          maxLength={MESSAGE_MAX_LENGTH}
          disabled={!chatEnabled || isChatRestricted}
        />
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted tabular-nums">
            {input.length}/{MESSAGE_MAX_LENGTH}
          </span>
          {sendError && (
            <span className="text-xs text-danger flex-1 truncate">{sendError}</span>
          )}
          <Button type="submit" size="sm" disabled={!canSend}>
            {sending ? "Sending…" : "Send"}
          </Button>
        </div>
      </form>
    </Panel>
  );
}

function MessageRow({ message, isOwn }: { message: ChatMessage; isOwn: boolean }) {
  const isDeleted = !!message.deletedAt;
  const isSystem = message.type === "SYSTEM";

  if (isSystem) {
    return (
      <div className="text-xs text-center text-muted italic">
        {message.content}
      </div>
    );
  }

  return (
    <div className="flex gap-2 text-sm">
      <Avatar
        url={message.userAvatarUrl}
        name={message.userDisplayName}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span
            className={`font-medium truncate ${isOwn ? "text-gold" : "text-text"}`}
          >
            {message.userDisplayName}
          </span>
          <span className="text-xs text-muted shrink-0">
            {formatTime(message.createdAt)}
          </span>
        </div>
        {isDeleted ? (
          <p className="italic text-muted">[deleted]</p>
        ) : (
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        )}
      </div>
    </div>
  );
}

function Avatar({ url, name }: { url: string | null; name: string }) {
  const initials = name
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  if (url) {
    return (
      <Image
        src={url}
        alt=""
        width={28}
        height={28}
        className="shrink-0 w-7 h-7 rounded-full object-cover bg-brand-elevated"
      />
    );
  }
  return (
    <div className="shrink-0 w-7 h-7 rounded-full bg-brand-elevated flex items-center justify-center text-xs font-medium text-brand-muted">
      {initials || "?"}
    </div>
  );
}

// Merge two message lists by id (server copy wins so edits like deletedAt
// propagate), sorted oldest-first.
function mergeMessagesById(a: ChatMessage[], b: ChatMessage[]): ChatMessage[] {
  const byId = new Map<string, ChatMessage>();
  for (const m of a) byId.set(m.id, m);
  for (const m of b) byId.set(m.id, m);
  return Array.from(byId.values()).sort(
    (x, y) => new Date(x.createdAt).getTime() - new Date(y.createdAt).getTime(),
  );
}

function isAtBottom(el: HTMLElement): boolean {
  return el.scrollHeight - el.scrollTop - el.clientHeight <= AT_BOTTOM_THRESHOLD_PX;
}

function scrollToBottom(el: HTMLElement | null): void {
  if (!el) return;
  el.scrollTop = el.scrollHeight;
}

function formatTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.floor((now - then) / 1000);
  if (diffSec < 10) return "now";
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return new Date(iso).toLocaleDateString();
}
