// lib/rate-limit.ts
// Pure, in-memory sliding-window rate limiting, keyed per (userId, roomId).
// Extracted from the socket server so the spam-control logic can be unit-tested
// without standing up Express / Socket.io. The DB-side *_RATE_LIMIT_PER_MINUTE
// policies in config.ts are the coarser future-Redis limits; these limiters are
// the fast guard that runs on every send.

/** Chat: max sends per window before "slow_down". */
export const CHAT_RATE_LIMIT_COUNT = 5;
export const CHAT_RATE_LIMIT_WINDOW_MS = 5_000;

/** Reactions: looser than chat — reactions are inherently spammy (that's the point). */
export const REACTION_RATE_LIMIT_COUNT = 10;
export const REACTION_RATE_LIMIT_WINDOW_MS = 5_000;

export interface RateLimiter {
  /** Records an attempt and returns true if allowed, false if over the limit. */
  check(userId: string, roomId: string): boolean;
  /** Per-key buckets, `${userId}:${roomId}` → recent attempt timestamps (ms). */
  readonly hits: Map<string, number[]>;
}

/**
 * Build a sliding-window limiter allowing up to `count` actions per `windowMs`.
 * Each limiter owns its own bucket map, so instances are fully isolated.
 */
export function createRateLimiter(count: number, windowMs: number): RateLimiter {
  const hits = new Map<string, number[]>();

  function check(userId: string, roomId: string): boolean {
    const key = `${userId}:${roomId}`;
    const now = Date.now();
    const cutoff = now - windowMs;
    const recent = (hits.get(key) ?? []).filter((t) => t > cutoff);
    if (recent.length >= count) {
      // Write back the pruned list even on reject so stale timestamps don't
      // linger for a user who keeps hammering past the limit.
      hits.set(key, recent);
      return false;
    }
    recent.push(now);
    hits.set(key, recent);
    return true;
  }

  return { check, hits };
}

export const chatRateLimiter = createRateLimiter(
  CHAT_RATE_LIMIT_COUNT,
  CHAT_RATE_LIMIT_WINDOW_MS,
);

export const reactionRateLimiter = createRateLimiter(
  REACTION_RATE_LIMIT_COUNT,
  REACTION_RATE_LIMIT_WINDOW_MS,
);
