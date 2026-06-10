import { createServer } from "node:http";
import express from "express";
import { Server as IOServer, type Socket } from "socket.io";
import { prisma } from "@/lib/prisma";
import { verifySocketToken, type SocketTokenClaims } from "@/lib/socket-token";
import { MESSAGE_MAX_LENGTH } from "@/lib/config";
import { isAllowedReactionEmoji } from "@/lib/validations/reactions";

// Railway (and most PaaS hosts) inject the listen port as PORT; SOCKET_PORT is
// the local-dev override, 3001 the final fallback.
const PORT = Number(process.env.PORT ?? process.env.SOCKET_PORT ?? 3001);

// Allowed origins for CORS. In dev we accept localhost; in production
// this would be the deployed web app origin.
const ALLOWED_ORIGINS = (process.env.SOCKET_ALLOWED_ORIGINS ?? "http://localhost:3000")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

interface AuthedSocket extends Socket {
  data: {
    user: SocketTokenClaims;
    rooms: Set<string>;
  };
}

// ── Playback state cache ──────────────────────────────────────────
// Per-room in-memory state. Source of truth for any new joiner so
// they can catch up to wherever playback currently is. Persistence
// of `hasPlayed`/`playedAt` lives in Postgres; this cache is for
// "where are we right now" only.
interface VideoState {
  itemId: string | null;
  positionSecs: number;
  isPlaying: boolean;
  updatedAt: number; // server time when this state was last received
}

const roomStates = new Map<string, VideoState>();

// Cached host lookups so we don't hit the DB on every state event.
// Expired/invalidated by `room:host-changed` (not implemented yet —
// hostId on the Room model doesn't change in Phase 3).
const roomHosts = new Map<string, string>();

// ── Chat rate limiting ────────────────────────────────────────────
// Sliding-window per (userId, roomId). The DB-side CHAT_RATE_LIMIT_PER_MINUTE
// in config.ts is a coarser policy for future Redis enforcement; this
// in-memory limiter is the fast guard that runs on every send.
const CHAT_RATE_LIMIT_COUNT = 5;
const CHAT_RATE_LIMIT_WINDOW_MS = 5_000;
const chatRateLimits = new Map<string, number[]>();

function checkChatRateLimit(userId: string, roomId: string): boolean {
  const key = `${userId}:${roomId}`;
  const now = Date.now();
  const cutoff = now - CHAT_RATE_LIMIT_WINDOW_MS;
  const recent = (chatRateLimits.get(key) ?? []).filter((t) => t > cutoff);
  if (recent.length >= CHAT_RATE_LIMIT_COUNT) {
    chatRateLimits.set(key, recent);
    return false;
  }
  recent.push(now);
  chatRateLimits.set(key, recent);
  return true;
}

// ── Reaction rate limiting ────────────────────────────────────────
// Same sliding-window shape as chat but tuned looser — reactions are
// inherently spammy (that's the point). The DB-side
// REACTION_RATE_LIMIT_PER_MINUTE=30 is the coarser future-Redis policy.
const REACTION_RATE_LIMIT_COUNT = 10;
const REACTION_RATE_LIMIT_WINDOW_MS = 5_000;
const reactionRateLimits = new Map<string, number[]>();

function checkReactionRateLimit(userId: string, roomId: string): boolean {
  const key = `${userId}:${roomId}`;
  const now = Date.now();
  const cutoff = now - REACTION_RATE_LIMIT_WINDOW_MS;
  const recent = (reactionRateLimits.get(key) ?? []).filter((t) => t > cutoff);
  if (recent.length >= REACTION_RATE_LIMIT_COUNT) {
    reactionRateLimits.set(key, recent);
    return false;
  }
  recent.push(now);
  reactionRateLimits.set(key, recent);
  return true;
}

async function getRoomHost(roomId: string): Promise<string | null> {
  const cached = roomHosts.get(roomId);
  if (cached) return cached;
  const row = await prisma.room.findUnique({
    where: { id: roomId },
    select: { hostId: true },
  });
  if (!row) return null;
  roomHosts.set(roomId, row.hostId);
  return row.hostId;
}

const app = express();

app.get("/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

const httpServer = createServer(app);

const io = new IOServer(httpServer, {
  cors: {
    origin: ALLOWED_ORIGINS,
    credentials: true,
  },
});

// ── Auth middleware ───────────────────────────────────────────────
io.use(async (socket, next) => {
  try {
    const raw = socket.handshake.auth?.token;
    if (typeof raw !== "string" || raw.length === 0) {
      return next(new Error("Missing socket token"));
    }
    const claims = await verifySocketToken(raw);
    (socket as AuthedSocket).data = { user: claims, rooms: new Set() };
    next();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid socket token";
    next(new Error(`Auth failed: ${message}`));
  }
});

// ── Connection handler ────────────────────────────────────────────
io.on("connection", (socket: Socket) => {
  const s = socket as AuthedSocket;
  const userId = s.data.user.userId;
  log(`+ connect  socket=${socket.id} user=${userId}`);

  socket.on("disconnect", (reason) => {
    log(`- disconnect socket=${socket.id} user=${userId} reason=${reason}`);
  });

  socket.on("heartbeat", (...args: unknown[]) => {
    const last = args[args.length - 1];
    if (typeof last === "function") {
      (last as (r: { ok: true; serverTime: number }) => void)({
        ok: true,
        serverTime: Date.now(),
      });
    }
  });

  // Join a room channel. We verify membership against the DB before
  // allowing the join — token alone is not enough.
  socket.on(
    "room:join",
    async (
      payload: { roomId?: string },
      cb?: (response: {
        ok: boolean;
        error?: string;
        state?: VideoState | null;
        serverTime?: number;
      }) => void,
    ) => {
      const roomId = payload?.roomId;
      if (!roomId || typeof roomId !== "string") {
        return cb?.({ ok: false, error: "roomId is required" });
      }

      try {
        const member = await prisma.roomMember.findUnique({
          where: { roomId_userId: { roomId, userId } },
          select: { status: true },
        });
        if (!member) return cb?.({ ok: false, error: "Not a member of this room" });
        if (member.status === "BANNED") {
          return cb?.({ ok: false, error: "You are banned from this room" });
        }

        const channel = roomChannel(roomId);
        await socket.join(channel);
        s.data.rooms.add(channel);
        log(`  join     socket=${socket.id} user=${userId} room=${roomId}`);
        socket.to(channel).emit("room:peer-joined", { userId, socketId: socket.id });

        // Hand the joiner the current playback state if any, so they
        // can catch up immediately.
        const state = roomStates.get(roomId) ?? null;
        cb?.({ ok: true, state, serverTime: Date.now() });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to join";
        cb?.({ ok: false, error: message });
      }
    },
  );

  socket.on(
    "room:leave",
    async (
      payload: { roomId?: string },
      cb?: (response: { ok: boolean }) => void,
    ) => {
      const roomId = payload?.roomId;
      if (!roomId) return cb?.({ ok: false });
      const channel = roomChannel(roomId);
      await socket.leave(channel);
      s.data.rooms.delete(channel);
      socket
        .to(channel)
        .emit("room:peer-left", { userId, socketId: socket.id });
      cb?.({ ok: true });
    },
  );

  // ── Video sync ──────────────────────────────────────────────────
  // The host emits `video:state` whenever the current playback
  // changes (play, pause, seek, item change) and every ~5s as a
  // heartbeat. The server validates the emitter is the host, stamps
  // the state with its own time, caches it, persists item-completion
  // to the DB, and broadcasts to the rest of the room.
  socket.on(
    "video:state",
    async (payload: {
      roomId?: string;
      itemId?: string | null;
      positionSecs?: number;
      isPlaying?: boolean;
    }) => {
      const roomId = payload?.roomId;
      if (!roomId || !s.data.rooms.has(roomChannel(roomId))) {
        // Silently drop — client emitted to a room they haven't joined.
        return;
      }

      const hostId = await getRoomHost(roomId);
      if (!hostId) return;
      if (hostId !== userId) {
        // Non-hosts cannot drive sync state.
        return;
      }

      const positionSecs = typeof payload.positionSecs === "number" && payload.positionSecs >= 0
        ? payload.positionSecs
        : 0;
      const isPlaying = !!payload.isPlaying;
      const itemId = payload.itemId ?? null;

      const prev = roomStates.get(roomId);
      const next: VideoState = {
        itemId,
        positionSecs,
        isPlaying,
        updatedAt: Date.now(),
      };
      roomStates.set(roomId, next);

      // If the item changed, mark the previous one played in the DB.
      // Fire-and-forget; sync broadcast doesn't wait on the write.
      if (prev?.itemId && prev.itemId !== itemId) {
        void markItemPlayed(prev.itemId).catch((err) => {
          log(`! markItemPlayed failed item=${prev.itemId} ${err instanceof Error ? err.message : err}`);
        });
      }

      socket.to(roomChannel(roomId)).emit("video:state", next);
    },
  );

  // Viewer-initiated re-sync. When a viewer manually pauses then plays
  // (or vice versa), their local position diverges from the host. The
  // host's heartbeat would eventually correct them (~10s), but that's a
  // long beat of drift. This event lets viewers pull the authoritative
  // cached state on demand — same `video:state` shape the joiner gets,
  // emitted to just the requesting socket.
  socket.on(
    "video:request-sync",
    (payload: { roomId?: string }) => {
      const roomId = payload?.roomId;
      if (!roomId || !s.data.rooms.has(roomChannel(roomId))) return;
      const state = roomStates.get(roomId);
      if (!state) return;
      socket.emit("video:state", state);
    },
  );

  // Any room member can announce that the queue changed (add/remove/reorder
  // via REST). We don't carry a payload — viewers re-fetch /api/rooms/[id]/queue.
  // Without this, mutations done by the host while a viewer is connected
  // leave the viewer's local items[] stale, and playing a freshly-added item
  // shows "No video selected" until they refresh the page.
  socket.on(
    "queue:changed",
    async (payload: { roomId?: string }) => {
      const roomId = payload?.roomId;
      if (!roomId || !s.data.rooms.has(roomChannel(roomId))) return;

      const member = await prisma.roomMember.findUnique({
        where: { roomId_userId: { roomId, userId } },
        select: { status: true },
      });
      if (!member || member.status !== "ACTIVE") return;

      socket.to(roomChannel(roomId)).emit("queue:changed");
    },
  );

  // ── Chat ────────────────────────────────────────────────────────
  // Any ACTIVE member with chat enabled can send. The server is the
  // source of truth: it persists first, then broadcasts the canonical
  // record (id + server timestamp) to the entire room INCLUDING the
  // sender — so every client renders the same persisted shape and
  // there's no optimistic/reconcile dance on the client.
  socket.on(
    "chat:send",
    async (
      payload: { roomId?: string; content?: string },
      cb?: (response: { ok: boolean; error?: string }) => void,
    ) => {
      const roomId = payload?.roomId;
      const rawContent = typeof payload?.content === "string" ? payload.content : "";
      const content = rawContent.trim();

      if (!roomId || typeof roomId !== "string") {
        return cb?.({ ok: false, error: "roomId is required" });
      }
      if (!content) {
        return cb?.({ ok: false, error: "Message is empty" });
      }
      if (content.length > MESSAGE_MAX_LENGTH) {
        return cb?.({
          ok: false,
          error: `Message too long (max ${MESSAGE_MAX_LENGTH})`,
        });
      }
      if (!s.data.rooms.has(roomChannel(roomId))) {
        return cb?.({ ok: false, error: "Not joined to this room" });
      }
      if (!checkChatRateLimit(userId, roomId)) {
        return cb?.({ ok: false, error: "slow_down" });
      }

      try {
        const member = await prisma.roomMember.findUnique({
          where: { roomId_userId: { roomId, userId } },
          select: {
            status: true,
            isChatRestricted: true,
            room: { select: { chatEnabled: true } },
          },
        });
        if (!member || member.status !== "ACTIVE") {
          return cb?.({ ok: false, error: "Not an active member" });
        }
        if (!member.room.chatEnabled) {
          return cb?.({ ok: false, error: "Chat is disabled in this room" });
        }
        if (member.isChatRestricted) {
          return cb?.({ ok: false, error: "You are restricted from chat in this room" });
        }

        const created = await prisma.message.create({
          data: { roomId, userId, content, type: "TEXT" },
          select: {
            id: true,
            roomId: true,
            userId: true,
            content: true,
            type: true,
            createdAt: true,
            user: { select: { displayName: true, avatarUrl: true } },
          },
        });

        const wire = {
          id: created.id,
          roomId: created.roomId,
          userId: created.userId,
          userDisplayName: created.user.displayName,
          userAvatarUrl: created.user.avatarUrl,
          content: created.content,
          type: created.type,
          createdAt: created.createdAt.toISOString(),
        };

        io.to(roomChannel(roomId)).emit("chat:message", wire);
        cb?.({ ok: true });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Server error";
        log(`! chat:send failed user=${userId} room=${roomId} ${message}`);
        cb?.({ ok: false, error: "Server error" });
      }
    },
  );

  // ── Reactions ───────────────────────────────────────────────────
  // Ephemeral overlay reactions. The wire is similar to chat but:
  //   - No persistence-before-broadcast: we broadcast immediately and
  //     write to the DB fire-and-forget. The animation is the artifact;
  //     the DB row is for future analytics / retention.
  //   - The broadcast id is server-generated but is just an animation
  //     key, not a canonical record id the client must reconcile.
  socket.on(
    "reaction:send",
    async (
      payload: { roomId?: string; emoji?: string },
      cb?: (response: { ok: boolean; error?: string }) => void,
    ) => {
      const roomId = payload?.roomId;
      const emoji = typeof payload?.emoji === "string" ? payload.emoji : "";

      if (!roomId || typeof roomId !== "string") {
        return cb?.({ ok: false, error: "roomId is required" });
      }
      if (!isAllowedReactionEmoji(emoji)) {
        return cb?.({ ok: false, error: "Emoji not allowed" });
      }
      if (!s.data.rooms.has(roomChannel(roomId))) {
        return cb?.({ ok: false, error: "Not joined to this room" });
      }
      if (!checkReactionRateLimit(userId, roomId)) {
        return cb?.({ ok: false, error: "slow_down" });
      }

      try {
        const member = await prisma.roomMember.findUnique({
          where: { roomId_userId: { roomId, userId } },
          select: {
            status: true,
            user: { select: { displayName: true } },
            room: { select: { reactionsEnabled: true } },
          },
        });
        if (!member || member.status !== "ACTIVE") {
          return cb?.({ ok: false, error: "Not an active member" });
        }
        if (!member.room.reactionsEnabled) {
          return cb?.({ ok: false, error: "Reactions are disabled in this room" });
        }

        const createdAt = new Date();
        const id = `${createdAt.getTime()}-${Math.random().toString(36).slice(2, 10)}`;

        io.to(roomChannel(roomId)).emit("reaction:burst", {
          id,
          roomId,
          userId,
          userDisplayName: member.user.displayName,
          emoji,
          createdAt: createdAt.toISOString(),
        });
        cb?.({ ok: true });

        // Persist in the background; broadcast does not wait on the write.
        void prisma.reaction
          .create({ data: { roomId, userId, emoji, createdAt } })
          .catch((err) => {
            log(
              `! reaction persist failed user=${userId} room=${roomId} ${
                err instanceof Error ? err.message : err
              }`,
            );
          });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Server error";
        log(`! reaction:send failed user=${userId} room=${roomId} ${message}`);
        cb?.({ ok: false, error: "Server error" });
      }
    },
  );
});

async function markItemPlayed(itemId: string): Promise<void> {
  await prisma.videoQueue.updateMany({
    where: { id: itemId, hasPlayed: false },
    data: { hasPlayed: true, playedAt: new Date() },
  });
}

function roomChannel(roomId: string): string {
  return `room:${roomId}`;
}

function log(line: string): void {
  // eslint-disable-next-line no-console
  console.log(`[socket] ${line}`);
}

httpServer.listen(PORT, () => {
  log(`listening on port ${PORT}`);
  log(`allowed origins: ${ALLOWED_ORIGINS.join(", ")}`);
});

function shutdown(signal: string): void {
  log(`received ${signal}, shutting down`);
  io.close(() => {
    httpServer.close(() => {
      void prisma.$disconnect().finally(() => process.exit(0));
    });
  });
  setTimeout(() => process.exit(1), 5_000).unref();
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
