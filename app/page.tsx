import Link from "next/link";
import { auth } from "@/lib/auth";
import { TopBar } from "@/components/layout/TopBar";
import { buttonVariants } from "@/components/ui";
import {
  FilmIcon,
  PlayIcon,
  SendIcon,
  MicIcon,
  UsersIcon,
} from "@/components/ui/icons";

const FEATURES = [
  {
    icon: FilmIcon,
    title: "Synced playback",
    body: "Everyone sees the same frame, down to the second.",
  },
  {
    icon: SendIcon,
    title: "Live chat",
    body: "React and talk through every scene together.",
  },
  {
    icon: UsersIcon,
    title: "Floating reactions",
    body: "Emoji light up the screen the moment they hit.",
  },
  {
    icon: MicIcon,
    title: "Voice chat",
    body: "Hop on mic for the full hangout — opt-in, push-to-talk.",
  },
];

export default async function HomePage() {
  const session = await auth();
  const user = session?.user
    ? {
        displayName: session.user.name,
        email: session.user.email,
        isPremium: session.user.tier === "PREMIUM",
      }
    : null;

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar user={user} />

      <main className="mx-auto w-full max-w-5xl px-4">
        {/* Hero */}
        <section className="flex flex-col items-center pt-16 pb-12 text-center sm:pt-24">
          <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-3 py-1 font-display text-xs uppercase tracking-[0.2em] text-gold-bright">
            <span className="h-1.5 w-1.5 rounded-full bg-gold animate-glow-pulse" />
            Your virtual theater
          </span>

          <h1 className="font-display text-5xl font-bold uppercase leading-[1.05] tracking-tight text-text sm:text-7xl">
            Watch together,
            <br />
            <span className="text-gold">from anywhere.</span>
          </h1>

          <p className="mt-6 max-w-xl text-lg text-muted">
            Synced playback, live chat, reactions, and voice — your own movie
            theater with friends and family, in real time.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/dashboard"
              className={buttonVariants({ variant: "primary", size: "lg" })}
            >
              {user ? "Enter the lobby" : "Get started — it's free"}
            </Link>
            {!user && (
              <Link
                href="/signin"
                className={buttonVariants({ variant: "ghost", size: "lg" })}
              >
                Sign in
              </Link>
            )}
          </div>
        </section>

        {/* The screen */}
        <section className="pb-16">
          <div className="relative mx-auto aspect-video w-full max-w-3xl overflow-hidden rounded-2xl border border-border bg-black shadow-screen">
            <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_50%_-20%,rgb(var(--wp-glow)/0.18),transparent_60%)]" />
            <div className="absolute inset-0 grid place-items-center">
              <span className="grid h-20 w-20 place-items-center rounded-full bg-gold/15 text-gold ring-1 ring-gold/30">
                <PlayIcon size={36} />
              </span>
            </div>
            <div className="absolute bottom-3 left-4 flex items-center gap-2 font-display text-xs uppercase tracking-widest text-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-danger animate-glow-pulse" />
              Now showing
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="grid gap-4 pb-24 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="rounded-2xl border border-border bg-surface p-5 shadow-panel"
            >
              <span className="mb-3 grid h-10 w-10 place-items-center rounded-xl bg-gold/15 text-gold ring-1 ring-gold/25">
                <Icon size={20} />
              </span>
              <h3 className="font-display text-base uppercase tracking-wide text-text">
                {title}
              </h3>
              <p className="mt-1 text-sm text-muted">{body}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t border-border/70">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-5 text-xs text-muted">
          <span className="font-display uppercase tracking-widest">
            Watch <span className="text-gold">Party</span>
          </span>
          <span>Watch together, from anywhere.</span>
        </div>
      </footer>
    </div>
  );
}
