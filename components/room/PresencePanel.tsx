"use client";

import { useEffect, useState } from "react";
import type { Socket } from "socket.io-client";
import { Panel, Badge, Button } from "@/components/ui";
import { UsersIcon } from "@/components/ui/icons";
import { publishRoomPresenceCount } from "@/lib/room-presence-store";

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
    const onPresence = (snapshot: PresenceSnapshot) => {
      setPresence(snapshot);
      publishRoomPresenceCount(snapshot.count);
    };
    socket.on("room:presence", onPresence);
    return () => {
      socket.off("room:presence", onPresence);
    };
  }, [socket]);

  const awayCount = presence.viewers.filter((v) => v.away).length;

  return (
    <Panel
      title="Watching"
      icon={<UsersIcon size={16} />}
      action={
        <Badge tone="muted">
          {presence.count}/{capacity}
          {awayCount > 0 && ` · ${awayCount} away`}
        </Badge>
      }
      bodyClassName="flex flex-col gap-2"
    >
      {presence.viewers.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {presence.viewers.map((v) => {
            const isSelf = v.userId === currentUserId;
            return (
              <li key={v.userId} className="flex items-center gap-2 text-sm min-w-0">
                <span
                  className={`shrink-0 w-2 h-2 rounded-full ${
                    v.away ? "bg-muted/50" : "bg-success"
                  }`}
                  aria-hidden
                />
                <span
                  className={`truncate flex-1 ${v.away ? "text-muted" : ""} ${
                    isSelf ? "text-gold" : ""
                  }`}
                >
                  {v.displayName}
                  {isSelf && " (you)"}
                </span>
                {v.away && <span className="text-xs text-muted shrink-0">away</span>}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-xs text-muted">Connecting…</p>
      )}

      {canStepAway && (
        <Button
          variant={isAway ? "primary" : "ghost"}
          size="sm"
          className="self-start"
          onClick={onToggleAway}
        >
          {isAway ? "I'm back" : "Step away"}
        </Button>
      )}
    </Panel>
  );
}
