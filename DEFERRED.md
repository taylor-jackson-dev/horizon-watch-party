# Watch Party — Deferred Work Checklist

Tracks known work intentionally pushed to later. Each item lists **what**, **why deferred**, and **when to revisit**.

---

## Security & Upgrades

- [ ] **Patch-bump `next@14.2.29`** — has a known security advisory ([Dec 2025 update](https://nextjs.org/blog/security-update-2025-12-11)).
  - **Defer until:** MVP is approved and proven viable.
  - **How to revisit:** `npm install next@latest-14 && npm run typecheck && npm run build && npm run dev` — verify nothing broke, then commit.

- [x] ~~**Rotate Supabase database password**~~ — ✅ **ROTATED 2026-07-16.** The old
  value was reset in Supabase, and git history was scrubbed of the previously-committed
  plaintext (surgical `filter-repo` replace + force-push, 2026-07-16). Remaining
  propagation: update `DATABASE_URL` + `DIRECT_URL` in `.env.local`, **Vercel**, and
  **Railway** with the new value (Session pooler URL), and redeploy both.

---

## Code Audit Backlog — whole-repo audit (2026-07-10)

Full-repo `review-code` audit (report: `journal/AUDIT_2026_07.md`). Verdict: **0 Critical · 1 High · 9 Medium · 10 Low**. The High and the clearly-justified security fixes were **applied and pushed** the same session: database-credential rotation + history scrub, an open-redirect fix on the sign-in route, a socket-server hardening batch (membership-state gating, room-scoped writes, bounded real-time payloads), a consistent "left-the-room" re-join flow across every layer, and CI now running the test suite + a production build on every push.

> **The remaining open items are genericized here by category.** The precise
> file/line locations and reproduction details are tracked in a local, un-committed
> working file (`SECURITY_NOTES.local.md`, gitignored) so this public checklist
> isn't a step-by-step map against the live instance. None are Critical/High — they
> are hardening and tech-debt on a working system.

**Medium — pre-monetization gates (address before payment code ships):**
- [ ] **Subscription-tier freshness** — the session tier is set at sign-in; wire it to
  refresh from the source of truth before billing can change it.
- [ ] **Room lifecycle + moderation** — "close room," kick/ban, and per-member
  restrictions exist in the schema but have no write paths yet; without close-room,
  rooms and memberships accumulate. Fits the Phase 8 moderation slot.
- [ ] **Refactor the room playback-sync engine out of the large room component** into
  a standalone, unit-testable hook before the next room feature.
- [ ] **Error tracking + a staging checkpoint** — prerequisite for debugging
  production and for touching billing code (needs a vendor choice).
- [ ] **Host-cache invalidation** — a per-room host lookup is cached for the process
  lifetime; correct while host identity is immutable, revisit before host-transfer.

**Low — batch when convenient (hardening / cleanup):**
- [ ] Refine middleware route matching (PWA assets + JSON 401s for API routes).
- [ ] Remove the unused credentials auth path until email/password sign-in is built.
- [ ] Return generic error bodies from the voice-token route.
- [ ] Redact soft-deleted message content server-side before any delete UI ships.
- [ ] Harden the join capacity check under concurrency.
- [ ] Implement (or drop) the promised message/reaction retention window.
- [ ] Extend rate limiting to the remaining DB-touching socket events.
- [ ] Gate premium-only room themes on tier.
- [ ] Populate the display name on the session object consistently.
- [ ] Drop unused dependencies + annotate reserved (future-phase) env vars.
- [ ] Minor presence/roster refresh + validation polish.

---

## Code Audit Backlog — `server/socket-server.ts` (2026-06-27) — SUPERSEDED

The first `review-code` audit scoped the Socket.io engine only (verdict: 0 Critical ·
4 High · 6 Medium · 4 Low, two Highs downgraded on recheck). Its High items and both
fix chips (rate-limit extraction + unit tests, bounded in-memory maps, process-crash
guards) all landed. Its remaining findings were **re-ranked and folded into the
2026-07-10 whole-repo audit above** (and the membership-state gate it flagged was
fixed 2026-07-16). This section is retained only as a pointer; the live backlog is
the section above.

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
