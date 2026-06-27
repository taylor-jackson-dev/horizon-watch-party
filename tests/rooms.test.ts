import { describe, expect, it } from "vitest";
import { isHostRole, maxCapacityForTier } from "@/lib/rooms";
import { FREE_ROOM_CAPACITY, PREMIUM_ROOM_CAPACITY } from "@/lib/config";

describe("isHostRole", () => {
  it("treats HOST and CO_HOST as hosts", () => {
    expect(isHostRole("HOST")).toBe(true);
    expect(isHostRole("CO_HOST")).toBe(true);
  });

  it("treats a plain VIEWER as a non-host", () => {
    expect(isHostRole("VIEWER")).toBe(false);
  });
});

describe("maxCapacityForTier", () => {
  it("maps the FREE tier to the free cap", () => {
    expect(maxCapacityForTier("FREE")).toBe(FREE_ROOM_CAPACITY);
  });

  it("maps the PREMIUM tier to the premium cap", () => {
    expect(maxCapacityForTier("PREMIUM")).toBe(PREMIUM_ROOM_CAPACITY);
  });
});
