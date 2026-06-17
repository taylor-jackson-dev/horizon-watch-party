import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ProfileForm } from "@/components/settings/ProfileForm";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/settings");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { displayName: true, email: true },
  });
  if (!user) redirect("/signin");

  return (
    <main className="min-h-screen px-4 py-10 max-w-xl mx-auto space-y-6">
      <Link href="/dashboard" className="text-sm text-brand-muted hover:text-brand-text">
        ← Back to dashboard
      </Link>

      <header>
        <h1 className="text-3xl font-bold text-brand-gold">Profile</h1>
        <p className="text-sm text-brand-muted">Customize how you appear to others.</p>
      </header>

      <ProfileForm initialDisplayName={user.displayName} email={user.email} />
    </main>
  );
}
