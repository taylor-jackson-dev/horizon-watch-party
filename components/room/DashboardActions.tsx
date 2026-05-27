"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function DashboardActions() {
  return (
    <div className="grid sm:grid-cols-2 gap-4">
      <CreateRoomForm />
      <JoinRoomForm />
    </div>
  );
}

function CreateRoomForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Request failed (${res.status})`);
      }
      const { room } = (await res.json()) as { room: { joinCode: string } };
      router.push(`/room/${room.joinCode}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-3">
      <h3 className="font-semibold">Create a room</h3>
      <input
        className="input"
        placeholder="Room name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={80}
        required
      />
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button type="submit" className="btn-primary w-full" disabled={submitting || !name.trim()}>
        {submitting ? "Creating…" : "Create room"}
      </button>
    </form>
  );
}

function JoinRoomForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/rooms/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ joinCode: code.trim(), password: password || undefined }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Request failed (${res.status})`);
      }
      const { room } = (await res.json()) as { room: { joinCode: string } };
      router.push(`/room/${room.joinCode}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-3">
      <h3 className="font-semibold">Join a room</h3>
      <input
        className="input font-mono"
        placeholder="Join code"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        maxLength={32}
        required
      />
      <input
        className="input"
        type="password"
        placeholder="Password (private rooms only)"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        maxLength={64}
      />
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button type="submit" className="btn-primary w-full" disabled={submitting || !code.trim()}>
        {submitting ? "Joining…" : "Join"}
      </button>
    </form>
  );
}
