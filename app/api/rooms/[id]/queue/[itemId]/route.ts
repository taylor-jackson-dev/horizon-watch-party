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
import { isHostRole } from "@/lib/rooms";
import { reorderQueueItemSchema } from "@/lib/validations/queue";

type Params = { params: { id: string; itemId: string } };

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { user, response } = await requireUser();
  if (!user) return response;

  const member = await prisma.roomMember.findUnique({
    where: { roomId_userId: { roomId: params.id, userId: user.id } },
    select: { role: true, status: true },
  });
  if (!member || member.status === "BANNED") {
    return forbidden("You are not a member of this room");
  }

  const item = await prisma.videoQueue.findUnique({
    where: { id: params.itemId },
    select: { id: true, roomId: true, addedById: true, position: true },
  });
  if (!item || item.roomId !== params.id) return notFound("Queue item not found");

  const isHost = isHostRole(member.role);
  const isContributor = item.addedById === user.id;
  if (!isHost && !isContributor) {
    return forbidden("Only the host or the original contributor can remove this item");
  }

  await prisma.$transaction([
    prisma.videoQueue.delete({ where: { id: item.id } }),
    prisma.videoQueue.updateMany({
      where: { roomId: item.roomId, position: { gt: item.position } },
      data: { position: { decrement: 1 } },
    }),
    prisma.roomMember.update({
      where: { roomId_userId: { roomId: item.roomId, userId: item.addedById } },
      data: { videoContribCount: { decrement: 1 } },
    }),
  ]);

  return NextResponse.json({ ok: true });
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
    input = reorderQueueItemSchema.parse(body);
  } catch (err) {
    if (err instanceof ZodError) return zodErrorResponse(err);
    throw err;
  }

  const member = await prisma.roomMember.findUnique({
    where: { roomId_userId: { roomId: params.id, userId: user.id } },
    select: { role: true, status: true },
  });
  if (!member || member.status === "BANNED") {
    return forbidden("You are not a member of this room");
  }
  if (!isHostRole(member.role)) {
    return forbidden("Only the host can reorder the queue");
  }

  const item = await prisma.videoQueue.findUnique({
    where: { id: params.itemId },
    select: { id: true, roomId: true, position: true },
  });
  if (!item || item.roomId !== params.id) return notFound("Queue item not found");

  const queueSize = await prisma.videoQueue.count({ where: { roomId: item.roomId } });
  const target = Math.max(0, Math.min(input.position, queueSize - 1));
  const current = item.position;
  if (target === current) {
    return NextResponse.json({ ok: true });
  }

  if (target < current) {
    await prisma.$transaction([
      prisma.videoQueue.updateMany({
        where: {
          roomId: item.roomId,
          position: { gte: target, lt: current },
        },
        data: { position: { increment: 1 } },
      }),
      prisma.videoQueue.update({ where: { id: item.id }, data: { position: target } }),
    ]);
  } else {
    await prisma.$transaction([
      prisma.videoQueue.updateMany({
        where: {
          roomId: item.roomId,
          position: { gt: current, lte: target },
        },
        data: { position: { decrement: 1 } },
      }),
      prisma.videoQueue.update({ where: { id: item.id }, data: { position: target } }),
    ]);
  }

  return NextResponse.json({ ok: true });
}
