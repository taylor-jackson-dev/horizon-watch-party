"use client";

import { useEffect, useState, type CSSProperties } from "react";
import type { Socket } from "socket.io-client";

interface ReactionBurst {
  id: string;
  roomId: string;
  userId: string;
  userDisplayName: string;
  emoji: string;
  createdAt: string;
}

interface FloatingReaction {
  id: string;
  emoji: string;
  leftPct: number;
  x0: number;
  x1: number;
}

interface ReactionOverlayProps {
  roomId: string;
  socket: Socket | null;
}

// Cap on simultaneously rendered reactions. Animation duration is 2.5s and
// the per-user rate limit is 10/5s; with N users this could pile up briefly.
// 50 is well above any realistic burst but bounds DOM cost in pathological
// cases (e.g. a client tab backgrounded while reactions queue).
const MAX_LIVE_REACTIONS = 50;

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function ReactionOverlay({ roomId, socket }: ReactionOverlayProps) {
  const [live, setLive] = useState<FloatingReaction[]>([]);

  useEffect(() => {
    if (!socket) return;
    const onBurst = (b: ReactionBurst) => {
      if (b.roomId !== roomId) return;
      const next: FloatingReaction = {
        id: b.id,
        emoji: b.emoji,
        // Spread across most of the bottom, avoiding the corners where
        // the YouTube controls and our reaction picker live.
        leftPct: randomBetween(10, 85),
        // Horizontal wobble endpoints — keep small so the float still
        // reads as "rising," not "drifting sideways."
        x0: randomBetween(-18, 18),
        x1: randomBetween(-28, 28),
      };
      setLive((prev) => {
        const trimmed = prev.length >= MAX_LIVE_REACTIONS ? prev.slice(1) : prev;
        return [...trimmed, next];
      });
    };
    socket.on("reaction:burst", onBurst);
    return () => {
      socket.off("reaction:burst", onBurst);
    };
  }, [socket, roomId]);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {live.map((r) => (
        <span
          key={r.id}
          className="wp-react-float absolute bottom-2 text-3xl select-none drop-shadow-lg"
          style={
            {
              left: `${r.leftPct}%`,
              "--wp-react-x0": `${r.x0}px`,
              "--wp-react-x1": `${r.x1}px`,
            } as CSSProperties
          }
          onAnimationEnd={() =>
            setLive((prev) => prev.filter((x) => x.id !== r.id))
          }
          aria-hidden
        >
          {r.emoji}
        </span>
      ))}
    </div>
  );
}
