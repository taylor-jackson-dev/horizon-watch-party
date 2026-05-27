// Minimal client-side loader + types for the YouTube IFrame Player API.
// The remote script (https://www.youtube.com/iframe_api) is loaded once
// per page; subsequent calls return the cached namespace.

export const YT_PLAYER_STATE = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5,
} as const;

export type YTPlayerStateCode = (typeof YT_PLAYER_STATE)[keyof typeof YT_PLAYER_STATE];

export interface YTPlayer {
  loadVideoById(videoId: string, startSeconds?: number): void;
  cueVideoById(videoId: string, startSeconds?: number): void;
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead?: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): YTPlayerStateCode;
  destroy(): void;
}

interface YTPlayerEvent {
  target: YTPlayer;
  data?: YTPlayerStateCode;
}

interface YTPlayerOptions {
  videoId?: string;
  width?: number | string;
  height?: number | string;
  playerVars?: {
    autoplay?: 0 | 1;
    controls?: 0 | 1;
    disablekb?: 0 | 1;
    modestbranding?: 0 | 1;
    rel?: 0 | 1;
    playsinline?: 0 | 1;
    mute?: 0 | 1;
    origin?: string;
  };
  events?: {
    onReady?: (event: YTPlayerEvent) => void;
    onStateChange?: (event: YTPlayerEvent) => void;
    onError?: (event: YTPlayerEvent) => void;
  };
}

interface YTNamespace {
  Player: new (elementOrId: string | HTMLElement, options: YTPlayerOptions) => YTPlayer;
  PlayerState: typeof YT_PLAYER_STATE;
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let loaderPromise: Promise<YTNamespace> | null = null;

export function loadYouTubeIframeApi(): Promise<YTNamespace> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("YouTube IFrame API can only be loaded in the browser"));
  }
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
  if (loaderPromise) return loaderPromise;

  loaderPromise = new Promise<YTNamespace>((resolve, reject) => {
    const existing = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      try {
        existing?.();
      } catch {
        // ignore — don't let third-party handlers break us
      }
      if (window.YT && window.YT.Player) resolve(window.YT);
      else reject(new Error("YouTube IFrame API loaded but YT.Player not available"));
    };

    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = () => reject(new Error("Failed to load YouTube IFrame API"));
    document.head.appendChild(script);
  });

  return loaderPromise;
}
