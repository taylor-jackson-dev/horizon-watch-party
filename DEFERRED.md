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
