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

1. **Product (the roadmap):** Phase 5.5 two-device live verify → then Phase 5.6 (delight). This is what the resume phrase above is about. **← still the main open item.**
2. ✅ **Research agent — BUILT + dogfood-tested + tuned** (2026-06-27). `~/.claude/agents/researcher.md`, under a "research umbrella" parallel to the review umbrella. Smoke-tested via a stand-in (user-authorized), which surfaced 3 refinements — now applied. Full record in `## Research agent — BUILT` near the bottom. First *native* spawn happens after this `/clear`.
3. ✅ **Socket-server hardening — DONE locally.** Both fix chips + the process-crash guard are committed on `main` and green (typecheck · lint · build · 22 tests): `adccc12` (rate-limit extraction + tests), `1316769` (map-bounding sweep), `7eba2fc` (crash guards + global nets). **Committed but NOT pushed** — a push redeploys the Railway socket server, so the deploy is held for a deliberate batch (these are hardening, not a verify gate). Remaining open items (room:join ACTIVE gap, latent roomHosts staleness, uncaptured Medium/Low cluster) are in `DEFERRED.md → Code Audit Backlog`.

**Review-system note:** the `review-*` umbrella is complete and `review-code` is approved + tuned (see `## Review system` below). Custom agents only register at startup, so **after this `/clear`, both `review-code` AND the new `researcher` become natively spawnable** as subagents (this session ran review through a general-purpose stand-in; `researcher` has not been spawned at all yet).

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

## Research agent — BUILT (2026-06-27)

**Status:** Shipped + dogfood-tested + tuned. File: `~/.claude/agents/researcher.md` (global,
alongside `review-logic`/`review-code`). Validated — well-formed frontmatter, canonical tool
names, registers exactly like the review agents. **Smoke-tested 2026-06-27** via a
`general-purpose` stand-in (told to read `researcher.md` and operate as it — a native spawn
can't register mid-session): it produced a clean cited brief on YouTube IFrame sync, and the
anti-hallucination **Verify gate demonstrably fired** (it labeled an NTP formula it couldn't
source `(unverified)` rather than fabricate it). The test surfaced **3 refinements, now
applied** (see *Tuning* below). First *native* spawn happens after this `/clear`.

**What it is:** a senior-analyst agent that produces accurate, **citation-backed** briefs.
North star (mirrors the review umbrella's "precision over volume"): **accuracy and
verifiable sourcing over volume** — cite only sources actually opened, cross-check
load-bearing claims across ≥2 independent sources, keep "sources say" distinct from "my
read," and state plainly what couldn't be established. Hallucination is the failure mode it
is built to prevent.

**Architecture — orchestrator + on-demand subagents (user-approved):**
- Runs **solo by default** (most jobs). **Fans out** only for genuinely broad jobs that
  split into *independent* sub-questions — one scoped sub-researcher per sub-question via the
  `Agent` tool, in **leaf mode** ("do not fan out further"), **one level** deep.
- Why so disciplined: fan-out costs ~7× tokens, and Claude Code's nested-subagent support
  (live since **v2.1.172**, 2026-06-10; hard-capped at 5 levels) carries a known
  recursion/efficiency footgun (gh issue #68619). Real-world comparisons find multi-agent
  often buys only a few quality points for several× the cost. So: budget effort to stakes.
- `tools: Read, Write, Grep, Glob, Bash, WebSearch, WebFetch, Agent, TodoWrite` ·
  `model: inherit`. Read-mostly: never edits source code; `Write` only saves briefs;
  `Bash`/`gh` read-only.

**Workflow (improves the user's Scraper→contextualize→present→review sketch):**
Scope → Gather → **Verify (anti-hallucination gate)** → Sufficiency check → Contextualize →
Present — run as a loop, not a line. The three real adds vs the sketch: an explicit **Scope**
step (budget to complexity, `TodoWrite` decomposition up front), a **Verify/citation gate**
before synthesis, and a folded-in self-critique pass. "Scraper" became "tiered Gather" —
we deliberately do not scrape or spoof.

**Source strategy (tiered, legitimate):**
- **Default — open web:** `WebSearch` + `WebFetch` (docs, papers, engineering blogs, open
  forums like Hacker News). Covers most needs.
- **Gated sources (e.g. Reddit) — search-snippet route:** put the site name *in the query*
  (`reddit <topic> experience`) WITHOUT an `allowed_domains: ["reddit.com"]` filter — that
  filter 400s because Reddit blocks our crawler UA. Read the **indexed snippets**:
  practitioner sentiment without crawling the site or touching any logged-in session.
  Triangulate across several angled queries since snippets are shallow.
- **Claude-in-Chrome — opt-in last resort only.** *Decision reversed from the original
  proposal.* The user judged driving their real logged-in browser too risky for
  routine public research (session/cookie exposure + every page read becomes a
  prompt-injection surface). It is now last-resort, explicit-opt-in only, for sources that
  *genuinely* require it — NOT the default escalation. We will NOT build a UA-spoofing
  scraper either (brittle, ToS risk, arms race).

**Growth path (start simple; promote only when proven):** documented in the agent file and
here — a dedicated `research-worker` (an `Agent`-less leaf; the safe fix if fan-out
recursion ever misbehaves), a `citation-verifier` (Anthropic's multi-agent research system
runs citations as a separate pass), or domain specialists. Don't build these until real
usage shows the need.

**Tuning — 3 refinements from the dogfood test (applied 2026-06-27):**
1. **Snippet citations now have a home in the citation gate.** Added a `[WebSearch: "<query>"]`
   citation convention (Output/Sources + the citation rule) so a claim drawn from search
   snippets — the gated-source route — is cited honestly as an aggregated-snippet source
   instead of being dressed up as (or tempting a fabricated) single-page URL.
2. **"Independent sources" now explicitly discounts self-promotion.** The cross-check rule
   spells out that a vendor's own docs/blog/press-release (or several pages tracing to one
   origin) count as a *single* self-interested source — corroborate against a neutral party
   before a claim counts as established.
3. **Paywalls / 402 are an expected outcome, not an error to fight.** New source-strategy
   bullet: route around a 402/login-wall (abstract from search, open-access mirror/preprint,
   or cite `(paywalled — abstract only)` + lower confidence) — and it's *distinct* from
   Reddit's UA block, which has the snippet workaround; a paywall does not. Never fabricate
   the body of a source you couldn't open.
