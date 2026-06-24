"use client";

import Image from "next/image";
import { useVoiceRoom, type VoiceStatus } from "@/lib/use-voice-room";
import { Panel, Badge, Button } from "@/components/ui";
import { MicIcon } from "@/components/ui/icons";

interface VoicePanelProps {
  roomId: string;
  voiceEnabled: boolean;
  /** Host has muted this member server-side — token denies publish. */
  isMicMuted: boolean;
  /** Member is view-only — no voice permission at all. */
  isViewOnly: boolean;
}

export function VoicePanel({
  roomId,
  voiceEnabled,
  isMicMuted,
  isViewOnly,
}: VoicePanelProps) {
  const {
    status,
    error,
    mode,
    setMode,
    openMicEnabled,
    setOpenMicEnabled,
    pttActive,
    pressPtt,
    releasePtt,
    participants,
    join,
    leave,
    pttKeyLabel,
  } = useVoiceRoom(roomId);

  if (!voiceEnabled) {
    return <DisabledShell message="Disabled by host" />;
  }

  if (isViewOnly) {
    return <DisabledShell message="View-only" />;
  }

  const isConnected = status === "connected";

  return (
    <Panel
      title="Voice"
      icon={<MicIcon size={16} />}
      action={<StatusBadge status={status} count={participants.length} />}
      bodyClassName="flex flex-col gap-3"
    >
      {error && <p className="text-xs text-danger">{error}</p>}

      <div className="flex gap-1 text-xs">
        <ModeButton
          active={mode === "ptt"}
          onClick={() => setMode("ptt")}
          label="Push to talk"
        />
        <ModeButton
          active={mode === "open"}
          onClick={() => setMode("open")}
          label="Open mic"
        />
      </div>

      {!isConnected ? (
        <Button
          onClick={() => void join()}
          disabled={status === "connecting" || status === "reconnecting"}
        >
          {status === "connecting"
            ? "Joining…"
            : status === "reconnecting"
              ? "Reconnecting…"
              : "Join voice"}
        </Button>
      ) : (
        <div className="flex gap-2">
          {isMicMuted ? (
            <div className="flex-1 text-xs text-muted bg-elevated rounded-lg px-2 py-2 text-center">
              Muted by host
            </div>
          ) : mode === "ptt" ? (
            <button
              type="button"
              className={`flex-1 px-3 py-2 rounded-lg font-medium text-sm transition-colors select-none ${
                pttActive
                  ? "bg-success text-white"
                  : "bg-elevated text-text hover:bg-elevated/70"
              }`}
              onPointerDown={pressPtt}
              onPointerUp={releasePtt}
              onPointerLeave={releasePtt}
              onPointerCancel={releasePtt}
            >
              {pttActive ? "Talking…" : `Hold to talk (${pttKeyLabel})`}
            </button>
          ) : (
            <button
              type="button"
              className={`flex-1 px-3 py-2 rounded-lg font-medium text-sm transition-colors ${
                openMicEnabled
                  ? "bg-success text-white"
                  : "bg-elevated text-text hover:bg-elevated/70"
              }`}
              onClick={() => setOpenMicEnabled((v) => !v)}
            >
              {openMicEnabled ? "Mic on" : "Mic off"}
            </button>
          )}
          <Button variant="ghost" size="sm" onClick={() => void leave()}>
            Leave
          </Button>
        </div>
      )}

      {isConnected && participants.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {participants.map((p) => (
            <li key={p.identity} className="flex items-center gap-2 text-sm min-w-0">
              <ParticipantAvatar
                url={p.avatarUrl}
                name={p.name}
                isSpeaking={p.isSpeaking}
              />
              <span className={`truncate flex-1 ${p.isLocal ? "text-gold" : ""}`}>
                {p.name}
                {p.isLocal && " (you)"}
              </span>
              {!p.micEnabled && (
                <span className="text-xs text-muted shrink-0">muted</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function DisabledShell({ message }: { message: string }) {
  return (
    <Panel
      title="Voice"
      icon={<MicIcon size={16} />}
      action={<Badge tone="muted">{message}</Badge>}
    >
      <p className="text-xs text-muted">Voice is unavailable in this room.</p>
    </Panel>
  );
}

function ModeButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1 rounded-lg transition-colors ${
        active
          ? "bg-gold text-on-gold font-medium"
          : "bg-elevated text-muted hover:text-text"
      }`}
    >
      {label}
    </button>
  );
}

function StatusBadge({ status, count }: { status: VoiceStatus; count: number }) {
  if (status === "connected") {
    return <Badge tone="success">{count} in voice</Badge>;
  }
  if (status === "connecting") {
    return <Badge tone="default">Connecting…</Badge>;
  }
  if (status === "reconnecting") {
    return <Badge tone="default">Reconnecting…</Badge>;
  }
  if (status === "error") {
    return <Badge tone="danger">Error</Badge>;
  }
  return <Badge tone="muted">Off</Badge>;
}

function ParticipantAvatar({
  url,
  name,
  isSpeaking,
}: {
  url: string | null;
  name: string;
  isSpeaking: boolean;
}) {
  const initials = name
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const ring = isSpeaking ? "ring-2 ring-success" : "";
  if (url) {
    return (
      <Image
        src={url}
        alt=""
        width={24}
        height={24}
        className={`shrink-0 w-6 h-6 rounded-full object-cover bg-elevated ${ring}`}
      />
    );
  }
  return (
    <div
      className={`shrink-0 w-6 h-6 rounded-full bg-elevated flex items-center justify-center text-[10px] font-medium text-muted ${ring}`}
    >
      {initials || "?"}
    </div>
  );
}
