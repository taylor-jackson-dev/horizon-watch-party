import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import {
  requireUser,
  notFound,
  forbidden,
  zodErrorResponse,
} from "@/lib/api";
import { voiceTokenRequestSchema } from "@/lib/validations/voice";
import { createVoiceToken } from "@/lib/livekit";

/**
 * POST /api/livekit/token
 *
 * Issues a short-lived LiveKit access token scoped to one (user, room). The
 * server is the sole authority on whether the caller may publish their mic:
 *   - Room.voiceEnabled gates the entire room
 *   - RoomMember.isViewOnly gates the user (no token issued at all)
 *   - RoomMember.isMicMuted gates publish (token allows subscribe-only)
 *
 * The URL is returned in the response so we never have to expose
 * NEXT_PUBLIC_LIVEKIT_URL to the client bundle.
 */
export async function POST(req: NextRequest) {
  const { user, response } = await requireUser();
  if (!user) return response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  let parsed;
  try {
    parsed = voiceTokenRequestSchema.parse(body);
  } catch (err) {
    if (err instanceof ZodError) return zodErrorResponse(err);
    throw err;
  }

  const member = await prisma.roomMember.findUnique({
    where: { roomId_userId: { roomId: parsed.roomId, userId: user.id } },
    select: {
      status: true,
      isMicMuted: true,
      isViewOnly: true,
      user: { select: { displayName: true, avatarUrl: true } },
      room: { select: { voiceEnabled: true } },
    },
  });

  if (!member) return notFound("Room not found");
  if (member.status === "BANNED") return forbidden("You are banned from this room");
  if (member.status !== "ACTIVE") return forbidden("Inactive members cannot join voice");
  if (member.isViewOnly) return forbidden("Your membership is view-only");
  if (!member.room.voiceEnabled) return forbidden("Voice is disabled in this room");

  try {
    const result = await createVoiceToken({
      userId: user.id,
      displayName: member.user.displayName,
      avatarUrl: member.user.avatarUrl,
      roomId: parsed.roomId,
      canPublish: !member.isMicMuted,
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to issue token";
    // eslint-disable-next-line no-console
    console.error("[livekit/token]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
