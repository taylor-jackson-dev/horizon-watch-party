import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import {
  requireUser,
  badRequest,
  notFound,
  forbidden,
  conflict,
  zodErrorResponse,
} from "@/lib/api";
import { roomPublicSelect } from "@/lib/rooms";
import { joinRoomSchema } from "@/lib/validations/room";

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
    input = joinRoomSchema.parse(body);
  } catch (err) {
    if (err instanceof ZodError) return zodErrorResponse(err);
    throw err;
  }

  const room = await prisma.room.findUnique({
    where: { joinCode: input.joinCode },
    select: {
      id: true,
      capacity: true,
      isPrivate: true,
      password: true,
      closedAt: true,
      status: true,
    },
  });
  if (!room) return notFound("Room not found");
  if (room.closedAt || room.status === "ENDED") {
    return forbidden("This room has ended");
  }

  if (room.isPrivate) {
    if (!input.password) return badRequest("Password required");
    if (!room.password) return forbidden("Room is misconfigured");
    const ok = await bcrypt.compare(input.password, room.password);
    if (!ok) return forbidden("Incorrect password");
  }

  const existing = await prisma.roomMember.findUnique({
    where: { roomId_userId: { roomId: room.id, userId: user.id } },
    select: { id: true, status: true, role: true },
  });

  if (existing?.status === "BANNED") {
    return forbidden("You are banned from this room");
  }

  if (!existing) {
    const activeCount = await prisma.roomMember.count({
      where: { roomId: room.id, status: "ACTIVE" },
    });
    if (activeCount >= room.capacity) {
      return conflict("Room is at capacity");
    }
  }

  const member = existing
    ? await prisma.roomMember.update({
        where: { id: existing.id },
        data: { status: "ACTIVE", leftAt: null },
        select: { id: true, role: true, status: true },
      })
    : await prisma.roomMember.create({
        data: {
          roomId: room.id,
          userId: user.id,
          role: "VIEWER",
          status: "ACTIVE",
        },
        select: { id: true, role: true, status: true },
      });

  const fullRoom = await prisma.room.findUniqueOrThrow({
    where: { id: room.id },
    select: roomPublicSelect,
  });

  return NextResponse.json({ room: fullRoom, membership: member });
}
