import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, badRequest, zodErrorResponse } from "@/lib/api";
import { updateProfileSchema } from "@/lib/validations/user";

export async function PATCH(req: NextRequest) {
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
    input = updateProfileSchema.parse(body);
  } catch (err) {
    if (err instanceof ZodError) return zodErrorResponse(err);
    throw err;
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { displayName: input.displayName },
    select: { id: true, displayName: true, avatarUrl: true },
  });

  return NextResponse.json({ user: updated });
}
