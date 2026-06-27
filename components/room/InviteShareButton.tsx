"use client";

import { useEffect, useRef, useState } from "react";
import { Button, type ButtonSize, type ButtonVariant } from "@/components/ui";
import { CheckIcon, CloseIcon, ShareIcon } from "@/components/ui/icons";

interface InviteShareButtonProps {
  joinCode: string;
  roomName?: string;
  size?: ButtonSize;
  variant?: ButtonVariant;
  label?: string;
  className?: string;
}

/**
 * Copy / native-share an invite link to a room. The link is just the room URL
 * (`/room/<code>`) — opening it auto-joins public rooms and prompts for a
 * password on private ones (see JoinGate). Prefers the native share sheet when
 * available (mobile), otherwise copies to the clipboard with a "Copied!" cue.
 */
export function InviteShareButton({
  joinCode,
  roomName,
  size = "sm",
  variant = "ghost",
  label = "Invite",
  className,
}: InviteShareButtonProps) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");
  const resetTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => clearTimeout(resetTimer.current), []);

  function flash(next: "copied" | "failed") {
    setStatus(next);
    clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setStatus("idle"), 2000);
  }

  async function onShare() {
    const url = `${window.location.origin}/room/${joinCode}`;
    const shareData = {
      title: "Watch Party",
      text: roomName ? `Join "${roomName}" on Watch Party` : "Join my Watch Party room",
      url,
    };

    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share(shareData);
        return;
      } catch (err) {
        // User dismissed the native sheet — leave it at that.
        if (err instanceof DOMException && err.name === "AbortError") return;
        // Anything else (share unsupported for this payload) → fall back to copy.
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      flash("copied");
    } catch {
      // No share API and clipboard blocked (insecure context / policy) — tell the user.
      flash("failed");
    }
  }

  const forName = roomName ? ` for ${roomName}` : "";
  const ariaLabel =
    status === "copied"
      ? "Invite link copied"
      : status === "failed"
        ? "Copy failed"
        : `Share invite link${forName}`;

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={onShare}
      aria-label={ariaLabel}
    >
      {status === "copied" ? (
        <CheckIcon size={16} className="text-success" />
      ) : status === "failed" ? (
        <CloseIcon size={16} className="text-danger" />
      ) : (
        <ShareIcon size={16} />
      )}
      {status === "copied" ? "Copied!" : status === "failed" ? "Copy failed" : label}
    </Button>
  );
}
