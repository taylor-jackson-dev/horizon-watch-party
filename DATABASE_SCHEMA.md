# Watch Party — Database Schema

> **Status:** Approved — Ready for Phase 1  
> **Last Updated:** 2026-05-26  
> **Phase:** 0 — Planning & Architecture  
> **ORM:** Prisma  
> **Database:** PostgreSQL (Supabase)

---

## How to Read This Document

Each section covers one database model (table). For every model you'll find:
- **Purpose** — what it stores and why
- **Prisma schema block** — the actual schema code ready to paste
- **Field notes** — explanation of any non-obvious field choices
- **Relations** — how it connects to other models

The full compiled `schema.prisma` file is at the bottom of this document.

---

## Resolved Design Decisions

| # | Question | Decision |
|---|---|---|
| 1 | Room passwords | **Free = Public rooms (no password, discoverable). Premium = Private rooms (password + hidden from discovery). Room browser UI deferred to post-MVP.** |
| 2 | Message retention | **48-hour auto-purge for all tiers. Not a tier differentiator. Voice/chat/reaction toggles available to all tiers. Per-member permissions are premium only.** |
| 3 | CO_HOST role | **Kept in schema, marked inactive in MVP. Activates as part of large-room premium permission system.** |
| 4 | Guest access | **Accounts required at launch. Named guest access added post-MVP as a growth feature with a planned sunset.** |
| 5 | Video queue | **Rolling cap of 33 items for all tiers. Played items stay in queue marked as played. Shuffle, loop queue, loop single, and per-member contribution limits included.** |

---

## Model 1 — User

**Purpose:** The core identity record for every person using Watch Party. Stores display info, tier status, and links to auth accounts.

```prisma
model User {
  id            String   @id @default(cuid())
  email         String   @unique
  emailVerified DateTime?
  displayName   String
  avatarUrl     String?
  bio           String?
  tier          UserTier @default(FREE)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  // Relations
  accounts      Account[]
  sessions      Session[]
  hostedRooms   Room[]         @relation("RoomHost")
  memberships   RoomMember[]
  messages      Message[]
  reactions     Reaction[]
  videoQueue    VideoQueue[]
  subscription  Subscription?
  adImpressions AdImpression[]

  @@index([email])
}

enum UserTier {
  FREE
  PREMIUM
}
```

**Field Notes:**
- `id` uses `cuid()` — collision-resistant, URL-safe, no sequential guessing
- `tier` drives capacity gates, ad display, private room access, and all feature gating throughout the app
- `avatarUrl` points to Supabase Storage; `null` renders a generated default avatar in the UI
- `emailVerified` is managed by NextAuth — null until the user verifies their email
- `bio` is optional — reserved for profile customization (premium feature, later phase)

---

## Model 2 — Account

**Purpose:** Stores OAuth provider accounts linked to a User. One user can have multiple accounts (e.g. Google + Discord). Standard NextAuth adapter model.

```prisma
model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String  // "oauth" | "email" | "credentials"
  provider          String  // "google" | "discord" | "apple"
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@index([userId])
}
```

**Field Notes:**
- `@db.Text` on token fields — OAuth tokens can exceed the default varchar limit
- `onDelete: Cascade` — deleting a user removes all their linked OAuth accounts
- `@@unique([provider, providerAccountId])` prevents duplicate OAuth links per provider

---

## Model 3 — Session

**Purpose:** NextAuth database sessions. Tracks active login sessions per user.

```prisma
model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}
```

**Field Notes:**
- Standard NextAuth model — required for database session strategy
- `expires` is checked on every authenticated request; expired sessions are rejected automatically

---

## Model 4 — VerificationToken

**Purpose:** One-time tokens for email verification and magic link sign-in.

```prisma
model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}
```

**Field Notes:**
- Standard NextAuth model — no `id` field; composite unique key is the NextAuth requirement
- Tokens are deleted after use

---

## Model 5 — Room

**Purpose:** A watch party room. The central organizing entity. Supports both public (free, discoverable) and private (premium, password-protected) room types.

```prisma
model Room {
  id                     String     @id @default(cuid())
  joinCode               String     @unique
  name                   String
  description            String?
  hostId                 String
  theme                  RoomTheme  @default(DARK_CINEMA)
  status                 RoomStatus @default(WAITING)
  capacity               Int        @default(10)    // Free default: 10 | Premium: 25–100+

  // Privacy — Decision 1
  isPrivate              Boolean    @default(false) // false = Public (free), true = Private (premium)
  password               String?                   // bcrypt-hashed — only set on Private rooms

  // Communication toggles — Decision 2
  chatEnabled            Boolean    @default(true)
  voiceEnabled           Boolean    @default(true)
  reactionsEnabled       Boolean    @default(true)

  // Queue settings — Decision 5
  memberContributionLimit Int       @default(2)     // Max videos per member (0 = host-only curation)
  loopQueue              Boolean    @default(false) // Restart queue when last video ends
  loopSingle             Boolean    @default(false) // Repeat current video
  shuffleEnabled         Boolean    @default(false) // Shuffle queue order on loop restart

  createdAt              DateTime   @default(now())
  updatedAt              DateTime   @updatedAt
  closedAt               DateTime?  // Set when room ends; preserves history

  // Relations
  host       User         @relation("RoomHost", fields: [hostId], references: [id])
  members    RoomMember[]
  messages   Message[]
  reactions  Reaction[]
  videoQueue VideoQueue[]

  @@index([joinCode])
  @@index([hostId])
  @@index([status])
  @@index([isPrivate, status]) // Powers the public room browser query
}

enum RoomStatus {
  WAITING  // Room created, no video playing yet
  ACTIVE   // Video is currently playing
  PAUSED   // Video paused by host
  ENDED    // Room session is over
}

enum RoomTheme {
  DARK_CINEMA  // Default — dark charcoal, gold accents
  NEON_NIGHT   // Premium — dark purple, neon accents
  RETRO_DRIVE  // Premium — retro drive-in aesthetic
  MINIMAL      // Premium — clean minimal dark
}
```

**Field Notes:**
- `joinCode` generated by `nanoid(8)` server-side — e.g. `"xK9mP2qR"` — unique and URL-safe
- `isPrivate: false` = Public room. Discoverable in the room browser (UI deferred post-MVP). Join code only
- `isPrivate: true` = Private room. Premium only. Hidden from room browser. Requires join code + password
- `password` is bcrypt-hashed server-side before storage — never stored in plaintext
- `capacity` defaults to 10 (free); set to 25/50/100+ when host is premium
- `chatEnabled`, `voiceEnabled`, `reactionsEnabled` — all tiers; host-controlled per session
- `memberContributionLimit` = 0 means only the host can add videos; 1–5 lets members contribute
- `loopQueue` + `shuffleEnabled` together create "endless party mode" — reshuffles and loops the queue
- `@@index([isPrivate, status])` optimizes the public room browser query: `WHERE isPrivate = false AND status = 'ACTIVE'`
- `closedAt` preserves ended room history without hard deletion

---

## Model 6 — RoomMember

**Purpose:** Join table tracking which users are (or were) in which rooms, their role, connection state, and per-member permissions.

```prisma
model RoomMember {
  id                 String         @id @default(cuid())
  roomId             String
  userId             String
  role               RoomMemberRole @default(VIEWER)
  status             MemberStatus   @default(ACTIVE)

  // Host-controlled permissions (premium per-member controls)
  isMicMuted         Boolean        @default(false) // Voice muted by host
  isChatRestricted   Boolean        @default(false) // Chat disabled for this member
  isViewOnly         Boolean        @default(false) // No mic, no chat — watch only
  videoContribCount  Int            @default(0)     // Tracks how many videos this member has added

  joinedAt           DateTime       @default(now())
  leftAt             DateTime?      // Set on disconnect or leave

  room Room @relation(fields: [roomId], references: [id], onDelete: Cascade)
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([roomId, userId])
  @@index([roomId])
  @@index([userId])
}

enum RoomMemberRole {
  HOST     // Full control: play, pause, seek, kick, manage settings
  CO_HOST  // [INACTIVE IN MVP] Future premium feature: partial host controls
  VIEWER   // Default: watch, chat, react (within room toggle settings)
}

enum MemberStatus {
  ACTIVE  // Currently in the room
  LEFT    // Left voluntarily
  KICKED  // Removed by host
  BANNED  // Banned from rejoining this room
}
```

**Field Notes:**
- `@@unique([roomId, userId])` — one membership record per user per room
- `isMicMuted`, `isChatRestricted`, `isViewOnly` are the **per-member premium permission controls** — set by host on large premium rooms
- `isViewOnly` is the "read-only mode" — useful for managing disruptive members without kicking them
- `videoContribCount` is checked server-side against `Room.memberContributionLimit` when a member tries to add to the queue
- `CO_HOST` is in the enum but inactive in MVP — one-line comment makes this clear to any developer
- `BANNED` status causes the join API to reject the user even with a valid `joinCode` and password
- `leftAt` + `status` together provide a complete audit trail per room session

---

## Model 7 — Message

**Purpose:** Stores all chat messages in a room. Covers text, emoji-to-chat, system events, and future GIF support. Auto-purged after 48 hours.

```prisma
model Message {
  id        String      @id @default(cuid())
  roomId    String
  userId    String
  content   String      @db.Text
  type      MessageType @default(TEXT)
  createdAt DateTime    @default(now())
  deletedAt DateTime?   // Soft delete — UI renders "[deleted]", record stays for moderation

  room Room @relation(fields: [roomId], references: [id], onDelete: Cascade)
  user User @relation(fields: [userId], references: [id])

  @@index([roomId, createdAt]) // Primary query: last N messages for a room, ordered by time
  @@index([userId])
}

enum MessageType {
  TEXT      // Standard chat message
  REACTION  // Emoji sent to chat panel (distinct from video overlay reactions)
  SYSTEM    // Server-generated: "Peak joined the room" / "Peak was kicked"
  GIPHY     // Future: GIF messages
}
```

**Field Notes:**
- **Retention:** A nightly cleanup job purges messages where `createdAt < NOW() - INTERVAL '48 hours'` — same for all tiers, not a differentiator
- `deletedAt` is a soft delete — content is replaced with `[deleted]` in the UI but the record remains for moderation review
- `SYSTEM` messages are server-generated — keeps the chat timeline coherent without a separate events table (e.g. join/leave/kick notifications appear inline with chat)
- `@@index([roomId, createdAt])` is a composite index for the most frequent query pattern
- `content` uses `@db.Text` — no character limit enforced at DB level (rate limiting + length validation in API layer)

---

## Model 8 — Reaction

**Purpose:** Emoji reactions that animate over the video screen or float in the chat panel. High-frequency and ephemeral — handled in real time via Socket.io, stored for engagement analytics.

```prisma
model Reaction {
  id        String   @id @default(cuid())
  roomId    String
  userId    String
  emoji     String   // Unicode emoji — e.g. "😂", "🔥", "❤️"
  createdAt DateTime @default(now())

  room Room @relation(fields: [roomId], references: [id], onDelete: Cascade)
  user User @relation(fields: [userId], references: [id])

  @@index([roomId, createdAt])
}
```

**Field Notes:**
- Reactions are NOT fetched on room join — they're ephemeral display-only in real time
- The floating animation over the video is entirely client-side; the DB record is an analytics log
- Rate limiting enforced at the Socket/API layer via Redis (not DB constraints)
- Stored data enables: most-used emoji per room, engagement heatmaps by timestamp, reaction peaks during playback (useful feature later — "everyone reacted at 1:23:45")

---

## Model 9 — VideoQueue

**Purpose:** The rolling ordered playlist for a room. Cap of 33 items enforced in the API layer. Supports shuffle, loop, and per-member contribution tracking. YouTube-only in MVP with upload hooks ready.

```prisma
model VideoQueue {
  id           String          @id @default(cuid())
  roomId       String
  addedById    String
  type         VideoSourceType @default(YOUTUBE)
  url          String?         // YouTube URL (MVP) or external stream URL
  storagePath  String?         // Future: Supabase Storage path for user uploads
  title        String
  thumbnailUrl String?
  durationSecs Int?            // Fetched from YouTube Data API, cached here for UI display
  position     Int             // Queue order (0-indexed); updated on reorder/shuffle
  hasPlayed    Boolean         @default(false)  // Marked true when playback begins
  playedAt     DateTime?       // Timestamp when this item started playing
  createdAt    DateTime        @default(now())

  room    Room @relation(fields: [roomId], references: [id], onDelete: Cascade)
  addedBy User @relation(fields: [addedById], references: [id])

  @@index([roomId, position])  // Fast queue order fetch
  @@index([roomId, hasPlayed]) // Fast "what's been played / what's next" queries
}

enum VideoSourceType {
  YOUTUBE   // YouTube IFrame API — active in MVP
  UPLOAD    // User-uploaded file — INACTIVE, feature-flagged off, schema ready
  EXTERNAL  // Reserved for future direct stream URLs
}
```

**Field Notes:**
- **Queue cap of 33** is enforced in the API layer (`lib/config.ts` constant `QUEUE_MAX_SIZE = 33`) — not a DB constraint, so it's trivial to adjust
- `hasPlayed` + `playedAt` together power: play history display, loop detection (all items played = trigger loop), and session analytics
- **Shuffle:** Randomizes `position` values across all items in the queue — a single bulk update query
- **Loop queue:** When all items have `hasPlayed = true`, the server resets all `hasPlayed` to false and restarts from position 0. If `shuffleEnabled` is true on the room, positions are reshuffled first
- **Loop single:** Handled in the Socket.io sync layer — when current video ends, server re-emits `video:play` for the same queue item without advancing position
- `storagePath` is nullable — populated only when `type = UPLOAD` (future). `url` and `storagePath` are mutually exclusive
- **Rolling queue:** Users can add/remove items at any time during the session as long as total count ≤ 33. `videoContribCount` on `RoomMember` enforces per-member limits

---

## Model 10 — Subscription

**Purpose:** Tracks a user's Stripe subscription. One record per user — created on first billing interaction, updated via Stripe webhooks. Source of truth for tier enforcement.

```prisma
model Subscription {
  id                   String             @id @default(cuid())
  userId               String             @unique
  stripeCustomerId     String             @unique
  stripeSubscriptionId String?            @unique
  stripePriceId        String?
  tier                 UserTier           @default(FREE)
  status               SubscriptionStatus @default(ACTIVE)
  currentPeriodStart   DateTime?
  currentPeriodEnd     DateTime?
  cancelAtPeriodEnd    Boolean            @default(false)
  createdAt            DateTime           @default(now())
  updatedAt            DateTime           @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([stripeCustomerId])
  @@index([stripeSubscriptionId])
}

enum SubscriptionStatus {
  ACTIVE      // Paid and current
  PAST_DUE    // Payment failed — grace period active
  CANCELED    // Subscription ended
  TRIALING    // On a free trial (future use)
  INCOMPLETE  // Stripe payment pending confirmation
}
```

**Field Notes:**
- A `Subscription` record is created for every user on first billing interaction — even free users get a `stripeCustomerId` so upgrading doesn't require creating a new Stripe customer
- `cancelAtPeriodEnd: true` means the subscription stays `ACTIVE` until `currentPeriodEnd`, then flips to `CANCELED` via webhook
- `stripePriceId` stores which Stripe Price the user is on — supports multiple premium tier price points in the future
- `User.tier` is a denormalized fast-read copy of `Subscription.tier` — updated by Stripe webhook handler so we don't hit Stripe on every auth check

---

## Model 11 — AdImpression

**Purpose:** Append-only log of ad impressions and clicks for free tier users. Powers reporting for ad network integration and future direct ad deals.

```prisma
model AdImpression {
  id        String   @id @default(cuid())
  userId    String?  // Nullable — future-proofed for guest users (post-MVP)
  slot      AdSlot
  adId      String   // Ad unit ID — AdSense unit or internal ID for direct deals
  clicked   Boolean  @default(false)
  roomId    String?  // Room context if impression occurred during a session
  createdAt DateTime @default(now())

  user User? @relation(fields: [userId], references: [id], onDelete: SetNull)

  @@index([userId])
  @@index([slot, createdAt])
  @@index([adId])
}

enum AdSlot {
  PRE_SESSION   // Full-screen interstitial before a room session starts
  SIDEBAR       // Banner ad in the chat panel during viewing
  POST_SESSION  // Shown after a room session ends
}
```

**Field Notes:**
- `userId` is nullable — ready for when guest access is introduced post-MVP
- `adId` references whatever ad network is active — swapping ad providers requires no schema change
- `roomId` replaces `sessionId` for clarity — links impressions to a specific room session
- This table is **append-only** — impressions are never updated or deleted; analytics reads from it
- `onDelete: SetNull` — if a user deletes their account, impression logs are anonymized but retained for billing/reporting accuracy

---

## Full Compiled Schema

```prisma
// prisma/schema.prisma
// Watch Party — Database Schema
// Last updated: 2026-05-26
// DO NOT edit manually — use `prisma migrate dev` to apply changes

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL") // Required by Supabase for migrations
}

// ─────────────────────────────────────────────
// ENUMS
// ─────────────────────────────────────────────

enum UserTier {
  FREE
  PREMIUM
}

enum RoomStatus {
  WAITING
  ACTIVE
  PAUSED
  ENDED
}

enum RoomTheme {
  DARK_CINEMA  // Default — all tiers
  NEON_NIGHT   // Premium only
  RETRO_DRIVE  // Premium only
  MINIMAL      // Premium only
}

enum RoomMemberRole {
  HOST
  CO_HOST  // INACTIVE IN MVP — future premium feature
  VIEWER
}

enum MemberStatus {
  ACTIVE
  LEFT
  KICKED
  BANNED
}

enum MessageType {
  TEXT
  REACTION
  SYSTEM
  GIPHY  // Future
}

enum VideoSourceType {
  YOUTUBE   // Active in MVP
  UPLOAD    // INACTIVE IN MVP — feature-flagged off, schema ready
  EXTERNAL  // Reserved for future
}

enum SubscriptionStatus {
  ACTIVE
  PAST_DUE
  CANCELED
  TRIALING
  INCOMPLETE
}

enum AdSlot {
  PRE_SESSION
  SIDEBAR
  POST_SESSION
}

// ─────────────────────────────────────────────
// AUTH MODELS (NextAuth)
// ─────────────────────────────────────────────

model User {
  id            String   @id @default(cuid())
  email         String   @unique
  emailVerified DateTime?
  displayName   String
  avatarUrl     String?
  bio           String?
  tier          UserTier @default(FREE)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  accounts      Account[]
  sessions      Session[]
  hostedRooms   Room[]         @relation("RoomHost")
  memberships   RoomMember[]
  messages      Message[]
  reactions     Reaction[]
  videoQueue    VideoQueue[]
  subscription  Subscription?
  adImpressions AdImpression[]

  @@index([email])
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@index([userId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}

// ─────────────────────────────────────────────
// CORE APP MODELS
// ─────────────────────────────────────────────

model Room {
  id                      String     @id @default(cuid())
  joinCode                String     @unique
  name                    String
  description             String?
  hostId                  String
  theme                   RoomTheme  @default(DARK_CINEMA)
  status                  RoomStatus @default(WAITING)
  capacity                Int        @default(10)

  // Privacy
  isPrivate               Boolean    @default(false)
  password                String?

  // Communication toggles
  chatEnabled             Boolean    @default(true)
  voiceEnabled            Boolean    @default(true)
  reactionsEnabled        Boolean    @default(true)

  // Queue settings
  memberContributionLimit Int        @default(2)
  loopQueue               Boolean    @default(false)
  loopSingle              Boolean    @default(false)
  shuffleEnabled          Boolean    @default(false)

  createdAt               DateTime   @default(now())
  updatedAt               DateTime   @updatedAt
  closedAt                DateTime?

  host       User         @relation("RoomHost", fields: [hostId], references: [id])
  members    RoomMember[]
  messages   Message[]
  reactions  Reaction[]
  videoQueue VideoQueue[]

  @@index([joinCode])
  @@index([hostId])
  @@index([status])
  @@index([isPrivate, status])
}

model RoomMember {
  id                String         @id @default(cuid())
  roomId            String
  userId            String
  role              RoomMemberRole @default(VIEWER)
  status            MemberStatus   @default(ACTIVE)
  isMicMuted        Boolean        @default(false)
  isChatRestricted  Boolean        @default(false)
  isViewOnly        Boolean        @default(false)
  videoContribCount Int            @default(0)
  joinedAt          DateTime       @default(now())
  leftAt            DateTime?

  room Room @relation(fields: [roomId], references: [id], onDelete: Cascade)
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([roomId, userId])
  @@index([roomId])
  @@index([userId])
}

model Message {
  id        String      @id @default(cuid())
  roomId    String
  userId    String
  content   String      @db.Text
  type      MessageType @default(TEXT)
  createdAt DateTime    @default(now())
  deletedAt DateTime?

  room Room @relation(fields: [roomId], references: [id], onDelete: Cascade)
  user User @relation(fields: [userId], references: [id])

  @@index([roomId, createdAt])
  @@index([userId])
}

model Reaction {
  id        String   @id @default(cuid())
  roomId    String
  userId    String
  emoji     String
  createdAt DateTime @default(now())

  room Room @relation(fields: [roomId], references: [id], onDelete: Cascade)
  user User @relation(fields: [userId], references: [id])

  @@index([roomId, createdAt])
}

model VideoQueue {
  id           String          @id @default(cuid())
  roomId       String
  addedById    String
  type         VideoSourceType @default(YOUTUBE)
  url          String?
  storagePath  String?
  title        String
  thumbnailUrl String?
  durationSecs Int?
  position     Int
  hasPlayed    Boolean         @default(false)
  playedAt     DateTime?
  createdAt    DateTime        @default(now())

  room    Room @relation(fields: [roomId], references: [id], onDelete: Cascade)
  addedBy User @relation(fields: [addedById], references: [id])

  @@index([roomId, position])
  @@index([roomId, hasPlayed])
}

// ─────────────────────────────────────────────
// MONETIZATION MODELS
// ─────────────────────────────────────────────

model Subscription {
  id                   String             @id @default(cuid())
  userId               String             @unique
  stripeCustomerId     String             @unique
  stripeSubscriptionId String?            @unique
  stripePriceId        String?
  tier                 UserTier           @default(FREE)
  status               SubscriptionStatus @default(ACTIVE)
  currentPeriodStart   DateTime?
  currentPeriodEnd     DateTime?
  cancelAtPeriodEnd    Boolean            @default(false)
  createdAt            DateTime           @default(now())
  updatedAt            DateTime           @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([stripeCustomerId])
  @@index([stripeSubscriptionId])
}

model AdImpression {
  id        String   @id @default(cuid())
  userId    String?
  slot      AdSlot
  adId      String
  clicked   Boolean  @default(false)
  roomId    String?
  createdAt DateTime @default(now())

  user User? @relation(fields: [userId], references: [id], onDelete: SetNull)

  @@index([userId])
  @@index([slot, createdAt])
  @@index([adId])
}
```

---

## Entity Relationship Summary

```
User
 ├── Account (1:many)        — OAuth providers linked to the user
 ├── Session (1:many)        — Active login sessions
 ├── Room (1:many)           — Rooms the user hosts
 ├── RoomMember (1:many)     — Rooms the user has joined
 ├── Message (1:many)        — Chat messages sent
 ├── Reaction (1:many)       — Emoji reactions sent
 ├── VideoQueue (1:many)     — Videos added to queues
 ├── Subscription (1:1)      — Billing and tier record
 └── AdImpression (1:many)   — Ad interaction log

Room
 ├── RoomMember (1:many)     — All members (past + present + banned)
 ├── Message (1:many)        — Chat history (48hr retention)
 ├── Reaction (1:many)       — Emoji reaction log
 └── VideoQueue (1:many)     — Rolling ordered video playlist (cap: 33)
```

---

## Config Constants (lib/config.ts — Phase 1)

These values live in code, not the database. Changing them requires no migration.

```typescript
export const QUEUE_MAX_SIZE = 33           // Max videos in a room queue
export const MEMBER_CONTRIB_DEFAULT = 2    // Default videos per member
export const MEMBER_CONTRIB_MAX = 5        // Host can set up to this value
export const MESSAGE_RETENTION_HOURS = 48  // Chat auto-purge window
export const FREE_ROOM_CAPACITY = 10       // Max viewers on free tier
export const PREMIUM_ROOM_CAPACITY = 100   // Max viewers on premium tier
export const JOIN_CODE_LENGTH = 8          // nanoid character count
```

---

## Next Step → Phase 1: Foundation

Schema approved. Phase 1 begins:
1. Scaffold Next.js 14 project with TypeScript + Tailwind
2. Create `lib/config.ts` with all constants above
3. Wire in Prisma with this schema against Supabase
4. Set up NextAuth.js (Google OAuth + email/password)
5. Establish full folder structure from PLAN.md
6. Create `.env.example` with all required variables documented
7. Set up GitHub Actions CI (lint + typecheck)
