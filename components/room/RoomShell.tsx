"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRoomSocket, type VideoSyncState } from "@/lib/use-room-socket";
import { parseYouTubeVideoId } from "@/lib/youtube";
import { YT_PLAYER_STATE } from "@/lib/youtube-iframe";
import { VideoPlayer, type VideoPlayerHandle } from "./VideoPlayer";
import { QueuePanel, type QueueItem } from "./QueuePanel";
import { ChatPanel } from "./ChatPanel";
import { ReactionOverlay } from "./ReactionOverlay";
import { ReactionPicker } from "./ReactionPicker";
import { VoicePanel } from "./VoicePanel";
import { PresencePanel } from "./PresencePanel";
import {
  MaximizeIcon,
  MinimizeIcon,
  LayoutRailIcon,
  LayoutFullIcon,
  LayoutSplitIcon,
  ChatBubbleIcon,
} from "@/components/ui/icons";

// Room layout presets, surfaced as a segmented control on the player stage.
//  theater — stage + social rail (default).
//  focus   — rail hidden, stage maximized ("lights down").
//  split   — stage + enlarged chat side-by-side; secondary panels tuck below.
type ViewMode = "theater" | "focus" | "split";
const VIEW_MODES: ViewMode[] = ["theater", "focus", "split"];
const VIEWMODE_STORAGE_KEY = "wp:viewmode";
const FSCHAT_STORAGE_KEY = "wp:fschat";

function isViewMode(v: unknown): v is ViewMode {
  return typeof v === "string" && (VIEW_MODES as string[]).includes(v);
}

interface RoomShellProps {
  roomId: string;
  initialItems: QueueItem[];
  currentUserId: string;
  isHost: boolean;
  loopQueue: boolean;
  loopSingle: boolean;
  chatEnabled: boolean;
  isChatRestricted: boolean;
  reactionsEnabled: boolean;
  voiceEnabled: boolean;
  isMicMuted: boolean;
  isViewOnly: boolean;
  initialActiveCount: number;
  capacity: number;
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
  chatEnabled,
  isChatRestricted,
  reactionsEnabled,
  voiceEnabled,
  isMicMuted,
  isViewOnly,
  initialActiveCount,
  capacity,
}: RoomShellProps) {
  const [items, setItems] = useState<QueueItem[]>(initialItems);
  const [currentItemId, setCurrentItemId] = useState<string | null>(
    initialItems[0]?.id ?? null,
  );
  const [isPlaying, setIsPlaying] = useState(false);
  // Step-away (AFK). While away, a viewer detaches from sync: incoming host
  // state is ignored and their own play/pause won't pull a re-sync. The ref
  // mirrors the state so the socket handlers (stable closures) read it live.
  const [isAway, setIsAway] = useState(false);
  const isAwayRef = useRef(false);
  const playerRef = useRef<VideoPlayerHandle | null>(null);
  const playerReadyRef = useRef(false);
  const isApplyingRemoteRef = useRef(false);
  const playerStageRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  // Fallback for browsers without element Fullscreen API (iPhone Safari only
  // fullscreens <video>, never a <div>). When native FS is unavailable we pin
  // the stage to the viewport via CSS instead so the button still works.
  const [cssFullscreen, setCssFullscreen] = useState(false);
  // View-mode preset + fullscreen-chat-overlay visibility. Both seed to their
  // defaults for a stable first paint (SSR-safe), then hydrate from
  // localStorage in a mount effect to avoid a hydration mismatch.
  const [viewMode, setViewMode] = useState<ViewMode>("theater");
  const [fsChatOpen, setFsChatOpen] = useState(true);
  // Holds a video:state event that we couldn't apply yet — usually because
  // the player is mid-itemSwitch and the new video hasn't cued. Drained by
  // the effect that watches currentItemId below.
  const [pendingRemoteState, setPendingRemoteState] = useState<VideoSyncState | null>(null);

  const { socket, status: socketStatus, error: socketError, initialState, serverTimeSkewMs, syncEpoch } =
    useRoomSocket(roomId);

  const currentItem = useMemo(
    () => items.find((i) => i.id === currentItemId) ?? null,
    [items, currentItemId],
  );
  const currentVideoId = useMemo(
    () => (currentItem?.url ? parseYouTubeVideoId(currentItem.url) : null),
    [currentItem],
  );

  // Pure: just refetches the queue and reconciles local state. Used both
  // by the local-mutation path AND by the queue:changed broadcast handler.
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

  // Used by QueuePanel when this client successfully mutates the queue.
  // Refreshes local data AND announces to other room members so their
  // items[] doesn't go stale. Without the announce, a freshly-added item
  // played by the host would render as "No video selected" on viewers
  // until they refreshed the page.
  const handleQueueMutation = useCallback(async () => {
    await refresh();
    if (socket) {
      socket.emit("queue:changed", { roomId });
    }
  }, [refresh, socket, roomId]);

  // Subscribe to queue:changed broadcasts from other clients. We refresh
  // without re-emitting (otherwise we'd loop forever).
  useEffect(() => {
    if (!socket) return;
    const onQueueChanged = () => {
      dbg("queue:changed received");
      void refresh();
    };
    socket.on("queue:changed", onQueueChanged);
    return () => {
      socket.off("queue:changed", onQueueChanged);
    };
  }, [socket, refresh]);

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
    if (isHost) {
      emitState({ isPlaying: true });
    } else if (socket && !isAwayRef.current) {
      // Viewer-initiated play (e.g. they paused earlier and hit resume,
      // or used the YT controls to seek). Their local position has likely
      // diverged from the host — pull the authoritative state immediately
      // instead of waiting for the next host heartbeat (~10s). Suppressed
      // while away so a stepped-away viewer isn't yanked back into sync.
      dbg("viewer play → request-sync");
      socket.emit("video:request-sync", { roomId });
    }
  }, [isHost, emitState, socket, roomId]);

  const handlePause = useCallback(() => {
    if (isApplyingRemoteRef.current) return;
    setIsPlaying(false);
    if (isHost) {
      emitState({ isPlaying: false });
    } else if (socket && !isAwayRef.current) {
      // Same logic as handlePlay — re-sync to host on any viewer-driven
      // state change. If the host is actually playing, the response will
      // snap the viewer back into play; if the host is also paused, no-op.
      // Suppressed while away so the viewer can pause and stay paused.
      dbg("viewer pause → request-sync");
      socket.emit("video:request-sync", { roomId });
    }
  }, [isHost, emitState, socket, roomId]);

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
    isAwayRef.current = isAway;
  }, [isAway]);

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
    const onState = (state: VideoSyncState) => {
      // While away, ignore host corrections — let local playback run free.
      if (isAwayRef.current) return;
      applyRemoteStateRef.current(state);
    };
    socket.on("video:state", onState);
    return () => {
      socket.off("video:state", onState);
    };
  }, [isHost, socket]);

  // ── Reconcile after a reconnect ─────────────────────────────────
  // syncEpoch bumps on every (re)join. Epoch 1 is the initial join
  // (handled by the initial-state effect above); epoch ≥ 2 means the socket
  // reconnected and we missed whatever was broadcast while we were gone.
  // Heal it: refetch the queue, then either push our authoritative state
  // (host) or pull the host's (viewer), and restore the step-away flag the
  // server clears on a fresh presence entry. The last-epoch ref keeps this
  // from firing when unrelated deps (emitState/refresh) change identity
  // during normal playback — it only acts when the epoch actually advances.
  const lastReconciledEpoch = useRef(0);
  useEffect(() => {
    if (syncEpoch <= 1 || !socket) return;
    if (lastReconciledEpoch.current === syncEpoch) return;
    lastReconciledEpoch.current = syncEpoch;
    dbg("reconnect reconcile", { syncEpoch, isHost });
    void refresh();
    if (isHost) {
      emitState();
    } else if (!isAwayRef.current) {
      socket.emit("video:request-sync", { roomId });
    }
    if (isAwayRef.current) {
      socket.emit("presence:set-away", { roomId, away: true });
    }
  }, [syncEpoch, socket, isHost, refresh, emitState, roomId]);

  // ── Fullscreen ──────────────────────────────────────────────────
  // We fullscreen the WHOLE player stage (iframe + reaction overlay +
  // picker), not the YouTube iframe alone — otherwise the iframe covers
  // our overlay and reactions vanish. YouTube's own FS button is hidden
  // via playerVars.fs=0 in VideoPlayer so users only see ours.
  useEffect(() => {
    const onChange = () => {
      const doc = document as Document & { webkitFullscreenElement?: Element };
      const fsEl = document.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
      setIsFullscreen(fsEl === playerStageRef.current);
    };
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("webkitfullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("webkitfullscreenchange", onChange);
    };
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = playerStageRef.current;
    if (!el) return;
    const doc = document as Document & {
      webkitExitFullscreen?: () => Promise<void>;
      webkitFullscreenElement?: Element;
    };
    const fsEl = document.fullscreenElement ?? doc.webkitFullscreenElement ?? null;

    // Exit whichever mode is currently active.
    if (fsEl) {
      if (document.exitFullscreen) void document.exitFullscreen();
      else doc.webkitExitFullscreen?.();
      return;
    }
    if (cssFullscreen) {
      setCssFullscreen(false);
      return;
    }

    // Enter: prefer the native Fullscreen API; fall back to a CSS viewport-pin
    // when it's unavailable. iPhone Safari exposes no element fullscreen
    // (requestFullscreen/webkitRequestFullscreen are absent on a <div>), so
    // the native branch silently no-ops there — detect and use CSS instead.
    const target = el as HTMLDivElement & {
      webkitRequestFullscreen?: () => Promise<void>;
    };
    const canNative =
      document.fullscreenEnabled !== false &&
      (typeof target.requestFullscreen === "function" ||
        typeof target.webkitRequestFullscreen === "function");
    if (canNative) {
      if (target.requestFullscreen) void target.requestFullscreen();
      else target.webkitRequestFullscreen?.();
    } else {
      setCssFullscreen(true);
    }
  }, [cssFullscreen]);

  // Hydrate the persisted view-mode + overlay prefs once on mount.
  useEffect(() => {
    try {
      const v = window.localStorage.getItem(VIEWMODE_STORAGE_KEY);
      if (isViewMode(v)) setViewMode(v);
      if (window.localStorage.getItem(FSCHAT_STORAGE_KEY) === "0") setFsChatOpen(false);
    } catch {
      /* private mode / disabled storage — defaults are fine */
    }
  }, []);

  const updateViewMode = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    try {
      window.localStorage.setItem(VIEWMODE_STORAGE_KEY, mode);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleFsChat = useCallback(() => {
    setFsChatOpen((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(FSCHAT_STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  // Host: select a different queue item
  const handleSelect = useCallback(
    (id: string) => {
      dbg("handleSelect", { id, isHost });
      setCurrentItemId(id);
      if (isHost) emitState({ itemId: id, positionSecs: 0, isPlaying: true });
    },
    [isHost, emitState],
  );

  // Step-away toggle. Broadcasts the AFK flag so the roster updates for
  // everyone. On return we ignored host state while away, so pull the
  // authoritative state once to snap cleanly back into sync.
  const handleToggleAway = useCallback(() => {
    setIsAway((prev) => {
      const next = !prev;
      if (socket) {
        socket.emit("presence:set-away", { roomId, away: next });
        if (!next) socket.emit("video:request-sync", { roomId });
      }
      return next;
    });
  }, [socket, roomId]);

  const fullscreenActive = isFullscreen || cssFullscreen;

  // Panels rendered once and slotted differently per view mode. Only one
  // branch of the layout below mounts each on a given render, so there's no
  // duplicate-instance concern.
  const presenceNode = (
    <PresencePanel
      socket={socket}
      currentUserId={currentUserId}
      initialCount={initialActiveCount}
      capacity={capacity}
      canStepAway={!isHost}
      isAway={isAway}
      onToggleAway={handleToggleAway}
    />
  );
  const voiceNode = (
    <VoicePanel
      roomId={roomId}
      voiceEnabled={voiceEnabled}
      isMicMuted={isMicMuted}
      isViewOnly={isViewOnly}
    />
  );
  const queueNode = (
    <QueuePanel
      roomId={roomId}
      items={items}
      currentItemId={currentItemId}
      currentUserId={currentUserId}
      isHost={isHost}
      onChanged={handleQueueMutation}
      onSelect={handleSelect}
    />
  );
  const chatNode = (
    <ChatPanel
      roomId={roomId}
      socket={socket}
      currentUserId={currentUserId}
      chatEnabled={chatEnabled}
      isChatRestricted={isChatRestricted}
      syncEpoch={syncEpoch}
    />
  );

  const gridColsClass =
    viewMode === "split"
      ? "lg:grid-cols-[1fr_minmax(340px,420px)]"
      : viewMode === "focus"
        ? "lg:grid-cols-1"
        : "lg:grid-cols-[1fr_300px]";

  return (
    <div className={`grid grid-cols-1 gap-6 ${gridColsClass}`}>
      <div className="space-y-6 min-w-0">
        <section className="space-y-2">
          <div
            ref={playerStageRef}
            className={`group wp-player-stage relative${cssFullscreen ? " wp-fs-css" : ""}${
              fullscreenActive ? "" : " rounded-xl shadow-screen ring-1 ring-border/60"
            }`}
          >
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
            <ReactionOverlay roomId={roomId} socket={socket} />
            <ReactionPicker
              roomId={roomId}
              socket={socket}
              reactionsEnabled={reactionsEnabled}
              align={fullscreenActive && fsChatOpen ? "left" : "right"}
              autoHide
            />
            {/* Fullscreen-only controls — chat toggle + exit. These must live
                INSIDE the stage because native fullscreen renders only the
                stage subtree. No hover-fade here: in fullscreen the stage
                fills the viewport so :hover is always true and a fade couldn't
                hide them anyway. Wrapper is pointer-events-none; only the
                buttons capture clicks. The view-mode presets + enter-fullscreen
                button live in the bar ABOVE the player, off the video. */}
            {fullscreenActive && (
              <div className="pointer-events-none absolute top-3 right-3 z-20 flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleFsChat}
                  aria-pressed={fsChatOpen}
                  className={`pointer-events-auto w-10 h-10 rounded-full backdrop-blur-sm flex items-center justify-center shadow-lg transition-colors ${
                    fsChatOpen
                      ? "bg-gold text-on-gold hover:bg-gold-bright"
                      : "bg-black/70 text-white hover:bg-black/85"
                  }`}
                  aria-label={fsChatOpen ? "Hide chat overlay" : "Show chat overlay"}
                  title={fsChatOpen ? "Hide chat" : "Show chat"}
                >
                  <ChatBubbleIcon size={18} />
                </button>
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className="pointer-events-auto w-10 h-10 rounded-full bg-black/70 backdrop-blur-sm text-white flex items-center justify-center shadow-lg hover:bg-black/85 transition-colors"
                  aria-label="Exit fullscreen"
                  title="Exit fullscreen"
                >
                  <MinimizeIcon size={18} />
                </button>
              </div>
            )}

            {/* Fullscreen chat overlay — a second, translucent ChatPanel that
                lives INSIDE the stage element so it's visible while the stage
                is fullscreen (native FS only renders the stage subtree). Docked
                below the control row so the buttons stay tappable. */}
            {fullscreenActive && fsChatOpen && (
              <div className="pointer-events-auto absolute top-16 right-2 bottom-2 z-10 w-[340px] max-w-[80%]">
                <ChatPanel
                  roomId={roomId}
                  socket={socket}
                  currentUserId={currentUserId}
                  chatEnabled={chatEnabled}
                  isChatRestricted={isChatRestricted}
                  syncEpoch={syncEpoch}
                  compact
                  panelClassName="bg-black/45 backdrop-blur-md border-white/10 shadow-2xl"
                />
              </div>
            )}
          </div>
          {/* Controls sit BELOW the player so the video stays flush at the top
              of the column. Off the video, so they never cover the embed's own
              corner chrome (YouTube puts share/settings in those corners; other
              players may differ). View-mode presets are an lg+ concern — every
              mode collapses to a single column below lg — so they're hidden on
              mobile, leaving just the fullscreen toggle. Replaced by the
              in-stage overlay while fullscreen. */}
          {!fullscreenActive && (
            <div className="flex items-center justify-end gap-2">
              <div className="hidden lg:flex items-center gap-0.5 rounded-full bg-surface border border-border p-1">
                <StageModeButton
                  active={viewMode === "theater"}
                  onClick={() => updateViewMode("theater")}
                  label="Theater view — stage with side rail"
                  icon={<LayoutRailIcon size={16} />}
                />
                <StageModeButton
                  active={viewMode === "focus"}
                  onClick={() => updateViewMode("focus")}
                  label="Focus view — maximize the screen"
                  icon={<LayoutFullIcon size={16} />}
                />
                <StageModeButton
                  active={viewMode === "split"}
                  onClick={() => updateViewMode("split")}
                  label="Split view — chat beside the screen"
                  icon={<LayoutSplitIcon size={16} />}
                />
              </div>
              <button
                type="button"
                onClick={toggleFullscreen}
                className="w-10 h-10 rounded-full bg-surface border border-border text-text flex items-center justify-center hover:bg-elevated hover:border-border-strong transition-colors"
                aria-label="Enter fullscreen"
                title="Fullscreen"
              >
                <MaximizeIcon size={18} />
              </button>
            </div>
          )}
          {currentItem && (
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
              <span className="font-display text-xs uppercase tracking-wider text-gold">
                Now playing
              </span>
              <span className="font-medium text-text truncate">{currentItem.title}</span>
              {!isHost && (
                <span className="text-xs text-muted">
                  (viewer — audio muted by default; click the unmute icon on the player to enable)
                </span>
              )}
            </div>
          )}
          <SocketStatusLine status={socketStatus} error={socketError} />
        </section>

        {viewMode === "split" ? (
          // Secondary panels tuck under the stage so the wide chat column
          // owns the right side.
          <div className="space-y-4">
            {queueNode}
            <div className="grid gap-4 sm:grid-cols-2">
              {presenceNode}
              {voiceNode}
            </div>
          </div>
        ) : (
          queueNode
        )}
      </div>

      {viewMode === "theater" && (
        <aside className="lg:h-[calc(100vh-6rem)] lg:sticky lg:top-20 flex flex-col gap-3 min-h-0">
          {presenceNode}
          {voiceNode}
          <div className="flex-1 min-h-0 h-[500px] lg:h-auto">{chatNode}</div>
        </aside>
      )}

      {viewMode === "split" && (
        <aside className="lg:h-[calc(100vh-6rem)] lg:sticky lg:top-20 flex flex-col min-h-0">
          <div className="flex-1 min-h-0 h-[600px] lg:h-auto">{chatNode}</div>
        </aside>
      )}
      {/* focus — no rail; the stage spans the full content width. */}
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
      <p className="text-xs text-muted">
        <span className="text-success">●</span> Connected to sync server
      </p>
    );
  }
  if (status === "error") {
    return <p className="text-xs text-danger">Sync server error: {error ?? "unknown"}</p>;
  }
  return (
    <p className="text-xs text-muted">
      <span className="text-warning">●</span> Sync: {status}…
    </p>
  );
}

function StageModeButton({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      title={label}
      className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
        active
          ? "bg-gold text-on-gold"
          : "text-muted hover:text-text hover:bg-elevated"
      }`}
    >
      {icon}
    </button>
  );
}
