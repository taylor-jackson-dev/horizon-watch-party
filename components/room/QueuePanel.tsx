"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import { QUEUE_MAX_SIZE } from "@/lib/config";

type QueueItem = {
  id: string;
  type: "YOUTUBE" | "UPLOAD" | "EXTERNAL";
  url: string | null;
  title: string;
  thumbnailUrl: string | null;
  durationSecs: number | null;
  position: number;
  hasPlayed: boolean;
  playedAt: string | null;
  createdAt: string;
  addedById: string;
};

interface QueuePanelProps {
  roomId: string;
  initialItems: QueueItem[];
  currentUserId: string;
  isHost: boolean;
}

export function QueuePanel({ roomId, initialItems, currentUserId, isHost }: QueuePanelProps) {
  const [items, setItems] = useState<QueueItem[]>(initialItems);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch(`/api/rooms/${roomId}/queue`);
    if (res.ok) {
      const data = (await res.json()) as { items: QueueItem[] };
      setItems(data.items);
    }
  }

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    setAdding(true);
    setError(null);
    try {
      const res = await fetch(`/api/rooms/${roomId}/queue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, title: title.trim() || undefined }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Failed (${res.status})`);
      }
      setUrl("");
      setTitle("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setAdding(false);
    }
  }

  async function onRemove(itemId: string) {
    setBusyId(itemId);
    setError(null);
    try {
      const res = await fetch(`/api/rooms/${roomId}/queue/${itemId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Failed (${res.status})`);
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusyId(null);
    }
  }

  async function onMove(item: QueueItem, direction: -1 | 1) {
    const newPosition = item.position + direction;
    if (newPosition < 0 || newPosition >= items.length) return;
    setBusyId(item.id);
    setError(null);
    try {
      const res = await fetch(`/api/rooms/${roomId}/queue/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ position: newPosition }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Failed (${res.status})`);
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">Queue</h2>
        <span className="text-xs text-brand-muted">
          {items.length}/{QUEUE_MAX_SIZE}
        </span>
      </div>

      <form onSubmit={onAdd} className="card space-y-2">
        <input
          className="input"
          placeholder="Paste a YouTube URL"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          maxLength={500}
          required
        />
        <input
          className="input"
          placeholder="Title (optional)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          className="btn-primary w-full"
          disabled={adding || !url.trim() || items.length >= QUEUE_MAX_SIZE}
        >
          {adding ? "Adding…" : items.length >= QUEUE_MAX_SIZE ? "Queue full" : "Add to queue"}
        </button>
      </form>

      {items.length === 0 ? (
        <p className="text-sm text-brand-muted">
          Queue is empty. Paste a YouTube URL above to add the first video.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((item, idx) => {
            const canRemove = isHost || item.addedById === currentUserId;
            const isBusy = busyId === item.id;
            return (
              <li
                key={item.id}
                className={`card flex gap-3 items-center ${
                  item.hasPlayed ? "opacity-60" : ""
                }`}
              >
                <div className="text-xs text-brand-muted w-5 text-right tabular-nums">
                  {idx + 1}
                </div>
                {item.thumbnailUrl ? (
                  <div className="relative shrink-0 w-24 h-14 rounded overflow-hidden">
                    <Image
                      src={item.thumbnailUrl}
                      alt=""
                      fill
                      sizes="96px"
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div className="shrink-0 w-24 h-14 rounded bg-brand-elevated" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{item.title}</div>
                  {item.url && (
                    <div className="text-xs text-brand-muted truncate">{item.url}</div>
                  )}
                  {item.hasPlayed && (
                    <div className="text-xs text-brand-muted">Already played</div>
                  )}
                </div>
                {isHost && (
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      className="btn-ghost text-xs px-2 py-0.5 leading-none"
                      onClick={() => onMove(item, -1)}
                      disabled={isBusy || idx === 0}
                      aria-label="Move up"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="btn-ghost text-xs px-2 py-0.5 leading-none"
                      onClick={() => onMove(item, +1)}
                      disabled={isBusy || idx === items.length - 1}
                      aria-label="Move down"
                    >
                      ↓
                    </button>
                  </div>
                )}
                {canRemove && (
                  <button
                    type="button"
                    className="btn-ghost text-xs"
                    onClick={() => onRemove(item.id)}
                    disabled={isBusy}
                    aria-label="Remove"
                  >
                    Remove
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
