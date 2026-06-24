import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isHostRole, roomPublicSelect } from "@/lib/rooms";
import { RoomShell } from "@/components/room/RoomShell";
import { RoomHeadcountBadge } from "@/components/room/RoomHeadcountBadge";
import { AppShell } from "@/components/layout/AppShell";
import { Card, Badge } from "@/components/ui";
import { ArrowLeftIcon } from "@/components/ui/icons";

interface RoomPageProps {
  params: { code: string };
  searchParams: { asViewer?: string };
}

export default async function RoomPage({ params, searchParams }: RoomPageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect(`/signin?callbackUrl=/room/${params.code}`);
  const userId = session.user.id;
  const forceViewer = searchParams.asViewer === "1";

  const room = await prisma.room.findUnique({
    where: { joinCode: params.code },
    select: {
      ...roomPublicSelect,
      members: {
        where: { userId },
        select: {
          role: true,
          status: true,
          isChatRestricted: true,
          isMicMuted: true,
          isViewOnly: true,
        },
      },
      _count: { select: { members: { where: { status: "ACTIVE" } } } },
    },
  });

  if (!room) notFound();
  const membership = room.members[0];
  const isMember = membership && membership.status !== "BANNED";
  const isHost = isMember && !forceViewer ? isHostRole(membership.role) : false;
  const isChatRestricted = membership?.isChatRestricted ?? false;
  const isMicMuted = membership?.isMicMuted ?? false;
  const isViewOnly = membership?.isViewOnly ?? false;

  const queueItems = isMember
    ? await prisma.videoQueue.findMany({
        where: { roomId: room.id },
        orderBy: { position: "asc" },
        select: {
          id: true,
          type: true,
          url: true,
          title: true,
          thumbnailUrl: true,
          durationSecs: true,
          position: true,
          hasPlayed: true,
          playedAt: true,
          createdAt: true,
          addedById: true,
        },
      })
    : [];

  const user = {
    displayName: session.user.name ?? undefined,
    email: session.user.email ?? undefined,
    isPremium: session.user.tier === "PREMIUM",
  };

  return (
    <AppShell user={user} width="wide">
      <div className="space-y-6">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-text"
        >
          <ArrowLeftIcon size={16} />
          Back to dashboard
        </Link>

        <header className="space-y-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h1 className="font-display text-3xl uppercase tracking-wide text-text">
              {room.name}
            </h1>
            {membership && (
              <Badge tone={isHost ? "gold" : "default"}>{membership.role}</Badge>
            )}
            {forceViewer && <Badge tone="warning">Forced viewer</Badge>}
          </div>
          {room.description && <p className="text-muted">{room.description}</p>}
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="muted">
              Code <code className="font-mono text-text">{room.joinCode}</code>
            </Badge>
            <Badge tone={room.isPrivate ? "default" : "muted"}>
              {room.isPrivate ? "Private" : "Public"}
            </Badge>
            <RoomHeadcountBadge initialCount={room._count.members} capacity={room.capacity} />
          </div>
        </header>

        {isMember ? (
          <RoomShell
            roomId={room.id}
            initialItems={queueItems.map((item) => ({
              ...item,
              playedAt: item.playedAt?.toISOString() ?? null,
              createdAt: item.createdAt.toISOString(),
            }))}
            currentUserId={userId}
            isHost={isHost}
            loopQueue={room.loopQueue}
            loopSingle={room.loopSingle}
            chatEnabled={room.chatEnabled}
            isChatRestricted={isChatRestricted}
            reactionsEnabled={room.reactionsEnabled}
            voiceEnabled={room.voiceEnabled}
            isMicMuted={isMicMuted}
            isViewOnly={isViewOnly}
            initialActiveCount={room._count.members}
            capacity={room.capacity}
          />
        ) : (
          <Card>
            <p className="text-sm text-muted">
              You are not a member of this room. Use the join form on the dashboard with code{" "}
              <code className="font-mono text-text">{room.joinCode}</code>.
            </p>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
