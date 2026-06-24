# Watch Party — Handoff Brief

Bootstrap doc for resuming the build in a fresh chat. Full detail lives in
`journal/PHASE_4_DEPLOYMENT.md` and `PLAN.md`; this is the quick-start.

---

## Resume phrase (paste this first in a new chat)

> **Resume Watch Party. App is live at `https://water-party-private-repo.vercel.app`.
> Phase 5.2 (Dark cinema design system + layout overhaul — a CSS-variable theming
> engine keyed by `data-theme`/`data-lighting`, in-house UI primitives, app shell +
> real landing, full room restyle) is implemented and pushed; it's build-green
> (typecheck + lint + `next build` all pass) but NOT yet live-verified. First do a
> two-device visual pass (landing, dashboard, settings, sign-in, and especially the
> room: stage glow, sticky rail under the top bar, queue/chat/voice panels,
> fullscreen, reactions still float). If good, proceed to Phase 5.3 (view modes —
> theater rail, split-view toggle, fullscreen chat overlay). Read
> `journal/HANDOFF.md`, `journal/PHASE_5_2_DESIGN_SYSTEM.md`, and `PLAN.md` → Phase 5.
> Order after 5.3: 5.4 mobile/PWA → 5.5 invite link → 5.6 delight. Upload, full sync
> watchdog, live polls, premium theme skins deferred.**

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
- 🟡 **Phase 5.2 implemented + pushed — build-green, live-verify pending** (2026-06-24)
  — dark cinema design system + layout overhaul. CSS-variable theming engine keyed by
  `data-theme`/`data-lighting` (built to swap themes + add color/lighting control
  later), in-house UI primitives (`components/ui/`), app shell + real landing, full
  room restyle. Sync/voice/chat logic untouched. typecheck + lint + `next build` all
  clean; **not yet visually verified on two devices.** See
  `journal/PHASE_5_2_DESIGN_SYSTEM.md`.
- 🔄 **Next: Phase 5.3** — view modes (theater rail, split-view toggle, fullscreen chat overlay)

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
