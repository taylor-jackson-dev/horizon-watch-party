import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createRateLimiter,
  chatRateLimiter,
  reactionRateLimiter,
  CHAT_RATE_LIMIT_COUNT,
  REACTION_RATE_LIMIT_COUNT,
} from "@/lib/rate-limit";

describe("createRateLimiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows calls up to the limit within a window", () => {
    const limiter = createRateLimiter(3, 5_000);
    expect(limiter.check("u1", "r1")).toBe(true);
    expect(limiter.check("u1", "r1")).toBe(true);
    expect(limiter.check("u1", "r1")).toBe(true);
  });

  it("rejects once the limit is reached within the window", () => {
    const limiter = createRateLimiter(3, 5_000);
    limiter.check("u1", "r1");
    limiter.check("u1", "r1");
    limiter.check("u1", "r1");
    // 4th call inside the same window is over the limit.
    expect(limiter.check("u1", "r1")).toBe(false);
    // Still rejected on repeated attempts within the window.
    vi.setSystemTime(4_999);
    expect(limiter.check("u1", "r1")).toBe(false);
  });

  it("re-allows after the window slides past the recorded attempts", () => {
    const limiter = createRateLimiter(2, 5_000);
    expect(limiter.check("u1", "r1")).toBe(true); // t=0
    expect(limiter.check("u1", "r1")).toBe(true); // t=0
    expect(limiter.check("u1", "r1")).toBe(false); // at limit

    // The cutoff is `now - windowMs` and timestamps are kept with strict `>`,
    // so at exactly t=windowMs the t=0 attempts fall out and a slot frees up.
    vi.setSystemTime(4_999);
    expect(limiter.check("u1", "r1")).toBe(false); // still inside the window
    vi.setSystemTime(5_000);
    expect(limiter.check("u1", "r1")).toBe(true); // window expired → allowed
  });

  it("tracks each (userId, roomId) pair independently", () => {
    const limiter = createRateLimiter(1, 5_000);
    expect(limiter.check("u1", "r1")).toBe(true);
    expect(limiter.check("u1", "r1")).toBe(false); // u1/r1 exhausted

    // A different user in the same room has their own bucket...
    expect(limiter.check("u2", "r1")).toBe(true);
    // ...and the same user in a different room does too.
    expect(limiter.check("u1", "r2")).toBe(true);
  });

  it("does not record rejected attempts (a flood cannot extend the window)", () => {
    const limiter = createRateLimiter(2, 5_000);
    expect(limiter.check("u1", "r1")).toBe(true); // t=0
    vi.setSystemTime(1_000);
    expect(limiter.check("u1", "r1")).toBe(true); // t=1000

    // Hammer past the limit; these rejects must not append timestamps.
    vi.setSystemTime(2_000);
    expect(limiter.check("u1", "r1")).toBe(false);
    expect(limiter.check("u1", "r1")).toBe(false);

    // Only t=1000 is still in-window here; the t=0 attempt has aged out and
    // the t=2000 rejects were never recorded, so a slot is free.
    vi.setSystemTime(5_001);
    expect(limiter.check("u1", "r1")).toBe(true);
  });
});

describe("configured chat & reaction limiters", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    chatRateLimiter.hits.clear();
    reactionRateLimiter.hits.clear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it(`allows ${CHAT_RATE_LIMIT_COUNT} chat sends then rejects`, () => {
    for (let i = 0; i < CHAT_RATE_LIMIT_COUNT; i++) {
      expect(chatRateLimiter.check("u1", "r1")).toBe(true);
    }
    expect(chatRateLimiter.check("u1", "r1")).toBe(false);
  });

  it(`allows ${REACTION_RATE_LIMIT_COUNT} reactions then rejects`, () => {
    for (let i = 0; i < REACTION_RATE_LIMIT_COUNT; i++) {
      expect(reactionRateLimiter.check("u1", "r1")).toBe(true);
    }
    expect(reactionRateLimiter.check("u1", "r1")).toBe(false);
  });
});
