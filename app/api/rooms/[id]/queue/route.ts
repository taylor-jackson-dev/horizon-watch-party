import { NextRequest, NextResponse } from "next/server";
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
import { isHostRole } from "@/lib/rooms";
import { addQueueItemSchema } from "@/lib/validations/queue";
import { parseYouTubeVideoId, canonicalYouTubeUrl, youTubeThumbnailUrl } from "@/lib/youtube";
import { QUEUE_MAX_SIZE } from "@/lib/config";

type Params = { params: { id: string } };

export async function GET(_req: NextRequest, { params }: Params) {
  const { user, response } = await requireUser();
  if (!user) return response;

  const member = await prisma.roomMember.findUnique({
    where: { roomId_userId: { roomId: params.id, userId: user.id } },
    select: { status: true },
  });
  if (!member) return notFound("Room not found");
  if (member.status === "BANNED") return forbidden("You are banned from this room");

  const items = await prisma.videoQueue.findMany({
    where: { roomId: params.id },
    orderBy: { position: "asc" },
    select: {
      id: true,
      type: true,
      url: true,
      title: true,
      thumbnailUrl: true,
      durationSecs: true,
      position: true,
      hasPlayed: true,
      playedAt: true,
      createdAt: true,
      addedById: true,
    },
  });

  return NextResponse.json({ items });
}

export async function POST(req: NextRequest, { params }: Params) {
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
    input = addQueueItemSchema.parse(body);
  } catch (err) {
    if (err instanceof ZodError) return zodErrorResponse(err);
    throw err;
  }

  const videoId = parseYouTubeVideoId(input.url);
  if (!videoId) return badRequest("Only YouTube URLs are supported right now");

  const room = await prisma.room.findUnique({
    where: { id: params.id },
    select: { id: true, memberContributionLimit: true },
  });
  if (!room) return notFound("Room not found");

  const member = await prisma.roomMember.findUnique({
    where: { roomId_userId: { roomId: room.id, userId: user.id } },
    select: { role: true, status: true, videoContribCount: true },
  });
  if (!member) return forbidden("You are not a member of this room");
  if (member.status !== "ACTIVE") return forbidden("Inactive members cannot add to the queue");

  const isHost = isHostRole(member.role);
  if (!isHost) {
    if (room.memberContributionLimit === 0) {
      return forbidden("Only the host can add videos in this room");
    }
    if (member.videoContribCount >= room.memberContributionLimit) {
      return forbidden(`You've hit your contribution limit (${room.memberContributionLimit})`);
    }
  }

  const totalCount = await prisma.videoQueue.count({ where: { roomId: room.id } });
  if (totalCount >= QUEUE_MAX_SIZE) {
    return conflict(`Queue is full (max ${QUEUE_MAX_SIZE})`);
  }

  const lastItem = await prisma.videoQueue.findFirst({
    where: { roomId: room.id },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  const nextPosition = lastItem ? lastItem.position + 1 : 0;

  const [item] = await prisma.$transaction([
    prisma.videoQueue.create({
      data: {
        roomId: room.id,
        addedById: user.id,
        type: "YOUTUBE",
        url: canonicalYouTubeUrl(videoId),
        title: input.title?.trim() || `YouTube video ${videoId}`,
        thumbnailUrl: youTubeThumbnailUrl(videoId),
        position: nextPosition,
      },
      select: {
        id: true,
        type: true,
        url: true,
        title: true,
        thumbnailUrl: true,
        durationSecs: true,
        position: true,
        hasPlayed: true,
        playedAt: true,
        createdAt: true,
        addedById: true,
      },
    }),
    prisma.roomMember.update({
      where: { roomId_userId: { roomId: room.id, userId: user.id } },
      data: { videoContribCount: { increment: 1 } },
    }),
  ]);

  return NextResponse.json({ item }, { status: 201 });
}
