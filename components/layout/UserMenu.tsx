"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui";
import { ChevronDownIcon, SettingsIcon, LogOutIcon } from "@/components/ui/icons";

interface UserMenuProps {
  displayName?: string | null;
  email?: string | null;
  isPremium?: boolean;
  signOutAction: () => Promise<void>;
}

export function UserMenu({
  displayName,
  email,
  isPremium,
  signOutAction,
}: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  const label = displayName || email || "Account";
  const initial = label.trim().charAt(0).toUpperCase() || "?";

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex items-center gap-2 rounded-xl border border-border bg-surface/40 py-1 pl-1 pr-2.5",
          "hover:bg-elevated hover:border-border-strong transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50",
        )}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-gold text-on-gold font-display text-sm font-semibold">
          {initial}
        </span>
        <span className="hidden sm:block max-w-[10rem] truncate text-sm text-text">
          {label}
        </span>
        <ChevronDownIcon size={16} className="text-muted" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-60 origin-top-right rounded-xl border border-border bg-overlay/95 backdrop-blur-md p-1.5 shadow-panel animate-fade-in z-50"
        >
          <div className="px-2.5 py-2">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-medium text-text">{label}</p>
              {isPremium && <Badge tone="gold">Premium</Badge>}
            </div>
            {email && email !== label && (
              <p className="truncate text-xs text-muted">{email}</p>
            )}
          </div>
          <div className="my-1 h-px bg-border/70" />
          <Link
            href="/settings"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-text hover:bg-elevated transition-colors"
          >
            <SettingsIcon size={16} className="text-muted" />
            Settings
          </Link>
          <form action={signOutAction}>
            <button
              type="submit"
              role="menuitem"
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-text hover:bg-elevated transition-colors"
            >
              <LogOutIcon size={16} className="text-muted" />
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
