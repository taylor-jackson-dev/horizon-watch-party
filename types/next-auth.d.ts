// types/next-auth.d.ts
// Extends NextAuth's built-in TypeScript types with our custom session fields.
// Without this, session.user.id and session.user.tier would be type errors.

import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id:   string;
      tier: string; // "FREE" | "PREMIUM"
    } & DefaultSession["user"];
  }
}
