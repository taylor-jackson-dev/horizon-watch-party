# Phase 4 — Social & Communication

> **Status:** 4.1 (chat) + 4.2 (reactions) + 4.3 (voice) complete; 4.4 (avatars) deferred
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

---

## 4.3 — LiveKit voice chat

Opt-in WebRTC voice via LiveKit Cloud, scoped one LiveKit room per Watch Party room. Server-issued short-lived tokens; client connects only when the user clicks Join voice. Push-to-talk is the default mode (no surprise hot-mic on first connect), with an Open mic toggle for live groups.

### Wire contract

**Token issuance — `POST /api/livekit/token`**

```ts
// Request
{ roomId: string }

// Response (200)
{
  token: string;      // JWT (TTL = LIVEKIT_TOKEN_TTL_SECONDS = 3600)
  url: string;        // LIVEKIT_URL — returned per-request so no NEXT_PUBLIC_ var
  identity: string;   // == userId
  roomName: string;   // "wp_<roomId>"
}
```

Returned in-band so the LiveKit URL never enters the client bundle.

**Server gates (in order)**

1. NextAuth session (`requireUser`)
2. `roomMember.status === "ACTIVE"` (also rejects BANNED with `403`)
3. `!isViewOnly` — view-only members get no token at all
4. `room.voiceEnabled` — host-level feature gate
5. Token built with `canPublish = !isMicMuted` — muted members get a subscribe-only token, the server is the enforcer

### Architecture — intent vs effect

The hook (`lib/use-voice-room.ts`) wraps `livekit-client`'s `Room` and exposes user *intent* (mode + open-mic toggle + PTT held state); a single `useEffect` reconciles that to LiveKit's publish state via `localParticipant.setMicrophoneEnabled()`. Effect runs only while `status === "connected"`, so we never try to enable the mic while disconnected.

```
effectiveMicEnabled =
  status === "connected" &&
  (mode === "ptt" ? pttActive : openMicEnabled)
```

This collapses three independent inputs (mode, open toggle, PTT key/button) into one truth, and pushing it through a single effect means no race between mode flips and key events.

### PTT mechanics

- Default key: **V** (avoids YouTube's spacebar play/pause conflict)
- Listener registers at the window level **only** when `mode === "ptt"` and `status === "connected"` — automatically cleaned up on mode/status changes
- `isEditableTarget` guard blocks PTT from firing while focus is in `<input>`, `<textarea>`, or contenteditable (so typing a `V` in chat doesn't transmit voice)
- `window.blur` listener safety-releases — if user alt-tabs while holding V, mic doesn't hang open
- `e.repeat` filter on keydown prevents the OS auto-repeat from spamming state
- Click-and-hold on-screen button mirrors the key: `pressPtt`/`releasePtt` handlers on `pointerdown`/`pointerup`/`pointerleave`/`pointercancel` so a drag-off-button also releases cleanly

### Remote audio sink

A single hidden `<div id="wp-voice-audio-sink">` is appended to `<body>` once per hook lifetime. Remote `RemoteAudioTrack`s are `attach()`ed (creating `<audio>` elements) and appended to the sink; `detach()` on `TrackUnsubscribed`/`Disconnected` prevents zombie elements from accumulating across reconnects.

### Mic permission pre-prompt

Before `room.connect()`, we do a throwaway `navigator.mediaDevices.getUserMedia({ audio: true })` and immediately stop the track. The browser permission prompt appears at the *moment the user clicks "Join voice"* — not later when they first press PTT. Failure is non-fatal: a denial means publish will silently fail later, but subscribe still works (you can listen even if you can't speak).

### Decisions locked

- **One LiveKit room per Watch Party room, namespaced "wp_<roomId>".** Avoids collisions if we ever share a LiveKit project across environments.
- **No NEXT_PUBLIC_LIVEKIT_URL.** URL ships in the token response. One less client env var, one less leak vector.
- **Default mode = PTT.** Safer first-time UX. Open mic is one click away.
- **Default PTT key = `V`.** Discord convention; no spacebar collision. No settings UI in MVP — change later.
- **Opt-in join.** Users click Join voice; we don't auto-connect on room entry. Avoids surprise permission prompts and bandwidth.
- **`canPublish` baked into the token, not enforced client-side.** A user can't grant themselves publish rights by tampering with the UI — the server is the only authority.
- **Roll-your-own thin layer over `livekit-client`.** Skipped `@livekit/components-react`; tighter integration with the existing dark cinema theme and ~150kB lighter.
- **Voice panel goes above chat in the sidebar.** Same column as chat for desktop; stacks naturally on mobile.

### Files

| File | Role |
|---|---|
| `lib/livekit.ts` | **new** — server-only `createVoiceToken` + `liveKitRoomName` (`wp_<roomId>`). `"server-only"` import enforces the boundary at build time. |
| `lib/validations/voice.ts` | **new** — `voiceTokenRequestSchema` (zod) |
| `app/api/livekit/token/route.ts` | **new** — POST endpoint, all 5 gates above |
| `lib/use-voice-room.ts` | **new** — React hook wrapping `Room` lifecycle. Intent → effect reconciliation; PTT key listener; remote audio attachment; cleanup on unmount |
| `components/room/VoicePanel.tsx` | **new** — Mode toggle, Join/Leave, Hold-to-talk button or Mic toggle, participant list with speaking ring; disabled shells for `!voiceEnabled` and `isViewOnly` |
| `components/room/RoomShell.tsx` | Mounts `VoicePanel` above `ChatPanel` in the sidebar; aside became a flex column to accommodate both |
| `app/room/[code]/page.tsx` | Selects `isMicMuted` + `isViewOnly` in the membership query; threads `voiceEnabled`, `isMicMuted`, `isViewOnly` to `RoomShell` |
| `package.json` | Added `livekit-server-sdk@2.15` + `livekit-client@2.19` |

### Deferred

- **Host force-mute / kick from voice** — requires LiveKit Admin API calls (RoomService). Schema flag (`isMicMuted`) is honored on token issuance, but there's no UI yet to flip it for someone else. Likely lands with the broader moderation UI (Phase 8).
- **Audio device picker** — no UI to choose mic/speaker yet. Browser default is used.
- **Volume sliders per participant** — out of scope.
- **Noise suppression / echo cancellation toggle** — LiveKit/Chrome defaults are on; no UI to flip.
- **PTT key rebind UI** — hardcoded V. Lives in `PTT_KEY` constant for now.
- **E2EE (DAVE-style)** — explicitly discussed and deferred. LiveKit's opt-in E2EE remains a future path if the threat model ever calls for it; PLAN's target audience (small-group viewing parties) doesn't warrant the build cost.

### Verification

- `npm run lint` — clean
- `npm run typecheck` — clean
- Solo connect: Join voice → mic permission prompt → "Connected · 1 in voice". Mode toggle works. Leave disconnects cleanly. No console errors.
- Negative gates spot-checked: `LIVEKIT_API_KEY=your-livekit-api-key` (placeholder) → "invalid API key" surfaces in the panel correctly (caught during setup; see Problems below)
- **Two-party ear test deferred to a real session with multiple users** — scheduled for the next session (2026-05-29) with the user's friends. All wire-level signals (connection, participant list updates, speaking-ring state) work; only the actual audio path is unverified.

### Problems hit + resolutions

- **"could not establish signal connection: invalid API key" on first Join voice attempt.** Root cause: `.env.local` still contained the `.env.example` placeholder values (`LIVEKIT_URL="wss://your-project.livekit.cloud"` etc.) — the file had never been edited since project init. Diagnosed without exposing secrets by reading just the value lengths and prefixes from the file. Resolved by populating `.env.local` with real Cloud project credentials and restarting `npm run dev:web` (env is only read at process start).
- **Secret leaked through chat.** During setup the user pasted live API credentials directly into the conversation. Flagged immediately, recommended rotation. Going forward: shape-probe (length + prefix) is sufficient to verify env vars are populated correctly without ever needing the value in chat.
- **macOS Finder hides `.env.local`.** Files starting with `.` are hidden by default; ⌘⇧. toggles visibility. Documenting this pattern because it'll bite the same way when adding new env vars.

---

## Phase 4.4 polish backlog

Found during the 2026-05-29 pre-friends-test readiness pass. Not show-stoppers; defer to Phase 4.4 cleanup:

- **Active-member count is membership-based, not presence-based.** `room._count.members where status === "ACTIVE"` reflects the `RoomMember` row, which stays ACTIVE after a user closes the tab / navigates away. The displayed count goes stale until someone explicitly leaves (the `/api/rooms/[id]/leave` endpoint exists but the `← Back to dashboard` link doesn't call it). Fix shape: socket-driven presence (server tracks currently-connected userIds per room, emits a `room:presence` event; client renders that instead of the SSR count). Membership rows stay for history; presence is the live count.
