# Watch Party — Handoff Brief

Bootstrap doc for resuming the build in a fresh chat. Full detail lives in
`journal/PHASE_4_CHAT.md` and `PLAN.md`; this is the quick-start.

---

## Resume phrase (paste this first in a new chat)

> **Resume Watch Party. We are mid-deployment. Railway socket server is LIVE.
> Vercel is next — but first, the user needs help finding and copying secrets
> from `.env.local` on their Mac without exposing them in chat.
> Read `journal/HANDOFF.md` and `PLAN.md` → Deployment section for context,
> then walk them through accessing `.env.local` values safely, then continue
> the Vercel setup.**

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
- ✅ Deployment prep committed (`fdd5e48`, `e0710c1`)
- ✅ **Railway socket server: LIVE**
  - URL: `https://water-party-private-repo-production.up.railway.app`
  - Health check: `/health` → `{"status":"ok","uptime":…}` confirmed
  - Env vars set: `DATABASE_URL`, `DIRECT_URL`, `NEXTAUTH_SECRET`
- 🔄 **Vercel: IN PROGRESS** — user was entering the 15 env vars when session paused

---

## Remaining deployment steps (pick up here)

### Immediate user need
The user had trouble accessing secrets from `.env.local` on their Mac. Address
this first in the new chat:
- `.env.local` is a hidden file (dot-prefix) — visible in VS Code file tree by default
- For copying values safely to external services: use the Bash tool to run
  `| pbcopy` — copies to clipboard without printing in chat. Example already
  demonstrated this session for `NEXTAUTH_SECRET`.
- The user should NEVER paste secret values into chat — always copy direct to
  the target UI.

### Vercel setup (resume here)
The 15 env vars to enter in Vercel (Production only):

| Key | Source |
|---|---|
| `DATABASE_URL` | `.env.local` |
| `DIRECT_URL` | `.env.local` |
| `NEXTAUTH_SECRET` | `.env.local` (same value as Railway) |
| `NEXTAUTH_URL` | `https://watch-party.vercel.app` ← placeholder, update after deploy |
| `NEXT_PUBLIC_APP_URL` | `https://watch-party.vercel.app` ← placeholder |
| `NEXT_PUBLIC_SOCKET_URL` | `https://water-party-private-repo-production.up.railway.app` |
| `GOOGLE_CLIENT_ID` | `.env.local` |
| `GOOGLE_CLIENT_SECRET` | `.env.local` |
| `LIVEKIT_URL` | `.env.local` |
| `LIVEKIT_API_KEY` | `.env.local` |
| `LIVEKIT_API_SECRET` | `.env.local` |
| `YOUTUBE_API_KEY` | `.env.local` |
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.local` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `.env.local` |
| `SUPABASE_SERVICE_ROLE_KEY` | `.env.local` |

After Vercel deploys → note the real Vercel URL, then:

### Backfill (after Vercel URL is known)
1. **Vercel** → update `NEXTAUTH_URL` + `NEXT_PUBLIC_APP_URL` to the real URL → redeploy
2. **Railway** → add `SOCKET_ALLOWED_ORIGINS` = real Vercel URL → redeploy
3. **Terminal** → run DB migration:
   `dotenv -e .env.local -- npx prisma migrate deploy`
4. **Google Cloud Console** → Authorized redirect URIs → add:
   `https://<real-vercel-url>/api/auth/callback/google`

### Smoke test (final)
- [ ] Google sign-in on the live URL
- [ ] Create room → add YouTube video → host play/pause/seek
- [ ] Second user joins by code → playback syncs, chat sends, reactions float
- [ ] Multi-party voice ear test (still unverified)

---

## ⚠️ Flags

- **LiveKit credentials:** rotated and verified this session ✅
- **Multi-party voice:** solo test only — real 2-person test is the final smoke test
- **NEXTAUTH_SECRET must be identical** on Vercel and Railway — already confirmed set

---

## Standing process constraint (don't wait to be reminded)

At each phase boundary, run the **phase-end ritual**:

1. write/update `journal/PHASE_N_*.md`
2. commit `Phase N.x — <subject>`
3. push origin/main
4. tell user it's a clean state + give the resume phrase
5. **never** suggest `/compact` across phases — `/clear` only

Journals are the source of truth for cross-session context.
