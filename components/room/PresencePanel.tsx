"use client";

import { useEffect, useState } from "react";
import type { Socket } from "socket.io-client";

interface Viewer {
  userId: string;
  displayName: string;
  away: boolean;
}

interface PresenceSnapshot {
  count: number;
  viewers: Viewer[];
}

interface PresencePanelProps {
  socket: Socket | null;
  currentUserId: string;
  /** SSR member count — seeds the badge so it doesn't flash 0 before the first presence event. */
  initialCount: number;
  capacity: number;
  /** Only viewers get the Step-away toggle; the host is driving playback. */
  canStepAway: boolean;
  isAway: boolean;
  onToggleAway: () => void;
}

export function PresencePanel({
  socket,
  currentUserId,
  initialCount,
  capacity,
  canStepAway,
  isAway,
  onToggleAway,
}: PresencePanelProps) {
  const [presence, setPresence] = useState<PresenceSnapshot>({
    count: initialCount,
    viewers: [],
  });

  useEffect(() => {
    if (!socket) return;
    const onPresence = (snapshot: PresenceSnapshot) => setPresence(snapshot);
    socket.on("room:presence", onPresence);
    return () => {
      socket.off("room:presence", onPresence);
    };
  }, [socket]);

  const awayCount = presence.viewers.filter((v) => v.away).length;

  return (
    <section className="card flex flex-col gap-2">
      <header className="flex items-baseline justify-between border-b border-white/10 pb-2">
        <h2 className="text-lg font-semibold">Watching</h2>
        <span className="text-xs text-brand-muted">
          {presence.count}/{capacity}
          {awayCount > 0 && ` · ${awayCount} away`}
        </span>
      </header>

      {presence.viewers.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {presence.viewers.map((v) => {
            const isSelf = v.userId === currentUserId;
            return (
              <li key={v.userId} className="flex items-center gap-2 text-sm min-w-0">
                <span
                  className={`shrink-0 w-2 h-2 rounded-full ${
                    v.away ? "bg-brand-muted/50" : "bg-emerald-400"
                  }`}
                  aria-hidden
                />
                <span
                  className={`truncate flex-1 ${v.away ? "text-brand-muted" : ""} ${
                    isSelf ? "text-brand-gold" : ""
                  }`}
                >
                  {v.displayName}
                  {isSelf && " (you)"}
                </span>
                {v.away && (
                  <span className="text-xs text-brand-muted shrink-0">away</span>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-xs text-brand-muted">Connecting…</p>
      )}

      {canStepAway && (
        <button
          type="button"
          onClick={onToggleAway}
          className={`text-sm self-start ${isAway ? "btn-primary" : "btn-ghost"}`}
        >
          {isAway ? "I'm back" : "Step away"}
        </button>
      )}
    </section>
  );
}
