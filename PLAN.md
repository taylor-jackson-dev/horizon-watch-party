# Watch Party — High-Level Architectural Plan

> **Status:** Approved — Ready for Phase 1  
> **Last Updated:** 2026-05-26  
> **Phase:** 0 — Planning & Architecture (Complete)

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

### Phase 1 — Foundation
- [ ] Next.js 14 project scaffold with TypeScript + Tailwind
- [ ] Prisma schema + initial migration (Supabase)
- [ ] NextAuth.js: Google OAuth + email/password
- [ ] User model, profile API endpoint
- [ ] `.env.example` with all required variables documented
- [ ] GitHub Actions: lint + typecheck CI

### Phase 2 — Room System
- [ ] Room creation with `nanoid` join codes
- [ ] Room join flow (code-based entry)
- [ ] Host vs. viewer role enforcement
- [ ] Room settings API (name, theme, capacity)
- [ ] Free tier capacity gate (max 10 viewers)
- [ ] RoomMember join/leave tracking

### Phase 3 — Video Playback Sync
- [ ] YouTube embed via IFrame API
- [ ] Socket.io sync engine: play / pause / seek / heartbeat
- [ ] Latency compensation logic
- [ ] Host-only playback controls
- [ ] Video queue management (add, reorder, remove)
- [ ] Stub for future upload support (feature-flagged, UI hidden)

### Phase 4 — Social & Communication
- [ ] Real-time text chat (Socket.io room channel)
- [ ] Animated emoji reactions (overlay + chat)
- [ ] LiveKit voice chat (push-to-talk + open mic)
- [ ] User avatars + basic profile customization

### Phase 5 — View Modes & UI Polish
- [ ] Theater mode (avatar rail below screen)
- [ ] Full-screen mode
- [ ] Split view (video + chat/social panel)
- [ ] Mobile-responsive / PWA manifest + service worker
- [ ] Dark cinema theme design system

### Phase 6 — Monetization
- [ ] Stripe subscription integration (free/premium tiers)
- [ ] Ad slot components (pre-session + sidebar)
- [ ] Google AdSense integration
- [ ] Affiliate link system for streaming services
- [ ] Premium feature gates (room capacity, no ads, exclusive customization)
- [ ] Billing portal (Stripe Customer Portal)

### Phase 7 — Cross-Platform & Extension
- [ ] Tauri desktop app (wraps web app)
- [ ] Expo React Native app (iOS + Android)
- [ ] Chrome browser extension (streaming service sync)

### Phase 8 — Moderation & Safety
- [ ] Host controls: mute, kick, ban
- [ ] Report system
- [ ] Rate limiting on chat
- [ ] Age-appropriate content defaults

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

## Next Step → Phase 1: Foundation

All planning and schema decisions are locked. See `DATABASE_SCHEMA.md` for the full approved Prisma schema.

Phase 1 tasks:
1. Scaffold Next.js 14 project with TypeScript + Tailwind
2. Create `lib/config.ts` with all queue/room constants
3. Wire in Prisma with approved schema against Supabase
4. Set up NextAuth.js (Google OAuth + email/password)
5. Establish full folder structure
6. Create `.env.example` with all required variables
7. Set up GitHub Actions CI (lint + typecheck)
