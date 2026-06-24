import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { roomPublicSelect } from "@/lib/rooms";
import { DashboardActions } from "@/components/room/DashboardActions";
import { AppShell } from "@/components/layout/AppShell";
import { Card, Badge, buttonVariants } from "@/components/ui";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/dashboard");
  const userId = session.user.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { displayName: true, email: true },
  });

  const memberships = await prisma.roomMember.findMany({
    where: { userId, status: { in: ["ACTIVE", "LEFT"] } },
    orderBy: { joinedAt: "desc" },
    select: {
      id: true,
      role: true,
      status: true,
      joinedAt: true,
      room: { select: roomPublicSelect },
    },
  });

  return (
    <AppShell
      user={{
        displayName: user?.displayName,
        email: user?.email,
        isPremium: session.user.tier === "PREMIUM",
      }}
      width="default"
    >
      <div className="space-y-8">
        <header className="space-y-1">
          <h1 className="font-display text-3xl uppercase tracking-wide text-text">
            The <span className="text-gold">lobby</span>
          </h1>
          <p className="text-sm text-muted">
            Start a new room or jump back into one you&apos;ve joined.
          </p>
        </header>

        <DashboardActions />

        <section className="space-y-3">
          <h2 className="font-display text-sm uppercase tracking-wider text-muted">
            Your rooms
          </h2>
          {memberships.length === 0 ? (
            <Card className="text-sm text-muted">
              You haven&apos;t joined any rooms yet. Create one above or join with a code.
            </Card>
          ) : (
            <ul className="space-y-2">
              {memberships.map((m) => (
                <li key={m.id}>
                  <Card className="flex items-center justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium text-text">{m.room.name}</span>
                        <Badge tone={m.role === "HOST" ? "gold" : "muted"}>{m.role}</Badge>
                        {m.status === "LEFT" && <Badge tone="muted">left</Badge>}
                      </div>
                      <div className="text-xs text-muted">
                        Code: <code className="font-mono text-text">{m.room.joinCode}</code>
                        {" · "}
                        {m.room.isPrivate ? "Private" : "Public"}
                      </div>
                    </div>
                    <Link
                      href={`/room/${m.room.joinCode}`}
                      className={buttonVariants({ variant: "ghost", size: "sm" })}
                    >
                      Open
                    </Link>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}
