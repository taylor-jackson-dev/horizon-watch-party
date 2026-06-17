"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { DISPLAY_NAME_MAX } from "@/lib/validations/user";

interface ProfileFormProps {
  initialDisplayName: string;
  email: string;
}

export function ProfileForm({ initialDisplayName, email }: ProfileFormProps) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const trimmed = displayName.trim();
  const unchanged = trimmed === initialDisplayName.trim();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      const res = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: trimmed }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Request failed (${res.status})`);
      }
      setSaved(true);
      // Refresh server components (dashboard greeting, room rosters re-read on next load).
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-4">
      <div className="space-y-1">
        <label htmlFor="displayName" className="text-sm font-medium">
          Display name
        </label>
        <input
          id="displayName"
          className="input"
          placeholder="Display name"
          value={displayName}
          onChange={(e) => {
            setDisplayName(e.target.value);
            setSaved(false);
          }}
          maxLength={DISPLAY_NAME_MAX}
          required
        />
        <p className="text-xs text-brand-muted">
          Shown in chat, voice, and the room roster.
        </p>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-brand-muted">Email</label>
        <p className="text-sm text-brand-muted">{email}</p>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {saved && !error && <p className="text-sm text-emerald-400">Saved.</p>}

      <button
        type="submit"
        className="btn-primary"
        disabled={saving || unchanged || !trimmed}
      >
        {saving ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
