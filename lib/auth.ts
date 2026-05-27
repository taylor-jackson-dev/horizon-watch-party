// lib/auth.ts
// NextAuth v5 configuration.
// Providers: Google OAuth + email/password credentials.
// Adapter: Prisma — sessions and accounts stored in PostgreSQL.

import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { NextAuthConfig } from "next-auth";

export const authConfig: NextAuthConfig = {
  adapter: PrismaAdapter(prisma),

  // Use JWT strategy so sessions work across the custom Express socket server
  session: {
    strategy: "jwt",
  },

  pages: {
    signIn:  "/signin",
    signOut: "/",
    error:   "/signin", // Error query param appended automatically
  },

  providers: [
    // ── Google OAuth ──────────────────────────────────────────────
    GoogleProvider({
      clientId:     process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      profile(profile) {
        // Map Google's profile shape to our User model
        return {
          id:          profile.sub,
          email:       profile.email,
          displayName: profile.name,
          avatarUrl:   profile.picture,
          emailVerified: profile.email_verified ? new Date() : null,
        };
      },
    }),

    // ── Email / Password credentials ──────────────────────────────
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email:    { label: "Email",    type: "email"    },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
          include: {
            accounts: {
              where: { provider: "credentials" },
            },
          },
        });

        if (!user) return null;

        // Retrieve hashed password stored on the credentials Account record
        const credAccount = user.accounts[0];
        if (!credAccount?.access_token) return null;

        const passwordMatch = await bcrypt.compare(
          credentials.password as string,
          credAccount.access_token // access_token field stores the hashed password
        );

        if (!passwordMatch) return null;

        return {
          id:          user.id,
          email:       user.email,
          displayName: user.displayName,
          avatarUrl:   user.avatarUrl,
        };
      },
    }),
  ],

  callbacks: {
    // Attach user id and tier to the JWT so we don't need a DB lookup on every request
    async jwt({ token, user }) {
      if (user) {
        token.id   = user.id;
        token.tier = (user as { tier?: string }).tier ?? "FREE";
      }
      return token;
    },

    // Expose id and tier on the session object accessible in components
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id   = token.id   as string;
        session.user.tier = token.tier as string;
      }
      return session;
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
