# Watch Party — Handoff Brief

Bootstrap doc for resuming the build in a fresh chat. Full detail lives in
`journal/PHASE_4_DEPLOYMENT.md` and `PLAN.md`; this is the quick-start.

---

## Resume phrase (paste this first in a new chat)

> **Resume Watch Party. App is live at `https://water-party-private-repo.vercel.app`.
> Phases 1–5.4.1 are complete + verified live. Phase 5.5 (invite link) is BUILT +
> static-green and DEPLOYED — awaiting its two-device live verify. The invite link is
> the room URL (`/room/<code>`), with a copy/native-share button in the room header +
> on each dashboard card; opening a PUBLIC link auto-joins you (join fires client-side
> on mount, so Next.js `<Link>` prefetch can't silently enroll a hovering user); PRIVATE
> links land on a password card; it reuses `/api/rooms/join` (no new route, no
> migration). FIRST: run the live checklist in `journal/PHASE_5_5_INVITE_LINK.md` on two
> devices/accounts; if green, mark 5.5 verified, then start Phase 5.6 — delight
> (spotlight reactions + catch-up summary for latecomers). Read `journal/HANDOFF.md`,
> `journal/PHASE_5_5_INVITE_LINK.md`, and `PLAN.md` → Phase 5. Deferred: voice settings
> page + voice-quality work (mic monitoring, background-noise suppression, snappier
> remote speaking rings — see PLAN backlog), avatar upload, full sync watchdog, live
> polls, premium theme skins, and the 4th "front-row" cinema view mode (gated on
> avatars).**

---

## Next-chat agenda (queued 2026-06-27)

Three **independent** workstreams for the next session — tackle in any order:

1. **Product (the roadmap):** Phase 5.5 two-device live verify → then Phase 5.6 (delight). This is what the resume phrase above is about.
2. **Build the research agent** (new — under a "research umbrella," parallel to the review umbrella). My full thinking is in `## Research agent — proposed` near the bottom.
3. **Socket-server hardening** from the first `review-code` audit. Details + checklist live in `DEFERRED.md → Code Audit Backlog`. ⚠️ **Both fix chips' output is already sitting in the working tree, UNCOMMITTED + unverified** (map eviction + `.unref()` sweep in `server/socket-server.ts`; new `lib/rate-limit.ts` + `tests/rate-limit.test.ts`). **It currently fails typecheck** — a one-line Map-iteration fix at `server/socket-server.ts:67` (lint + 22 tests are green; see `DEFERRED.md`) — so fix → verify → commit them (their chat sessions are "waiting"). The **process-crash guard (High)** is *not* covered by either chip — pick that one up here.

**Review-system note:** the `review-*` umbrella is complete and `review-code` is approved + tuned (see `## Review system` below). Custom agents only register at startup, so **after this `/clear`, `review-code` becomes natively spawnable** as a subagent (this session ran it through a general-purpose stand-in).

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
- ✅ **Phase 5.4 complete + verified live** (2026-06-25) — PWA (manifest at
  `/manifest.webmanifest`, conservative service worker, install button, icons, offline
  page) + a real mobile layout: RoomShell unified into **one fixed DOM** so the
  singleton VideoPlayer/voice call never remount — desktop theater/focus/split + a
  mobile **tabbed** layout (Chat · Queue · People under a pinned video) are all pure-CSS
  (also killed the latent remount-on-mode-switch bug). Confirmed two-device
  ("Everything checks out"). See `journal/PHASE_5_4_MOBILE_PWA.md`.
- ✅ **Phase 5.4.1 complete + verified live** (2026-06-25) — combined **People panel**:
  the "Watching" roster + "Voice" box merged into one box — each viewer is one row
  (presence dot · name · **mic toggle at the far end**), with the Join-voice button
  directly below. PTT/open-mic selector removed (→ future voice settings page); default
  **open-mic, joined muted** (tap your mic to talk). A green speaking **ring** rings the
  mic icon while voice is picked up — your own ring is instant (local Web Audio
  `createAudioAnalyser`); others' rings ride the server's debounced
  `ActiveSpeakersChanged` (a slight delay, backlogged under voice-quality work). Keyed on
  userId === LiveKit identity; used everywhere (mobile People tab + desktop rail) so the
  voice call still mounts once. PresencePanel + VoicePanel deleted. Confirmed two-device
  ("Looks good on both ends"). See `journal/PHASE_5_4_MOBILE_PWA.md` §5.4.1.
- 🔄 **Phase 5.5 — invite link** (built + static-green, **awaiting two-device live
  verify**) — invite link = the room URL (`/room/<code>`); copy/native-share button in
  the room header + on each dashboard card; **public** links auto-join (client-side
  join-on-mount, prefetch-safe), **private** links prompt for the password; reuses
  `/api/rooms/join` (no new route, no migration). See `journal/PHASE_5_5_INVITE_LINK.md`.
- 🔄 **Next: Phase 5.6** — delight (spotlight reactions + catch-up summary for latecomers).

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

---

## Review system (`review-*` umbrella — global, all projects)

Read-only review agents live in `~/.claude/agents/` (cross-project), documented in the
project memory `review_agents_umbrella.md`:

- **review-logic** — per-change correctness. Run **every phase** on the diff before live
  verify (now **Part A** of the phase-end ritual: build → review-logic → apply fixes →
  unit-test new pure logic → typecheck/lint/build → live-verify).
- **review-code** — on-demand structural/architectural audit (severity scale
  Critical/High/Medium/Low + Strengths, with a prioritized remediation plan). Run at
  phase-*group* boundaries, before a refactor, before launch, or when inheriting/scaling
  code — **NOT** per sub-phase. **Approved 2026-06-27** with two tunings: (a) **cross-layer
  verification** — never rate a bypass/cross-layer claim High/Critical without reading
  *both* layers (else cap Medium + label unverified); (b) **propose, don't auto-create**
  follow-up task chips — it ends with a "Proposed follow-up tasks" list for you to approve.
- Plus the `/security-review` skill (deep security pass) and the `simplify` skill
  (simplify *changed* code).
- **Watch Party plan:** first `review-code` audit was a test-drive on
  `server/socket-server.ts` (findings in `DEFERRED.md`); next at the end of the Phase 5
  series and again as a pre-launch gate. Keep `review-logic` on every 5.x.

---

## Research agent — proposed (build next chat)

**Why:** Anthropic's built-in `WebSearch`/`WebFetch` crawler is blocked by some sites
(Reddit returns "not accessible to our user agent"), so practitioner research on those
sources is hard with the default tools.

**What I will NOT build:** a user-agent-spoofing / anti-bot-evasion scraper that "appears
as a normal web user." It's brittle (anti-bot measures change constantly → frequent
breakage), it risks violating site ToS (Reddit included), and it's an arms race not worth
maintaining.

**The legitimate path — Claude-in-Chrome:** drive the user's *real* Chrome (logged in as
them) via the `claude-in-chrome` MCP. That isn't spoofing — it *is* a real human's browser
session, so it can read what the user can read (Reddit threads, gated forums) and
navigate/extract legitimately. Requires the Chrome extension connected.

**Proposed design (a "research umbrella," parallel to review):**
- Default to `WebSearch`/`WebFetch` (fast, no browser) for open content; **escalate to
  Claude-in-Chrome only** for human-gated sources that block the crawler.
- Deliverable = a **cited, multi-source research brief**: synthesize across sources, cite
  each claim, separate consensus from outliers, flag low-confidence/unverified points.
- Scope it for the "more arduous / extensive research" the user wants, with the same
  **precision-over-volume** discipline as the review agents.
- Reddit-specific fallbacks if ever needed: a thread's public `.json` endpoint / old.reddit
  — but these are increasingly gated; Claude-in-Chrome is the robust path.
