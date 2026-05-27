import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, badRequest, zodErrorResponse } from "@/lib/api";
import { generateUniqueJoinCode, maxCapacityForTier, roomPublicSelect } from "@/lib/rooms";
import { createRoomSchema } from "@/lib/validations/room";
import { FREE_ROOM_CAPACITY } from "@/lib/config";

const BCRYPT_ROUNDS = 10;

export async function POST(req: NextRequest) {
  const { user, response } = await requireUser();
  if (!user) return response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Request body must be valid JSON");
  }

  let input;
  try {
    input = createRoomSchema.parse(body);
  } catch (err) {
    if (err instanceof ZodError) return zodErrorResponse(err);
    throw err;
  }

  if (input.isPrivate && user.tier !== "PREMIUM") {
    return badRequest("Private rooms are a premium feature");
  }

  const tierCap = maxCapacityForTier(user.tier);
  const capacity = Math.min(input.capacity ?? FREE_ROOM_CAPACITY, tierCap);
  const passwordHash = input.password
    ? await bcrypt.hash(input.password, BCRYPT_ROUNDS)
    : null;

  const joinCode = await generateUniqueJoinCode();

  const room = await prisma.room.create({
    data: {
      joinCode,
      name: input.name,
      description: input.description ?? null,
      hostId: user.id,
      theme: input.theme ?? "DARK_CINEMA",
      isPrivate: input.isPrivate ?? false,
      password: passwordHash,
      capacity,
      members: {
        create: {
          userId: user.id,
          role: "HOST",
          status: "ACTIVE",
        },
      },
    },
    select: roomPublicSelect,
  });

  return NextResponse.json({ room }, { status: 201 });
}

export async function GET() {
  const { user, response } = await requireUser();
  if (!user) return response;

  const memberships = await prisma.roomMember.findMany({
    where: {
      userId: user.id,
      status: { in: ["ACTIVE", "LEFT"] },
    },
    orderBy: { joinedAt: "desc" },
    select: {
      role: true,
      status: true,
      joinedAt: true,
      room: { select: roomPublicSelect },
    },
  });

  return NextResponse.json({ memberships });
}
