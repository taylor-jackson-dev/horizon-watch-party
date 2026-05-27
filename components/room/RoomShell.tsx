"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRoomSocket, type VideoSyncState } from "@/lib/use-room-socket";
import { parseYouTubeVideoId } from "@/lib/youtube";
import { YT_PLAYER_STATE } from "@/lib/youtube-iframe";
import { VideoPlayer, type VideoPlayerHandle } from "./VideoPlayer";
import { QueuePanel, type QueueItem } from "./QueuePanel";

interface RoomShellProps {
  roomId: string;
  initialItems: QueueItem[];
  currentUserId: string;
  isHost: boolean;
  loopQueue: boolean;
  loopSingle: boolean;
}

const HEARTBEAT_INTERVAL_MS = 10_000;
// Generous so normal buffering lag doesn't trigger a seek loop. If a viewer
// is more than ~2.5s out of sync we'll correct; smaller drift is tolerated
// (YouTube playback rate is stable; once we're in sync we stay in sync).
const POSITION_DRIFT_TOLERANCE_SECS = 2.5;
// Fallback timeout for draining the pending state if the player's CUED
// event somehow never fires (e.g. network hiccup). Normal path is the
// onCued callback which is much faster.
const ITEM_SWITCH_FALLBACK_MS = 1500;

function dbg(label: string, payload?: unknown): void {
  if (typeof window === "undefined") return;
  if (window.localStorage?.getItem("wp:debug") !== "1") return;
  if (payload !== undefined) {
    // eslint-disable-next-line no-console
    console.log(`[WP][shell] ${label}`, payload);
  } else {
    // eslint-disable-next-line no-console
    console.log(`[WP][shell] ${label}`);
  }
}

export function RoomShell({
  roomId,
  initialItems,
  currentUserId,
  isHost,
  loopQueue,
  loopSingle,
}: RoomShellProps) {
  const [items, setItems] = useState<QueueItem[]>(initialItems);
  const [currentItemId, setCurrentItemId] = useState<string | null>(
    initialItems[0]?.id ?? null,
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const playerRef = useRef<VideoPlayerHandle | null>(null);
  const playerReadyRef = useRef(false);
  const isApplyingRemoteRef = useRef(false);
  // Holds a video:state event that we couldn't apply yet — usually because
  // the player is mid-itemSwitch and the new video hasn't cued. Drained by
  // the effect that watches currentItemId below.
  const [pendingRemoteState, setPendingRemoteState] = useState<VideoSyncState | null>(null);

  const { socket, status: socketStatus, error: socketError, initialState, serverTimeSkewMs } =
    useRoomSocket(roomId);

  const currentItem = useMemo(
    () => items.find((i) => i.id === currentItemId) ?? null,
    [items, currentItemId],
  );
  const currentVideoId = useMemo(
    () => (currentItem?.url ? parseYouTubeVideoId(currentItem.url) : null),
    [currentItem],
  );

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/rooms/${roomId}/queue`);
    if (!res.ok) return;
    const data = (await res.json()) as { items: QueueItem[] };
    setItems(data.items);
    setCurrentItemId((prev) => {
      if (prev && data.items.some((i) => i.id === prev)) return prev;
      return data.items[0]?.id ?? null;
    });
  }, [roomId]);

  // ── Host: emit state to server ──────────────────────────────────
  const emitState = useCallback(
    (overrides: Partial<Omit<VideoSyncState, "updatedAt">> = {}) => {
      if (!isHost || !socket) {
        dbg("emitState skipped", { isHost, hasSocket: !!socket });
        return;
      }
      const p = playerRef.current;
      const positionSecs =
        overrides.positionSecs !== undefined
          ? overrides.positionSecs
          : p?.getCurrentTime() ?? 0;
      const itemId = overrides.itemId !== undefined ? overrides.itemId : currentItemId;
      const isPlayingOut = overrides.isPlaying !== undefined ? overrides.isPlaying : isPlaying;
      dbg("emitState ->", { itemId, positionSecs, isPlaying: isPlayingOut });
      socket.emit("video:state", { roomId, itemId, positionSecs, isPlaying: isPlayingOut });
    },
    [isHost, socket, roomId, currentItemId, isPlaying],
  );

  // ── Player event handlers ───────────────────────────────────────
  const handleReady = useCallback(() => {
    playerReadyRef.current = true;
    dbg("player ready");
  }, []);

  // Apply the pending state immediately when the new video has cued — this
  // is much more reliable than the 800ms blind timer.
  const drainPending = useCallback(() => {
    const state = pendingRemoteState;
    if (!state) return;
    const p = playerRef.current;
    if (!p) return;
    if (state.itemId !== currentItemId) return;

    isApplyingRemoteRef.current = true;
    try {
      const serverElapsedMs = Date.now() - serverTimeSkewMs - state.updatedAt;
      const effectivePos = state.isPlaying
        ? state.positionSecs + Math.max(0, serverElapsedMs) / 1000
        : state.positionSecs;
      dbg("drain pending", { effectivePos, isPlaying: state.isPlaying });
      p.seekTo(effectivePos);
      if (state.isPlaying) p.play();
      else p.pause();
      setIsPlaying(state.isPlaying);
      setPendingRemoteState(null);
    } finally {
      setTimeout(() => {
        isApplyingRemoteRef.current = false;
      }, 250);
    }
  }, [pendingRemoteState, currentItemId, serverTimeSkewMs]);

  const handleCued = useCallback(() => {
    dbg("player cued");
    drainPending();
  }, [drainPending]);

  const handlePlay = useCallback(() => {
    if (isApplyingRemoteRef.current) return;
    setIsPlaying(true);
    if (isHost) emitState({ isPlaying: true });
  }, [isHost, emitState]);

  const handlePause = useCallback(() => {
    if (isApplyingRemoteRef.current) return;
    setIsPlaying(false);
    if (isHost) emitState({ isPlaying: false });
  }, [isHost, emitState]);

  const handleEnded = useCallback(() => {
    if (isApplyingRemoteRef.current) return;
    if (!currentItemId) return;

    const idx = items.findIndex((i) => i.id === currentItemId);
    if (idx === -1) return;

    if (loopSingle) {
      playerRef.current?.seekTo(0);
      playerRef.current?.play();
      if (isHost) emitState({ positionSecs: 0, isPlaying: true });
      return;
    }

    let nextId: string | null = null;
    if (idx < items.length - 1) {
      nextId = items[idx + 1].id;
    } else if (loopQueue && items.length > 0) {
      nextId = items[0].id;
    }

    setCurrentItemId(nextId);
    if (isHost) {
      emitState({ itemId: nextId, positionSecs: 0, isPlaying: nextId !== null });
    }
  }, [currentItemId, items, loopQueue, loopSingle, isHost, emitState]);

  // ── Host: heartbeat during playback ─────────────────────────────
  const isPlayingRef = useRef(isPlaying);
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    if (!isHost || !socket) return;
    const interval = setInterval(() => {
      if (!isPlayingRef.current) return;
      emitState({ isPlaying: true });
    }, HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isHost, socket, emitState]);

  // ── Viewer: apply remote state ──────────────────────────────────
  //
  // Two-phase strategy:
  //   - If the incoming state's itemId differs from ours, we switch the
  //     currentItemId and STORE the state as pending. The effect below
  //     drains it once the new video has had a moment to cue.
  //   - Otherwise apply directly (position + play/pause), but skip the
  //     seekTo entirely if the player is already BUFFERING (it's catching
  //     up; another seek would just restart the spinner).
  const applyRemoteState = useCallback(
    (state: VideoSyncState) => {
      dbg("applyRemoteState", {
        stateItemId: state.itemId,
        stateIsPlaying: state.isPlaying,
        statePositionSecs: state.positionSecs,
        currentItemId,
      });
      const p = playerRef.current;
      if (!playerReadyRef.current || !p) {
        setPendingRemoteState(state);
        if (state.itemId !== currentItemId) setCurrentItemId(state.itemId);
        return;
      }

      if (state.itemId !== currentItemId) {
        dbg("item change → pending");
        setCurrentItemId(state.itemId);
        setPendingRemoteState(state);
        return;
      }

      isApplyingRemoteRef.current = true;
      try {
        const serverElapsedMs = Date.now() - serverTimeSkewMs - state.updatedAt;
        const effectivePos = state.isPlaying
          ? state.positionSecs + Math.max(0, serverElapsedMs) / 1000
          : state.positionSecs;

        const playerState = p.getPlayerState();
        const isBuffering = playerState === YT_PLAYER_STATE.BUFFERING;
        const localPos = p.getCurrentTime();
        const drift = Math.abs(localPos - effectivePos);

        if (!isBuffering && drift > POSITION_DRIFT_TOLERANCE_SECS) {
          p.seekTo(effectivePos);
        }
        if (state.isPlaying) p.play();
        else p.pause();
        setIsPlaying(state.isPlaying);
      } finally {
        setTimeout(() => {
          isApplyingRemoteRef.current = false;
        }, 250);
      }
    },
    [currentItemId, serverTimeSkewMs],
  );

  // Fallback drain: if onCued never fires (e.g. transport hiccup), apply
  // the pending state after a generous timeout. Normal path is handleCued.
  useEffect(() => {
    if (isHost) return;
    if (!pendingRemoteState) return;
    if (pendingRemoteState.itemId !== currentItemId) return;

    const timer = setTimeout(() => {
      dbg("fallback drain timer fired");
      drainPending();
    }, ITEM_SWITCH_FALLBACK_MS);

    return () => clearTimeout(timer);
  }, [pendingRemoteState, currentItemId, isHost, drainPending]);

  const applyRemoteStateRef = useRef(applyRemoteState);
  useEffect(() => {
    applyRemoteStateRef.current = applyRemoteState;
  }, [applyRemoteState]);

  // Apply initial state on join exactly once (viewer only).
  // Critical: applyRemoteState's identity changes whenever currentItemId or
  // serverTimeSkewMs changes — so without a guard, every real switch would
  // re-fire this effect and reapply the (stale) initial state, snapping the
  // viewer back to whatever was playing when they joined.
  const initialStateAppliedRef = useRef(false);
  useEffect(() => {
    if (isHost) return;
    if (!initialState) return;
    if (initialStateAppliedRef.current) return;
    initialStateAppliedRef.current = true;
    applyRemoteState(initialState);
  }, [isHost, initialState, applyRemoteState]);

  // Subscribe to ongoing video:state events (viewer only)
  useEffect(() => {
    if (isHost || !socket) return;
    const onState = (state: VideoSyncState) => applyRemoteStateRef.current(state);
    socket.on("video:state", onState);
    return () => {
      socket.off("video:state", onState);
    };
  }, [isHost, socket]);

  // Host: select a different queue item
  const handleSelect = useCallback(
    (id: string) => {
      dbg("handleSelect", { id, isHost });
      setCurrentItemId(id);
      if (isHost) emitState({ itemId: id, positionSecs: 0, isPlaying: true });
    },
    [isHost, emitState],
  );

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <VideoPlayer
          ref={playerRef}
          videoId={currentVideoId}
          autoplay={isHost}
          muted={!isHost}
          controlsDisabled={false}
          onReady={handleReady}
          onPlay={handlePlay}
          onPause={handlePause}
          onEnded={handleEnded}
          onCued={handleCued}
        />
        {currentItem && (
          <div className="text-sm">
            <span className="text-brand-muted">Now playing: </span>
            <span className="font-medium">{currentItem.title}</span>
            {!isHost && (
              <span className="text-xs text-brand-muted ml-2">
                (viewer — audio muted by default; click the unmute icon on the player to enable)
              </span>
            )}
          </div>
        )}
        <SocketStatusLine status={socketStatus} error={socketError} />
      </section>

      <QueuePanel
        roomId={roomId}
        items={items}
        currentItemId={currentItemId}
        currentUserId={currentUserId}
        isHost={isHost}
        onChanged={refresh}
        onSelect={handleSelect}
      />
    </div>
  );
}

function SocketStatusLine({
  status,
  error,
}: {
  status: ReturnType<typeof useRoomSocket>["status"];
  error: string | null;
}) {
  if (status === "connected") {
    return (
      <p className="text-xs text-brand-muted">
        <span className="text-emerald-400">●</span> Connected to sync server
      </p>
    );
  }
  if (status === "error") {
    return <p className="text-xs text-red-400">Sync server error: {error ?? "unknown"}</p>;
  }
  return (
    <p className="text-xs text-brand-muted">
      <span className="text-yellow-400">●</span> Sync: {status}…
    </p>
  );
}
