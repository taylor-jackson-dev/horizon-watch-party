"use client";

// Minimal pub/sub bridge so the room header — rendered by the server page,
// outside RoomShell — can show the same live headcount the PresencePanel
// receives over the socket, without opening a second socket or lifting the
// connection out of RoomShell. PresencePanel publishes; the header subscribes.

type Listener = (count: number) => void;

const listeners = new Set<Listener>();

export function publishRoomPresenceCount(count: number): void {
  listeners.forEach((listener) => listener(count));
}

export function subscribeRoomPresenceCount(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
