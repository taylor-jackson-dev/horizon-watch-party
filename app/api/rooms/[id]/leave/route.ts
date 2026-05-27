import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, notFound, forbidden } from "@/lib/api";

type Params = { params: { id: string } };

export async function POST(_req: NextRequest, { params }: Params) {
  const { user, response } = await requireUser();
  if (!user) return response;

  const member = await prisma.roomMember.findUnique({
    where: { roomId_userId: { roomId: params.id, userId: user.id } },
    select: { id: true, status: true, role: true },
  });
  if (!member) return notFound("You are not a member of this room");
  if (member.status === "BANNED") return forbidden("You are banned from this room");
  if (member.role === "HOST") {
    return forbidden("Host cannot leave; close the room instead");
  }

  const updated = await prisma.roomMember.update({
    where: { id: member.id },
    data: { status: "LEFT", leftAt: new Date() },
    select: { id: true, status: true, leftAt: true },
  });

  return NextResponse.json({ membership: updated });
}
