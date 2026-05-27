# Phase 1 — Foundation

> **Status:** Complete
> **Commit:** `0d8bebb` (initial) — Phase 1 — Foundation complete
> **Dates:** 2026-05-26 / 2026-05-27

## Goal

Stand up the Next.js app skeleton, wire Prisma against Supabase, set up NextAuth for sign-in, and prove the pipeline works end-to-end (sign in with Google, create a row).

## What was built

| Area | Detail |
|---|---|
| App framework | Next.js 14.2.29 (App Router), TypeScript, Tailwind, ESLint |
| Database | Prisma 5.22 schema applied to Supabase Postgres (`init` migration) |
| Auth | NextAuth v5-beta with Google OAuth + email/password providers (UI for email/password deferred) |
| Folder structure | `app/(auth)`, `app/(marketing)`, `app/dashboard`, `app/room/[code]`, `app/api/`, `components/{ui,room,player,chat,ads}`, `lib/`, `server/`, `prisma/`, `.github/workflows/` |
| Config constants | `lib/config.ts` — `QUEUE_MAX_SIZE`, `FREE_ROOM_CAPACITY`, `MEMBER_CONTRIB_*`, retention windows, feature flags |
| `.env.example` | Documented every env var (DATABASE_URL, DIRECT_URL, NEXTAUTH_SECRET, Google OAuth, Supabase Storage, LiveKit, Stripe, YouTube, Socket URL) |
| CI | `.github/workflows/ci.yml` — lint + typecheck on push to `main`/`develop` and PRs to `main` |

## Decisions locked

- **Single Next.js app first** (folders pre-structured for a future Turborepo extraction)
- **PWA first, Expo later** — Phase 7 for mobile
- **LiveKit Cloud** for voice (managed, free tier in dev)
- **Stripe** for payments
- **File uploads deferred** — schema hooks in place (`VideoQueue.storagePath`, `VideoSourceType.UPLOAD`), feature-flagged off
- **Chrome-first** for browser extension; Firefox/Edge later
- **JWT session strategy** (not database sessions) so the Socket.io server can verify the same token

## Problems hit and how they were resolved

1. **`next.config.ts` not supported in Next 14.** Scaffold had a `.ts` config; Next 14 only loads `.js` / `.mjs` / `.cjs` (TS config landed in Next 15). Converted to `next.config.mjs`, same content minus the TS type import.

2. **Prisma CLI loads `.env`, not `.env.local`.** Initial `prisma migrate dev` failed with `Environment variable not found: DIRECT_URL` despite the vars being in `.env.local`. Installed `dotenv-cli` and wrapped `db:migrate` / `db:push` / `db:studio` scripts so they explicitly load `.env.local` — single source of truth.

3. **NextAuth v5 `handlers` export pattern misuse.** Scaffold's `app/api/auth/[...nextauth]/route.ts` did `export { handlers as GET, handlers as POST }`. But `handlers` in NextAuth v5 is an object `{ GET, POST }`, not a function — making `GET` and `POST` both equal to the whole object. Request handler tried to call it as a function: `TypeError: r is not a function`. Fixed by destructuring: `import { handlers } from "@/lib/auth"; export const { GET, POST } = handlers;`.

4. **`.gitignore` was ignoring `prisma/migrations/`.** That's the source of truth for schema reproducibility — must be committed. Removed the offending line; migration files now version-controlled.

5. **Landing page Sign-In button linked to `/auth/signin`.** Route group `(auth)` is URL-transparent in Next.js App Router — parens don't appear in the URL. Real route is `/signin`. Fixed the anchor.

6. **`session.user.tier` typed as `string`** in the NextAuth type augmentation. Tightened to `UserTier` from `@prisma/client` so downstream API code gets enum-narrowed inference.

## Files added or significantly touched

```
prisma/schema.prisma                 # 11 models, 9 enums, 19 indexes
prisma/migrations/20260527023840_init/migration.sql
lib/auth.ts                          # NextAuth v5 config
lib/prisma.ts                        # Prisma client singleton
lib/config.ts                        # All constants + feature flags
types/next-auth.d.ts                 # Session typing (UserTier-aware)
middleware.ts                        # Auth gate for /dashboard /room
app/layout.tsx, globals.css          # Tailwind theme baseline
app/api/auth/[...nextauth]/route.ts  # NextAuth GET/POST handlers
.env.example                         # All required vars documented
.github/workflows/ci.yml             # lint + typecheck CI
```

## Verification

- `npm run typecheck` → clean
- `npm run lint` → clean (after `next.config.ts` fix)
- `npm run dev` → boots, landing page renders
- Google OAuth sign-in completes; `/api/auth/providers` returns both `google` and `credentials`
- `prisma migrate dev --name init` applied successfully against Supabase

## Deferred from this phase (tracked in DEFERRED.md)

- Next.js security patch (14.2.29 has a Dec 2025 advisory) → revisit post-MVP
- Supabase Transaction pooler URL → only needed at Vercel deploy time
- `SUPABASE_SERVICE_ROLE_KEY` → needed when Phase 4 wires Supabase Storage for avatars
- Email/password sign-in UI — providers configured but `/signin` only exposes Google for now
- Phase-gated credentials (LiveKit, Stripe, YouTube Data API) — env-var slots exist as placeholders

## What this enabled

Phase 1 is the foundation everything stands on. Phase 2 (rooms) plugs straight into the Prisma schema and NextAuth session. The dev workflow (`npm run dev`, hot reload, type-safe DB calls) was solid by the end and didn't need to change again.
