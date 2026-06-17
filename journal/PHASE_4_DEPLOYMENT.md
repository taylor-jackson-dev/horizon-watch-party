# Phase 4 — Deployment Journal

**Date:** 2026-06-17  
**Session:** Mid-deployment resume → first live smoke test  
**Status:** ✅ Deployed and functional

---

## What was accomplished

Completed the full production deployment of Watch Party across Railway (socket server) and Vercel (web app).

### Issues encountered and resolved

**1. Env var quotes in `.env.local`**  
All values in `.env.local` were double-quoted. The initial `pbcopy` approach included the quotes, causing every secret entered into Vercel to be wrong. Fixed by stripping quotes with `tr -d '"'` in all clipboard commands. All 12 secrets re-entered correctly.

**2. `NEXTAUTH_URL` wrong value (`example.com`)**  
The placeholder was never updated. Fixed to `https://water-party-private-repo.vercel.app`.

**3. `redirect_uri_mismatch` on Google sign-in**  
Root cause: `NEXTAUTH_URL` was wrong. After fixing, Google OAuth worked once the correct redirect URI (`https://water-party-private-repo.vercel.app/api/auth/callback/google`) was registered in Google Cloud Console.

**4. Stale NextAuth cookie causing AES cipher error**  
After fixing `NEXTAUTH_SECRET`, old encrypted cookies from failed auth attempts caused `DOMException [OperationError]: Cipher job failed`. Fixed by clearing site cookies / using private browsing.

**5. Supabase DATABASE_URL — direct connection blocked on Vercel**  
Vercel (serverless) cannot reach `db.*.supabase.co:5432` (direct connection). Switched DATABASE_URL to the **Session pooler** URL: `postgresql://postgres.PROJECTREF:PASSWORD@aws-1-us-east-1.pooler.supabase.com:5432/postgres`. Transaction pooler (port 6543 + `pgbouncer=true`) also failed — Session pooler was the fix.

**6. Railway socket server — `crypto is not defined`**  
`jose` (JWT verification) uses the Web Crypto API (`globalThis.crypto`) which wasn't available on Railway's default Node.js version. Fixed by:
- Adding polyfill at top of `server/socket-server.ts`: `import { webcrypto } from 'node:crypto'; if (!globalThis.crypto) globalThis.crypto = webcrypto`
- Adding `"engines": { "node": ">=18" }` to `package.json`
- Committed `c26bc31` and pushed — Railway auto-redeployed

**7. Railway DATABASE_URL — also needed Session pooler**  
Railway was also failing to connect once the direct connection was blocked. Updated Railway's DATABASE_URL to the same Session pooler URL format.

**8. YouTube IFrame API — black screen on first load**  
The player rendered an empty div on first page load. Workaround: page refresh initializes the player correctly. Root cause appears to be a timing/initialization race. Not fully diagnosed — flagged for Phase 4.4 investigation.

---

## Production URLs

| Service | URL |
|---|---|
| Web app (Vercel) | `https://water-party-private-repo.vercel.app` |
| Socket server (Railway) | `https://water-party-private-repo-production.up.railway.app` |

---

## Smoke test results

| Check | Result |
|---|---|
| Google sign-in | ✅ |
| Create room | ✅ |
| Join by code (cross-device) | ✅ |
| Video play / pause / seek | ✅ |
| Video queue (second video) | ✅ |
| Playback sync (host → viewer) | ✅ |
| Chat | ✅ |
| Reactions | ✅ |
| Voice — desktop | ⚠️ untested |
| Voice — mobile Safari | ❌ `NotAllowedError` mic permission |
| Live viewer count | ❌ requires page refresh |

---

## Known issues / backlog items

**Voice mic on mobile Safari**  
Error: `The request is not allowed by the user agent or the platform in the current context`  
iOS Safari requires a direct user gesture to grant mic + permission must not be previously denied. Needs proper permission request flow + user-facing error message instead of raw error. Target: Phase 4.4.

**Live viewer count**  
Member count only updates on page refresh; refreshing restarts the video. Already tracked in PLAN.md Phase 4.4 candidates: *"Presence-based active count — replace SSR count with socket-driven presence."*

**YouTube player black screen on first load**  
Requires page refresh to initialize. Timing/race condition in IFrame API initialization. Investigate in Phase 4.4.

---

## Next phase: 4.4 — Avatars + Profile Customization

Candidates to review and approve/cut at phase start (see PLAN.md § Phase 4.4 Candidates).  
Priority additions from deployment findings:
- Fix live viewer count (socket-driven presence)
- Fix YouTube player first-load initialization
- Fix mobile Safari voice mic permission flow
