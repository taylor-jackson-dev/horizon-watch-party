/**
 * Spotlight reactions: when the room sends a burst of the SAME emoji in a short
 * window, we fire one big celebratory "spotlight" overlay on top of the normal
 * float-up reactions. This module is the pure detection logic — no React, no DOM —
 * so it can be unit-tested in isolation. The overlay component feeds it bursts in
 * arrival order and renders a spotlight whenever `record` returns a hit.
 */

/** Bursts of one emoji must land within this window (ms) to count toward a spotlight. */
export const SPOTLIGHT_WINDOW_MS = 2000;
/** How many of the same emoji within the window trigger a spotlight. */
export const SPOTLIGHT_THRESHOLD = 3;
/**
 * After a spotlight fires for an emoji, suppress re-firing THAT emoji for this long.
 * Without it, a sustained stream would re-fire on every subsequent burst; with it a
 * surge spotlights at most once per cooldown.
 */
export const SPOTLIGHT_COOLDOWN_MS = 4000;

export interface SpotlightHit {
  emoji: string;
  /** Count of that emoji within the window at the moment it fired (≥ threshold). */
  count: number;
}

export interface SpotlightDetectorOptions {
  windowMs?: number;
  threshold?: number;
  cooldownMs?: number;
}

interface BurstAt {
  emoji: string;
  at: number;
}

export interface SpotlightDetector {
  /**
   * Record a reaction burst that arrived at time `at` (ms; caller passes
   * `Date.now()`, injectable for tests). Returns a {@link SpotlightHit} when this
   * burst pushes an emoji to the threshold within the rolling window, else null.
   */
  record(emoji: string, at: number): SpotlightHit | null;
}

/**
 * Create a stateful — but deterministic — spotlight detector. Bursts must be fed
 * in non-decreasing `at` order (true for socket arrivals stamped at receipt).
 */
export function createSpotlightDetector(
  options: SpotlightDetectorOptions = {},
): SpotlightDetector {
  const windowMs = options.windowMs ?? SPOTLIGHT_WINDOW_MS;
  const threshold = options.threshold ?? SPOTLIGHT_THRESHOLD;
  const cooldownMs = options.cooldownMs ?? SPOTLIGHT_COOLDOWN_MS;

  let recent: BurstAt[] = [];
  const lastFiredAt = new Map<string, number>();

  return {
    record(emoji, at) {
      // Drop bursts that have aged out of the window, then add this one.
      const cutoff = at - windowMs;
      recent = recent.filter((b) => b.at >= cutoff);
      recent.push({ emoji, at });

      // Don't re-fire the same emoji until its cooldown has elapsed.
      const firedAt = lastFiredAt.get(emoji);
      if (firedAt !== undefined && at - firedAt < cooldownMs) {
        return null;
      }

      let count = 0;
      for (const b of recent) {
        if (b.emoji === emoji) count++;
      }
      if (count >= threshold) {
        lastFiredAt.set(emoji, at);
        return { emoji, count };
      }
      return null;
    },
  };
}
