# Watch Party — Handoff Brief

Bootstrap doc for resuming the build in a fresh chat. Full detail lives in
`journal/PHASE_4_DEPLOYMENT.md` and `PLAN.md`; this is the quick-start.

---

## Resume phrase (paste this first in a new chat)

> **Resume Watch Party. Deployment is complete — the app is live at
> `https://water-party-private-repo.vercel.app`. Next phase is 4.4 (Avatars +
> Profile Customization). Read `journal/HANDOFF.md` and `PLAN.md` → Phase 4.4
> section for context, review the candidate list with the user, approve/cut,
> then begin.**

---

## What this project is

**Watch Party** — cross-platform social video-watching app (synced YouTube
playback, chat, animated reactions, opt-in LiveKit voice). Discord-style virtual
theater.

- **Root:** `/Users/horizon/Documents/Claude-Workspace/Projects/Watch Party`
- **Repo:** `Water-Party-Private-Repo` (GitHub), branch `main`
- **Stack:** Next.js 14 (App Router, TS) · Tailwind/shadcn · Zustand · Socket.io
  (custom server) · Prisma + Postgres (Supabase) · NextAuth v5 (Google +
  email/pw) · LiveKit Cloud (voice) · YouTube IFrame API
- **Dev:** `npm run dev:all` (web :3000 + socket :3001).
  Verify with `npm run lint` && `npm run typecheck`.

---

## Where the build stands

- ✅ Phases 1–4.3 complete (foundation, rooms, sync, chat, reactions, voice)
- ✅ **Deployment complete** (2026-06-17)
  - Web: `https://water-party-private-repo.vercel.app`
  - Socket: `https://water-party-private-repo-production.up.railway.app`
  - Smoke test passed (see `journal/PHASE_4_DEPLOYMENT.md`)
- 🔄 **Next: Phase 4.4** — Avatars + Profile Customization

---

## Production config (already set — do not re-enter)

- **Vercel:** 15 env vars set. `DATABASE_URL` uses Supabase **Session pooler**
  (`postgres.PROJECTREF@aws-1-us-east-1.pooler.supabase.com:5432`).
- **Railway:** `DATABASE_URL`, `DIRECT_URL`, `NEXTAUTH_SECRET`,
  `SOCKET_ALLOWED_ORIGINS` set. Also uses Session pooler for DATABASE_URL.
- **Google Cloud:** YouTube Data API v3 key active; OAuth redirect URI registered.

---

## Known issues (fix in Phase 4.4)

1. **Live viewer count** — member count requires page refresh; refresh restarts video.
   Fix: socket-driven presence count (already in PLAN.md Phase 4.4 candidates).
2. **Voice mic on mobile Safari** — `NotAllowedError`. Needs better permission
   request flow + user-facing error message.
3. **YouTube player black screen on first load** — page refresh fixes it.
   Timing/race condition in IFrame API initialization.

---

## Standing process constraint (don't wait to be reminded)

At each phase boundary, run the **phase-end ritual**:

1. write/update `journal/PHASE_N_*.md`
2. commit `Phase N.x — <subject>`
3. push origin/main
4. tell user it's a clean state + give the resume phrase
5. **never** suggest `/compact` across phases — `/clear` only

Journals are the source of truth for cross-session context.
