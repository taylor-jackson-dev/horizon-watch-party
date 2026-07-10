# Watch Party — Deferred Work Checklist

Tracks known work intentionally pushed to later. Each item lists **what**, **why deferred**, and **when to revisit**.

---

## Security & Upgrades

- [ ] **Patch-bump `next@14.2.29`** — has a known security advisory ([Dec 2025 update](https://nextjs.org/blog/security-update-2025-12-11)).
  - **Defer until:** MVP is approved and proven viable.
  - **How to revisit:** `npm install next@latest-14 && npm run typecheck && npm run build && npm run dev` — verify nothing broke, then commit.

- [ ] **Rotate Supabase database password — ⚠️ UPGRADED TO HIGH (2026-07-10 audit), USER ACTION REQUIRED.** The password was shared in chat history AND was committed to this file in plaintext (scrubbed 2026-07-10, but it persists in git history) — and this is the *production* database now, not a dev instance. Rotation makes the leaked value worthless; until then anyone with repo access has direct Postgres access.
  - **How:** Supabase Dashboard → Project Settings → Database → "Reset database password". Then update `DATABASE_URL` + `DIRECT_URL` in `.env.local`, **Vercel**, and **Railway** env vars (both use the Session pooler URL), and redeploy both.

---

## Code Audit Backlog — whole-repo audit (2026-07-10)

Full-repo `review-code` audit (report: `journal/AUDIT_2026_07.md`). Verdict: **0 Critical · 1 High · 9 Medium · 10 Low**. Applied same-session: the High scrub (password line above — rotation itself is user-gated), the `/signin` open-redirect fix, the socket hardening batch (ACTIVE gate on `room:join`, room-scoped `markItemPlayed`, bounded `video:state` payload), the LEFT-member rejoin flow (room page + capacity-on-rejoin), and CI now running tests + build. Deferred below, one line of rationale each:

**Medium — pre-Phase-6 gates (do before Stripe ships):**
- [ ] **JWT `tier` is frozen at sign-in** (`lib/auth.ts` jwt callback) — Stripe upgrades would never take effect until re-login. Needs a refresh-on-stale design (e.g. `tierCheckedAt` in the token). *Deferred: design decision, zero impact until Phase 6 can set PREMIUM.*
- [ ] **Room lifecycle/moderation enums have no write paths** — nothing sets `closedAt`/`ENDED`/`KICKED`/`BANNED`/`isChatRestricted`; leave route tells hosts to "close the room" which doesn't exist; rooms/memberships accumulate forever. *Deferred: product-shape decision (close-room + minimal moderation), fits the Phase 8 moderation slot — pull forward if room clutter bites sooner.* When this lands, also add **socket force-disconnect on leave/kick** (a socket joined before a REST leave stays in the channel receiving broadcasts until it disconnects; sends are already blocked, and reconnects now get rejected by the ACTIVE gate — review-logic note, 2026-07-10).
- [ ] **Extract `usePlaybackSync` from RoomShell.tsx** (976 lines, sync engine + layout in one file) — do before the next room feature (front-row mode) lands. *Deferred: M-effort refactor, no behavior change, wrong to rush in a fix batch.*
- [ ] **Error tracking (Sentry or similar) on web + socket, and a staging checkpoint** — prerequisite for debugging prod (issue #5 is undiagnosable today) and for touching billing code. *Deferred: needs an account/vendor choice from the user.*
- [ ] **Stale `roomHosts` host cache** *(carried from 2026-06-27)* — correct while `hostId` is immutable; add invalidation when host-transfer/CO_HOST ships.

**Low — batch when convenient:**
- [ ] **Middleware matcher over-matches** — `/sw.js`, `/manifest.webmanifest`, `/offline.html`, icons all 302→/signin for signed-out visitors (PWA registration fails pre-auth); non-auth `/api/*` gets 302 HTML instead of 401. Also: split `auth.config.ts` (adapter-free) for middleware per NextAuth guidance. *Deferred: needs a small matcher redesign + retest of the auth gate.*
- [ ] **Delete the dead credentials provider** (`lib/auth.ts`) — `/signup` is a stub, no credentials Account can exist, so it's pure attack surface (unrate-limited DB lookup per attempt, timing oracle). When email/password actually ships: dedicated `passwordHash` column, dummy compare, rate limit. *Deferred: auth file is frozen this session (Known issue #5 under diagnosis — don't touch auth on a guess).*
- [ ] **LiveKit token route leaks internal error messages** (500 body includes `err.message`). Log detail, return generic body.
- [ ] **Soft-deleted message content still shipped to clients** (messages route sends full `content` with `deletedAt`; client renders "[deleted]"). Redact server-side before any delete UI ships.
- [ ] **Join capacity TOCTOU race** — two concurrent joins can both pass the count check. Transaction/conditional update when capacity matters commercially.
- [ ] **48h message retention promised but unimplemented** — `Message`/`Reaction` grow unbounded; add a purge cron or drop the claim.
- [ ] **No rate limit on DB-touching socket events** (`room:join`, `video:state`, `queue:changed`) — reuse `createRateLimiter` with a generous window.
- [ ] **Premium theme gate missing** — FREE users can set premium-marked themes (cosmetic until themes render differently; monetization leak in Phase 6).
- [ ] **`session.user.name` never populated** — room page falls back to email in the top bar while dashboard shows the real name; renames don't reflect in session.
- [ ] **Unused deps + dead env surface** — `@supabase/ssr`/`@supabase/supabase-js` imported nowhere; `SUPABASE_*`/`YOUTUBE_API_KEY`/`STRIPE_*` env slots documented but unread. Drop the packages, annotate the env entries.
- [ ] **Presence `displayName` refreshes only on join** — mid-session rename not reflected until rejoin (cosmetic).
- [ ] **`video:state` `itemId` not validated against the room's queue** — a host can broadcast an arbitrary ≤64-char id to their own room (viewers show "No video selected"); cross-tenant write is already blocked by the roomId-scoped `markItemPlayed`. Cosmetic self-sabotage only (review-logic, 2026-07-10).
- [ ] **Room-details GET (`/api/rooms/[id]`) still serves LEFT members** — deliberate since Phase 2 ("history"), but now inconsistent with the ACTIVE-only invariant; revisit when the dashboard history view gets its pass.

---

## Code Audit Backlog — `server/socket-server.ts` (2026-06-27) — SUPERSEDED by the 2026-07-10 whole-repo audit above

First `review-code` audit (the new on-demand structural-audit agent — see `journal/HANDOFF.md` → Review system). Scope was the Socket.io real-time engine **only**. Verdict on the raw audit: **0 Critical · 4 High · 6 Medium · 4 Low**; a trust-but-verify recheck downgraded two of the Highs (see below). These are **hardening / tech-debt on a working system — NOT blockers** for Phase 5.5/5.6. Batch them before a real load test or the pre-launch gate.

**Both fix chips are committed** (2026-06-27 — green: typecheck · lint · build · 22 tests). The blocking `TS2802` Map-iteration error was fixed (`for…of` → `map.forEach`, safe key-delete inside the callback). Committed locally on `main`; **not yet pushed** (a push redeploys the Railway socket server — hold for a batched hardening deploy):
- [x] **Chip B — extract + unit-test the rate-limit helpers** (`adccc12`) — new pure `lib/rate-limit.ts` (`createRateLimiter` + `chatRateLimiter`/`reactionRateLimiter`, exported count/window constants, a `hits` bucket map) with `tests/rate-limit.test.ts`; `server/socket-server.ts` now calls `chatRateLimiter.check()` / `reactionRateLimiter.check()`.
- [x] **Chip A — bound the unbounded maps** *(was High #2)* (`1316769`) — `removePresence` now deletes `roomStates` + `roomHosts` when the last viewer leaves (new `roomIdFromChannel` helper), **plus** a periodic `setInterval(…).unref()` sweep that prunes aged-out rate-limit buckets.

**Process-crash guard — DONE; the items below it are still open:**
- [x] **[High] Process-crash guard** (`7eba2fc`, 2026-06-27 — green: typecheck · lint · build · 22 tests) — wrapped the `async` handlers' DB/await bodies in try/catch (`video:state`, `queue:changed`, **and** `room:leave` — the last unguarded one, surfaced by a `review-logic` pass), matching `chat:send`/`reaction:send`. Added global `process.on('uncaughtException' | 'unhandledRejection')` nets that log and keep the process alive (the relay is stateless — Postgres is source of truth, in-memory caches self-heal on reconnect; Railway restarts if the process does exit). **Local only — not yet pushed.**
- [ ] **[Low, real] Socket `room:join` should require `status === ACTIVE`** — `room:join` (~:224-270) rejects non-members and BANNED members but does **not** require `status === ACTIVE`, so a member who `LEFT` can re-establish presence over the socket without re-clearing the REST `/api/rooms/join` capacity check. (Capacity itself is **not** bypassable — the REST route caps ACTIVE membership and the socket requires existing membership. This first *looked* like a High "capacity bypass"; reading **both** layers showed it's a narrow presence-state gap. That miss is exactly why review-code now carries a cross-layer-verification rule.)
- [ ] **[Medium] Stale `roomHosts` host cache** *(was High #3 → latent)* — `getRoomHost` caches the host forever; correct **today** because `hostId` is immutable, but it will serve stale data the moment host transfer/CO_HOST promotion ships. Add invalidation when that lands.
- [ ] **Remaining Medium/Low cluster** — the audit listed 6 Medium · 4 Low total; only the items above were captured in detail. **Re-run `review-code` on `server/socket-server.ts`** in the next chat to regenerate the full ranked list with `path:line` cites before acting.

**When to revisit:** all three Highs / both chips above are done (committed locally, **unpushed** — a push redeploys Railway; batch the deploy deliberately). Still open: the `room:join` ACTIVE gap (Low), the latent `roomHosts` staleness (Medium, gated on host-transfer shipping), and the uncaptured Medium/Low cluster — **re-run `review-code`** to regenerate the full ranked list before a multi-room load test or the pre-launch gate.

---

## Credentials Still to Grab

- [ ] **Supabase Transaction pooler URL** → goes into `DATABASE_URL`.
  - **Defer until:** Before deploying to Vercel (or any serverless host).
  - **Where to find it:** Supabase Dashboard → top of project page → **Connect** button → **Transaction pooler** tab (port `6543`, ends with `?pgbouncer=true`).
  - **Why it matters:** Serverless cold starts open new DB connections constantly. Direct connections exhaust Postgres limits; the pooler reuses them. Local dev doesn't need it.

- [ ] **Supabase service role key (`sb_secret_...`)** → goes into `SUPABASE_SERVICE_ROLE_KEY`.
  - **Defer until:** Phase 4 (avatar uploads + Supabase Storage integration).
  - **Where to find it:** Supabase Dashboard → Project Settings → API → API Keys → look for **Secret key** (or click "Reveal" on `service_role`).

---

## DevOps

- [x] ~~**Push to GitHub remote**~~ — done 2026-05-27. Pushed to `https://github.com/g6gzyfh5b5-creator/Water-Party-Private-Repo`. Credentials stored in macOS Keychain.
- [x] ~~**Verify GitHub Actions CI runs on push**~~ — confirmed green on commit `744045a` (initial Phase 3.1 push).

---

## Phase-Gated Credentials (don't need yet, listed for awareness)

These slots in `.env.local` are still placeholders. They become required as their phases land:

| Variable | Required for | Where to get it |
|---|---|---|
| `LIVEKIT_URL` / `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` | Phase 4 — voice chat | [livekit.io](https://livekit.io) — Cloud project → Keys |
| `STRIPE_PUBLISHABLE_KEY` / `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `STRIPE_PREMIUM_PRICE_ID` | Phase 6 — payments | [dashboard.stripe.com](https://dashboard.stripe.com) |
| `YOUTUBE_API_KEY` | Phase 3 — video metadata fetch | Google Cloud Console → APIs & Services → enable YouTube Data API v3 → Credentials → API key |
| `NEXT_PUBLIC_SOCKET_URL` | Phase 3 — Socket.io sync server | Set when the custom Socket server is split out (defaults to `http://localhost:3001` in dev) |
