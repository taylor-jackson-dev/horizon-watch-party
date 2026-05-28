"use client";

import { useEffect, useImperativeHandle, useRef, forwardRef } from "react";
import {
  loadYouTubeIframeApi,
  YT_PLAYER_STATE,
  type YTPlayer,
} from "@/lib/youtube-iframe";

export interface VideoPlayerHandle {
  play(): void;
  pause(): void;
  seekTo(seconds: number): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
}

interface VideoPlayerProps {
  videoId: string | null;
  autoplay?: boolean;
  /**
   * Start the player muted. Required for the viewer because browsers block
   * programmatic play() calls without prior user interaction; muted playback
   * is exempt. The viewer can click the unmute icon on the player to enable
   * audio — that user gesture also unlocks future plays for the page.
   */
  muted?: boolean;
  controlsDisabled?: boolean;
  onReady?: () => void;
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
  /** Fires when the player transitions to the CUED state — i.e. a new video has loaded and is ready to play. */
  onCued?: () => void;
}

export const VideoPlayer = forwardRef<VideoPlayerHandle, VideoPlayerProps>(
  function VideoPlayer(
    {
      videoId,
      autoplay = false,
      muted = false,
      controlsDisabled = false,
      onReady,
      onPlay,
      onPause,
      onEnded,
      onCued,
    },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const playerRef = useRef<YTPlayer | null>(null);

    // Keep latest handler refs without re-creating the player.
    const handlersRef = useRef({ onReady, onPlay, onPause, onEnded, onCued });
    useEffect(() => {
      handlersRef.current = { onReady, onPlay, onPause, onEnded, onCued };
    }, [onReady, onPlay, onPause, onEnded, onCued]);

    useImperativeHandle(
      ref,
      () => ({
        play: () => playerRef.current?.playVideo(),
        pause: () => playerRef.current?.pauseVideo(),
        seekTo: (s: number) => playerRef.current?.seekTo(s, true),
        getCurrentTime: () => playerRef.current?.getCurrentTime() ?? 0,
        getDuration: () => playerRef.current?.getDuration() ?? 0,
        getPlayerState: () => playerRef.current?.getPlayerState() ?? -1,
      }),
      [],
    );

    // Create the player once when the container is mounted.
    useEffect(() => {
      let cancelled = false;
      const host = containerRef.current;
      if (!host) return;

      void loadYouTubeIframeApi()
        .then((YT) => {
          if (cancelled || !host) return;
          playerRef.current = new YT.Player(host, {
            width: "100%",
            height: "100%",
            videoId: videoId ?? undefined,
            playerVars: {
              autoplay: autoplay ? 1 : 0,
              controls: controlsDisabled ? 0 : 1,
              disablekb: controlsDisabled ? 1 : 0,
              modestbranding: 1,
              rel: 0,
              playsinline: 1,
              // Hide YouTube's native fullscreen button — the room shell
              // provides its own that fullscreens the whole player stage
              // (iframe + reaction overlay + picker) instead of just the
              // iframe alone. Without this, native FS hides our overlay
              // behind the iframe.
              fs: 0,
              mute: muted ? 1 : 0,
              origin: window.location.origin,
            },
            events: {
              onReady: () => handlersRef.current.onReady?.(),
              onStateChange: (e) => {
                if (typeof window !== "undefined" && window.localStorage?.getItem("wp:debug") === "1") {
                  // eslint-disable-next-line no-console
                  console.log("[WP][player] state", e.data);
                }
                switch (e.data) {
                  case YT_PLAYER_STATE.PLAYING:
                    handlersRef.current.onPlay?.();
                    break;
                  case YT_PLAYER_STATE.PAUSED:
                    handlersRef.current.onPause?.();
                    break;
                  case YT_PLAYER_STATE.ENDED:
                    handlersRef.current.onEnded?.();
                    break;
                  case YT_PLAYER_STATE.CUED:
                    handlersRef.current.onCued?.();
                    break;
                  default:
                    break;
                }
              },
            },
          });
        })
        .catch((err) => {
          // eslint-disable-next-line no-console
          console.error("[VideoPlayer] failed to init", err);
        });

      return () => {
        cancelled = true;
        const p = playerRef.current;
        if (p) {
          try {
            p.destroy();
          } catch {
            /* ignore */
          }
        }
        playerRef.current = null;
      };
      // We only want this effect to run once on mount. Subsequent videoId
      // changes are handled by the next effect via loadVideoById, which
      // is much cheaper than tearing down and recreating the player.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Swap the loaded video when videoId changes.
    useEffect(() => {
      const p = playerRef.current;
      const dbg = typeof window !== "undefined" && window.localStorage?.getItem("wp:debug") === "1";
      if (!p || !videoId) {
        if (dbg) {
          // eslint-disable-next-line no-console
          console.log("[WP][player] videoId effect skipped", { videoId, hasPlayer: !!p });
        }
        return;
      }
      if (dbg) {
        // eslint-disable-next-line no-console
        console.log(`[WP][player] ${autoplay ? "loadVideoById" : "cueVideoById"}`, videoId);
      }
      if (autoplay) p.loadVideoById(videoId);
      else p.cueVideoById(videoId);
    }, [videoId, autoplay]);

    return (
      <div className="wp-player-frame aspect-video w-full overflow-hidden rounded-xl bg-black">
        {videoId ? (
          <div ref={containerRef} className="w-full h-full" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-brand-muted text-sm">
            No video selected — add one to the queue to begin.
          </div>
        )}
      </div>
    );
  },
);
