import { describe, expect, it } from "vitest";
import {
  createSpotlightDetector,
  SPOTLIGHT_THRESHOLD,
  SPOTLIGHT_WINDOW_MS,
  SPOTLIGHT_COOLDOWN_MS,
} from "@/lib/spotlight-reactions";

describe("createSpotlightDetector", () => {
  it("fires when the threshold of the same emoji lands within the window", () => {
    const d = createSpotlightDetector();
    expect(d.record("🔥", 0)).toBeNull();
    expect(d.record("🔥", 500)).toBeNull();
    expect(d.record("🔥", 1000)).toEqual({ emoji: "🔥", count: 3 });
  });

  it("does not fire below the threshold", () => {
    const d = createSpotlightDetector();
    expect(d.record("🔥", 0)).toBeNull();
    expect(d.record("🔥", 500)).toBeNull();
    // Only two within the window — no spotlight.
  });

  it("does not fire when the same emoji is spread beyond the window", () => {
    const d = createSpotlightDetector();
    expect(d.record("🔥", 0)).toBeNull();
    expect(d.record("🔥", 1500)).toBeNull();
    // At t=2600 the t=0 burst has aged out (cutoff = 2600 - 2000 = 600), so only
    // two remain in-window and nothing fires.
    expect(d.record("🔥", 2600)).toBeNull();
  });

  it("counts only the matching emoji — a mixed burst does not trigger", () => {
    const d = createSpotlightDetector();
    expect(d.record("🔥", 0)).toBeNull();
    expect(d.record("😂", 100)).toBeNull();
    expect(d.record("🔥", 200)).toBeNull(); // 🔥 count = 2
    expect(d.record("😂", 300)).toBeNull(); // 😂 count = 2
    // Neither emoji reaches the threshold despite 4 bursts in 300ms.
  });

  it("isolates the per-emoji count when a foreign emoji is interleaved", () => {
    // All bursts share one rolling buffer, so this guards the invariant that
    // the matching-emoji count never absorbs an interleaved foreign emoji.
    const d = createSpotlightDetector();
    expect(d.record("🔥", 0)).toBeNull(); // 🔥 = 1
    expect(d.record("😂", 100)).toBeNull(); // 😂 = 1 (same buffer)
    expect(d.record("🔥", 200)).toBeNull(); // 🔥 = 2
    expect(d.record("😂", 300)).toBeNull(); // 😂 = 2
    // The third 🔥 reaches the threshold even though two 😂 sit in the window.
    expect(d.record("🔥", 400)).toEqual({ emoji: "🔥", count: 3 });
  });

  it("fires once per surge — the cooldown suppresses immediate re-fires", () => {
    const d = createSpotlightDetector();
    d.record("🔥", 0);
    d.record("🔥", 100);
    expect(d.record("🔥", 200)).toEqual({ emoji: "🔥", count: 3 });
    // Still surging, but within the cooldown → no second spotlight.
    expect(d.record("🔥", 300)).toBeNull();
    expect(d.record("🔥", 1000)).toBeNull();
  });

  it("re-fires after the cooldown elapses if the surge continues", () => {
    const d = createSpotlightDetector();
    d.record("🔥", 0);
    d.record("🔥", 100);
    expect(d.record("🔥", 200)).toEqual({ emoji: "🔥", count: 3 }); // fired at 200
    // Past the cooldown (4201 - 200 = 4001 ≥ 4000); rebuild a fresh window of 3.
    expect(d.record("🔥", 4201)).toBeNull(); // window reset → count 1
    expect(d.record("🔥", 4301)).toBeNull(); // count 2
    expect(d.record("🔥", 4401)).toEqual({ emoji: "🔥", count: 3 });
  });

  it("tracks cooldowns per emoji independently", () => {
    const d = createSpotlightDetector();
    expect(d.record("🔥", 0)).toBeNull();
    expect(d.record("🔥", 100)).toBeNull();
    expect(d.record("🔥", 200)).toEqual({ emoji: "🔥", count: 3 }); // 🔥 on cooldown
    // A different emoji has its own bucket and fires on its own three.
    expect(d.record("😂", 300)).toBeNull();
    expect(d.record("😂", 400)).toBeNull();
    expect(d.record("😂", 500)).toEqual({ emoji: "😂", count: 3 });
  });

  it("reports the full in-window count on a sustained-stream re-fire", () => {
    const d = createSpotlightDetector({ cooldownMs: 1000 });
    // Prime a fire at t=200.
    d.record("🔥", 0);
    d.record("🔥", 100);
    expect(d.record("🔥", 200)).toEqual({ emoji: "🔥", count: 3 });
    // Keep streaming every 100ms; the next fire (past the 1s cooldown) reports
    // however many are in the 2s window, which can exceed the threshold.
    let lastHit: { emoji: string; count: number } | null = null;
    for (let t = 300; t <= 2000; t += 100) {
      const hit = d.record("🔥", t);
      if (hit) lastHit = hit;
    }
    expect(lastHit).not.toBeNull();
    expect(lastHit!.count).toBeGreaterThan(SPOTLIGHT_THRESHOLD);
  });

  it("honors custom options", () => {
    const d = createSpotlightDetector({ threshold: 2, windowMs: 1000, cooldownMs: 500 });
    expect(d.record("⭐", 0)).toBeNull();
    expect(d.record("⭐", 100)).toEqual({ emoji: "⭐", count: 2 });
  });

  it("exposes sane default constants", () => {
    expect(SPOTLIGHT_THRESHOLD).toBeGreaterThanOrEqual(2);
    expect(SPOTLIGHT_WINDOW_MS).toBeGreaterThan(0);
    expect(SPOTLIGHT_COOLDOWN_MS).toBeGreaterThan(0);
  });
});
