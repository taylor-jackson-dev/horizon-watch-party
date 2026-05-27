import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import {
  requireUser,
  badRequest,
  notFound,
  forbidden,
  zodErrorResponse,
} from "@/lib/api";
import { maxCapacityForTier, roomPublicSelect } from "@/lib/rooms";
import { updateRoomSchema } from "@/lib/validations/room";

type Params = { params: { id: string } };

export async function GET(_req: NextRequest, { params }: Params) {
  const { user, response } = await requireUser();
  if (!user) return response;

  const room = await prisma.room.findUnique({
    where: { id: params.id },
    select: { ...roomPublicSelect, members: { where: { userId: user.id }, select: { role: true, status: true } } },
  });
  if (!room) return notFound("Room not found");

  const { members, ...roomFields } = room;
  const membership = members[0];
  if (!membership || membership.status === "BANNED") {
    return forbidden("You are not a member of this room");
  }

  return NextResponse.json({ room: roomFields, membership });
}

export async function PATCH(req: NextRequest, { params }: Params) {
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
    input = updateRoomSchema.parse(body);
  } catch (err) {
    if (err instanceof ZodError) return zodErrorResponse(err);
    throw err;
  }

  const room = await prisma.room.findUnique({
    where: { id: params.id },
    select: { hostId: true, capacity: true },
  });
  if (!room) return notFound("Room not found");
  if (room.hostId !== user.id) return forbidden("Only the host can update room settings");

  if (input.capacity !== undefined) {
    const tierCap = maxCapacityForTier(user.tier);
    if (input.capacity > tierCap) {
      return badRequest(`Capacity ${input.capacity} exceeds your tier limit of ${tierCap}`);
    }
  }

  const updated = await prisma.room.update({
    where: { id: params.id },
    data: input,
    select: roomPublicSelect,
  });

  return NextResponse.json({ room: updated });
}
