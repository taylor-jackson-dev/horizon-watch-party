"use client";

import { useEffect, useState } from "react";
import { buttonVariants } from "@/components/ui";
import { DownloadIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";

// `beforeinstallprompt` isn't in the standard DOM lib types.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * Web/desktop PWA install affordance. Only renders once the browser fires
 * `beforeinstallprompt` (i.e. installable + not already installed) — so it
 * naturally stays hidden on iOS Safari and inside the installed standalone
 * app, which don't fire the event. Native app builds won't need this.
 */
export function InstallButton({ className }: { className?: string }) {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPromptEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setPromptEvent(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!promptEvent) return null;

  const install = async () => {
    await promptEvent.prompt();
    await promptEvent.userChoice.catch(() => undefined);
    // The prompt can only be used once; drop it either way.
    setPromptEvent(null);
  };

  return (
    <button
      type="button"
      onClick={install}
      className={cn(buttonVariants({ variant: "ghost", size: "sm" }), className)}
      aria-label="Install Watch Party app"
    >
      <DownloadIcon size={16} />
      <span className="hidden sm:inline">Install app</span>
    </button>
  );
}
