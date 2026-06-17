# Phase 4.4 — Profile, Presence & Step-Away

**Date:** 2026-06-17
**Status:** Code complete, static checks pass; live multi-device verification pending (user, post-deploy)

---

## Scope (approved at phase start)

From the eight 4.4 candidates in `PLAN.md`, three were approved and the rest cut:

| ID | Feature | What it does |
|----|---------|--------------|
| **F1** | Display-name edit | Settings UI to rename yourself. `User.displayName` already existed — no migration. |
| **B1/F8** | Presence-based live viewer count | Socket-driven count + roster, replacing the stale SSR `members where status=ACTIVE` count. Also fixes the known bug where the count only updated on page refresh (and refresh restarted the video). |
| **F7** | Step-away (AFK) mode | A viewer flags themselves away; their video keeps playing and they detach from host re-sync. Distinct from leaving. |

**Cut** (deferred, still listed in PLAN.md): avatar upload, status messages, lurker-mode UI, avatar reactions, per-participant volume slider.

**Added mid-phase** (bug found during smoke test): mobile fullscreen fix — see below.

**Key win:** zero DB migrations. `displayName` already exists; presence and the away flag are ephemeral in-memory socket state.

---

## Architecture

### Presence + step-away (one socket channel)

Both B1/F8 and F7 ride a single `room:presence` broadcast — presence entries carry the `away` flag, so there's no second connection and `displayName` comes free from the existing join membership query.

Server state (`server/socket-server.ts`):
```ts
interface PresenceEntry { sockets: Set<string>; displayName: string; away: boolean; }
const roomPresence = new Map<string, Map<string, PresenceEntry>>();  // channel -> userId -> entry
```
- **Multi-tab safe:** a user has a `Set` of socket ids; we only drop them from the roster when their *last* socket disconnects.
- `addPresence` / `removePresence` mutate the maps; `broadcastPresence(channel)` emits `room:presence { count, viewers: [{userId, displayName, away}] }` to the room.
- Wired into `room:join` (add + broadcast), `room:leave` (remove + broadcast), and `disconnect` (per-room remove + broadcast, via `s.data.rooms.forEach(...)`).
- New event `presence:set-away { roomId, away }` flips the entry's `away` and re-broadcasts.

Client:
- `components/room/PresencePanel.tsx` — subscribes to `room:presence`, renders `count/capacity` (+ "· N away"), a roster with green/dimmed dots, self highlighted, and the **Step away / I'm back** toggle (viewers only — host is driving playback).
- `components/room/RoomShell.tsx` — owns `isAway` state mirrored into `isAwayRef` for the stable socket closures. While away: incoming `video:state` is ignored, and the viewer's own play/pause does **not** fire `video:request-sync`. On return, emits `presence:set-away{away:false}` plus one `video:request-sync` for a clean snap back into sync.

### F1 display-name edit
- `lib/validations/user.ts` — `updateProfileSchema` (trimmed, 1–40 chars).
- `app/api/users/me/route.ts` — `PATCH`, `requireUser` guard, Zod validation, updates `displayName`.
- `components/settings/ProfileForm.tsx` — client form; PATCH then `router.refresh()`; save disabled when unchanged/empty/saving.
- `app/settings/page.tsx` — auth-guarded server page rendering the form.
- `app/dashboard/page.tsx` — greeting now uses `displayName`; added a Settings link.

### Mobile fullscreen fix (RoomShell.tsx + globals.css)
- **Root cause:** the fullscreen button calls `requestFullscreen()` on the player-stage `<div>` (so our reaction overlay rides along on top). **iPhone Safari has no element Fullscreen API** — it only fullscreens `<video>` — so neither `requestFullscreen` nor `webkitRequestFullscreen` exists on a div there, and the button silently did nothing. Desktop/Android were unaffected.
- **Fix:** feature-detect native FS; when unavailable, fall back to CSS pseudo-fullscreen — toggle a `wp-fs-css` class that pins `.wp-player-stage` to `position:fixed; inset:0` at `100dvw/100dvh`. The overlay + FS button (absolute children) anchor to the pinned stage, so exit stays reachable. Native path is byte-for-byte unchanged on desktop/Android (only gated behind `canNative`).

---

## Page header cleanup

`app/room/[code]/page.tsx` previously showed a stale SSR `N/capacity active` count in the header. Removed it (avoided two conflicting counts) and now pass `initialActiveCount` + `capacity` into `RoomShell` → `PresencePanel`, which seeds the badge so it doesn't flash `0` before the first presence event.

---

## Files

**Created:** `lib/validations/user.ts`, `app/api/users/me/route.ts`, `components/settings/ProfileForm.tsx`, `app/settings/page.tsx`, `components/room/PresencePanel.tsx`
**Edited:** `server/socket-server.ts`, `components/room/RoomShell.tsx`, `app/room/[code]/page.tsx`, `app/dashboard/page.tsx`, `app/globals.css`

---

## Verification

- `npm run typecheck` — pass
- `npm run lint` — pass (no warnings)
- Both dev servers boot clean; routes compile and guard correctly.
- **Live verification (user, post-deploy, 2 devices):**
  - F1 — rename persists across refresh; shows in dashboard greeting, room roster, chat.
  - B1/F8 — Watching panel shows live count + roster without refresh; second device joining bumps the count live.
  - F7 — viewer Step away dims their dot + shows "· 1 away"; video keeps playing while away; I'm back snaps cleanly to host.
  - Mobile FS — iPhone fullscreen button now fills the screen (CSS fallback); desktop FS unchanged.

---

## Known limitations / gotchas

- **Reconnect under-reports presence:** a transient socket reconnect doesn't re-emit `room:join`, so the roster can briefly under-report until the component remounts. Pre-existing gap that also affects video sync; not addressed here.
- **TS Set iteration:** `tsconfig.json` has no `target` (defaults low), so `for…of` over a `Set` doesn't compile. Used `s.data.rooms.forEach(...)` in the disconnect handler to keep the change local instead of bumping the global target.
- The host intentionally has **no** step-away toggle. If a test account is the room host, that page correctly shows none.

---

## Still-open bugs (carried from deployment, not in 4.4 scope)

- **B2** — Voice mic on mobile Safari: `NotAllowedError`; needs a better permission-request flow + user-facing error.
- **B3** — YouTube player black screen on first load; refresh fixes it. IFrame API init race.
