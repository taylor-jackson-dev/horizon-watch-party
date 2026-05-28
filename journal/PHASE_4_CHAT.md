# Phase 4 — Social & Communication

> **Status:** 4.1 (chat) + 4.2 (reactions) complete; 4.3 (voice), 4.4 (avatars) deferred
> **Dates:** 2026-05-27 → 2026-05-28

## Goal

Layered on top of Phase 3's working sync engine, give viewers a way to actually *be* in the room together. Phase 4 covers text chat, emoji reactions, voice, and richer presence. This journal documents 4.1 — real-time text chat — and is intended to grow as later sub-phases ship.

---

## 4.1 — Real-time text chat

Persistent, server-authoritative text chat over the existing socket connection. Soft-deletion already modeled in the schema; moderation tooling deferred.

### Wire contract

**Client → server**

```ts
socket.emit("chat:send", { roomId, content }, (ack: { ok: boolean; error?: string }) => { ... });
```

**Server → all clients in room (including sender)**

```ts
socket.on("chat:message", (m: {
  id: string;
  roomId: string;
  userId: string;
  userDisplayName: string;
  userAvatarUrl: string | null;
  content: string;
  type: "TEXT" | "REACTION" | "SYSTEM" | "GIPHY";
  createdAt: string; // ISO
}) => { ... });
```

The sender receives the same canonical `chat:message` broadcast everyone else does — no optimistic UI / reconcile dance. Trade-off: there's a tiny perceived send latency. Worth it for state-machine simplicity (one path renders every message).

### History

`GET /api/rooms/[id]/messages?limit=50&before=<ISO>` — ascending chronological order so the client can append. Cursor pagination by `createdAt`. Includes soft-deleted rows with `deletedAt` set; client renders `[deleted]` for those.

### Server validation gates (in order)

1. Payload shape (`roomId` present, `content` non-empty after trim, ≤ `MESSAGE_MAX_LENGTH=500`)
2. Socket has actually joined the room channel (`s.data.rooms.has(roomChannel(roomId))`)
3. In-memory rate limit: **5 messages / 5s / (user, room)** — sliding window
4. DB membership lookup: `status === "ACTIVE"`, `room.chatEnabled`, `!isChatRestricted`

Persist → broadcast → ack. If any gate fails, ack returns `{ ok: false, error }` and nothing is persisted or broadcast.

### Rate limiter

In-memory `Map<"${userId}:${roomId}", number[]>` of recent send timestamps. Each request drops entries older than the window, checks count, appends and writes back. Memory bounded by active senders; no cleanup sweeper yet — fine until we scale horizontally (then the Redis-backed `CHAT_RATE_LIMIT_PER_MINUTE` config kicks in).

### Files

| File | Role |
|---|---|
| `lib/validations/chat.ts` | `chatSendSchema`, `messageHistoryQuerySchema` (zod) |
| `server/socket-server.ts` | `chat:send` handler, `checkChatRateLimit` helper |
| `app/api/rooms/[id]/messages/route.ts` | GET paginated history |
| `components/room/ChatPanel.tsx` | Client component — history fetch, live subscription, send form |
| `components/room/RoomShell.tsx` | Two-column layout (main / chat sidebar) |
| `app/room/[code]/page.tsx` | Wires `chatEnabled` from Room + `isChatRestricted` from RoomMember |

### Decisions locked

- **Broadcast includes sender.** Simpler client state machine; tolerable latency.
- **History is read-on-join, not pushed.** Live socket only carries new messages; initial state comes from REST. Easier caching/CDN story long-term.
- **Soft-delete content stays in the payload.** Server returns `deletedAt`; client renders placeholder. Trivially flippable once moderation lands.
- **`displayName` and `avatarUrl` denormalized into the broadcast payload.** Saves the client an N+1 user lookup per render. If a user renames mid-session, old messages keep the old name — acceptable.
- **Rate limit is per (user, room), not per user globally.** A user chatting in multiple rooms isn't throttled across them. Matches mental model.
- **`chatEnabled` and `isChatRestricted` are checked server-side AND surfaced client-side.** Client uses them to gray out the input; server is the actual enforcer.
- **Layout: right-sidebar full height on lg+, stacked below player on mobile.** Page width bumped from `max-w-3xl` to `max-w-6xl`; chat sidebar fixed at 300px after a side-by-side tune-down from 360 → 320 → 300 (tested live with the host).

### Deferred

- **Moderation UI** — delete-own-message, host delete-any, user mute, persistent ban. Schema is ready (`deletedAt`, `isChatRestricted`); UI/endpoints come later.
- **`@mention` support, link previews, emoji picker.** Plain text only in 4.1.
- **Retention cron** — `MESSAGE_RETENTION_HOURS=48` already declared in config; the nightly purge job is post-MVP.
- **Pagination UI** — "Load older" scroll-up trigger. API supports it via `before` cursor; the client only does initial 50 for now.
- **Read receipts / unread badges** — not modeled.

### Verification

- `npm run lint` — clean
- `npm run typecheck` — clean
- Two-window manual test against existing dev server (host + `?asViewer=1`): host sends a message, both windows render it with avatar + display name + relative time. Viewer can send too. Rate limit kicks in after 5 rapid sends.
- Disable chat at the room level (post-MVP UI; verified by toggling `chatEnabled=false` in Prisma Studio): textarea greys out, "Disabled by host" label appears in panel header, server rejects sends with the right error.

### What this enables

Phase 4.2 (animated emoji reactions over the player) plugs into the same socket and `chat:message` shape with `type: "REACTION"`. Phase 4.3 (LiveKit voice) gets its own connection but reuses the room-membership gate. Phase 4.4 (user avatars / profile editor) replaces the OAuth-derived `avatarUrl` already flowing through chat.

---

## 4.2 — Animated emoji reactions

Twitch-style emoji reactions that float up across the player canvas. Ephemeral visual; cheap fire-and-forget DB write for future analytics. Works inline AND in fullscreen.

> Note on the schema split: the existing `Reaction` model is for **video overlay** reactions (this feature). The separate `MessageType.REACTION` enum value is for *chat-panel* emoji-as-message — explicitly distinct per its schema comment. 4.2 uses the `Reaction` table only.

### Wire contract

**Client → server**

```ts
socket.emit("reaction:send", { roomId, emoji }, (ack: { ok: boolean; error?: string }) => { ... });
```

**Server → all clients in room (including sender)**

```ts
socket.on("reaction:burst", (r: {
  id: string;           // server-generated animation key (not a record id)
  roomId: string;
  userId: string;
  userDisplayName: string;
  emoji: string;
  createdAt: string;    // ISO
}) => { ... });
```

The sender receives the same broadcast — single render path, just like chat.

### Server validation gates (in order)

1. Payload shape (`roomId` present, `emoji` in allowlist)
2. Socket has actually joined the room channel
3. In-memory rate limit: **10 reactions / 5s / (user, room)** — sliding window, looser than chat because reactions are inherently spammy
4. DB membership lookup: `status === "ACTIVE"`, `room.reactionsEnabled`
5. **Broadcast immediately**, then persist `Reaction` row fire-and-forget. Differs from chat (which is persist-then-broadcast) because the overlay is the artifact — there's no canonical id the client needs to reconcile against.

### Emoji set — fixed allowlist

```
👍 ❤️ 😂 😮 😢 🔥 👏 🎉
```

Centralised in `lib/validations/reactions.ts` as `ALLOWED_REACTION_EMOJIS`. Server rejects anything not in this set. Bounded UI surface; blocks zalgo/skin-tone storms; cheap to expand later.

### Animation — float up + accelerate + fade

CSS keyframe `wp-react-float`, 2800ms, `linear` timing (with non-uniform keyframe spacing for the acceleration feel — easier to tune than a bezier).

Visual profile, tuned across three iterations of live feedback:

| Phase | Time | Distance | Opacity | Scale |
|---|---|---|---|---|
| Pop-in (small, slow) | 0–25% | 0 → -35 px | 0 → 0.8 | 0.4 → 1.0 |
| Slow rise | 25–50% | -35 → -130 px | 0.8 → 0.55 | 1.0 |
| Faster rise | 50–75% | -130 → -290 px | 0.55 → 0.25 | 1.0 |
| Final acceleration | 75–87% | -290 → -420 px | 0.25 → 0 | 1.0 |
| Invisible exit | 87–100% | -420 → -560 px | 0 | 1.0 |

Each reaction gets two random horizontal-wobble offsets (`--wp-react-x0`, `--wp-react-x1`) injected as CSS custom properties so the path looks organic, not on rails.

`onAnimationEnd` removes the entry from local state — no setInterval sweeper. `MAX_LIVE_REACTIONS = 50` caps DOM growth from pathological bursts.

### Fullscreen — the wrapper, not the iframe

The hard part. YouTube's native fullscreen button fullscreens just the `<iframe>` element, which means **our overlay (a sibling div) gets hidden behind it** and reactions vanish.

Fix:
- `playerVars.fs = 0` — hides YouTube's native FS button so users only see one path
- New "stage" wrapper div (`wp-player-stage`) holds the iframe + overlay + picker + our own FS button
- Our FS button calls `wrapperRef.current.requestFullscreen()` (with webkit prefix fallback) on the stage, not the iframe
- `:fullscreen` CSS drops the 16:9 frame constraint so the iframe fills the screen edge-to-edge; YouTube handles its own letterboxing inside
- Overlay (`absolute inset-0`) automatically expands to cover the fullscreen stage; picker stays at `bottom-3 right-3` of the new viewport

**Known limitation:** iOS Safari doesn't support the standard Fullscreen API on non-video elements. Our button is a no-op there. Mobile is Phase 7 — likely solved with a CSS-only theater mode for iOS.

### Files

| File | Role |
|---|---|
| `lib/validations/reactions.ts` | **new** — `ALLOWED_REACTION_EMOJIS`, `reactionSendSchema` (zod), `isAllowedReactionEmoji` |
| `server/socket-server.ts` | `reaction:send` handler + `checkReactionRateLimit` helper |
| `components/room/ReactionOverlay.tsx` | **new** — subscribes to `reaction:burst`, renders floating emoji spans, GC via `onAnimationEnd` |
| `components/room/ReactionPicker.tsx` | **new** — floating bottom-right button → expands emoji strip; emits `reaction:send`; outside-click closes; transient inline error toast |
| `components/room/RoomShell.tsx` | Wraps `VideoPlayer` in `wp-player-stage`; mounts overlay + picker + fullscreen button as siblings; owns FS toggle state and `fullscreenchange` listener |
| `components/room/VideoPlayer.tsx` | `fs: 0` in playerVars; added `wp-player-frame` class for `:fullscreen` CSS hook |
| `app/room/[code]/page.tsx` | Threads `room.reactionsEnabled` to `RoomShell` |
| `lib/youtube-iframe.ts` | Added `fs` to the `playerVars` type |
| `app/globals.css` | `@keyframes wp-react-float` + `.wp-react-float` utility + `:fullscreen` overrides for `.wp-player-stage` / `.wp-player-frame` |

### Decisions locked

- **Reactions are ephemeral; the DB row is for analytics, not state.** Server broadcasts then persists fire-and-forget. Late joiners do NOT see a backlog of recent reactions — they only see what happens after they joined.
- **Fixed 8-emoji allowlist, server-enforced.** No free emoji input. Small picker; bounded abuse surface.
- **Floating button picker, not an always-visible strip.** Keeps the player area clean during viewing.
- **Host-level `reactionsEnabled` toggle only.** No per-member `isReactionRestricted` flag in the schema yet — deferred. Hosts can disable for the whole room; that's enough until moderation lands.
- **Acceleration via keyframe spacing + `linear` timing**, not a bezier curve. Easier to read and tune from the keyframes alone.
- **Full transparency by 87% of animation time** (which is 3/4 of the visual rise distance, since motion accelerates). The remaining 13% is an invisible drift to ensure the animation cleanly exits even if the screen is unusually tall.
- **Custom fullscreen button instead of YouTube's native one.** Without this the overlay is hidden behind the iframe in fullscreen. Single, predictable path.

### Deferred

- **Mobile fullscreen on iOS.** Standard Fullscreen API not supported on non-video elements. Solve in Phase 7 with a CSS-only theater mode.
- **Per-member reaction restriction.** No `RoomMember.isReactionRestricted` flag yet. Add alongside the chat moderation UI when that lands.
- **Custom emoji / `MessageType.REACTION` chat messages.** Out of scope; the schema reserves the slot.
- **Late-joiner reaction backlog.** Not modeled — would defeat the "ephemeral overlay" UX.

### Problems hit + resolutions

- **YouTube's native fullscreen breaks the overlay.** The iframe goes fullscreen alone, hiding our sibling overlay. Resolved with a custom stage-level fullscreen button and `playerVars.fs = 0`.
- **Local YT type def missing `fs`.** Added `fs?: 0 | 1` to `playerVars` in `lib/youtube-iframe.ts`.
- **Animation iterated three times.** First pass was too aggressive on opacity (held near 1 until 75%), then too uniform on motion (linear distance), then transparency completed too late. Final tuning: small slow pop-in, accelerating distance, transparency complete at 87% time / 3/4 distance.

### Verification

- `npm run lint` — clean
- `npm run typecheck` — clean
- Two-window manual test (host + `?asViewer=1`): emoji sent from one window floats up on both; sender sees their own. Picker outside-click closes. Spam-clicking past 10 in 5s triggers "Slow down" toast. Fullscreen button enters/exits stage fullscreen; reactions render correctly in both modes.
- `room.reactionsEnabled = false` (via Prisma Studio) → picker button disables with "Reactions disabled by host" title; server rejects bypass attempts.
