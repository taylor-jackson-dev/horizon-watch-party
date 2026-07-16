# Watch Party

A cross-platform social viewing app — watch YouTube together in real time with
synchronized playback, live chat, animated reactions, and opt-in voice. A
Discord-style virtual movie theater for friends and family.

**Live demo:** https://water-party-private-repo.vercel.app

> Sign in with Google, create a room, paste a YouTube link, and share the room
> URL — anyone who opens it drops straight into synced playback.

---

## Highlights

- **Server-authoritative playback sync** — the host drives; viewers follow within
  ~1s. Each client corrects for its own clock skew against a server timestamp and
  tolerates small drift, so the room stays together without a seek-loop. Self-heals
  across network drops by re-joining and reconciling on reconnect.
- **Real-time everything over one socket** — chat (persistent, rate-limited),
  animated emoji reactions with "spotlight" surges when the room reacts together,
  live presence with a step-away mode, and a latecomer catch-up modal.
- **Opt-in voice** — WebRTC voice rooms via LiveKit, with server-issued,
  room-scoped tokens and a per-viewer mic toggle.
- **Adaptive room UI** — theater / focus / split view modes on desktop and a
  tabbed layout on mobile, all driven by CSS over a single fixed DOM so the video
  iframe and voice call never remount when the layout changes.
- **Installable PWA** — web manifest, a conservative service worker with an
  offline fallback, and an install affordance.
- **One-tap invites** — the room URL *is* the invite; opening it auto-joins public
  rooms (prefetch-safe) or prompts for a password on private ones.

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14 (App Router, TypeScript) |
| Styling | Tailwind CSS + a small in-house component library (CSS-variable theming engine) |
| Real-time | Socket.io (custom Node/Express server) |
| Auth | NextAuth v5 (Google OAuth, JWT sessions) |
| Database | PostgreSQL (Supabase) via Prisma ORM |
| Voice | LiveKit Cloud (WebRTC SFU) |
| Video | YouTube IFrame Player API |
| Validation | Zod on every API boundary |
| Hosting | Vercel (web + API) · Railway (socket server) |

## Architecture

```
        Web + API (Vercel, serverless)  ──HTTPS/REST──┐
                                                       ├──► PostgreSQL (Supabase)
        Socket.io server (Railway, persistent) ──WS───┘
                                                       └──► LiveKit Cloud (voice)
```

The socket server runs as its own long-lived process because Vercel's serverless
model can't hold an open WebSocket. Both services verify the **same JWT** (signed
with a shared secret), so a client authenticated to the web app can prove identity
to the socket server without a second login. Postgres is the source of truth;
the socket server keeps only ephemeral, self-healing in-memory state (room
playback position, live presence).

**Sync engine.** The host emits `video:state` (play/pause/seek/item-change plus a
periodic heartbeat); the server stamps it with authoritative time, caches it, and
broadcasts to the room. Each viewer projects the position to "now" using a
per-client clock-skew estimate and only re-seeks past a drift threshold. On socket
reconnect a `syncEpoch` bump triggers a reconcile — the host re-pushes state, a
viewer pulls it — which fixed the original "refresh to fix desync" bug.

## Project layout

```
app/            Next.js App Router — pages + API routes
components/      room/ (player, chat, queue, people, reactions) + ui/ primitives
lib/            auth, prisma, socket + livekit tokens, validations, sync helpers
server/         custom Socket.io server (server/socket-server.ts)
prisma/         schema + migrations
tests/          Vitest unit tests (pure logic: validators, rate limiter, sync detectors)
journal/        per-phase engineering journals + a full-project audit
```

## Running locally

```bash
npm install
cp .env.example .env.local   # fill in the documented values
npm run db:migrate           # apply the Prisma schema to your database
npm run dev:all              # Next.js on :3000 + socket server on :3001
```

Required environment variables (all documented in `.env.example`): a PostgreSQL
`DATABASE_URL`/`DIRECT_URL`, `NEXTAUTH_SECRET`, Google OAuth credentials, LiveKit
Cloud keys, and the public socket URL. No secrets are committed — everything is
env-driven.

```bash
npm run lint        # ESLint
npm run typecheck   # tsc --noEmit
npm test            # Vitest
npm run build       # production build
```

CI (GitHub Actions) runs lint, typecheck, tests, and a production build on every
push.

## Engineering process

This project was built in documented phases, each with a written journal
(`journal/`), a code-review pass before it shipped, and live verification on two
real devices. A full-project audit (architecture, security, and a candid viability
assessment) lives in `journal/AUDIT_2026_07.md`.

## Status & roadmap

Phases 1–5 are complete and deployed: foundation, rooms, playback sync, chat,
reactions, voice, presence, a dark-cinema design system, view modes, mobile/PWA,
and invite links. Next up is monetization (subscription tiers), moderation tools,
and native/desktop wrappers.
