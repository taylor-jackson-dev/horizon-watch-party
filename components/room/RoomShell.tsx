"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRoomSocket } from "@/lib/use-room-socket";
import { parseYouTubeVideoId } from "@/lib/youtube";
import { VideoPlayer, type VideoPlayerHandle } from "./VideoPlayer";
import { QueuePanel, type QueueItem } from "./QueuePanel";

interface RoomShellProps {
  roomId: string;
  initialItems: QueueItem[];
  currentUserId: string;
  isHost: boolean;
  loopQueue: boolean;
  loopSingle: boolean;
}

export function RoomShell({
  roomId,
  initialItems,
  currentUserId,
  isHost,
  loopQueue,
  loopSingle,
}: RoomShellProps) {
  const [items, setItems] = useState<QueueItem[]>(initialItems);
  const [currentItemId, setCurrentItemId] = useState<string | null>(
    initialItems[0]?.id ?? null,
  );
  const playerRef = useRef<VideoPlayerHandle | null>(null);
  const { status: socketStatus, error: socketError } = useRoomSocket(roomId);

  const currentItem = useMemo(
    () => items.find((i) => i.id === currentItemId) ?? null,
    [items, currentItemId],
  );
  const currentVideoId = useMemo(
    () => (currentItem?.url ? parseYouTubeVideoId(currentItem.url) : null),
    [currentItem],
  );

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/rooms/${roomId}/queue`);
    if (!res.ok) return;
    const data = (await res.json()) as { items: QueueItem[] };
    setItems(data.items);
    // If the current item disappeared (e.g. host removed it), fall back to
    // the first item in the queue.
    setCurrentItemId((prev) => {
      if (prev && data.items.some((i) => i.id === prev)) return prev;
      return data.items[0]?.id ?? null;
    });
  }, [roomId]);

  const handleEnded = useCallback(() => {
    if (!currentItemId) return;
    const idx = items.findIndex((i) => i.id === currentItemId);
    if (idx === -1) return;

    if (loopSingle) {
      playerRef.current?.seekTo(0);
      playerRef.current?.play();
      return;
    }

    if (idx < items.length - 1) {
      setCurrentItemId(items[idx + 1].id);
      return;
    }

    if (loopQueue && items.length > 0) {
      setCurrentItemId(items[0].id);
      return;
    }

    // Reached the end with no loop — stop on the last item.
    setCurrentItemId(null);
  }, [currentItemId, items, loopQueue, loopSingle]);

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <VideoPlayer
          ref={playerRef}
          videoId={currentVideoId}
          autoplay
          controlsDisabled={!isHost}
          onEnded={handleEnded}
        />
        {currentItem && (
          <div className="text-sm">
            <span className="text-brand-muted">Now playing: </span>
            <span className="font-medium">{currentItem.title}</span>
          </div>
        )}
        <SocketStatusLine status={socketStatus} error={socketError} />
      </section>

      <QueuePanel
        roomId={roomId}
        items={items}
        currentItemId={currentItemId}
        currentUserId={currentUserId}
        isHost={isHost}
        onChanged={refresh}
        onSelect={(id) => setCurrentItemId(id)}
      />
    </div>
  );
}

function SocketStatusLine({
  status,
  error,
}: {
  status: ReturnType<typeof useRoomSocket>["status"];
  error: string | null;
}) {
  if (status === "connected") {
    return (
      <p className="text-xs text-brand-muted">
        <span className="text-emerald-400">●</span> Connected to sync server
      </p>
    );
  }
  if (status === "error") {
    return <p className="text-xs text-red-400">Sync server error: {error ?? "unknown"}</p>;
  }
  return (
    <p className="text-xs text-brand-muted">
      <span className="text-yellow-400">●</span> Sync: {status}…
    </p>
  );
}
