# Phase 3 — Video Playback Sync

> **Status:** Complete
> **Commits:** `744045a` (3.1) → `cb050ae` (3.1.1) → `0931f8a` (3.2) → `ea90b90` (3.3a) → `3ed5a83` (3.3b)
> **Dates:** 2026-05-27

## Goal

Synchronized video playback across multiple viewers in real time. Host drives, viewers follow within ~1 second. YouTube-only in MVP; queue lives in Postgres; sync state is server-authoritative.

The phase was split into five sub-chunks so each was independently testable.

---

## 3.1 — Queue API

REST endpoints on top of the `VideoQueue` Prisma model. YouTube-only for MVP; upload type stays in the schema but feature-flagged off.

### Endpoints

| Endpoint | Behavior |
|---|---|
| `GET /api/rooms/[id]/queue` | List queue items in position order (members only) |
| `POST /api/rooms/[id]/queue` | Add a YouTube video — 33-item cap (`QUEUE_MAX_SIZE`), per-member contrib limit, contribContext=0 means host-only curation |
| `DELETE /api/rooms/[id]/queue/[itemId]` | Host or original contributor; renumbers later positions; decrements contributor's `videoContribCount` |
| `PATCH /api/rooms/[id]/queue/[itemId]` | Host-only reorder; shifts affected positions in a transaction |

### Utilities

- `lib/youtube.ts` — `parseYouTubeVideoId(input)` handles all common URL forms (watch?v, youtu.be, embed/, shorts/, m.youtube.com, bare 11-char ID). 13 unit cases pass via tsx script.
- `lib/validations/queue.ts` — `addQueueItemSchema`, `reorderQueueItemSchema`

### Decisions

- **`videoContribCount` is currently-in-queue, not lifetime.** Decrement on delete so removing-and-adding works.
- **Append-to-end semantics.** New items get `position = max(position) + 1`.
- **Reorder algorithm:** if moving from A to B with B<A, items in `[B, A-1]` shift +1; opposite direction shifts -1. No unique constraint on `(roomId, position)` so a transaction with `updateMany` works cleanly.

---

## 3.1.1 — Queue UI

Small client component embedded on the room page so the queue API can be exercised visually.

- `components/room/QueuePanel.tsx` — paste URL → add; thumbnails from `i.ytimg.com` (already allow-listed in `next.config.mjs`); position numbers; 33-cap indicator; host-only ↑/↓ reorder; Remove (host or original contributor); "Already played" dim state
- The room page server-fetches initial items via Prisma so there's no client loading flash; the panel manages its own state for mutations

---

## 3.2 — Socket.io server skeleton

Custom Express + Socket.io server on port 3001. Authenticated via short-lived JWTs minted by Next. Per-room channels, host validated against the DB.

### Architecture decision

The PLAN.md called for a separate process. We picked that over a custom Next.js server because Vercel hosts Next as serverless; the socket server lives on Railway/Fly in production. Keeping them split locally mirrors production.

### Token flow

1. Client `POST /api/socket/token` — authenticated Next API route mints a 1-hour JWT (`jose` HS256, audience `watch-party-socket`, issuer `watch-party`) using the same `NEXTAUTH_SECRET`.
2. Client `io(socketUrl, { auth: { token } })` — Socket.io middleware verifies the token; rejects with `Auth failed: ...` if invalid.
3. Client emits `room:join { roomId }`. Server checks `RoomMember` row exists and isn't BANNED — token alone is not enough.

### Files

- `lib/socket-token.ts` — `signSocketToken`, `verifySocketToken` (shared by Next API route and the socket server)
- `app/api/socket/token/route.ts` — mint endpoint
- `server/socket-server.ts` — Express + Socket.io with auth middleware, `room:join` / `room:leave` handlers, `heartbeat` ack, peer-joined/left broadcasts, graceful SIGINT/SIGTERM shutdown
- `scripts/socket-smoke.ts` — 5-case smoke test (auth rejection, valid connect, heartbeat ack, bogus roomId rejection, real room join)

### Dev scripts

- `npm run dev:web` — Next only (port 3000)
- `npm run dev:socket` — socket server only (port 3001, `tsx watch`)
- `npm run dev:all` — both via `concurrently` with color-prefixed output

### Problem hit

**`ping` / `pong` are reserved by Engine.io** for transport-level heartbeats. My custom `socket.on("ping", ...)` handler never fired because Engine.io intercepted the event before reaching my handler. Renamed application event to `heartbeat`.

**Vararg trap on ack callbacks.** First `heartbeat` handler declared `(cb?: ...)` — but `socket.emit("heartbeat", undefined, cb)` passes two args, so my `cb` was actually receiving `undefined`. Switched to varargs and pull the function from the last arg: `(...args) => args[args.length - 1]`.

---

## 3.3a — YouTube player + client socket scaffolding

Player works locally; socket connection from the browser proven. No cross-viewer sync yet.

### Files

- `lib/youtube-iframe.ts` — singleton loader for the YouTube IFrame Player API + strict TS types (no `any`)
- `lib/use-room-socket.ts` — `useRoomSocket(roomId)` React hook: mint token → connect → `room:join`, with status/error state and best-effort cleanup on unmount
- `components/room/VideoPlayer.tsx` — `forwardRef` wrapper exposing imperative `play/pause/seek/getCurrentTime/getDuration/getPlayerState`. Uses `cueVideoById` / `loadVideoById` to swap videos without tearing down the iframe.
- `components/room/RoomShell.tsx` — orchestrator: owns queue state, current item, socket lifecycle; renders `VideoPlayer` + `QueuePanel` together; handles auto-advance, `loopSingle`, `loopQueue`.

### Decision

**YouTube IFrame Player API directly, not Video.js.** PLAN.md mentioned Video.js as a future cross-source player. For YouTube-only MVP the direct IFrame API is much lighter — Video.js wraps it and adds bundle weight we don't need yet.

### Refactor in this sub-phase

QueuePanel went from owning its own state (fetched, refreshed independently) to being a controlled component — RoomShell now owns `items` + `currentItemId` + `onChanged` callback. Player + queue stay in sync without prop drilling.

---

## 3.3b — Sync engine

Where it gets real. Host's actions broadcast to viewers; viewers apply with server-authoritative timing.

### Wire protocol

**One event, both directions:**

```ts
// client → server
socket.emit("video:state", { roomId, itemId, positionSecs, isPlaying })

// server → client (broadcast)
{ itemId, positionSecs, isPlaying, updatedAt /* server time ms */ }
```

The host emits on play, pause, seek, item change, and a 10s heartbeat during playback. The server:
1. Drops non-host emits silently (uses cached `Room.hostId`).
2. Stamps `updatedAt = Date.now()`.
3. Updates the per-room state cache (a `Map<roomId, VideoState>`).
4. If `itemId` changed, marks the previous item `hasPlayed = true, playedAt = now` in the DB (fire-and-forget).
5. Broadcasts to the room channel **excluding the sender**.

### Server-authoritative timing (deviation from PLAN.md §7)

PLAN.md proposed `targetTime = eventTime + (clientReceivedAt - serverSentAt) / 2`. That's half-RTT correction *between server and one client*, which doesn't help sync *across viewers*.

What we actually do: server stamps each state with `updatedAt`. Each client computes a `serverTimeSkewMs = clientNow - serverTimeFromJoinAck` once at join. When applying a state event, the viewer computes:

```ts
const elapsed = (Date.now() - serverTimeSkewMs) - state.updatedAt; // server frame ms
const effectivePos = state.isPlaying
  ? state.positionSecs + Math.max(0, elapsed) / 1000
  : state.positionSecs;
```

Then seek the player to `effectivePos`. All viewers compute the same target from the same authoritative state.

### Viewer apply strategy

- **Item change:** `setCurrentItemId(state.itemId)` + store `pendingRemoteState`. Drain when the player fires `CUED` (fast) or via a 1.5s fallback timer (safety net).
- **Same item:** compute `effectivePos`, but only `seekTo` when `drift > 2.5s` *and* the player isn't already `BUFFERING`. Smaller drift is tolerated (YouTube playback rate is stable; once in sync we stay in sync).
- **Heartbeat:** every 10s while host is playing. Mostly for new joiners / brief disconnects; not for fine-grained drift correction.

### Browser autoplay-policy workaround

Modern browsers refuse to start playback via `play()` without prior user interaction. The viewer in a passive tab never interacts, so play was silently rejected.

Fix: **viewer plays muted by default** (`mute: 1` in YT playerVars). Muted playback is exempt from the user-gesture rule. Viewer can click the unmute icon on the player itself to enable audio — that click also unlocks future programmatic plays for the page.

### Testing override

`?asViewer=1` URL parameter forces `isHost = false` in the room page. Lets us test viewer behavior in a second tab without needing a real second Google account. Server-side host validation is unaffected (it's based on socket auth claims), so the override is purely cosmetic on the client.

### Bugs found during the 2-window smoke test

1. **1s drift tolerance → seek loop.** Every 5s heartbeat re-seeked the viewer because YouTube's buffering lag put `localPos` ~1s behind `effectivePos`. Each seek restarted buffering → next heartbeat sees the lag again → loop. Raised tolerance to 2.5s and increased heartbeat to 10s.

2. **800ms blind timer for item-switch was wrong.** Sometimes the new video had cued in 200ms; sometimes still loading at 800ms. Replaced with: when the player transitions to YT's `CUED` state (5), drain pending state immediately. Kept the 1.5s timer as a fallback safety net.

3. **Browser autoplay block (described above).** Spent debugging time pursuing buffer/timing theories before the actual cause clicked. Muted viewer playback solved it.

4. **Initial-state useEffect re-fired on every state change → "phantom" item changes.** This was the nasty one. The viewer's "apply initial state on join" effect had `applyRemoteState` in its dep list. `applyRemoteState` was a `useCallback` with `currentItemId` in *its* deps, so it got a new identity every time the viewer switched items. That re-fired the initial-state effect, which re-applied the stale initial state — snapping the viewer back to whatever video was playing when they joined.

   Caught by adding the dbg log `applyRemoteState - {stateItemId, currentItemId}` and seeing every real switch followed by `{itemId: cmpoaugur (original), positionSecs: 0, isPlaying: false}` events that hadn't come from the host. Guarded with `initialStateAppliedRef` — applies exactly once per mount.

### Debug instrumentation

`localStorage.setItem("wp:debug", "1")` → console logs `handleSelect`, `emitState ->`, `applyRemoteState` (with stateItemId + currentItemId), player state transitions, item-change pending, and drain events. Kept in the code; cheap (string compare + localStorage read in handler hot paths only) and invaluable when sync misbehaves.

---

## Verification

- 5/5 socket smoke test cases pass (`npx dotenv -e .env.local -- tsx scripts/socket-smoke.ts`)
- Two-window browser test:
  - Window A (host): plays, pauses, seeks, switches items
  - Window B (`?asViewer=1`): mirrors all actions within ~1s, muted playback works, unmute click enables audio without breaking sync
  - Window B refresh mid-playback → joins room → catches up to current position via initial state in join ack
  - Switched item gets marked `hasPlayed=true, playedAt=NOW` in DB

## What this enables

Phase 4 (chat, reactions, voice) sits on the same socket plumbing. The room-channel + JWT auth + per-room state pattern transfers directly:

- **Chat:** `chat:message` event → server validates membership (not just host), persists to `Message`, broadcasts to room
- **Reactions:** `reaction:emoji` event → broadcast only (DB write is fire-and-forget analytics log), client renders floating emoji overlay
- **LiveKit voice:** different SFU entirely, but the JWT mint pattern from `lib/socket-token.ts` is the template — Phase 4 will add `lib/livekit-token.ts` for server-issued, room-scoped tokens

## Deferred from Phase 3

- **YouTube Data API integration** (titles, thumbnails, durations) — currently we accept a title from the client and derive a thumbnail URL from the video ID. Real metadata fetch waits for `YOUTUBE_API_KEY` and is tracked in `DEFERRED.md`.
- **Shuffle.** `Room.shuffleEnabled` exists in the schema but the loop logic doesn't shuffle on restart yet. Defer to Phase 4 or 5.
- **Proper "click to join" overlay for viewers.** Current UX leaves viewer controls enabled (so they can unmute). They can technically pause/seek locally; the next sync event snaps them back. A cleaner gated UX comes with Phase 5 UI polish.
