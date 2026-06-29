# Watch Party — High-Level Architectural Plan

> **Status:** In progress — Phase 5 (re-scoped after friend-test feedback)  
> **Last Updated:** 2026-06-29  
> **Phase:** 5.5 invite link complete + verified live · 5.6 delight (spotlight
> reactions + latecomer catch-up) built + static-green, awaiting two-device live verify

---

## 1. Project Overview

Watch Party is a cross-platform social viewing application that lets friends and family watch videos, movies, and TV shows together in real time. The experience mirrors a virtual movie theater with Discord-style social features: synchronized playback, real-time chat, voice communication, emoji reactions, and customizable rooms.

**Target Platforms:**
- Web (primary, PWA-ready)
- iOS & Android (Expo React Native — Phase 7, after web is stable)
- Desktop — Mac & Windows (Tauri wrapper — Phase 7)

---

## 2. Confirmed Architecture Decisions

| # | Decision | Choice | Notes |
|---|---|---|---|
| 1 | Repo structure | Single Next.js app first | Folders structured for future Turborepo extraction |
| 2 | Mobile strategy | PWA first, Expo later | Native app after web experience is stable |
| 3 | Voice chat | LiveKit Cloud (managed) | Free tier covers dev + early users; migrate to self-hosted at scale |
| 4 | Payment processor | Stripe | Subscriptions, upgrades/downgrades, billing portal |
| 5 | File uploads | Deferred — hooks only in MVP | See monetization strategy below |
| 6 | Browser extension | Chrome first | Firefox/Edge after Chrome version is stable |

---

## 3. Tech Stack

### Frontend
| Layer | Choice | Rationale |
|---|---|---|
| Framework | **Next.js 14 (App Router)** | SSR/SSG for public pages, API routes, PWA support |
| Language | **TypeScript** | Type safety across the full stack |
| Styling | **Tailwind CSS** | Rapid dark-themed UI, consistent design tokens |
| Component Library | **shadcn/ui** | Headless, accessible, Tailwind-compatible |
| State Management | **Zustand** | Lightweight, no boilerplate; ideal for room/player state |
| Real-time Client | **Socket.io-client** | Handles reconnection, pairs with server |
| Video Player | **Video.js** + **YouTube IFrame API** | Unified player interface for multiple sources |

### Backend
| Layer | Choice | Rationale |
|---|---|---|
| Runtime | **Node.js 18+** | Unified JS/TS stack |
| Server | **Next.js API Routes + custom Express server** | REST via API routes; Express for Socket.io upgrade |
| Real-time | **Socket.io** | WebSocket sync engine with rooms, namespaces, fallbacks |
| Voice Chat | **LiveKit Cloud** | Open-source WebRTC SFU, managed hosting, free tier |
| Auth | **NextAuth.js v5** | OAuth (Google, Discord, Apple) + email/password |

### Database & Storage
| Layer | Choice | Rationale |
|---|---|---|
| Primary DB | **PostgreSQL** (via **Supabase**) | Relational, scalable; Supabase adds realtime + file storage |
| ORM | **Prisma** | Type-safe schema, migrations, seeding |
| File Storage | **Supabase Storage** | Reserved for avatars and future user video uploads |
| Caching | **Redis** (Upstash serverless) | Room state, rate limiting, session store |

### Infrastructure & DevOps
| Layer | Choice | Rationale |
|---|---|---|
| Hosting (Web) | **Vercel** | First-class Next.js support, edge functions |
| Hosting (Socket server) | **Railway** or **Fly.io** | Persistent Node process for Socket.io |
| LiveKit | **LiveKit Cloud** | Managed WebRTC SFU |
| CI/CD | **GitHub Actions** | Lint, typecheck, build, deploy pipeline |
| Secrets | **.env + Vercel/Railway env vars** | Never hardcoded in source |

---

## 4. Monetization Strategy

### Revenue Streams

**1. Subscription Tiers (Primary)**
- **Free:** Rooms up to 10 viewers, standard features, ad-supported
- **Premium:** Rooms up to 25–100+ viewers, no ads, exclusive themes/avatars, priority server quality
- Managed via Stripe — recurring billing, proration, billing portal

**2. Advertisements (Free Tier)**
- Ad placements for free tier users:
  - Pre-session interstitial (before a room starts)
  - Sidebar/banner ads in chat panel during viewing
- Ad network: **Google AdSense / AdMob** (web + mobile)
- Premium subscribers are ad-free
- Ad slots designed as swappable components so direct ad deals can be plugged in later

**3. Affiliate & Partner Revenue**
- Surface "Don't have [Service]? Subscribe here" prompts with tracked affiliate links
- Programs: Amazon Associates (Prime Video), Disney+ affiliate, Apple TV+ affiliate
- Integrated contextually when users attempt to sync a service they may not have

### Streaming Service Compatibility — Realistic Approach

> **Important Note:** Official API licensing from Netflix, Disney+, Prime Video etc. is not available to third-party applications. These companies enforce strict DRM and do not offer playback APIs for external use.

**What we will build instead:**

| Approach | How It Works | DRM Risk |
|---|---|---|
| **YouTube** | Official YouTube IFrame API + Data API v3 | None — fully supported |
| **Browser Extension Sync** | Extension detects play/pause/seek on streaming sites; relays events to Watch Party room via Socket.io | None — we never touch the content, only sync controls |
| **Affiliate Prompts** | Deep links + affiliate tracking to streaming service sign-up pages | None |

The browser extension is the correct, legally sound solution for Netflix/Disney+/Prime sync. Every viewer watches on their own subscription; Watch Party only synchronizes the remote control signals.

### File Upload — Deferred, Hooks Ready
User video file uploads are **not in the MVP** but the architecture is designed to support them without rework:
- Supabase Storage bucket is provisioned from day one
- The `VideoQueue` model includes a `storage_path` field (nullable in MVP)
- The video player abstraction supports a `type: 'upload'` source alongside `'youtube'`
- Size cap constants are defined in a single config file for easy future activation
- When ready to enable: flip a feature flag, set cap values, expose the upload UI

---

## 5. System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENTS                              │
│  Web (Next.js PWA)  │  iOS/Android (Expo)  │ Desktop (Tauri)│
│                     │  [Phase 7]           │ [Phase 7]      │
└────────┬────────────────────┬──────────────────┬────────────┘
         │ HTTPS/REST         │ WebSocket        │ WebRTC
         ▼                    ▼                  ▼
┌─────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  Next.js API    │  │  Socket.io Server │  │  LiveKit Cloud   │
│  (Vercel Edge)  │  │  (Railway/Fly.io) │  │  (Voice Chat)    │
└────────┬────────┘  └────────┬─────────┘  └──────────────────┘
         │                    │
         ▼                    ▼
┌──────────────────────────────────────────┐
│           PostgreSQL (Supabase)          │
│  Redis Cache (Upstash)                   │
│  File Storage (Supabase Storage)         │
└──────────────────────────────────────────┘

Browser Extension (Chrome, Phase 7):
  Streaming Site → Extension → Socket.io Server → All Room Members
```

---

## 6. Core Domain Models (Preview — Full Schema Next)

These are the top-level entities. The full Prisma database schema will be drafted separately for your approval.

| Model | Key Fields |
|---|---|
| **User** | id, email, displayName, avatarUrl, tier (free/premium) |
| **Account** | OAuth provider accounts linked to User (NextAuth) |
| **Room** | id, joinCode, name, theme, hostId, capacity, status |
| **RoomMember** | userId, roomId, role (host/viewer), joinedAt |
| **Message** | id, roomId, userId, content, type (text/reaction/system) |
| **Reaction** | id, roomId, userId, emoji, timestamp |
| **VideoQueue** | id, roomId, url, storagePath (nullable), type (youtube/upload), position |
| **Subscription** | id, userId, tier, stripeCustomerId, periodStart, periodEnd |
| **AdPlacement** | id, userId, slot (pre-session/sidebar), impressions, clicks |

---

## 7. Real-Time Sync Strategy

**Playback Sync (Socket.io)**
- Host emits `video:play`, `video:pause`, `video:seek` events with a server timestamp
- Server relays to all room members
- Clients apply offset correction: `targetTime = eventTime + (clientReceivedAt - serverSentAt) / 2`
- Host emits `video:heartbeat` every 5 seconds to correct drift

**Chat (Socket.io)**
- Messages emitted to a room-scoped channel
- Persisted to PostgreSQL asynchronously
- Last 50 messages loaded on room join

**Voice (LiveKit)**
- Each room maps 1:1 to a LiveKit room
- Tokens issued server-side only — scoped to user + room, 1hr TTL
- Push-to-talk = client mute/unmute toggle

---

## 8. Security Model

- All API routes require authenticated session (NextAuth JWT middleware)
- Room join codes: cryptographically random via `nanoid` (8 chars)
- Socket.io connections authenticate via signed JWT on handshake
- LiveKit tokens are server-issued, short-lived (1hr), room-scoped
- Rate limiting on chat messages (Redis token bucket)
- No API keys or secrets in source code — all via environment variables
- File uploads (future): server-side type whitelist + size enforcement before storage write

---

## 9. Folder Structure

```
watch-party/
├── app/                        # Next.js App Router
│   ├── (auth)/                 # Login, signup, OAuth callback pages
│   ├── (marketing)/            # Landing page, pricing
│   ├── dashboard/              # User dashboard, room list
│   ├── room/[code]/            # Watch room page
│   └── api/                    # API route handlers
│       ├── auth/               # NextAuth endpoints
│       ├── rooms/              # Room CRUD
│       ├── messages/           # Chat history
│       ├── subscriptions/      # Stripe webhooks + billing
│       └── livekit/            # Token generation
├── components/
│   ├── ui/                     # shadcn/ui base components
│   ├── room/                   # Room-specific components
│   ├── player/                 # Video player abstraction
│   ├── chat/                   # Chat panel components
│   └── ads/                    # Ad slot components (swappable)
├── lib/
│   ├── auth.ts                 # NextAuth config
│   ├── prisma.ts               # Prisma client singleton
│   ├── socket.ts               # Socket.io client setup
│   ├── livekit.ts              # LiveKit token utils
│   ├── stripe.ts               # Stripe client
│   └── config.ts               # Feature flags + upload caps (future)
├── server/
│   └── socket-server.ts        # Custom Express + Socket.io server
├── prisma/
│   ├── schema.prisma           # Database schema
│   └── migrations/             # Migration history
├── public/                     # Static assets
├── .env.example                # Environment variable template
├── .github/workflows/          # CI/CD pipelines
└── PLAN.md                     # This document
```

---

## 10. Build Phases

### Phase 1 — Foundation ✅
- [x] Next.js 14 project scaffold with TypeScript + Tailwind
- [x] Prisma schema + initial migration (Supabase)
- [x] NextAuth.js: Google OAuth + email/password
- [x] User model, profile API endpoint
- [x] `.env.example` with all required variables documented
- [x] GitHub Actions: lint + typecheck CI

### Phase 2 — Room System ✅
- [x] Room creation with `nanoid` join codes
- [x] Room join flow (code-based entry)
- [x] Host vs. viewer role enforcement
- [x] Room settings API (name, theme, capacity)
- [x] Free tier capacity gate (max 10 viewers)
- [x] RoomMember join/leave tracking

### Phase 3 — Video Playback Sync ✅
- [x] YouTube embed via IFrame API
- [x] Socket.io sync engine: play / pause / seek / heartbeat
- [x] Latency compensation logic
- [x] Host-only playback controls
- [x] Video queue management (add, reorder, remove)
- [x] Stub for future upload support (feature-flagged, UI hidden)

### Phase 4 — Social & Communication
- [x] **4.1** Real-time text chat (Socket.io room channel)
- [x] **4.2** Animated emoji reactions (overlay + chat)
- [x] **4.3** LiveKit voice chat (push-to-talk + open mic)
- [x] **4.4** Profile, presence & step-away (2026-06-17) — shipped display-name edit, presence-based live count, step-away mode; + mobile fullscreen fix. See `journal/PHASE_4_4_PROFILE.md`.

**4.4 Candidates — disposition (reviewed + approved/cut at phase start)**
- ✅ *Display-name edit* — SHIPPED. Settings UI + `PATCH /api/users/me`. No migration (field existed).
- ✅ *Presence-based active count* — SHIPPED. Socket `room:presence` channel + PresencePanel; also fixed the refresh-required count bug.
- ✅ *"Step away" mode* — SHIPPED. AFK flag on the presence entry; viewer detaches from re-sync while away.
- ✂️ *Avatar upload to Supabase Storage* — CUT (deferred).
- ✂️ *Status messages under name* — CUT (deferred).
- ✂️ *Lurker mode UI* (`isViewOnly`) — CUT (deferred).
- ✂️ *Avatar reactions* — CUT (deferred).
- ✂️ *Per-participant local volume slider* — CUT (deferred).

### Phase 5 — Sync Reliability, Design & View Modes *(re-scoped 2026-06-24)*

Friend-test feedback reshaped Phase 5 into a reliability hotfix first, then the
design/layout work, then view modes, mobile/PWA, invite, and delight. Each
sub-phase closes with the journal + two-device-verify ritual.

- [x] **5.1** Socket reconnect reliability ✅ (2026-06-24) — re-emit `room:join`
  on every reconnect, mint a fresh token per attempt (survives the 1h JWT TTL),
  and reconcile video/chat/queue/presence/step-away on a `syncEpoch` bump. Kills
  the "refresh fixes it" desync. See `journal/PHASE_5_1_SYNC_RELIABILITY.md`.
- [x] **5.2** Dark cinema design system + layout overhaul ✅ (2026-06-24, verified
  live on two devices) — CSS-variable theming engine keyed by
  `data-theme`/`data-lighting` (swap themes + add color/lighting control later),
  in-house UI primitives, app shell + real landing, full room restyle; sync/voice/chat
  untouched. One bug caught in the live pass: room header showed a perpetual `WAITING`
  status enum → now a live "N/capacity watching" headcount badge. Premium skins still
  land in Phase 6. See `journal/PHASE_5_2_DESIGN_SYSTEM.md`.
- [x] **5.3** View modes ✅ (2026-06-25, verified live on two devices) — theater
  rail / focus / split presets (segmented control), persisted per-browser, plus a
  fullscreen translucent chat overlay. Post-live polish: controls moved off the
  video onto the "Now playing" row (clears YouTube's corner chrome) + reaction-picker
  auto-hide. Backlogged a 4th "front-row" cinema mode (gated on avatars). See
  `journal/PHASE_5_3_VIEW_MODES.md`.
- [x] **5.4** Mobile-responsive + PWA ✅ complete + verified live (2026-06-25) — PWA
  (manifest at `/manifest.webmanifest`, conservative service worker, install button,
  icons, offline page) + a real mobile layout for the room: RoomShell unified into
  **one fixed DOM** (zero remounts; also kills the latent remount-on-mode-switch bug),
  with desktop theater/focus/split and a mobile **tabbed** layout (Chat · Queue ·
  People under a pinned video) all driven purely by CSS. Split tweak: presence/voice
  moved into the rail. Presentation-only. See `journal/PHASE_5_4_MOBILE_PWA.md`.
- [x] **5.4.1** Combined **People panel** ✅ complete + verified live (2026-06-25) —
  merged the "Watching" roster + "Voice" box into one panel: each viewer is
  one row (presence dot · name · **mic toggle at the far end**), Join-voice button
  directly below. PTT/open-mic selector removed (deferred to a future voice settings
  page); default is **open-mic, joined muted** — tap your own mic to talk. Keyed on
  userId === LiveKit identity. Used everywhere (mobile People tab + desktop rail), so
  the voice call still mounts once. Presentation-only. See `journal/PHASE_5_4_MOBILE_PWA.md`.
- [x] **5.5** Invite link ✅ complete + verified live (2026-06-29; at-capacity case
  covered by inspection) — the
  invite link is just the room URL (`/room/<code>`), with a copy/native-share button in
  the room header **and** on each dashboard room card. Opening a **public** link
  **auto-joins** and drops you straight in — the join fires **client-side on mount**
  (not during server render) so Next.js `<Link>` prefetch can't silently enroll you;
  **private** links land on a password card. Reuses `/api/rooms/join` (no new route, no
  migration). See `journal/PHASE_5_5_INVITE_LINK.md`.
- [~] **5.6** Delight — spotlight reactions + catch-up summary for latecomers ✅ built
  + static-green (review-logic clean · 33 tests · typecheck/lint/build clean), 🔄
  **awaiting two-device live verify** (2026-06-29). Both client-only, no migration:
  spotlight = a pure detector (`lib/spotlight-reactions.ts`, 3-same-emoji-in-2s, per-emoji
  cooldown) feeding a centered overlay layer in `ReactionOverlay`; catch-up = a one-time
  modal popped from the join-ack `initialState`, gated on the initial join (`syncEpoch === 1`,
  not reconnects) when a video's already > 1 min in. See `journal/PHASE_5_6_DELIGHT.md`.

**Candidate dispositions (locked at re-scope)**
- ✅ *Spotlight reactions* — KEPT → 5.6. 3+ same emoji within ~2s triggers a big
  animated overlay. Builds on 4.2 reactions infra.
- ✅ *Catch-up summary for latecomers* — KEPT → 5.6. Join-mid-session modal
  ("playback at 14:32 · 3 queued · chat highlight: …").
- ✅ *Layout overhaul* — KEPT → folded into 5.2 design system.
- ✅ *Invite link* — KEPT → 5.5 (chosen "invite link now" over full friends-list).
- 🔭 *Theme variants / premium skins* — DEFERRED → Phase 6 (build the engine in
  5.2, ship cosmetic skins as a premium hook later).
- 🔭 *Live polls* — DEFERRED (post-Phase-5 delight candidate).
- 🔭 *Local video upload* — DEFERRED ("defer upload"; player is YouTube-only —
  its own phase later, hooks already in schema/config).
- 🔭 *Full sync watchdog / diagnostics* — DEFERRED. The durable successor to the
  5.1 hotfix: error-code taxonomy, periodic reconcile, manual-reconnect UI +
  infinite retry. (This was the friend's "background service + error codes" idea,
  scoped down to a hotfix for now.)
- 🔭 *Full friends-list invite* — DEFERRED → Phase 9 (needs a social graph).

### Phase 6 — Monetization
- [ ] Stripe subscription integration (free/premium tiers)
- [ ] Ad slot components (pre-session + sidebar)
- [ ] Google AdSense integration
- [ ] Affiliate link system for streaming services
- [ ] Premium feature gates (room capacity, no ads, exclusive customization)
- [ ] Billing portal (Stripe Customer Portal)

**6.x Premium feature candidates (proposed — discuss + approve/cut at phase start)**
- *Custom emoji sets* — upload your own emojis per-user or per-room. Builds on 4.2 reactions infra. Natural premium hook.
- *Voice soundboard* — pre-recorded short clips you can play into voice (Discord-style). Fun, monetizable, easy to ship with rate-limit guardrails.
- *AI session recaps* — auto-generated narrative recap of the session ("the room collectively gasped at the third act twist…"). Whisper for voice transcription + Claude for narrative.
- *Themed room skins* — Halloween, sci-fi, indie cinema. Pure cosmetic, big-feeling differentiator.
- *Custom join codes* — branded codes like `MOVIE-NIGHT` instead of `xK9mP2qR`. Vanity feature.
- *Persistent rooms* — premium rooms don't auto-close on inactivity.

### Phase 7 — Cross-Platform & Extension
- [ ] Tauri desktop app (wraps web app)
- [ ] Expo React Native app (iOS + Android)
- [ ] Chrome browser extension (streaming service sync)

### Phase 8 — Moderation & Safety
- [ ] Host controls: mute, kick, ban
- [ ] Report system
- [ ] Rate limiting on chat (in-memory limiter ships with each feature; this graduates to Redis-backed)
- [ ] Age-appropriate content defaults

**8.x Candidates (proposed — discuss + approve/cut at phase start)**
- *Host force-mute via LiveKit Admin API* — schema flag `isMicMuted` is already token-respected; this adds the host UI + server-side `RoomService.muteParticipant` call. (Carried from Phase 4.3 deferred list.)
- *Chat moderation UI* — delete-own-message, host delete-any. Schema already has `deletedAt`.
- *Audit log* — record host moderation actions (mute, kick, ban, message delete) for accountability.

---

### Phase 9 — Memory & Coordination *(new — proposed)*

Bridges between sessions and friend groups. Turns Watch Party from a utility into something users come back to. Sequenced after monetization so we have premium hooks to attach.

- [ ] *Friends-watched-together history* — dashboard surfaces "You've watched 7 things with Sarah, last together May 14." Network effect on relationships, not just rooms.
- [ ] *Recurring watch parties / templates* — "Friday Movie Night" template: saved member list, theme, recurring schedule, auto-opens. Solves the "when's everyone free?" coordination friction.
- [ ] *Schedule + RSVP* — invite friends to a future-time room. Calendar invite or push notification. Live RSVP counter.
- [ ] *Watchlists* — saved video lists portable between rooms; share lists between friends.
- [ ] *Session recap (basic, free tier)* — top reactions, peak chat moments, total runtime; shareable card. (Distinct from premium AI-narrative version in Phase 6.)

---

## Deployment — Production Setup & Checklist

> **Status:** In progress — first public deploy for remote friend testing (2026-06-10).
> **Topology:** Web + API → **Vercel** (serverless) · Socket.io → **Railway** (persistent Node) · Postgres → **Supabase** (reused dev project) · Voice → **LiveKit Cloud**.

### Why two hosts
`server/socket-server.ts` is a long-lived process and the client connects
WebSocket-only (no polling fallback). Vercel's serverless model can't hold an open
socket, so the socket server deploys separately to Railway. Vercel hosts the
Next.js web app + API routes.

### Repo prep (committed — no console needed)
- `start:socket` = `tsx server/socket-server.ts` (prod, no watch); `tsx` promoted to
  `dependencies` so it survives a production install.
- Socket server binds Railway's injected `PORT` (falls back to `SOCKET_PORT`, then 3001).
- `postinstall: prisma generate` — Vercel & Railway both ship a fresh Prisma client.
- `railway.json` pins the build (`prisma generate`), start (`start:socket`), and the
  `/health` check for the socket service.

### Environment variables

| Variable | Vercel (web) | Railway (socket) | Note |
|---|:---:|:---:|---|
| `DATABASE_URL` / `DIRECT_URL` | ✅ | ✅ | both use Prisma |
| `NEXTAUTH_SECRET` | ✅ | ✅ | **byte-identical** — web signs the socket JWT, socket verifies it |
| `NEXTAUTH_URL` | ✅ | — | the `…vercel.app` URL |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | ✅ | — | |
| `LIVEKIT_URL` / `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` | ✅ | — | rotate before deploy |
| `YOUTUBE_API_KEY` | ✅ | — | |
| `NEXT_PUBLIC_SUPABASE_URL` / `_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` | ✅ | — | |
| `NEXT_PUBLIC_APP_URL` | ✅ | — | the vercel URL |
| `NEXT_PUBLIC_SOCKET_URL` | ✅ | — | the Railway public URL (`https://…`) |
| `SOCKET_ALLOWED_ORIGINS` | — | ✅ | CORS allowlist = the vercel URL |

`STRIPE_*` vars are documented in `.env.example` but the Stripe SDK isn't wired yet
(Phase 6) — skip them.

### Deploy order (resolves the URL chicken-and-egg)
1. **Railway** — deploy the socket service; note its public URL.
2. **Vercel** — deploy web with `NEXT_PUBLIC_SOCKET_URL` = Railway URL; note the Vercel URL.
3. **Backfill** — set `SOCKET_ALLOWED_ORIGINS` (Railway) and `NEXTAUTH_URL` +
   `NEXT_PUBLIC_APP_URL` (Vercel) to the now-known URLs; redeploy both.
4. **Migrate** — `npx prisma migrate deploy` against the prod DB (uses `DIRECT_URL`).
5. **Google OAuth** — add `https://<vercel-url>/api/auth/callback/google` to the
   Authorized redirect URIs in Google Cloud Console.

### Must-verify
- `NEXTAUTH_SECRET` matches on both hosts (mismatch = socket auth fails silently).
- LiveKit credentials rotated (prior keys were exposed in chat last session).
- Set `AUTH_TRUST_HOST=true` only if NextAuth throws `UntrustedHost` (Vercel usually
  auto-detects).

### Post-deploy smoke test
- [ ] Google sign-in on the live URL.
- [ ] Create room → add a YouTube video → host play / pause / seek.
- [ ] Second user joins by code → playback syncs, chat sends, reactions float.
- [ ] Multi-party voice ear test (the still-unverified path).

---

## 11. All Decisions — Resolved

### Architecture Decisions
| # | Question | Decision |
|---|---|---|
| 1 | Monorepo tool | Single Next.js app first; refactor to Turborepo when mobile/desktop builds begin |
| 2 | Mobile strategy | PWA first; Expo app in Phase 7 |
| 3 | LiveKit hosting | LiveKit Cloud (managed free tier) |
| 4 | Payment processor | Stripe |
| 5 | File uploads | Deferred — architecture hooks in place, feature-flagged off |
| 6 | Browser extension scope | Chrome first; Firefox/Edge after stable |

### Schema Decisions
| # | Question | Decision |
|---|---|---|
| 1 | Room privacy | Free = Public (discoverable, code only). Premium = Private (code + password, hidden). Room browser UI post-MVP |
| 2 | Messages & toggles | 48hr retention all tiers. Voice/chat/reaction toggles all tiers. Per-member permissions premium only |
| 3 | CO_HOST role | In schema, inactive in MVP. Activates with large-room premium permission system |
| 4 | Guest access | Accounts required at launch. Named guests added post-MVP as growth feature, planned sunset |
| 5 | Video queue | Rolling cap of 33. Shuffle, loop queue, loop single. Per-member contribution limit. Unlimited session time |

---

## Backlog — Wild cards, no fixed phase

Captured here so they don't get lost. Surface when relevant or when a related phase opens up.

- *Live captions / transcription* — Whisper-style speech-to-text on the voice stream. Accessibility win + lets late-joiners "read" what was said. Infra-heavy (streaming Whisper or LiveKit Egress + transcription).
- *Watch-along trivia* — auto-pulled IMDB/YouTube metadata surfaces between videos ("Did you know this scene took 47 takes?"). Charming, needs a metadata pipeline.
- *AR/VR cinema room* — Quest support, avatar-seat layout. Far-future flag.
- *Local volume mixer overlay* — extends per-participant volume into a small mixer panel.
- *Voice effects* — robot voice, pitch shift, etc. for the soundboard. Fun, possibly cursed.
- *Webcam reactions* — tiny self-view bubble. Privacy minefield; design carefully if pursued.
- *Room banner frames* — the lobby / viewers' room list shows a host-chosen **banner frame** per room, set in the (future) room-settings page after creation. Ships first as a **basic banner set**, then grows into **achievement-unlockable**, **custom**, and **premium** banners — ties into Phase 6 monetization and a future achievements system. Slot in when the room-settings page or the lobby/room-list gets its next pass (host note, 2026-06-24; not yet scheduled).
- *"Front-row" cinema view mode* — a **4th view mode** joining theater / focus / split (Phase 5.3): the room's members render as **avatars seated front-row in silhouette** under a big-screen stage, "in a theater" feel. **Gated on avatars existing** (avatar upload was deferred out of Phase 4.4 — this is its marquee payoff). Wires cleanly into the `ViewMode` union + `gridColsClass`/layout switch already in `RoomShell`; pairs naturally with spotlight reactions (5.6 delight) and premium seat/silhouette cosmetics (Phase 6). Schedule alongside avatar upload (host note, 2026-06-24).
- *Voice quality + monitoring (future voice settings page)* — a cluster of audio-quality upgrades, naturally landing alongside the deferred **voice settings page** (which also holds the PTT/open-mic selector removed in 5.4.1). Three parts: **(a) mic monitoring** — input-level meter, device picker, and a "test your mic" affordance so users can confirm hardware before joining; **(b) background noise suppression** — LiveKit's Krisp noise filter (`@livekit/krisp-noise-filter` track processor) and/or the browser `noiseSuppression`/`echoCancellation` constraints, host- or self-toggleable; **(c) snappier remote speaking indicators** — the residual ring delay noticed in the 5.4.1 live pass is the *remote* ring: each device sees its OWN ring instantly (local Web Audio `createAudioAnalyser`, added in 5.4.1) but everyone else's `isSpeaking` arrives via the server's debounced `RoomEvent.ActiveSpeakersChanged`. Fix is per-remote-track `createAudioAnalyser` on each subscribed audio track, mirroring the local-speaking approach, to drive remote rings locally instead of waiting on the server event (host note, 2026-06-25).

---

## Next Step → Phase 5.6: Delight — two-device live verify

Phases 1–5.5 are shipped + live-verified. **Phase 5.6** (delight) is **built +
static-green + deployed**, now **awaiting its two-device live verify** — the same gate
5.5 cleared. Two client-only touches, no migration: **spotlight reactions** (≥3 of the
same emoji within ~2s → a big centered overlay on top of the float-up reactions, via a
pure unit-tested detector with a per-emoji cooldown) and a **latecomer catch-up modal**
(a one-time "you're joining mid-session · now playing X · around MM:SS · N queued"
popped from the join-ack `initialState`, gated to the initial join when a video is
already > 1 min in — never on reconnect, never for the host). review-logic came back
clean (one isolation test added); 33 tests / typecheck / lint / build all green. **Run
the live checklist in `journal/PHASE_5_6_DELIGHT.md`** (spotlight surge on two devices;
latecomer modal when Account B joins mid-playback; confirm it does NOT re-pop on
reconnect). Phase 5 order: 5.1 reliability → 5.2 design system → 5.3 view modes → 5.4
mobile/PWA → 5.4.1 People panel → 5.5 invite link → **5.6 delight (live-verify pending)**.

Carry-over bug still open: **B2** voice mic on mobile Safari (`NotAllowedError`).
**B3** (YouTube black-screen-on-first-load) and the reconnect desync are both
fixed + verified.

### Already-shipped highlights (1–4.3)
- Foundation, room system, video sync engine
- Real-time chat (4.1) — persistent, rate-limited, server-authoritative
- Animated emoji reactions (4.2) — Twitch-style overlay with full-screen support
- LiveKit voice chat (4.3) — opt-in join, default PTT on `V`, host-level toggle
- Strict viewer re-sync (4.3.1) — viewer-driven play/pause snaps to host position

### Original Phase 1 task list *(historical, kept for reference)*
1. Scaffold Next.js 14 project with TypeScript + Tailwind ✅
2. Create `lib/config.ts` with all queue/room constants ✅
3. Wire in Prisma with approved schema against Supabase ✅
4. Set up NextAuth.js (Google OAuth + email/password) ✅
5. Establish full folder structure ✅
6. Create `.env.example` with all required variables ✅
7. Set up GitHub Actions CI (lint + typecheck) ✅
