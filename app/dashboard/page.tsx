import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { roomPublicSelect } from "@/lib/rooms";
import { DashboardActions } from "@/components/room/DashboardActions";

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

  async function handleSignOut() {
    "use server";
    await signOut({ redirectTo: "/" });
  }

  return (
    <main className="min-h-screen px-4 py-10 max-w-3xl mx-auto space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-brand-gold">Your rooms</h1>
          <p className="text-sm text-brand-muted">
            Signed in as {user?.displayName ?? user?.email ?? session.user.email}
            {session.user.tier === "PREMIUM" && " · Premium"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/settings" className="btn-ghost text-sm">Settings</Link>
          <form action={handleSignOut}>
            <button type="submit" className="btn-ghost text-sm">Sign out</button>
          </form>
        </div>
      </header>

      <DashboardActions />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Rooms you&apos;ve joined</h2>
        {memberships.length === 0 ? (
          <p className="text-sm text-brand-muted">
            You haven&apos;t joined any rooms yet. Create one above or join with a code.
          </p>
        ) : (
          <ul className="space-y-2">
            {memberships.map((m) => (
              <li key={m.id} className="card flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{m.room.name}</span>
                    <span className="text-xs text-brand-muted">· {m.role}</span>
                    {m.status === "LEFT" && (
                      <span className="text-xs text-brand-muted">· left</span>
                    )}
                  </div>
                  <div className="text-xs text-brand-muted">
                    Code: <code className="font-mono">{m.room.joinCode}</code>
                    {" · "}
                    {m.room.isPrivate ? "Private" : "Public"}
                  </div>
                </div>
                <Link href={`/room/${m.room.joinCode}`} className="btn-ghost text-sm">
                  Open
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
