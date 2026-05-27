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
}

interface VideoPlayerProps {
  videoId: string | null;
  autoplay?: boolean;
  controlsDisabled?: boolean;
  onReady?: () => void;
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
}

export const VideoPlayer = forwardRef<VideoPlayerHandle, VideoPlayerProps>(
  function VideoPlayer(
    { videoId, autoplay = false, controlsDisabled = false, onReady, onPlay, onPause, onEnded },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const playerRef = useRef<YTPlayer | null>(null);

    // Keep latest handler refs without re-creating the player.
    const handlersRef = useRef({ onReady, onPlay, onPause, onEnded });
    useEffect(() => {
      handlersRef.current = { onReady, onPlay, onPause, onEnded };
    }, [onReady, onPlay, onPause, onEnded]);

    useImperativeHandle(
      ref,
      () => ({
        play: () => playerRef.current?.playVideo(),
        pause: () => playerRef.current?.pauseVideo(),
        seekTo: (s: number) => playerRef.current?.seekTo(s, true),
        getCurrentTime: () => playerRef.current?.getCurrentTime() ?? 0,
        getDuration: () => playerRef.current?.getDuration() ?? 0,
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
              origin: window.location.origin,
            },
            events: {
              onReady: () => handlersRef.current.onReady?.(),
              onStateChange: (e) => {
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
      if (!p || !videoId) return;
      if (autoplay) p.loadVideoById(videoId);
      else p.cueVideoById(videoId);
    }, [videoId, autoplay]);

    return (
      <div className="aspect-video w-full overflow-hidden rounded-xl bg-black">
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
