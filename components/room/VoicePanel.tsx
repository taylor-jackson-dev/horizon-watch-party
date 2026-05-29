"use client";

import Image from "next/image";
import { useVoiceRoom, type VoiceStatus } from "@/lib/use-voice-room";

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
    return (
      <DisabledShell
        label="Voice"
        message="Disabled by host"
        tone="muted"
      />
    );
  }

  if (isViewOnly) {
    return (
      <DisabledShell label="Voice" message="View-only" tone="muted" />
    );
  }

  const isConnected = status === "connected";

  return (
    <section className="card flex flex-col gap-3">
      <header className="flex items-baseline justify-between border-b border-white/10 pb-2">
        <h2 className="text-lg font-semibold">Voice</h2>
        <StatusBadge status={status} count={participants.length} />
      </header>

      {error && <p className="text-xs text-red-400">{error}</p>}

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
        <button
          type="button"
          className="btn-primary"
          onClick={() => void join()}
          disabled={status === "connecting" || status === "reconnecting"}
        >
          {status === "connecting"
            ? "Joining…"
            : status === "reconnecting"
              ? "Reconnecting…"
              : "Join voice"}
        </button>
      ) : (
        <div className="flex gap-2">
          {isMicMuted ? (
            <div className="flex-1 text-xs text-brand-muted bg-brand-elevated rounded px-2 py-2 text-center">
              Muted by host
            </div>
          ) : mode === "ptt" ? (
            <button
              type="button"
              className={`flex-1 px-3 py-2 rounded font-medium text-sm transition-colors select-none ${
                pttActive
                  ? "bg-emerald-500 text-white"
                  : "bg-brand-elevated text-brand-text hover:bg-brand-elevated/70"
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
              className={`flex-1 px-3 py-2 rounded font-medium text-sm transition-colors ${
                openMicEnabled
                  ? "bg-emerald-500 text-white"
                  : "bg-brand-elevated text-brand-text hover:bg-brand-elevated/70"
              }`}
              onClick={() => setOpenMicEnabled((v) => !v)}
            >
              {openMicEnabled ? "Mic on" : "Mic off"}
            </button>
          )}
          <button
            type="button"
            className="btn-ghost text-sm"
            onClick={() => void leave()}
          >
            Leave
          </button>
        </div>
      )}

      {isConnected && participants.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {participants.map((p) => (
            <li
              key={p.identity}
              className="flex items-center gap-2 text-sm min-w-0"
            >
              <ParticipantAvatar
                url={p.avatarUrl}
                name={p.name}
                isSpeaking={p.isSpeaking}
              />
              <span
                className={`truncate flex-1 ${
                  p.isLocal ? "text-brand-gold" : ""
                }`}
              >
                {p.name}
                {p.isLocal && " (you)"}
              </span>
              {!p.micEnabled && (
                <span className="text-xs text-brand-muted shrink-0">muted</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function DisabledShell({
  label,
  message,
  tone,
}: {
  label: string;
  message: string;
  tone: "muted" | "warning";
}) {
  const toneClass =
    tone === "warning" ? "text-yellow-400" : "text-brand-muted";
  return (
    <section className="card">
      <header className="flex items-baseline justify-between border-b border-white/10 pb-2">
        <h2 className="text-lg font-semibold">{label}</h2>
        <span className={`text-xs ${toneClass}`}>{message}</span>
      </header>
    </section>
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
      className={`px-2 py-1 rounded ${
        active
          ? "bg-brand-gold text-brand-bg font-medium"
          : "bg-brand-elevated text-brand-muted hover:text-brand-text"
      }`}
    >
      {label}
    </button>
  );
}

function StatusBadge({
  status,
  count,
}: {
  status: VoiceStatus;
  count: number;
}) {
  if (status === "connected") {
    return (
      <span className="text-xs text-emerald-400">
        ● Connected · {count} in voice
      </span>
    );
  }
  if (status === "connecting") {
    return <span className="text-xs text-yellow-400">● Connecting…</span>;
  }
  if (status === "reconnecting") {
    return <span className="text-xs text-yellow-400">● Reconnecting…</span>;
  }
  if (status === "error") {
    return <span className="text-xs text-red-400">● Error</span>;
  }
  return <span className="text-xs text-brand-muted">● Disconnected</span>;
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
  const ring = isSpeaking ? "ring-2 ring-emerald-400" : "";
  if (url) {
    return (
      <Image
        src={url}
        alt=""
        width={24}
        height={24}
        className={`shrink-0 w-6 h-6 rounded-full object-cover bg-brand-elevated ${ring}`}
      />
    );
  }
  return (
    <div
      className={`shrink-0 w-6 h-6 rounded-full bg-brand-elevated flex items-center justify-center text-[10px] font-medium text-brand-muted ${ring}`}
    >
      {initials || "?"}
    </div>
  );
}
