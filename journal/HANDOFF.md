# Watch Party — Handoff Brief

Bootstrap doc for resuming the build in a fresh chat. Full detail lives in
`journal/PHASE_4_CHAT.md` and `PLAN.md`; this is the quick-start.

---

## Resume phrase (paste this first in a new chat)

> **Resume Watch Party. Ready to deploy for remote testing.** Read
> `journal/PHASE_4_CHAT.md` and `PLAN.md` for context, then walk me through the
> deployment plan before doing anything.

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

## Where the build stands

- ✅ Phases 1–3 complete
- ✅ 4.1 Chat
- ✅ 4.2 Animated reactions
- ✅ 4.3 LiveKit voice
- ✅ 4.3.1 viewer play/pause re-sync fix

Git is clean. Last commits: `884b7c7`, `179a1ed`, `d0c62b3`.
Next feature phase is 4.4 (avatars/profile) — but **deployment comes first**.

## Next session = DEPLOYMENT (agreed focus)

Goal: a real public `https://…vercel.app` URL so remote friends can test.

1. Web → **Vercel**; socket server → **Railway** (or Fly.io).
2. Set env vars on both sides (DB, NextAuth, Google OAuth, LiveKit, socket URL).
3. Update **Google OAuth Authorized redirect URIs** + **`NEXTAUTH_URL`** to the
   deployed domain.
4. **Add a real deployment checklist to `PLAN.md`** — it has none yet (the deploy
   plan is currently implicit/late).

## ⚠️ Must-do flags at resume

- **ROTATE LIVEKIT CREDENTIALS.** Live keys were pasted in chat last session and
  are compromised. Confirm they were rotated in cloud.livekit.io before/at
  deploy. Never pass secrets through chat — verify by shape-probe only (length +
  prefix), never print values.
- **Multi-party voice is UNVERIFIED.** Solo test confirmed only UI/wiring; real
  2+ person audio still needs the remote friends test (postponed, happens after
  deploy).
- Carry-over polish (Phase 4.4): stale active-member count after a host rejoins.

## Standing process constraint (don't wait to be reminded)

At each phase boundary, run the **phase-end ritual**:

1. write/update `journal/PHASE_N_*.md`
2. commit `Phase N.x — <subject>`
3. push origin/main
4. tell user it's a clean state + give the resume phrase
5. **never** suggest `/compact` across phases — `/clear` only

Journals are the source of truth for cross-session context.
