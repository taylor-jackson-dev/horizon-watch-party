// types/next-auth.d.ts
// Extends NextAuth's built-in TypeScript types with our custom session fields.
// Without this, session.user.id and session.user.tier would be type errors.

import type { DefaultSession } from "next-auth";
import type { UserTier } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id:   string;
      tier: UserTier;
    } & DefaultSession["user"];
  }
}
