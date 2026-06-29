"use client";

import { useEffect, useState, type CSSProperties } from "react";
import type { Socket } from "socket.io-client";
import {
  createSpotlightDetector,
  type SpotlightDetector,
} from "@/lib/spotlight-reactions";

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

interface Spotlight {
  id: string;
  emoji: string;
  count: number;
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
// Spotlights are far rarer (gated by the 3-in-2s detector + per-emoji cooldown);
// a small cap is plenty and keeps overlapping pops from ever stacking deep.
const MAX_LIVE_SPOTLIGHTS = 6;

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function ReactionOverlay({ roomId, socket }: ReactionOverlayProps) {
  const [live, setLive] = useState<FloatingReaction[]>([]);
  const [spotlights, setSpotlights] = useState<Spotlight[]>([]);

  useEffect(() => {
    if (!socket) return;
    // One detector per room/socket binding; resets when either changes.
    const detector: SpotlightDetector = createSpotlightDetector();

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

      // A surge of the same emoji pops a celebratory spotlight on top.
      // Stamp by arrival time so the window reflects what landed together here.
      const hit = detector.record(b.emoji, Date.now());
      if (hit) {
        const spot: Spotlight = {
          id: `${b.id}-spot`,
          emoji: hit.emoji,
          count: hit.count,
        };
        setSpotlights((prev) => {
          const trimmed =
            prev.length >= MAX_LIVE_SPOTLIGHTS ? prev.slice(1) : prev;
          return [...trimmed, spot];
        });
      }
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

      {spotlights.map((s) => (
        <div
          key={s.id}
          className="absolute inset-0 flex items-center justify-center"
          aria-hidden
        >
          <div
            className="wp-spotlight flex flex-col items-center gap-1"
            onAnimationEnd={() =>
              setSpotlights((prev) => prev.filter((x) => x.id !== s.id))
            }
          >
            <span className="text-7xl sm:text-8xl select-none drop-shadow-2xl">
              {s.emoji}
            </span>
            <span className="font-display text-lg sm:text-xl tracking-wide text-gold drop-shadow">
              ×{s.count}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
