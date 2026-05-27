// app/api/auth/[...nextauth]/route.ts
// NextAuth v5 route handler.
// Handles all /api/auth/* requests: signin, signout, session, callbacks.

import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;
