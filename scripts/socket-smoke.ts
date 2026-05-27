// Smoke test for the socket server.
// Run with:  npm run dev:socket  (in another terminal)
//            npx dotenv -e .env.local -- tsx scripts/socket-smoke.ts
//
// Tests:
//   1. Connection with invalid token is rejected
//   2. Connection with valid token succeeds
//   3. ping returns pong
//   4. room:join with bogus roomId fails
//   5. room:join with a real room the user belongs to succeeds
//
// Picks the first existing RoomMember from the DB to test #5.

import { io as ioClient, type Socket } from "socket.io-client";
import { prisma } from "@/lib/prisma";
import { signSocketToken } from "@/lib/socket-token";

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:3001";
const STEP_TIMEOUT_MS = 5_000;

function connect(token: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const s = ioClient(SOCKET_URL, {
      auth: { token },
      transports: ["websocket"],
      reconnection: false,
    });
    const timer = setTimeout(() => {
      s.disconnect();
      reject(new Error(`connect timeout after ${STEP_TIMEOUT_MS}ms`));
    }, STEP_TIMEOUT_MS);
    s.on("connect", () => {
      clearTimeout(timer);
      resolve(s);
    });
    s.on("connect_error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

function emitWithAck<T>(s: Socket, event: string, payload?: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${event} ack timeout`)), STEP_TIMEOUT_MS);
    s.emit(event, payload, (response: T) => {
      clearTimeout(timer);
      resolve(response);
    });
  });
}

async function main() {
  let pass = 0;
  let fail = 0;
  const log = (ok: boolean, label: string, detail?: string) => {
    const tag = ok ? "PASS" : "FAIL";
    console.log(`${tag}  ${label}${detail ? `  (${detail})` : ""}`);
    if (ok) pass++;
    else fail++;
  };

  // Test 1: invalid token rejected
  try {
    await connect("not-a-real-token");
    log(false, "rejects invalid token", "unexpectedly connected");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log(/auth/i.test(msg) || /invalid/i.test(msg) || /signature/i.test(msg), "rejects invalid token", msg);
  }

  // Pick a user with a room membership to test as
  const member = await prisma.roomMember.findFirst({
    where: { status: "ACTIVE" },
    select: { userId: true, roomId: true, user: { select: { tier: true } } },
  });

  if (!member) {
    console.log("\nNo ACTIVE RoomMembers in DB — sign in via the UI and create/join a room first, then re-run.");
    await prisma.$disconnect();
    process.exit(fail === 0 ? 0 : 1);
  }

  const token = await signSocketToken({ userId: member.userId, tier: member.user.tier });

  // Test 2: valid token connects
  let socket: Socket | null = null;
  try {
    socket = await connect(token);
    log(true, "connects with valid token", socket.id);
  } catch (err) {
    log(false, "connects with valid token", err instanceof Error ? err.message : String(err));
  }

  if (!socket) {
    await prisma.$disconnect();
    process.exit(1);
  }

  // Test 3: heartbeat ack
  try {
    const beat = await emitWithAck<{ ok: boolean; serverTime: number }>(socket, "heartbeat");
    log(beat.ok === true && typeof beat.serverTime === "number", "heartbeat acks", `serverTime=${beat.serverTime}`);
  } catch (err) {
    log(false, "heartbeat acks", err instanceof Error ? err.message : String(err));
  }

  // Test 4: bogus roomId fails
  try {
    const r = await emitWithAck<{ ok: boolean; error?: string }>(socket, "room:join", { roomId: "nope-doesnt-exist" });
    log(r.ok === false && !!r.error, "room:join rejects unknown roomId", r.error ?? "");
  } catch (err) {
    log(false, "room:join rejects unknown roomId", err instanceof Error ? err.message : String(err));
  }

  // Test 5: real roomId succeeds
  try {
    const r = await emitWithAck<{ ok: boolean; error?: string }>(socket, "room:join", { roomId: member.roomId });
    log(r.ok === true, "room:join accepts member's own room", r.error ?? `room=${member.roomId}`);
  } catch (err) {
    log(false, "room:join accepts member's own room", err instanceof Error ? err.message : String(err));
  }

  socket.disconnect();
  await prisma.$disconnect();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(async (err) => {
  console.error("smoke test crashed:", err);
  await prisma.$disconnect();
  process.exit(1);
});
