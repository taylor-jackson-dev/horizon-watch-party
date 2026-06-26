"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Room,
  RoomEvent,
  Track,
  createAudioAnalyser,
  type Participant,
  type RemoteTrack,
} from "livekit-client";

export type VoiceStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "error";

export type VoiceMode = "open" | "ptt";

export interface VoiceParticipant {
  identity: string;
  name: string;
  avatarUrl: string | null;
  isLocal: boolean;
  isSpeaking: boolean;
  micEnabled: boolean;
}

const PTT_KEY = "v";

interface ParticipantMetadata {
  avatarUrl: string | null;
}

function parseMetadata(raw: string | undefined): ParticipantMetadata {
  if (!raw) return { avatarUrl: null };
  try {
    const m = JSON.parse(raw) as { avatarUrl?: unknown };
    return {
      avatarUrl: typeof m.avatarUrl === "string" ? m.avatarUrl : null,
    };
  } catch {
    return { avatarUrl: null };
  }
}

function toVoiceParticipant(p: Participant, isLocal: boolean): VoiceParticipant {
  return {
    identity: p.identity,
    name: p.name ?? p.identity,
    avatarUrl: parseMetadata(p.metadata).avatarUrl,
    isLocal,
    isSpeaking: p.isSpeaking,
    micEnabled: p.isMicrophoneEnabled,
  };
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;
}

/**
 * Wraps livekit-client's Room lifecycle in a React-friendly hook.
 *
 * Intent vs. effect: the user expresses intent (mode + open-mic toggle or
 * PTT held) and this hook reconciles that to LiveKit's actual mic publish
 * state. Status drives gating — we never try to enable the mic while not
 * connected.
 *
 * Remote audio is attached to a single hidden <div> appended to <body>.
 * Detaching on Disconnect / TrackUnsubscribed prevents zombie <audio>
 * elements from accumulating across reconnects.
 */
export function useVoiceRoom(roomId: string) {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  // Default to open-mic, joined muted: you join silent and tap your own mic to
  // start talking (PeoplePanel's per-row mic toggle drives `openMicEnabled`).
  // Push-to-talk machinery below is kept intact for a future voice settings
  // page; flipping `mode` to "ptt" re-arms the keyboard handler.
  const [mode, setMode] = useState<VoiceMode>("open");
  const [openMicEnabled, setOpenMicEnabled] = useState(false);
  const [pttActive, setPttActive] = useState(false);
  const [participants, setParticipants] = useState<VoiceParticipant[]>([]);
  // Low-latency local speaking flag, polled from the mic's Web Audio level.
  // The server-driven isSpeaking (used for everyone) is debounced and
  // round-trips, so it visibly lagged your own voice; this drives just your
  // own indicator and is merged onto the local participant below.
  const [localSpeaking, setLocalSpeaking] = useState(false);

  const roomRef = useRef<Room | null>(null);
  const audioSinkRef = useRef<HTMLDivElement | null>(null);

  // Hidden audio sink lives in <body> for the lifetime of the hook.
  useEffect(() => {
    const div = document.createElement("div");
    div.id = "wp-voice-audio-sink";
    div.style.display = "none";
    document.body.appendChild(div);
    audioSinkRef.current = div;
    return () => {
      div.remove();
      audioSinkRef.current = null;
    };
  }, []);

  const refreshParticipants = useCallback(() => {
    const room = roomRef.current;
    if (!room) {
      setParticipants([]);
      return;
    }
    const next: VoiceParticipant[] = [
      toVoiceParticipant(room.localParticipant, true),
    ];
    room.remoteParticipants.forEach((p) => {
      next.push(toVoiceParticipant(p, false));
    });
    setParticipants(next);
  }, []);

  const attachRemoteTrack = useCallback((track: RemoteTrack) => {
    if (track.kind !== Track.Kind.Audio) return;
    const sink = audioSinkRef.current;
    if (!sink) return;
    const el = track.attach();
    el.dataset.lkSid = track.sid;
    sink.appendChild(el);
  }, []);

  const detachRemoteTrack = useCallback((track: RemoteTrack) => {
    if (track.kind !== Track.Kind.Audio) return;
    track.detach().forEach((el) => el.remove());
  }, []);

  const join = useCallback(async () => {
    if (status === "connecting" || status === "connected") return;
    setStatus("connecting");
    setError(null);

    try {
      const res = await fetch("/api/livekit/token", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ roomId }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Token error (${res.status})`);
      }
      const { token, url } = (await res.json()) as {
        token: string;
        url: string;
      };

      // Pre-request mic permission so the prompt doesn't surprise users
      // mid-PTT-press. Failure is non-fatal — they can still subscribe.
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        stream.getTracks().forEach((t) => t.stop());
      } catch {
        // Permission denied or unavailable; user can still listen.
      }

      const room = new Room({ adaptiveStream: true, dynacast: true });

      room.on(RoomEvent.Connected, () => {
        setStatus("connected");
        refreshParticipants();
      });
      room.on(RoomEvent.Disconnected, () => {
        setStatus("idle");
        setParticipants([]);
      });
      room.on(RoomEvent.Reconnecting, () => setStatus("reconnecting"));
      room.on(RoomEvent.Reconnected, () => {
        setStatus("connected");
        refreshParticipants();
      });
      room.on(RoomEvent.ParticipantConnected, refreshParticipants);
      room.on(RoomEvent.ParticipantDisconnected, refreshParticipants);
      room.on(RoomEvent.ActiveSpeakersChanged, refreshParticipants);
      room.on(RoomEvent.TrackMuted, refreshParticipants);
      room.on(RoomEvent.TrackUnmuted, refreshParticipants);
      room.on(RoomEvent.LocalTrackPublished, refreshParticipants);
      room.on(RoomEvent.LocalTrackUnpublished, refreshParticipants);
      room.on(RoomEvent.TrackSubscribed, (track) => {
        attachRemoteTrack(track);
        refreshParticipants();
      });
      room.on(RoomEvent.TrackUnsubscribed, (track) => {
        detachRemoteTrack(track);
        refreshParticipants();
      });

      roomRef.current = room;
      await room.connect(url, token);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to join voice";
      setError(message);
      setStatus("error");
      const room = roomRef.current;
      if (room) {
        void room.disconnect();
      }
      roomRef.current = null;
    }
  }, [
    roomId,
    status,
    refreshParticipants,
    attachRemoteTrack,
    detachRemoteTrack,
  ]);

  const leave = useCallback(async () => {
    const room = roomRef.current;
    if (room) {
      await room.disconnect();
    }
    roomRef.current = null;
    setStatus("idle");
    setOpenMicEnabled(false);
    setPttActive(false);
    setParticipants([]);
  }, []);

  // Effective intent → publish state. Single reconcile point.
  const effectiveMicEnabled =
    status === "connected" && (mode === "ptt" ? pttActive : openMicEnabled);

  useEffect(() => {
    const room = roomRef.current;
    if (!room || status !== "connected") return;
    void room.localParticipant
      .setMicrophoneEnabled(effectiveMicEnabled)
      .catch((err) => {
        const message = err instanceof Error ? err.message : "Mic error";
        setError(message);
      });
  }, [effectiveMicEnabled, status]);

  // Local mic level → instant speaking flag. ActiveSpeakersChanged (the source
  // for everyone's isSpeaking) is debounced and round-trips through the server,
  // so your OWN ring lagged your voice. Polling the mic's audio level locally
  // makes the self-indicator react within a frame. Only runs while the mic is
  // actually live; the analyser is created lazily once the track is published.
  useEffect(() => {
    if (status !== "connected" || !effectiveMicEnabled) {
      setLocalSpeaking(false);
      return;
    }
    const room = roomRef.current;
    if (!room) return;

    let raf = 0;
    let handle: ReturnType<typeof createAudioAnalyser> | null = null;
    const SPEAKING_THRESHOLD = 0.02;

    const tick = () => {
      if (!handle) {
        const track = room.localParticipant.getTrackPublication(
          Track.Source.Microphone,
        )?.audioTrack;
        if (track) {
          handle = createAudioAnalyser(track, { smoothingTimeConstant: 0.2 });
        }
      }
      if (handle) {
        setLocalSpeaking(handle.calculateVolume() > SPEAKING_THRESHOLD);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      void handle?.cleanup();
      setLocalSpeaking(false);
    };
  }, [effectiveMicEnabled, status]);

  // PTT keyboard listener — only active in PTT mode while connected.
  // Window blur safety-releases in case keyup is missed (alt-tab while held).
  useEffect(() => {
    if (mode !== "ptt" || status !== "connected") {
      setPttActive(false);
      return;
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== PTT_KEY) return;
      if (isEditableTarget(e.target)) return;
      if (e.repeat) return;
      setPttActive(true);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== PTT_KEY) return;
      setPttActive(false);
    };
    const onBlur = () => setPttActive(false);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [mode, status]);

  // Unmount cleanup
  useEffect(() => {
    return () => {
      const room = roomRef.current;
      if (room) void room.disconnect();
      roomRef.current = null;
    };
  }, []);

  // Overlay the instant local-speaking flag onto the local participant so the
  // UI's mic ring uses it instead of the laggy server value. setLocalSpeaking
  // only flips on threshold crossings, so this re-derives rarely.
  const mergedParticipants = useMemo(
    () =>
      localSpeaking
        ? participants.map((p) => (p.isLocal ? { ...p, isSpeaking: true } : p))
        : participants,
    [participants, localSpeaking],
  );

  return {
    status,
    error,
    mode,
    setMode,
    micEnabled: effectiveMicEnabled,
    openMicEnabled,
    setOpenMicEnabled,
    pttActive,
    /** For the click-and-hold on-screen PTT button. */
    pressPtt: useCallback(() => {
      if (mode === "ptt" && status === "connected") setPttActive(true);
    }, [mode, status]),
    releasePtt: useCallback(() => setPttActive(false), []),
    participants: mergedParticipants,
    join,
    leave,
    pttKeyLabel: PTT_KEY.toUpperCase(),
  };
}
