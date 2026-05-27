// lib/prisma.ts
// Prisma client singleton.
//
// In development, Next.js hot reload can create multiple Prisma client instances
// which exhaust the database connection pool. This pattern caches a single
// instance on the global object so it survives hot reloads.

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
