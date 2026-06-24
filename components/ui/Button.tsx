import { forwardRef } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "ghost" | "subtle" | "danger";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

const base =
  "inline-flex items-center justify-center gap-2 font-medium rounded-xl whitespace-nowrap " +
  "transition-colors duration-150 select-none focus-visible:outline-none " +
  "focus-visible:ring-2 focus-visible:ring-gold/60 focus-visible:ring-offset-2 " +
  "focus-visible:ring-offset-bg disabled:opacity-50 disabled:cursor-not-allowed";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-gold text-on-gold font-semibold shadow-glow hover:bg-gold-bright disabled:shadow-none",
  ghost:
    "border border-border bg-surface/40 text-text hover:bg-elevated hover:border-border-strong",
  subtle: "text-muted hover:text-text hover:bg-elevated/60",
  danger: "border border-danger/40 text-danger hover:bg-danger/10",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "text-xs px-3 py-1.5",
  md: "text-sm px-4 py-2",
  lg: "text-base px-5 py-2.5",
  icon: "h-9 w-9 p-0",
};

/** Returns the merged class string — use on <button> via <Button> or on a <Link>. */
export function buttonVariants(opts: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}): string {
  const { variant = "primary", size = "md", className } = opts;
  return cn(base, variantClasses[variant], sizeClasses[size], className);
}

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant, size, className, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={buttonVariants({ variant, size, className })}
      {...props}
    />
  ),
);
Button.displayName = "Button";
