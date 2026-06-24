import { cn } from "@/lib/cn";

interface PanelProps {
  /** Marquee-style header label. Omit for a header-less panel. */
  title?: React.ReactNode;
  /** Optional leading icon next to the title. */
  icon?: React.ReactNode;
  /** Right-aligned header slot — counts, toggles, small buttons. */
  action?: React.ReactNode;
  /** When true the body scrolls and the panel fills its parent's height. */
  scroll?: boolean;
  /** Remove body padding (e.g. for a self-padded chat list). */
  flush?: boolean;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}

/** A structured cinema panel: marquee header + body. Used by the room rail. */
export function Panel({
  title,
  icon,
  action,
  scroll = false,
  flush = false,
  className,
  bodyClassName,
  children,
}: PanelProps) {
  return (
    <section
      className={cn(
        "flex flex-col rounded-2xl border border-border bg-surface shadow-panel overflow-hidden",
        scroll && "min-h-0",
        className,
      )}
    >
      {(title || action) && (
        <header className="flex items-center gap-2 px-4 py-2.5 border-b border-border/70 bg-elevated/30">
          {icon && <span className="text-gold shrink-0">{icon}</span>}
          {title && (
            <h2 className="font-display uppercase tracking-wider text-sm text-text">
              {title}
            </h2>
          )}
          {action && <div className="ml-auto flex items-center gap-1">{action}</div>}
        </header>
      )}
      <div
        className={cn(
          !flush && "p-4",
          scroll && "flex-1 min-h-0 overflow-y-auto",
          bodyClassName,
        )}
      >
        {children}
      </div>
    </section>
  );
}
