# Watch Party — Handoff Brief

Bootstrap doc for resuming the build in a fresh chat. Full detail lives in
`journal/PHASE_4_DEPLOYMENT.md` and `PLAN.md`; this is the quick-start.

---

## Resume prompt (paste this first to start the next session)

> **Resume Watch Party. The FULL-PROJECT AUDIT is DONE (2026-07-10) — read
> `journal/AUDIT_2026_07.md` first (assessment, timeline, Phase 6/7 recommendation),
> then `DEFERRED.md` → "Code Audit Backlog — whole-repo audit (2026-07-10)". App is
> live: web `https://water-party-private-repo.vercel.app` (Vercel) · socket
> `https://water-party-private-repo-production.up.railway.app` (Railway); pushing
> `main` redeploys BOTH (pre-authorized for green work). Phases 1–5.5 complete +
> verified live; the audit fix pass is committed + pushed (42 tests · typecheck ·
> lint · build green; CI now runs tests + build). Still open, user-gated: **(a)
> rotate the Supabase DB password (HIGH — overdue; Supabase dashboard → reset, then
> update `.env.local` + Vercel + Railway env and redeploy); (b) Phase 5.6 two-device
> live verify** (checklist in `journal/PHASE_5_6_DELIGHT.md`; green closes Phase 5;
> note the audit changed no 5.6 behavior); **(c) `VERCEL_TOKEN` for Known issue #5**
> (mobile Google first-attempt sign-in — diagnose from runtime logs while
> reproducing; capture the `?error=` code; do NOT edit auth before root cause; then
> build the `deploy-triage` skill). After those: the **Phase 6 strategy decision** —
> the audit recommends dropping ads (YouTube-ToS collision + category evidence),
> a compliance pass on the reaction/chat overlays, one retention feature pulled from
> Phase 9, moderation minimum + close-room, then small Stripe premium — decide with
> the user before writing Phase 6 code, then the pre-Phase-6 gates in `DEFERRED.md`
> (JWT tier refresh, error tracking, `usePlaybackSync` extraction). Deferred
> (unchanged, do not work on): voice settings page + voice-quality work, avatar
> upload, full sync watchdog, live polls, premium theme skins, and the 4th
> "front-row" cinema view mode (gated on avatars).**

---

## Next-session agenda (refreshed 2026-07-10, post-audit)

1. ✅ ~~**Full-project audit + fresh-eyes assessment**~~ — DONE 2026-07-10. Report:
   `journal/AUDIT_2026_07.md`. Fix pass applied + pushed (open redirect via new
   `lib/callback-url.ts`, LEFT-member ACTIVE gates across page/REST/socket/queue,
   socket payload bounds, room-scoped `markItemPlayed`, CI tests+build). Deferrals
   in `DEFERRED.md`. `researcher` had its first native spawn (market brief — clean).
2. ⚠️ **Rotate the Supabase DB password — HIGH, user action, overdue.** The value was
   committed to `DEFERRED.md` (scrubbed, but it's in git history) and this is the
   production DB. Supabase dashboard → reset → update `.env.local` + Vercel + Railway.
3. 🔄 **Phase 5.6 live verify — PENDING, user-gated.** Checklist in
   `journal/PHASE_5_6_DELIGHT.md`. Green closes Phase 5. The audit fix pass changed
   no 5.6 behavior (spotlight/catch-up untouched).
4. 🐛 **Known issue #5** — mobile Google first-attempt sign-in error. Confirmed
   blocked on data: no `VERCEL_TOKEN` in `.env.local`, repo not Vercel-linked, error
   code unrecorded. Diagnose before fixing (hypotheses under Known issues). If it
   recurs before logs exist: **note the red box's error code** — that alone
   disambiguates. Then `deploy-triage` skill (dogfood the manual pass first).
5. 🎯 **Phase 6 strategy decision (user + Claude)** — audit recommends reshaping:
   drop ads, ToS-compliance pass on overlays, one retention feature from Phase 9,
   moderation minimum + close-room, small Stripe premium. Report §3.2 + §6.
6. 🔌 **GitHub connector re-auth** — user-side, whenever convenient (harness
   integration only; local git/`gh` healthy).

**Agent note:** `review-logic`, `review-code`, and `researcher` are all natively
spawnable (review-logic ran natively in the 5.6 session; `researcher` still awaits its
first native spawn — the audit's market-context step is a natural first use).

---

## Full-project audit — spec ✅ EXECUTED 2026-07-10 (kept for reference; deliverables: `journal/AUDIT_2026_07.md` + fix-pass commit + `DEFERRED.md` backlog)

**The ask (user, verbatim intent):** re-read the *entire* project — codebase, plan,
journals, production — fix anything genuinely necessary, then, with fresh eyes, give an
honest, objectively critical assessment of the total project: its real weaknesses, a
solid outlook with an estimated timeline, and future projections for the app's
potential. The review umbrella already slated a `review-code` audit at this
phase-group boundary; this **widens** it (code audit → total-project assessment) and
**pulls it forward** — do not wait on the 5.6 live verify.

**1 · Re-acquaint (read first; touch nothing):**
- `PLAN.md` end-to-end · every `journal/*.md` (PHASE_5_6 last — it holds the pending
  checklist) · `DEFERRED.md` incl. the Code Audit Backlog.
- The full source tree: `app/` (pages + API routes) · `components/` (room/ + ui/) ·
  `lib/` · `server/socket-server.ts` · `prisma/schema.prisma` · `middleware.ts` ·
  `tests/` · configs (`package.json` scripts, `next.config`, tailwind).
- Production reality: hit the web URL + socket alive-check
  (`/socket.io/?EIO=4&transport=polling` → 200 + `0{...}`); note any drift from docs.
- Velocity data: `git log --format='%ad %s' --date=short` — real dates for the
  timeline estimate.

**2 · Audit (read-only):**
- Spawn **`review-code`** with an EXPLICIT whole-repo scope (unscoped, it stops and
  proposes one — name it: "the entire repository"). Direct it to explicitly cover the
  security surfaces — NextAuth config (incl. the credentials-provider
  hashed-password-in-`access_token` design), socket-server auth/rate-limits/room
  authority, API-route authorization, secrets/env handling — and hand it the known
  backlog (room:join ACTIVE gap, latent roomHosts staleness, socket Medium/Low
  cluster) for re-ranking in whole-repo context.
- Expect its contract: severity-ranked findings (Critical/High/Medium/Low +
  Strengths) + a prioritized remediation plan + proposed follow-up tasks for approval.

**3 · Fix pass (judgment, not blanket):**
- Apply the **clearly-justified Critical/High** remediations. Ritual Part A per
  batch: build → `review-logic` on the diff → apply → unit-test new pure logic →
  typecheck/lint/build → push. Defer Medium/Low to `DEFERRED.md` with a one-line
  rationale each. Don't rabbit-hole; the assessment is the deliverable.
- **Known issue #5** folds in here IF root cause gets confirmed (error code and/or
  Vercel logs). Sign-in works on retry — do not degrade it on a guess.

**4 · Fresh-eyes assessment — the headline deliverable.** A standalone written report
(suggested home: `journal/AUDIT_2026_07.md`) + a tight verbal summary in chat. The
user explicitly asked for honest and objectively critical: no cheerleading, strengths
only where earned, weaknesses named plainly. Cover at minimum:
- **Technical:** architecture + coupling; sync-engine correctness and limits
  (single-host authority, drift handling, reconnect story); security posture; test
  depth vs. surface (run the suite — unit tests cover pure logic only; no
  integration/E2E, no CI gate); operational maturity (deploy-on-push to prod, no
  staging, no monitoring/error-tracking/analytics).
- **Product:** onboarding + invite loop friction (incl. issue #5's first-impression
  cost), mobile experience, retention hooks, feature completeness vs. the Phase 6
  premium sketch, friend-test feedback themes from the journals.
- **Viability:** scalability ceilings (single Railway socket node, Supabase session
  pooler, LiveKit free tier, YouTube quota + embed-ToS constraints); competitive
  context (Teleparty, Discord watch-together, the Kast/Rabbit graveyard) — optionally
  ground this with a tightly-scoped **`researcher`** brief.
- **Outlook:** estimated timeline — from git-history velocity — to (a)
  friends-and-family beta and (b) public-launch-ready, *including* the non-feature
  work (monitoring, CI, abuse/moderation, ToS/privacy pages); then realistic
  projections for the app's potential — best case, likely case, and the kill-risks.
- **Format:** rank everything; separate "fix before more features" from "fine for
  now"; end with a recommended Phase 6/7 shape.

**5 · Close out:** the ritual, as always — journal the audit session, update
`PLAN.md` + this handoff (fresh resume block), commit, push, prompt `/clear`.

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
- ✅ **Phase 5.5 — invite link** complete + **verified live** (2026-06-29, two
  devices/two accounts) — invite link = the room URL (`/room/<code>`); copy/native-share
  button in the room header + on each dashboard card; **public** links auto-join
  (client-side join-on-mount, prefetch-safe), **private** links prompt for the password;
  reuses `/api/rooms/join` (no new route, no migration). Every checklist item green
  except **at-capacity**, which couldn't be filled with two accounts and is covered by
  inspection (existing join-route check + a shared error-render branch). See
  `journal/PHASE_5_5_INVITE_LINK.md`.
- 🔄 **Phase 5.6 — delight** (built + static-green + deployed, **awaiting two-device
  live verify** · 2026-06-29) — spotlight reactions (≥3 same emoji in ~2s → a big centered
  overlay via a pure unit-tested detector with a per-emoji cooldown) + a catch-up modal
  for latecomers (one-time, popped from the join-ack `initialState`, gated on the initial
  join when a video's already > 1 min in — never on reconnect, never for the host). Both
  client-only, no migration. review-logic clean · 33 tests · typecheck/lint/build green.
  See `journal/PHASE_5_6_DELIGHT.md`. **This is the last 5.x — clearing its live verify
  closes Phase 5.** Verify attempted 2026-07-10 but cut short by Known issue #5 (mobile
  sign-in); no checklist item confirmed yet. The phase-group audit is no longer gated on
  it — the full-project audit (see spec above) runs next session regardless.

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
5. 🐛 **Mobile Google sign-in — first attempt fails after 2-step auth** (observed
   2026-07-10 on the phone, against prod). Symptom: completing Google 2FA bounced back
   to `/signin` with the red "Sign-in failed: <code>" box (NextAuth error redirect —
   `pages.error: "/signin"`); tapping **Continue with Google** again succeeded
   instantly → lobby. **Not a 5.6 regression** — auth (`lib/auth.ts`, standard
   NextAuth v5 + PrismaAdapter + JWT strategy) untouched since setup. Leading
   hypotheses: **(A)** OAuth state/PKCE cookie dropped across the long mobile 2FA
   redirect chain → `error=OAuthCallback` (classic Auth.js-on-mobile-Safari class;
   retry works because Google is already authed — one short hop, cookie survives);
   **(B)** first-login DB write (`createUser`/`linkAccount` via the Supabase Session
   pooler) hiccuped on a cold connection → `error=Callback` (retry hits a warm path;
   would mostly bite first-ever sign-ins). **Disambiguator = the exact error code**
   (the `?error=` param / the box text / Vercel runtime logs). **Diagnosis path:**
   user creates a `VERCEL_TOKEN` (Vercel → Account Settings → Tokens), drops it in
   `.env.local` (gitignored — never commit or paste in chat); then `npx vercel link`
   + `npx vercel logs` — runtime logs are short-lived, so tail while reproducing on
   the phone (sign out → Continue with Google). **Do NOT edit auth config before the
   root cause is confirmed** — sign-in works on retry; don't degrade it. Afterward,
   codify the flow as the `deploy-triage` skill (agenda item 4).

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
- **Watch Party plan:** first `review-code` audit test-drove `server/socket-server.ts`
  (2026-06-27); the **whole-repo audit ran 2026-07-10** (`journal/AUDIT_2026_07.md`) —
  next `review-code` at the pre-launch gate. A dedicated `/security-review` pass is
  queued for when Phase 6 ships Stripe webhooks. Keep `review-logic` on every phase.

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
