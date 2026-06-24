import { cn } from "@/lib/cn";

/** Plain elevated surface. Defaults to comfortable padding (matches `.card`). */
export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-surface p-4 shadow-panel",
        className,
      )}
      {...props}
    />
  );
}
