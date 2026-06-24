import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signIn } from "@/lib/auth";
import { FilmIcon } from "@/components/ui/icons";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: { callbackUrl?: string; error?: string };
}) {
  const session = await auth();
  if (session?.user) redirect(searchParams.callbackUrl ?? "/dashboard");

  async function googleSignIn() {
    "use server";
    await signIn("google", { redirectTo: searchParams.callbackUrl ?? "/dashboard" });
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 px-4">
      <Link href="/" className="flex items-center gap-2" aria-label="Watch Party home">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-gold/15 text-gold ring-1 ring-gold/30">
          <FilmIcon size={18} />
        </span>
        <span className="font-display text-lg uppercase tracking-widest text-text">
          Watch <span className="text-gold">Party</span>
        </span>
      </Link>

      <div className="card w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="font-display text-3xl uppercase tracking-wide text-text">Sign in</h1>
          <p className="text-sm text-muted">
            Watch movies together — bring your friends.
          </p>
        </div>

        {searchParams.error && (
          <p className="text-sm text-red-400 text-center">
            Sign-in failed: {searchParams.error}
          </p>
        )}

        <form action={googleSignIn}>
          <button type="submit" className="btn-primary w-full">
            Continue with Google
          </button>
        </form>

        <p className="text-xs text-brand-muted text-center">
          Email & password sign-in coming soon.
        </p>
      </div>
    </main>
  );
}
