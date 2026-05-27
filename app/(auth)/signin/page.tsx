import { redirect } from "next/navigation";
import { auth, signIn } from "@/lib/auth";

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
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="card w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold text-brand-gold">Sign in</h1>
          <p className="text-sm text-brand-muted">
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
