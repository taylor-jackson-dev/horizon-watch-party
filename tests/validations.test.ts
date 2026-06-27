import { describe, expect, it } from "vitest";
import { createRoomSchema, joinRoomSchema } from "@/lib/validations/room";

describe("createRoomSchema", () => {
  it("accepts a minimal public room", () => {
    expect(createRoomSchema.safeParse({ name: "Movie Night" }).success).toBe(true);
  });

  it("trims surrounding whitespace from the name", () => {
    const result = createRoomSchema.safeParse({ name: "  Movie Night  " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.name).toBe("Movie Night");
  });

  it("rejects an empty or whitespace-only name", () => {
    expect(createRoomSchema.safeParse({ name: "" }).success).toBe(false);
    expect(createRoomSchema.safeParse({ name: "   " }).success).toBe(false);
  });

  it("rejects a name longer than 80 characters", () => {
    expect(createRoomSchema.safeParse({ name: "a".repeat(81) }).success).toBe(false);
  });

  it("rejects a private room with no password", () => {
    expect(
      createRoomSchema.safeParse({ name: "Secret", isPrivate: true }).success,
    ).toBe(false);
  });

  it("rejects a private room whose password is too short", () => {
    expect(
      createRoomSchema.safeParse({ name: "Secret", isPrivate: true, password: "abc" })
        .success,
    ).toBe(false);
  });

  it("accepts a private room with a long-enough password", () => {
    expect(
      createRoomSchema.safeParse({ name: "Secret", isPrivate: true, password: "open" })
        .success,
    ).toBe(true);
  });
});

describe("joinRoomSchema", () => {
  it("accepts a bare join code", () => {
    expect(joinRoomSchema.safeParse({ joinCode: "xK9mP2qR" }).success).toBe(true);
  });

  it("trims the join code", () => {
    const result = joinRoomSchema.safeParse({ joinCode: "  xK9mP2qR  " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.joinCode).toBe("xK9mP2qR");
  });

  it("rejects an empty or whitespace-only join code", () => {
    expect(joinRoomSchema.safeParse({ joinCode: "" }).success).toBe(false);
    expect(joinRoomSchema.safeParse({ joinCode: "   " }).success).toBe(false);
  });

  it("rejects a join code longer than 32 characters", () => {
    expect(joinRoomSchema.safeParse({ joinCode: "a".repeat(33) }).success).toBe(false);
  });
});
