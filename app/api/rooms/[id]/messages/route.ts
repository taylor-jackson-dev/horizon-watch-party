import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, notFound, forbidden, zodErrorResponse } from "@/lib/api";
import { messageHistoryQuerySchema } from "@/lib/validations/chat";

type Params = { params: { id: string } };

/**
 * GET /api/rooms/[id]/messages?limit=50&before=<ISO>
 *
 * Returns paginated chat history in ASCENDING chronological order so the
 * client can directly append to its rendered list. Cursor pagination via
 * `before` (a `createdAt` ISO timestamp); to fetch the next page of older
 * messages, pass the createdAt of the current oldest message.
 *
 * Includes soft-deleted rows (`deletedAt != null`). The client renders
 * "[deleted]" for those — content stays available for moderation review.
 */
export async function GET(req: NextRequest, { params }: Params) {
  const { user, response } = await requireUser();
  if (!user) return response;

  const url = new URL(req.url);
  let query;
  try {
    query = messageHistoryQuerySchema.parse({
      limit: url.searchParams.get("limit") ?? undefined,
      before: url.searchParams.get("before") ?? undefined,
    });
  } catch (err) {
    if (err instanceof ZodError) return zodErrorResponse(err);
    throw err;
  }

  const member = await prisma.roomMember.findUnique({
    where: { roomId_userId: { roomId: params.id, userId: user.id } },
    select: { status: true },
  });
  if (!member) return notFound("Room not found");
  if (member.status === "BANNED") return forbidden("You are banned from this room");
  if (member.status !== "ACTIVE") return forbidden("Inactive members cannot read chat");

  // Query newest-first so `take` always lands on the most recent rows that
  // satisfy the cursor; reverse before sending so the client gets oldest-first.
  const rows = await prisma.message.findMany({
    where: {
      roomId: params.id,
      ...(query.before ? { createdAt: { lt: query.before } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: query.limit,
    select: {
      id: true,
      roomId: true,
      userId: true,
      content: true,
      type: true,
      createdAt: true,
      deletedAt: true,
      user: { select: { displayName: true, avatarUrl: true } },
    },
  });

  const messages = rows.reverse().map((m) => ({
    id: m.id,
    roomId: m.roomId,
    userId: m.userId,
    userDisplayName: m.user.displayName,
    userAvatarUrl: m.user.avatarUrl,
    content: m.content,
    type: m.type,
    createdAt: m.createdAt.toISOString(),
    deletedAt: m.deletedAt?.toISOString() ?? null,
  }));

  return NextResponse.json({ messages });
}
