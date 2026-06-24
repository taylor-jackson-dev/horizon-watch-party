import Link from "next/link";
import { signOutAction } from "@/app/actions/auth";
import { buttonVariants } from "@/components/ui";
import { FilmIcon } from "@/components/ui/icons";
import { UserMenu } from "./UserMenu";

export interface TopBarUser {
  displayName?: string | null;
  email?: string | null;
  isPremium?: boolean;
}

interface TopBarProps {
  user?: TopBarUser | null;
}

export function TopBar({ user }: TopBarProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-bg/70 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-4 px-4">
        <Link
          href={user ? "/dashboard" : "/"}
          className="flex items-center gap-2 group"
          aria-label="Watch Party home"
        >
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gold/15 text-gold ring-1 ring-gold/30 transition-colors group-hover:bg-gold/25">
            <FilmIcon size={18} />
          </span>
          <span className="font-display text-lg uppercase tracking-widest text-text">
            Watch <span className="text-gold">Party</span>
          </span>
        </Link>

        <nav className="ml-auto flex items-center gap-2">
          {user ? (
            <UserMenu
              displayName={user.displayName}
              email={user.email}
              isPremium={user.isPremium}
              signOutAction={signOutAction}
            />
          ) : (
            <>
              <Link href="/signin" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                Sign in
              </Link>
              <Link href="/dashboard" className={buttonVariants({ variant: "primary", size: "sm" })}>
                Get started
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
