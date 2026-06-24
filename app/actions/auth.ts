"use server";

import { signOut } from "@/lib/auth";

/** Shared sign-out server action — used by the app shell's user menu. */
export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}
