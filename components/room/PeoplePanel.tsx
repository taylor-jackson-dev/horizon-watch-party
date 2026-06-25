"use client";

import { useEffect, useMemo, useState } from "react";
import type { Socket } from "socket.io-client";
import { useVoiceRoom } from "@/lib/use-voice-room";
import { Panel, Badge, Button } from "@/components/ui";
import { UsersIcon, MicIcon, MicOffIcon } from "@/components/ui/icons";
import { publishRoomPresenceCount } from "@/lib/room-presence-store";
import { cn } from "@/lib/cn";

interface Viewer {
  userId: string;
  displayName: string;
  away: boolean;
}

interface PresenceSnapshot {
  count: number;
  viewers: Viewer[];
}

interface PeoplePanelProps {
  socket: Socket | null;
  roomId: string;
  currentUserId: string;
  /** SSR member count — seeds the badge so it doesn't flash 0 before the first presence event. */
  initialCount: number;
  capacity: number;
  /** Only viewers get the Step-away toggle; the host is driving playback. */
  canStepAway: boolean;
  isAway: boolean;
  onToggleAway: () => void;
  voiceEnabled: boolean;
  /** Host has muted this member server-side — token denies publish. */
  isMicMuted: boolean;
  /** Member is view-only — no voice permission at all. */
  isViewOnly: boolean;
}

/**
 * The room's single "people" surface: the watch roster (socket presence)
 * merged with the voice call (LiveKit). Each viewer is one row — presence dot,
 * name, and a mic control at the far end. The mic control is interactive for
 * you (tap to talk/mute, open-mic) and a read-only indicator for everyone
 * else; it only appears once you've joined voice (that's when LiveKit tells us
 * who's actually on the call).
 *
 * The merge is keyed on userId === LiveKit identity (see lib/livekit.ts), so a
 * voice participant lines up with its roster row by id.
 *
 * Mic mode (push-to-talk vs. open) is deferred to a future voice settings page;
 * the default is open-mic, joined muted — you tap your own mic to start talking.
 */
export function PeoplePanel({
  socket,
  roomId,
  currentUserId,
  initialCount,
  capacity,
  canStepAway,
  isAway,
  onToggleAway,
  voiceEnabled,
  isMicMuted,
  isViewOnly,
}: PeoplePanelProps) {
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

  const { status, error, openMicEnabled, setOpenMicEnabled, participants, join, leave } =
    useVoiceRoom(roomId);

  const isConnected = status === "connected";
  const voiceAvailable = voiceEnabled && !isViewOnly;
  const selfMicOn = openMicEnabled && !isMicMuted;

  // Voice participants keyed by identity (=== userId) so each roster row can
  // find its live mic/speaking state in O(1).
  const voiceById = useMemo(
    () => new Map(participants.map((p) => [p.identity, p])),
    [participants],
  );

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
      bodyClassName="flex flex-col gap-3"
    >
      {presence.viewers.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {presence.viewers.map((v) => {
            const isSelf = v.userId === currentUserId;
            const vp = voiceById.get(v.userId);
            const inVoice = isConnected && !!vp;
            return (
              <li key={v.userId} className="flex items-center gap-2 text-sm min-w-0">
                <span
                  className={cn(
                    "shrink-0 w-2 h-2 rounded-full",
                    v.away ? "bg-muted/50" : "bg-success",
                  )}
                  aria-hidden
                />
                <span
                  className={cn(
                    "truncate flex-1",
                    v.away && "text-muted",
                    isSelf && "text-gold",
                  )}
                >
                  {v.displayName}
                  {isSelf && " (you)"}
                </span>
                {v.away && <span className="text-xs text-muted shrink-0">away</span>}
                <MicCell
                  inVoice={inVoice}
                  isSelf={isSelf}
                  isMicMuted={isMicMuted}
                  micOn={isSelf ? selfMicOn : (vp?.micEnabled ?? false)}
                  isSpeaking={vp?.isSpeaking ?? false}
                  onToggle={
                    isSelf && !isMicMuted
                      ? () => setOpenMicEnabled((m) => !m)
                      : undefined
                  }
                />
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-xs text-muted">Connecting…</p>
      )}

      {/* Voice controls live directly below the roster. */}
      <div className="flex flex-col gap-2">
        {error && <p className="text-xs text-danger">{error}</p>}

        {!voiceAvailable ? (
          <p className="text-xs text-muted">
            {!voiceEnabled
              ? "Voice chat disabled by host."
              : "View-only — voice unavailable."}
          </p>
        ) : !isConnected ? (
          <Button
            onClick={() => void join()}
            disabled={status === "connecting" || status === "reconnecting"}
          >
            {status === "connecting"
              ? "Joining…"
              : status === "reconnecting"
                ? "Reconnecting…"
                : "Join voice chat"}
          </Button>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted truncate">
              {isMicMuted
                ? "Muted by host"
                : selfMicOn
                  ? "Mic on — tap your mic to mute"
                  : "In voice — tap your mic to talk"}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0"
              onClick={() => void leave()}
            >
              Leave
            </Button>
          </div>
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
      </div>
    </Panel>
  );
}

// A speaking participant gets a green ring around their mic icon — the live
// "voice is working" cue. Implemented as a ring (box-shadow) so `transition`
// fades it in/out as LiveKit's active-speaker state flips on and off.
const SPEAKING_RING = "ring-2 ring-success ring-offset-2 ring-offset-surface";

/**
 * The per-row mic affordance at the far end of a viewer's name.
 * - Not in the voice call → nothing (they're only watching).
 * - You, muted by host → a locked, non-interactive off icon.
 * - You → a button that toggles your mic (open-mic on/off).
 * - Someone else → a read-only indicator (highlights while they speak).
 */
function MicCell({
  inVoice,
  isSelf,
  isMicMuted,
  micOn,
  isSpeaking,
  onToggle,
}: {
  inVoice: boolean;
  isSelf: boolean;
  isMicMuted: boolean;
  micOn: boolean;
  isSpeaking: boolean;
  onToggle?: () => void;
}) {
  if (!inVoice) return null;

  const base = "shrink-0 w-7 h-7 rounded-full grid place-items-center";

  if (isSelf && isMicMuted) {
    return (
      <span
        className={cn(base, "bg-danger/15 text-danger")}
        title="Muted by host"
        aria-label="Muted by host"
      >
        <MicOffIcon size={15} />
      </span>
    );
  }

  if (isSelf) {
    return (
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={micOn}
        title={micOn ? "Mute your mic" : "Turn on your mic"}
        aria-label={micOn ? "Mute your mic" : "Turn on your mic"}
        className={cn(
          base,
          "transition",
          micOn
            ? "bg-success/20 text-success hover:bg-success/30"
            : "bg-elevated text-muted hover:text-text",
          micOn && isSpeaking && SPEAKING_RING,
        )}
      >
        {micOn ? <MicIcon size={15} /> : <MicOffIcon size={15} />}
      </button>
    );
  }

  return (
    <span
      className={cn(
        base,
        "transition",
        isSpeaking
          ? "bg-success/20 text-success"
          : micOn
            ? "text-text/70"
            : "text-muted",
        micOn && isSpeaking && SPEAKING_RING,
      )}
      title={isSpeaking ? "Speaking" : micOn ? "Mic on" : "Muted"}
      aria-label={isSpeaking ? "Speaking" : micOn ? "Mic on" : "Muted"}
    >
      {micOn ? <MicIcon size={15} /> : <MicOffIcon size={15} />}
    </span>
  );
}
