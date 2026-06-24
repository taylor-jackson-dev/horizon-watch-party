"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui";
import { UsersIcon } from "@/components/ui/icons";
import { subscribeRoomPresenceCount } from "@/lib/room-presence-store";

interface RoomHeadcountBadgeProps {
  /** SSR active-member count — seeds the badge so it doesn't flash 0 before the first presence event. */
  initialCount: number;
  capacity: number;
}

export function RoomHeadcountBadge({ initialCount, capacity }: RoomHeadcountBadgeProps) {
  const [count, setCount] = useState(initialCount);
  useEffect(() => subscribeRoomPresenceCount(setCount), []);

  return (
    <Badge tone="muted">
      <UsersIcon size={12} />
      {count}/{capacity} watching
    </Badge>
  );
}
