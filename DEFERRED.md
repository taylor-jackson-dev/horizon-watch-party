# Watch Party — Deferred Work Checklist

Tracks known work intentionally pushed to later. Each item lists **what**, **why deferred**, and **when to revisit**.

---

## Security & Upgrades

- [ ] **Patch-bump `next@14.2.29`** — has a known security advisory ([Dec 2025 update](https://nextjs.org/blog/security-update-2025-12-11)).
  - **Defer until:** MVP is approved and proven viable.
  - **How to revisit:** `npm install next@latest-14 && npm run typecheck && npm run build && npm run dev` — verify nothing broke, then commit.

- [ ] **Rotate Supabase database password** — current dev password (`***REMOVED***`) was shared in chat history.
  - **Defer until:** Before sharing the repo with collaborators OR before going to production.
  - **How to revisit:** Supabase Dashboard → Project Settings → Database → "Reset database password". Then update `DATABASE_URL` and `DIRECT_URL` in `.env.local` and any deployment env vars.

---

## Code Audit Backlog — `server/socket-server.ts` (2026-06-27)

First `review-code` audit (the new on-demand structural-audit agent — see `journal/HANDOFF.md` → Review system). Scope was the Socket.io real-time engine **only**. Verdict on the raw audit: **0 Critical · 4 High · 6 Medium · 4 Low**; a trust-but-verify recheck downgraded two of the Highs (see below). These are **hardening / tech-debt on a working system — NOT blockers** for Phase 5.5/5.6. Batch them before a real load test or the pre-launch gate.

**Both fix chips have already produced changes — they are in the working tree NOW, uncommitted and not yet verified** (the chip sessions are open / "waiting" in their own chats for review). Confirm green (`npm run typecheck && npm run lint && npm run build && npm test`) and commit them from there (or here). They cover:
- [~] **Chip A — bound the unbounded maps** *(was High #2)* — in tree: `removePresence` now deletes `roomStates` + `roomHosts` when the last viewer leaves (new `roomIdFromChannel` helper), **plus** a periodic `setInterval(…).unref()` sweep that prunes aged-out rate-limit buckets. ⚠️ **Currently fails typecheck** — `server/socket-server.ts:67` iterates a Map with `for (const [k, v] of map)`, which this project's tsconfig target rejects (`TS2802`). One-line fix: switch to `map.forEach((timestamps, key) => …)` (deleting the current key inside `forEach` is safe) or `Array.from(map.entries())`. (Lint ✔ · 22 tests ✔ as of 2026-06-27.)
- [~] **Chip B — extract + unit-test the rate-limit helpers** — in tree: new pure `lib/rate-limit.ts` (`createRateLimiter` + `chatRateLimiter`/`reactionRateLimiter`, exported count/window constants, a `hits` bucket map) with `tests/rate-limit.test.ts`; `server/socket-server.ts` now calls `chatRateLimiter.check()` / `reactionRateLimiter.check()`.

**NOT covered by either chip — handle in the next chat (or as new chips):**
- [ ] **[High] Process-crash guard** *(the only uncovered High — highest-value item)* — `video:state` (~:314-360) and `queue:changed` (~:384-398) are `async` handlers with **no try/catch**; an unhandled rejection can crash the Node process, and there is **no** `process.on('uncaughtException' | 'unhandledRejection')` net (only a SIGINT/SIGTERM `shutdown`). Wrap both handlers like `chat:send`/`reaction:send` already are, **and** add global handlers that log + keep the process alive.
- [ ] **[Low, real] Socket `room:join` should require `status === ACTIVE`** — `room:join` (~:224-270) rejects non-members and BANNED members but does **not** require `status === ACTIVE`, so a member who `LEFT` can re-establish presence over the socket without re-clearing the REST `/api/rooms/join` capacity check. (Capacity itself is **not** bypassable — the REST route caps ACTIVE membership and the socket requires existing membership. This first *looked* like a High "capacity bypass"; reading **both** layers showed it's a narrow presence-state gap. That miss is exactly why review-code now carries a cross-layer-verification rule.)
- [ ] **[Medium] Stale `roomHosts` host cache** *(was High #3 → latent)* — `getRoomHost` caches the host forever; correct **today** because `hostId` is immutable, but it will serve stale data the moment host transfer/CO_HOST promotion ships. Add invalidation when that lands.
- [ ] **Remaining Medium/Low cluster** — the audit listed 6 Medium · 4 Low total; only the items above were captured in detail. **Re-run `review-code` on `server/socket-server.ts`** in the next chat to regenerate the full ranked list with `path:line` cites before acting.

**When to revisit:** batch the process-crash guard + the two chips before any multi-room load test or the pre-launch gate; the Medium/Low items can ride along.

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
