import { cn } from "@/lib/cn";
import { TopBar, type TopBarUser } from "./TopBar";

type ShellWidth = "narrow" | "default" | "wide";

const widthClass: Record<ShellWidth, string> = {
  narrow: "max-w-xl",
  default: "max-w-3xl",
  wide: "max-w-7xl",
};

interface AppShellProps {
  user?: TopBarUser | null;
  width?: ShellWidth;
  className?: string;
  children: React.ReactNode;
}

/** App chrome: sticky top bar + centered page container over the dim ambient. */
export function AppShell({
  user,
  width = "default",
  className,
  children,
}: AppShellProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <TopBar user={user} />
      <main
        className={cn(
          "mx-auto w-full px-4 py-8",
          widthClass[width],
          className,
        )}
      >
        {children}
      </main>
    </div>
  );
}
