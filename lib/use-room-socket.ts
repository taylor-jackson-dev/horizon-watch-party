"use client";

import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";

export type SocketStatus =
  | "idle"
  | "connecting"
  | "joining"
  | "connected"
  | "error"
  | "disconnected";

export interface VideoSyncState {
  itemId: string | null;
  positionSecs: number;
  isPlaying: boolean;
  updatedAt: number;
}

export interface UseRoomSocketState {
  socket: Socket | null;
  status: SocketStatus;
  error: string | null;
  /** Server-provided state at the moment of (re)join (used by viewers to catch up). */
  initialState: VideoSyncState | null;
  /** Skew between client clock and server clock, ms. (clientNow - serverNow) */
  serverTimeSkewMs: number;
  /**
   * Increments on every successful (re)join. Consumers watch this to
   * reconcile state that was missed while the socket was disconnected:
   * epoch 1 = the initial join, epoch ≥ 2 = a reconnect re-join.
   */
  syncEpoch: number;
}

interface JoinAck {
  ok: boolean;
  error?: string;
  state?: VideoSyncState | null;
  serverTime?: number;
}

// NEXT_PUBLIC_ vars are inlined client-side, so we don't need to round-trip
// the token endpoint just to learn the socket URL. (Falls back to local dev.)
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:3001";

/**
 * Opens an authenticated socket connection scoped to a specific room and
 * keeps it healthy across transport reconnects.
 *
 * The reliability contract:
 *   - A fresh short-lived JWT is minted before EVERY (re)connection attempt
 *     via socket.io's `auth` callback. The token TTL is 1h; without this a
 *     reconnect during a long session (a multi-hour movie night, or after a
 *     phone sleeps) would fail the handshake.
 *   - `room:join` is re-emitted on EVERY `connect`, not just the first. The
 *     server binds room membership (and all broadcasts) to `socket.join`, and
 *     socket.io reconnects with a brand-new server-side socket that was never
 *     joined — so without re-joining, video/chat/queue/presence silently stop
 *     updating until a manual page refresh.
 *   - `syncEpoch` bumps on each successful join so feature components can
 *     reconcile whatever they missed during the disconnect window.
 *
 * The hook is intentionally low-level — feature components subscribe to
 * specific events via the returned socket.
 */
export function useRoomSocket(roomId: string | null): UseRoomSocketState {
  const [status, setStatus] = useState<SocketStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [initialState, setInitialState] = useState<VideoSyncState | null>(null);
  const [serverTimeSkewMs, setServerTimeSkewMs] = useState(0);
  const [syncEpoch, setSyncEpoch] = useState(0);
  const socketRef = useRef<Socket | null>(null);
  const [, setVersion] = useState(0);

  useEffect(() => {
    if (!roomId) return;
    let cancelled = false;

    setStatus("connecting");
    setError(null);
    setInitialState(null);

    const s = io(SOCKET_URL, {
      // Runs before the initial connect AND before every reconnect attempt,
      // so the handshake always carries a non-expired token.
      auth: (cb: (data: { token: string }) => void) => {
        fetch("/api/socket/token", { method: "POST" })
          .then((res) =>
            res.ok
              ? (res.json() as Promise<{ token: string }>)
              : Promise.reject(new Error(`Token mint failed (${res.status})`)),
          )
          .then(({ token }) => cb({ token }))
          .catch((err: unknown) => {
            if (!cancelled) {
              setError(err instanceof Error ? err.message : "Token mint failed");
            }
            // Hand back an empty token so the server rejects the handshake;
            // socket.io then backs off and retries (which re-mints).
            cb({ token: "" });
          });
      },
      transports: ["websocket"],
      forceNew: true,
      reconnection: true,
      // Generous for long sessions — a brief outage shouldn't permanently give
      // up. Backoff is capped so recovery is quick once the network returns.
      reconnectionAttempts: 20,
      reconnectionDelayMax: 5000,
    });
    socketRef.current = s;
    setVersion((v) => v + 1);

    // Single join routine — runs on the first connect AND every reconnect.
    const joinRoom = () => {
      if (cancelled) return;
      setStatus("joining");
      s.emit("room:join", { roomId }, (ack: JoinAck) => {
        if (cancelled) return;
        if (!ack?.ok) {
          setError(ack?.error ?? "room:join failed");
          setStatus("error");
          return;
        }
        if (typeof ack.serverTime === "number") {
          setServerTimeSkewMs(Date.now() - ack.serverTime);
        }
        setInitialState(ack.state ?? null);
        setStatus("connected");
        setSyncEpoch((e) => e + 1);
      });
    };

    const onConnect = () => joinRoom();
    const onConnectError = (err: Error) => {
      // Don't flip to a terminal error mid-reconnect — socket.io keeps
      // retrying. `reconnect_failed` is the terminal signal. We still surface
      // the message so the status line can explain what's happening.
      if (!cancelled) setError(err.message);
    };
    const onDisconnect = () => {
      if (!cancelled) setStatus("disconnected");
    };
    const onReconnectAttempt = () => {
      if (!cancelled) setStatus("connecting");
    };
    const onReconnectFailed = () => {
      if (!cancelled) setStatus("error");
    };

    s.on("connect", onConnect);
    s.on("connect_error", onConnectError);
    s.on("disconnect", onDisconnect);
    s.io.on("reconnect_attempt", onReconnectAttempt);
    s.io.on("reconnect_failed", onReconnectFailed);

    return () => {
      cancelled = true;
      try {
        s.emit("room:leave", { roomId });
      } catch {
        /* ignore */
      }
      s.io.off("reconnect_attempt", onReconnectAttempt);
      s.io.off("reconnect_failed", onReconnectFailed);
      s.removeAllListeners();
      s.disconnect();
      socketRef.current = null;
    };
  }, [roomId]);

  return {
    socket: socketRef.current,
    status,
    error,
    initialState,
    serverTimeSkewMs,
    syncEpoch,
  };
}
