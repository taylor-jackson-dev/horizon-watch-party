"use client";

import { useEffect, useRef } from "react";
import { Card, Button } from "@/components/ui";
import { FilmIcon } from "@/components/ui/icons";

interface CatchUpModalProps {
  videoTitle: string | null;
  positionSecs: number;
  queueCount: number;
  onDismiss: () => void;
}

function formatClock(totalSecs: number): string {
  const s = Math.max(0, Math.floor(totalSecs));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  const ss = String(secs).padStart(2, "0");
  if (hrs > 0) return `${hrs}:${String(mins).padStart(2, "0")}:${ss}`;
  return `${mins}:${ss}`;
}

/**
 * One-time "here's where things are" modal shown to a viewer who joins after a
 * video is already underway. Purely informational — dismissing it just drops you
 * into the room (sync already has you at the right spot).
 */
export function CatchUpModal({
  videoTitle,
  positionSecs,
  queueCount,
  onDismiss,
}: CatchUpModalProps) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    buttonRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDismiss]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="catchup-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onDismiss();
      }}
    >
      <Card className="w-full max-w-sm space-y-4">
        <div className="space-y-1 text-center">
          <p className="text-xs uppercase tracking-widest text-gold">Catch up</p>
          <h2
            id="catchup-title"
            className="font-display text-xl uppercase tracking-wide text-text"
          >
            You&rsquo;re joining mid-session
          </h2>
        </div>

        <div className="space-y-2">
          <div className="flex items-start gap-3 rounded-lg bg-elevated/60 px-3 py-2">
            <span aria-hidden className="mt-0.5 shrink-0 text-gold">
              <FilmIcon />
            </span>
            <div className="min-w-0">
              <p className="text-xs text-muted">Now playing</p>
              <p className="truncate text-sm text-text">
                {videoTitle ?? "the current video"}
              </p>
              <p className="text-xs text-muted">around {formatClock(positionSecs)}</p>
            </div>
          </div>
          <div className="rounded-lg bg-elevated/60 px-3 py-2 text-sm text-text">
            {queueCount === 1 ? "1 video in the queue" : `${queueCount} videos in the queue`}
          </div>
        </div>

        <Button ref={buttonRef} onClick={onDismiss} className="w-full">
          Jump in
        </Button>
      </Card>
    </div>
  );
}
