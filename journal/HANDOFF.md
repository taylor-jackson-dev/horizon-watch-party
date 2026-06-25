# Watch Party — Handoff Brief

Bootstrap doc for resuming the build in a fresh chat. Full detail lives in
`journal/PHASE_4_DEPLOYMENT.md` and `PLAN.md`; this is the quick-start.

---

## Resume phrase (paste this first in a new chat)

> **Resume Watch Party. App is live at `https://water-party-private-repo.vercel.app`.
> Phases 1–5.3 are complete + verified live. Phase 5.4 (mobile-responsive + PWA) is
> built and static-green (typecheck · lint · build) and pushed to `main` — it needs a
> two-device live pass (real phone + desktop) before it's marked complete; run the
> live checklist in `journal/PHASE_5_4_MOBILE_PWA.md`. If 5.4 already verified, start
> Phase 5.5 — invite link for public rooms (shareable link + copy/native-share).
> Read `journal/HANDOFF.md`, `journal/PHASE_5_4_MOBILE_PWA.md`, and `PLAN.md` →
> Phase 5. Order: 5.5 invite link → 5.6 delight. Upload, full sync watchdog, live
> polls, premium theme skins, and the 4th "front-row" cinema view mode (gated on
> avatars) deferred.**

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
- ✅ **Phase 5.1 complete + verified live** (2026-06-24) — socket reconnect
  reliability. Re-emit `room:join` on every reconnect, mint a fresh token per
  attempt (survives the 1h TTL), and reconcile video/chat/queue/presence/step-away
  on a `syncEpoch` bump. Kills the friend-test "refresh fixes it" desync.
  Confirmed on two devices. See `journal/PHASE_5_1_SYNC_RELIABILITY.md`.
- ✅ **Phase 5.2 complete + verified live** (2026-06-24) — dark cinema design system +
  layout overhaul. CSS-variable theming engine keyed by `data-theme`/`data-lighting`
  (built to swap themes + add color/lighting control later), in-house UI primitives
  (`components/ui/`), app shell + real landing, full room restyle. Sync/voice/chat
  logic untouched. Confirmed on two devices; one bug caught + fixed during the pass —
  the room header showed a perpetual `WAITING` status enum, now a live
  "N/capacity watching" headcount badge. See `journal/PHASE_5_2_DESIGN_SYSTEM.md`.
- ✅ **Phase 5.3 complete + verified live** (2026-06-25) — view modes: theater /
  focus / split presets (segmented control, persisted per-browser) + a fullscreen
  translucent chat overlay. Presentation-only; sync/voice/chat untouched. Polish
  caught in the live pass: the view/fullscreen controls were covering YouTube's own
  corner chrome, so they moved off the video onto the "Now playing" row; the reaction
  picker auto-hides over the video (pure-CSS `group-hover`, pointer devices only —
  touch keeps it visible). A 4th "front-row" cinema mode (avatars seated front-row)
  is backlogged, gated on avatar upload. See `journal/PHASE_5_3_VIEW_MODES.md`.
- 🔄 **Phase 5.4 built — static-green, awaiting two-device live verify** (2026-06-25) —
  PWA (manifest at `/manifest.webmanifest`, conservative service worker, install
  button, icons, offline page) + a real mobile layout: RoomShell unified into **one
  fixed DOM** so the singleton VideoPlayer/VoicePanel never remount — desktop
  theater/focus/split + a mobile **tabbed** layout (Chat · Queue · People under a
  pinned video) are all pure-CSS now (also kills the latent remount-on-mode-switch
  bug). Presentation-only. Pushed to `main` for live verification; run the checklist
  in `journal/PHASE_5_4_MOBILE_PWA.md` before marking complete.
- 🔄 **Next: Phase 5.5** — invite link for public rooms (shareable link + copy /
  native-share).

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
4. ✅ ~~**Reconnect desync ("refresh fixes it")**~~ — FIXED + verified (2026-06-24).
   Socket.io reconnected the transport but the client never re-emitted `room:join`,
   so the server stopped delivering room broadcasts to the new socket. Re-join on
   every connect + per-attempt token mint + `syncEpoch` reconcile. See
   `journal/PHASE_5_1_SYNC_RELIABILITY.md`.

---

## Standing process constraint (don't wait to be reminded)

At each phase boundary, run the **phase-end ritual**:

1. write/update `journal/PHASE_N_*.md`
2. commit `Phase N.x — <subject>`
3. push origin/main
4. tell user it's a clean state + give the resume phrase
5. **never** suggest `/compact` across phases — `/clear` only

Journals are the source of truth for cross-session context.
