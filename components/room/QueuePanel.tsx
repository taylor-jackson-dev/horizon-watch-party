"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import { QUEUE_MAX_SIZE } from "@/lib/config";
import { Panel, Badge, Button, Input } from "@/components/ui";
import {
  FilmIcon,
  PlayIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  CloseIcon,
} from "@/components/ui/icons";

export type QueueItem = {
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
  items: QueueItem[];
  currentItemId: string | null;
  currentUserId: string;
  isHost: boolean;
  onChanged: () => Promise<void> | void;
  onSelect?: (itemId: string) => void;
}

export function QueuePanel({
  roomId,
  items,
  currentItemId,
  currentUserId,
  isHost,
  onChanged,
  onSelect,
}: QueuePanelProps) {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

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
      await onChanged();
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
      await onChanged();
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
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusyId(null);
    }
  }

  const atCapacity = items.length >= QUEUE_MAX_SIZE;

  return (
    <Panel
      title="Up next"
      icon={<FilmIcon size={15} />}
      action={
        <Badge tone={atCapacity ? "warning" : "muted"}>
          {items.length}/{QUEUE_MAX_SIZE}
        </Badge>
      }
      bodyClassName="flex flex-col gap-3"
    >
      <form onSubmit={onAdd} className="space-y-2">
        <Input
          placeholder="Paste a YouTube URL"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          maxLength={500}
          required
        />
        <Input
          placeholder="Title (optional)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
        />
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button
          type="submit"
          className="w-full"
          disabled={adding || !url.trim() || atCapacity}
        >
          {adding ? "Adding…" : atCapacity ? "Queue full" : "Add to queue"}
        </Button>
      </form>

      {items.length === 0 ? (
        <p className="text-sm text-muted">
          Queue is empty. Paste a YouTube URL above to add the first video.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((item, idx) => {
            const canRemove = isHost || item.addedById === currentUserId;
            const isBusy = busyId === item.id;
            const isCurrent = item.id === currentItemId;
            return (
              <li
                key={item.id}
                className={`flex gap-3 items-center rounded-xl border p-2 transition-colors ${
                  item.hasPlayed ? "opacity-60" : ""
                } ${
                  isCurrent
                    ? "border-gold/70 bg-gold/5 ring-1 ring-gold/30"
                    : "border-border bg-elevated/30"
                }`}
              >
                <div className="text-xs text-muted w-5 text-right tabular-nums shrink-0">
                  {idx + 1}
                </div>
                {item.thumbnailUrl ? (
                  <div className="relative shrink-0 w-24 h-14 rounded-lg overflow-hidden ring-1 ring-border/60">
                    <Image
                      src={item.thumbnailUrl}
                      alt=""
                      fill
                      sizes="96px"
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div className="shrink-0 w-24 h-14 rounded-lg bg-elevated grid place-items-center">
                    <FilmIcon size={18} className="text-muted" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{item.title}</div>
                  {item.url && (
                    <div className="text-xs text-muted truncate">{item.url}</div>
                  )}
                  {isCurrent && (
                    <div className="text-xs text-gold font-medium">Now playing</div>
                  )}
                </div>
                {isHost && onSelect && !isCurrent && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => onSelect(item.id)}
                    disabled={isBusy}
                    aria-label="Play now"
                    title="Play now"
                  >
                    <PlayIcon size={15} />
                  </Button>
                )}
                {isHost && (
                  <div className="flex flex-col gap-0.5 shrink-0">
                    <Button
                      variant="subtle"
                      size="icon"
                      className="h-6 w-7"
                      onClick={() => onMove(item, -1)}
                      disabled={isBusy || idx === 0}
                      aria-label="Move up"
                    >
                      <ChevronUpIcon size={14} />
                    </Button>
                    <Button
                      variant="subtle"
                      size="icon"
                      className="h-6 w-7"
                      onClick={() => onMove(item, +1)}
                      disabled={isBusy || idx === items.length - 1}
                      aria-label="Move down"
                    >
                      <ChevronDownIcon size={14} />
                    </Button>
                  </div>
                )}
                {canRemove && (
                  <Button
                    variant="subtle"
                    size="icon"
                    className="h-8 w-8 shrink-0 hover:text-danger"
                    onClick={() => onRemove(item.id)}
                    disabled={isBusy}
                    aria-label="Remove"
                    title="Remove"
                  >
                    <CloseIcon size={15} />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
