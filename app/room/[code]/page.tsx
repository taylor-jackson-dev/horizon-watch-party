import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isHostRole, roomPublicSelect } from "@/lib/rooms";
import { RoomShell } from "@/components/room/RoomShell";

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
        select: { role: true, status: true, isChatRestricted: true },
      },
      _count: { select: { members: { where: { status: "ACTIVE" } } } },
    },
  });

  if (!room) notFound();
  const membership = room.members[0];
  const isMember = membership && membership.status !== "BANNED";
  const isHost = isMember && !forceViewer ? isHostRole(membership.role) : false;
  const isChatRestricted = membership?.isChatRestricted ?? false;

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

  return (
    <main className="min-h-screen px-4 py-6 max-w-6xl mx-auto space-y-6">
      <Link href="/dashboard" className="text-sm text-brand-muted hover:text-brand-text">
        ← Back to dashboard
      </Link>

      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-brand-gold">{room.name}</h1>
        {room.description && <p className="text-brand-muted">{room.description}</p>}
        <div className="text-xs text-brand-muted">
          Code: <code className="font-mono">{room.joinCode}</code>
          {" · "}
          {room.isPrivate ? "Private" : "Public"}
          {" · "}
          Status: {room.status}
          {" · "}
          {room._count.members}/{room.capacity} active
          {membership && (
            <>
              {" · "}You are{" "}
              <span className="text-brand-gold font-medium">{membership.role}</span>
              {forceViewer && (
                <span className="ml-1">
                  (forced viewer via <code className="font-mono">?asViewer=1</code>)
                </span>
              )}
            </>
          )}
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
        />
      ) : (
        <section className="card space-y-2">
          <p className="text-sm text-brand-muted">
            You are not a member of this room. Use the join form on the dashboard with code{" "}
            <code className="font-mono">{room.joinCode}</code>.
          </p>
        </section>
      )}
    </main>
  );
}
