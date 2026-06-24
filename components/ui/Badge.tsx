import { cn } from "@/lib/cn";

export type BadgeTone = "default" | "gold" | "success" | "danger" | "warning" | "muted";

const toneClasses: Record<BadgeTone, string> = {
  default: "bg-elevated text-text border border-border",
  gold: "bg-gold/15 text-gold-bright border border-gold/30",
  success: "bg-success/15 text-success border border-success/30",
  danger: "bg-danger/15 text-danger border border-danger/30",
  warning: "bg-warning/15 text-warning border border-warning/30",
  muted: "bg-elevated/60 text-muted border border-border/60",
};

export function Badge({
  tone = "default",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium leading-none",
        toneClasses[tone],
        className,
      )}
      {...props}
    />
  );
}
