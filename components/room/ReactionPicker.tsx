"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { ALLOWED_REACTION_EMOJIS } from "@/lib/validations/reactions";

interface ReactionPickerProps {
  roomId: string;
  socket: Socket | null;
  reactionsEnabled: boolean;
}

// How long a transient error message lingers before clearing.
const ERROR_FADE_MS = 2400;

export function ReactionPicker({
  roomId,
  socket,
  reactionsEnabled,
}: ReactionPickerProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  // Auto-clear the inline error after a beat so the picker stays clean.
  useEffect(() => {
    if (!error) return;
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    errorTimerRef.current = setTimeout(() => setError(null), ERROR_FADE_MS);
    return () => {
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    };
  }, [error]);

  // Close the picker on outside click so it doesn't sit open over the video.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const node = wrapperRef.current;
      if (!node) return;
      if (e.target instanceof Node && node.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const send = useCallback(
    (emoji: string) => {
      if (!socket) {
        setError("Not connected");
        return;
      }
      if (!reactionsEnabled) {
        setError("Reactions disabled");
        return;
      }
      socket.emit(
        "reaction:send",
        { roomId, emoji },
        (ack: { ok: boolean; error?: string }) => {
          if (ack?.ok) return;
          setError(
            ack?.error === "slow_down"
              ? "Slow down"
              : ack?.error === "Reactions are disabled in this room"
                ? "Reactions disabled"
                : ack?.error ?? "Failed",
          );
        },
      );
    },
    [socket, roomId, reactionsEnabled],
  );

  const disabled = !socket || !reactionsEnabled;

  return (
    <div
      ref={wrapperRef}
      className="pointer-events-auto absolute bottom-3 right-3 flex flex-col items-end gap-2"
    >
      {error && (
        <div className="text-xs bg-black/70 text-white px-2 py-1 rounded-md shadow-md">
          {error}
        </div>
      )}

      {open && !disabled && (
        <div
          className="flex gap-1 bg-black/70 backdrop-blur-sm rounded-full px-2 py-1.5 shadow-lg"
          role="menu"
        >
          {ALLOWED_REACTION_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className="text-2xl leading-none w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
              onClick={() => send(emoji)}
              aria-label={`React with ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      <button
        type="button"
        className="w-10 h-10 rounded-full bg-black/70 backdrop-blur-sm text-xl flex items-center justify-center shadow-lg hover:bg-black/85 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        aria-label={
          !reactionsEnabled
            ? "Reactions disabled by host"
            : open
              ? "Close reactions"
              : "Open reactions"
        }
        aria-expanded={open}
        title={!reactionsEnabled ? "Reactions disabled by host" : "React"}
      >
        {open ? "×" : "😀"}
      </button>
    </div>
  );
}
