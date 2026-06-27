"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, Button, buttonVariants } from "@/components/ui";

interface JoinGateProps {
  joinCode: string;
  roomName: string;
  isPrivate: boolean;
  isEnded: boolean;
}

type Status = "idle" | "joining" | "error";

/**
 * Shown when an authenticated user opens an invite link to a room they haven't
 * joined. Public rooms auto-join on mount (the invite link "just works");
 * private rooms ask for the room password first. On success we refresh so the
 * server component re-renders the page as a member.
 */
export function JoinGate({ joinCode, roomName, isPrivate, isEnded }: JoinGateProps) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>(
    isPrivate || isEnded ? "idle" : "joining",
  );
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const autoJoined = useRef(false);

  async function join(pw?: string) {
    setStatus("joining");
    setError(null);
    try {
      const res = await fetch("/api/rooms/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ joinCode, password: pw || undefined }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Couldn't join (${res.status})`);
      }
      // Membership now exists — re-render the server component as a member.
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStatus("error");
    }
  }

  // Public rooms: join the moment the link is opened.
  useEffect(() => {
    if (isPrivate || isEnded || autoJoined.current) return;
    autoJoined.current = true;
    void join();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void join(password);
  }

  if (isEnded) {
    return (
      <Card className="space-y-3 text-center">
        <p className="text-text">This room has ended.</p>
        <Link href="/dashboard" className={buttonVariants({ variant: "ghost", size: "sm" })}>
          Back to the lobby
        </Link>
      </Card>
    );
  }

  if (isPrivate) {
    return (
      <Card className="space-y-4">
        <div className="space-y-1">
          <h2 className="font-display uppercase tracking-wide text-text">
            Join <span className="text-gold">{roomName}</span>
          </h2>
          <p className="text-sm text-muted">This room is private. Enter the password to join.</p>
        </div>
        <form onSubmit={onSubmit} className="space-y-3">
          <input
            className="input"
            type="password"
            placeholder="Room password"
            aria-label="Room password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            maxLength={64}
            autoFocus
            required
          />
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex items-center gap-2">
            <Button type="submit" disabled={status === "joining" || !password.trim()}>
              {status === "joining" ? "Joining…" : "Join room"}
            </Button>
            <Link
              href="/dashboard"
              className={buttonVariants({ variant: "subtle", size: "md" })}
            >
              Cancel
            </Link>
          </div>
        </form>
      </Card>
    );
  }

  // Public room — auto-joining (or showing why it failed).
  return (
    <Card className="space-y-3 text-center">
      {status === "error" ? (
        <>
          <p className="text-danger">{error}</p>
          <div className="flex items-center justify-center gap-2">
            <Button size="sm" onClick={() => join()}>
              Try again
            </Button>
            <Link
              href="/dashboard"
              className={buttonVariants({ variant: "subtle", size: "sm" })}
            >
              Back to the lobby
            </Link>
          </div>
        </>
      ) : (
        <div className="flex items-center justify-center gap-3 text-muted">
          <span
            className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-border border-t-gold"
            aria-hidden
          />
          <span>
            Joining <span className="text-text">{roomName}</span>…
          </span>
        </div>
      )}
    </Card>
  );
}
