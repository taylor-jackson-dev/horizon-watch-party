import { NextResponse } from "next/server";
import { ZodError, type ZodIssue } from "zod";
import { auth } from "@/lib/auth";

export async function requireUser() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return {
      user: null,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    } as const;
  }
  return {
    user: { id: userId, tier: session.user.tier ?? "FREE" },
    response: null,
  } as const;
}

export function badRequest(message: string, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status: 400 });
}

export function notFound(message = "Not found") {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function forbidden(message = "Forbidden") {
  return NextResponse.json({ error: message }, { status: 403 });
}

export function conflict(message: string) {
  return NextResponse.json({ error: message }, { status: 409 });
}

export function zodErrorResponse(err: ZodError) {
  const issues: ZodIssue[] = err.issues;
  return badRequest("Invalid request", issues);
}
