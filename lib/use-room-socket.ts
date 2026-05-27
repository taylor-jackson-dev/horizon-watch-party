"use client";

import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";

export type SocketStatus =
  | "idle"
  | "minting-token"
  | "connecting"
  | "joining"
  | "connected"
  | "error"
  | "disconnected";

export interface UseRoomSocketState {
  socket: Socket | null;
  status: SocketStatus;
  error: string | null;
}

interface TokenResponse {
  token: string;
  socketUrl: string;
}

/**
 * Opens an authenticated socket connection scoped to a specific room.
 *
 * Lifecycle on mount:
 *   1. POST /api/socket/token → short-lived JWT
 *   2. Open socket connection with that token
 *   3. Emit room:join with the roomId; wait for ack
 *   4. Set status = "connected"
 *
 * On unmount: emit room:leave (best-effort), close socket.
 *
 * The hook is intentionally low-level — feature components subscribe to
 * specific events via the returned socket.
 */
export function useRoomSocket(roomId: string | null): UseRoomSocketState {
  const [status, setStatus] = useState<SocketStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const [, setVersion] = useState(0); // force re-render when socket ref changes

  useEffect(() => {
    if (!roomId) return;
    let cancelled = false;
    let activeSocket: Socket | null = null;

    async function setup() {
      try {
        setError(null);
        setStatus("minting-token");
        const res = await fetch("/api/socket/token", { method: "POST" });
        if (!res.ok) throw new Error(`Token mint failed (${res.status})`);
        const { token, socketUrl } = (await res.json()) as TokenResponse;
        if (cancelled) return;

        setStatus("connecting");
        const s = io(socketUrl, {
          auth: { token },
          transports: ["websocket"],
          reconnection: true,
          reconnectionAttempts: 5,
        });
        activeSocket = s;
        socketRef.current = s;
        setVersion((v) => v + 1);

        await new Promise<void>((resolve, reject) => {
          const onConnect = () => {
            s.off("connect_error", onErr);
            resolve();
          };
          const onErr = (err: Error) => {
            s.off("connect", onConnect);
            reject(err);
          };
          s.once("connect", onConnect);
          s.once("connect_error", onErr);
        });
        if (cancelled) return;

        setStatus("joining");
        await new Promise<void>((resolve, reject) => {
          s.emit(
            "room:join",
            { roomId },
            (ack: { ok: boolean; error?: string }) => {
              if (ack.ok) resolve();
              else reject(new Error(ack.error ?? "room:join failed"));
            },
          );
        });
        if (cancelled) return;

        setStatus("connected");

        s.on("disconnect", () => {
          if (!cancelled) setStatus("disconnected");
        });
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Socket setup failed");
        setStatus("error");
      }
    }

    void setup();

    return () => {
      cancelled = true;
      const s = activeSocket;
      if (s) {
        try {
          s.emit("room:leave", { roomId });
        } catch {
          /* ignore */
        }
        s.removeAllListeners();
        s.disconnect();
      }
      socketRef.current = null;
    };
  }, [roomId]);

  return { socket: socketRef.current, status, error };
}
