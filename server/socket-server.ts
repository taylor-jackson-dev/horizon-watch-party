import { createServer } from "node:http";
import express from "express";
import { Server as IOServer, type Socket } from "socket.io";
import { prisma } from "@/lib/prisma";
import { verifySocketToken, type SocketTokenClaims } from "@/lib/socket-token";

const PORT = Number(process.env.SOCKET_PORT ?? 3001);

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
// Every connecting client must send `auth: { token }` in the handshake.
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

  // Application-level liveness check. Note: we avoid "ping"/"pong" since
  // those are reserved by Engine.io for transport-level heartbeats.
  // Accept varargs so both emit("heartbeat", cb) and emit("heartbeat", payload, cb) work.
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
      cb?: (response: { ok: boolean; error?: string }) => void,
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
        socket
          .to(channel)
          .emit("room:peer-joined", { userId, socketId: socket.id });
        cb?.({ ok: true });
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
});

function roomChannel(roomId: string): string {
  return `room:${roomId}`;
}

function log(line: string): void {
  // eslint-disable-next-line no-console
  console.log(`[socket] ${line}`);
}

httpServer.listen(PORT, () => {
  log(`listening on http://localhost:${PORT}`);
  log(`allowed origins: ${ALLOWED_ORIGINS.join(", ")}`);
});

// Graceful shutdown
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
