# Watch Party — Handoff Brief

Bootstrap doc for resuming the build in a fresh chat. Full detail lives in
`journal/PHASE_4_DEPLOYMENT.md` and `PLAN.md`; this is the quick-start.

---

## Resume phrase (paste this first in a new chat)

> **Resume Watch Party. App is live at `https://water-party-private-repo.vercel.app`.
> Phase 4.4 (display-name edit + presence-based live count + step-away + mobile
> fullscreen fix) and the B3 black-screen fix are shipped and verified live on two
> devices (2026-06-17). Next is Phase 5 (View Modes & UI Polish) — read
> `journal/HANDOFF.md` and `PLAN.md` → Phase 5 candidates, review with the user,
> approve/cut, then begin.**

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
- ✅ **Phase 4.4 complete + verified live** (2026-06-17) — display-name edit,
  presence-based live count, step-away mode, mobile fullscreen fix. Confirmed on
  two devices (host + viewer). See `journal/PHASE_4_4_PROFILE.md`.
- ✅ **B3 fixed + verified** (2026-06-17) — YouTube black-screen-on-first-load race.
- 🔄 **Next: Phase 5** — View Modes & UI Polish

---

## Production config (already set — do not re-enter)

- **Vercel:** 15 env vars set. `DATABASE_URL` uses Supabase **Session pooler**
  (`postgres.PROJECTREF@aws-1-us-east-1.pooler.supabase.com:5432`).
- **Railway:** `DATABASE_URL`, `DIRECT_URL`, `NEXTAUTH_SECRET`,
  `SOCKET_ALLOWED_ORIGINS` set. Also uses Session pooler for DATABASE_URL.
- **Google Cloud:** YouTube Data API v3 key active; OAuth redirect URI registered.

---

## Known issues

1. ✅ ~~**Live viewer count**~~ — FIXED in 4.4 (socket-driven `room:presence`). No more refresh-to-update.
2. **B2 — Voice mic on mobile Safari** — `NotAllowedError`. Needs better permission
   request flow + user-facing error message.
3. ✅ ~~**B3 — YouTube black screen on first load**~~ — FIXED + verified (2026-06-17).
   Root cause: VideoPlayer created the player via an async `.then()` while a separate
   effect swapped `videoId` — racy, plus the container only mounted when a video
   existed. Restructured to always-mount the container + a single load/cue effect
   gated on a `ready` flag. See `journal/PHASE_4_4_PROFILE.md` follow-up.

---

## Standing process constraint (don't wait to be reminded)

At each phase boundary, run the **phase-end ritual**:

1. write/update `journal/PHASE_N_*.md`
2. commit `Phase N.x — <subject>`
3. push origin/main
4. tell user it's a clean state + give the resume phrase
5. **never** suggest `/compact` across phases — `/clear` only

Journals are the source of truth for cross-session context.
