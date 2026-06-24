import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ProfileForm } from "@/components/settings/ProfileForm";
import { AppShell } from "@/components/layout/AppShell";
import { ArrowLeftIcon } from "@/components/ui/icons";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/settings");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { displayName: true, email: true },
  });
  if (!user) redirect("/signin");

  return (
    <AppShell
      user={{
        displayName: user.displayName,
        email: user.email,
        isPremium: session.user.tier === "PREMIUM",
      }}
      width="narrow"
    >
      <div className="space-y-6">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-text transition-colors"
        >
          <ArrowLeftIcon size={16} /> Back to lobby
        </Link>

        <header>
          <h1 className="font-display text-3xl uppercase tracking-wide text-text">
            Profile
          </h1>
          <p className="text-sm text-muted">Customize how you appear to others.</p>
        </header>

        <ProfileForm initialDisplayName={user.displayName} email={user.email} />
      </div>
    </AppShell>
  );
}
