# Phase 4 — Social & Communication

> **Status:** 4.1 (chat) complete; 4.2 (reactions), 4.3 (voice), 4.4 (avatars) deferred
> **Dates:** 2026-05-27

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
