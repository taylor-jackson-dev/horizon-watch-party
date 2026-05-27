import { customAlphabet } from "nanoid";
import { prisma } from "@/lib/prisma";
import {
  JOIN_CODE_LENGTH,
  FREE_ROOM_CAPACITY,
  PREMIUM_ROOM_CAPACITY,
} from "@/lib/config";
import type { UserTier, RoomMemberRole } from "@prisma/client";

// Excludes 0/O/1/I/l to reduce confusion when users type codes by hand
const JOIN_CODE_ALPHABET =
  "23456789ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz";

const nanoJoinCode = customAlphabet(JOIN_CODE_ALPHABET, JOIN_CODE_LENGTH);

/** Generate a unique room join code, retrying on the rare collision. */
export async function generateUniqueJoinCode(maxAttempts = 5): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    const code = nanoJoinCode();
    const existing = await prisma.room.findUnique({
      where: { joinCode: code },
      select: { id: true },
    });
    if (!existing) return code;
  }
  throw new Error("Failed to generate a unique join code after retries");
}

export function maxCapacityForTier(tier: UserTier): number {
  return tier === "PREMIUM" ? PREMIUM_ROOM_CAPACITY : FREE_ROOM_CAPACITY;
}

export function isHostRole(role: RoomMemberRole): boolean {
  return role === "HOST" || role === "CO_HOST";
}

export const roomPublicSelect = {
  id: true,
  joinCode: true,
  name: true,
  description: true,
  theme: true,
  status: true,
  capacity: true,
  isPrivate: true,
  hostId: true,
  chatEnabled: true,
  voiceEnabled: true,
  reactionsEnabled: true,
  memberContributionLimit: true,
  loopQueue: true,
  loopSingle: true,
  shuffleEnabled: true,
  createdAt: true,
  closedAt: true,
} as const;
