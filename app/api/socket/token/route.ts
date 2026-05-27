import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { signSocketToken } from "@/lib/socket-token";

export async function POST() {
  const { user, response } = await requireUser();
  if (!user) return response;

  const token = await signSocketToken({ userId: user.id, tier: user.tier });
  return NextResponse.json({ token, socketUrl: process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:3001" });
}
