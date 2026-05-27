const YT_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

/**
 * Extract a YouTube video ID from any of the supported URL forms.
 * Returns null if the input doesn't look like a YouTube URL/ID.
 *
 * Supported:
 *   - https://www.youtube.com/watch?v=ID (with extra query params, &t=, &si=, etc.)
 *   - https://youtu.be/ID
 *   - https://www.youtube.com/embed/ID
 *   - https://www.youtube.com/shorts/ID
 *   - https://m.youtube.com/watch?v=ID
 *   - bare 11-char video ID
 */
export function parseYouTubeVideoId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (YT_ID_PATTERN.test(trimmed)) return trimmed;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\.|^m\./, "");

  if (host === "youtu.be") {
    const id = url.pathname.slice(1).split("/")[0];
    return YT_ID_PATTERN.test(id) ? id : null;
  }

  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (url.pathname === "/watch") {
      const v = url.searchParams.get("v");
      return v && YT_ID_PATTERN.test(v) ? v : null;
    }
    const match = url.pathname.match(/^\/(?:embed|shorts|v|live)\/([^/?]+)/);
    if (match && YT_ID_PATTERN.test(match[1])) return match[1];
  }

  return null;
}

export function youTubeThumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

export function canonicalYouTubeUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}
