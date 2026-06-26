# Phase 5.4 — Mobile-Responsive + PWA (Manifest · Service Worker · Install)

**Status:** ✅ Complete + verified live (2026-06-25) — static checks green (typecheck · lint · build) and confirmed on a real phone + desktop ("Everything checks out").
**Follow-up:** §5.4.1 below — combined People panel (presentation-only), 🔄 static-green, awaiting its own two-device live pass.
**Live:** web `https://water-party-private-repo.vercel.app` · socket on Railway (deploys on push to `main`).

---

## Goal

Two things, per the brief:
1. **PWA** — installable app: web manifest + service worker (+ icons, offline fallback, install affordance).
2. **Mobile-appropriate view modes** — before this, the theater/focus/split presets were an `lg+`-only concern; below `lg` every mode just stacked to one column. Give mobile a real, intentional layout.

Presentation-only, in the 5.2/5.3 spirit: **zero sync / voice / chat logic touched.**

## Decisions locked (via question prompt)
- **Mobile layout = tabbed** below a pinned video (Chat · Queue · People) — *not* a stacked scroll or a bottom-sheet. It's the mobile counterpart of the desktop segmented view-mode control.
- **Desktop split = unify for zero-reload.** Accepted a small split tweak in exchange: presence/voice now live **in the side rail** (compact, side-by-side) instead of tucking under the video. Theater + focus are visually unchanged.
- **Install button = web/desktop only.** Lives in the top bar; only renders when the browser fires `beforeinstallprompt`. The future native app build won't need it (it naturally stays hidden on iOS Safari + inside the installed standalone app).

---

## The architectural core — one fixed DOM, zero remounts

`VideoPlayer` (the YouTube iframe) and `VoicePanel` (the LiveKit `useVoiceRoom` call) are **stateful singletons**: remounting either reloads the video / drops the voice call. The pre-5.4 RoomShell had **per-mode JSX branches** that slotted the panels into *different DOM parents* per view mode — so a theater→split switch unmounted + remounted them. That was a **latent bug** (a mode switch could drop your voice call), tolerable only because switching was rare.

A naive mobile fix (JS breakpoint → render a different tree) would make it **worse**: SSR can't know the viewport, so it'd guess wrong and remount on first paint for one platform, plus remount on every iPad rotation.

**Fix:** collapse everything into **ONE fixed DOM** where the stage, queue, presence, voice, and chat are each **mounted exactly once.** Theater / focus / split *and* the mobile tabs are now driven **purely by CSS class changes** — `display`/grid utilities computed per mode. No branch ever unmounts a panel. This:
- makes mobile tab-switching and desktop mode-switching **instant + state-preserving**, and
- **fixes the latent remount-on-switch bug** for free (voice survives every layout change).

### How the responsive classes compose
Each element gets a **single `lg:` display value** (chosen by a ternary on `viewMode`) plus a mobile base value (chosen by `mobileTab`). `cn` (`twMerge`) keeps base + `lg:` because they're different breakpoint keys. Helpers in `RoomShell`:
- `railLgDisplay` — `lg:hidden` in focus, else `lg:flex`.
- `peopleLgClass` — `lg:hidden` (focus) · `lg:grid lg:grid-cols-2` (split, side-by-side) · `lg:flex lg:flex-col` (theater, stacked).
- `chatLgClass` — `lg:hidden` (focus) · else `lg:flex-1` (fills the rail).
- `gridColsClass` (unchanged from 5.3) — the root grid template per mode.

Mobile ignores `viewMode` entirely and keys off `mobileTab`. Because the hidden panels are `display:none` (removed from flow), the *active* tab's content always renders directly under the tab bar regardless of which grid column it physically lives in.

## What was built — Mobile (RoomShell)
- **Tab state** `mobileTab: "chat" | "queue" | "people"`, persisted to `localStorage` (`wp:mtab`) following the `wp:viewmode`/`wp:fschat` convention. SSR-safe: seed `"chat"`, hydrate on mount.
- **Mobile tab bar** (`lg:hidden`, a 3-up segmented control) below the player — the mobile sibling of the desktop view-mode control. Hidden in fullscreen.
- **Layouts per tab (<lg):** Chat → a 60dvh chat panel; Queue → the full queue; People → presence + voice stacked. Video stays pinned at the top of the column above the tabs.
- Desktop (`lg+`) is unchanged behaviorally: theater rail, focus full-width, split wide-chat — now all expressed as CSS on the single DOM.
- Tightened mobile spacing (`gap-4` / `space-y-4` on mobile, `lg:gap-6` / `lg:space-y-6` up top).
- New `MobileTabButton` helper (mirrors `StageModeButton`); new icons reused: `FilmIcon` (Queue), `UsersIcon` (People), `ChatBubbleIcon` (Chat).

## What was built — PWA
- **`app/manifest.ts`** (`MetadataRoute.Manifest`) → served at `/manifest.webmanifest`: name/short_name, `start_url: /dashboard`, `scope: /`, `display: standalone`, cinema colors (`#0c0c0e`), categories, and the icon set (192 + 512 `any`, 512 `maskable`).
- **`app/layout.tsx`** — `metadataBase`, `applicationName`, `manifest`, `icons` (favicon-32 + icon.svg + apple-touch-icon), `appleWebApp` (capable, black status bar), and a `viewport` export (`width=device-width`, `viewport-fit: cover` for notches, `themeColor #0c0c0e`). Body mounts `<ServiceWorkerRegister />`.
- **`public/sw.js`** — deliberately conservative for a real-time/authed app: non-GET, `/api/*`, and cross-origin (YouTube/LiveKit/avatars) **pass through untouched**; page navigations are **network-first** with an offline fallback (HTML is **never** cached, so no stale/cross-user pages); `/_next/static` is cache-first (immutable); other same-origin GETs are stale-while-revalidate. `skipWaiting` + `clients.claim` + old-cache purge on activate.
- **`components/pwa/ServiceWorkerRegister.tsx`** — registers `/sw.js` on load. **Production-only** (registering in dev fights Next HMR / serves stale chunks). Best-effort; failures swallowed.
- **`components/pwa/InstallButton.tsx`** — captures `beforeinstallprompt`, renders a ghost "Install app" button in the top bar only when installable; clears the saved prompt after use and on `appinstalled`.
- **Icons + assets** — `public/icon.svg` (512 maskable-safe cinema mark) rasterized to `icon-192/512`, `icon-maskable-512`, `apple-touch-icon` (opaque bg), `favicon-32` via `scripts/generate-icons.mjs` (uses `sharp`; PNGs committed as static assets so the build never depends on sharp). `public/offline.html` — themed offline fallback.

## Responsive audit (rest of the app)
Swept landing, dashboard, room header, auth (signin/signup), settings, and the
forms. All already responsive — `px-4` everywhere (via `AppShell`), `sm:`/`lg:`
grids, `max-w` containers, `flex-wrap` headers, `truncate` + `min-w-0` on names.
The only two fixed-pixel widths are safe: the FS chat overlay is capped
`max-w-[80%]`, and the top-bar display name is `hidden` below `sm`. **No changes
needed** beyond RoomShell — the room's view modes were the only real mobile gap.

## Files touched
**New:** `app/manifest.ts` · `public/sw.js` · `public/offline.html` · `public/icon.svg` ·
`public/icon-192.png` · `public/icon-512.png` · `public/icon-maskable-512.png` ·
`public/apple-touch-icon.png` · `public/favicon-32.png` · `scripts/generate-icons.mjs` ·
`components/pwa/ServiceWorkerRegister.tsx` · `components/pwa/InstallButton.tsx` ·
`journal/PHASE_5_4_MOBILE_PWA.md`
**Modified:** `app/layout.tsx` · `components/layout/TopBar.tsx` ·
`components/ui/icons.tsx` (`DownloadIcon`) · `components/room/RoomShell.tsx` ·
`PLAN.md` · `journal/HANDOFF.md`

## Verification
- ✅ `npm run typecheck` clean · `npm run lint` clean · `npm run build` clean
  (all 14 routes; `/manifest.webmanifest` registered; `/room/[code]` builds).
- ⚠️ **Could not exercise the room UI locally** — the room page needs an authed
  session + the socket server + DB, so the responsive behavior is verified by
  build/type/lint plus reasoning, then on the deployed app. Per project workflow,
  **live two-device verification is the gate.**

### Live checklist (to run on a real phone + desktop)
- [ ] Mobile: video pinned on top; tab bar switches Chat / Queue / People; active tab reads.
- [ ] Mobile: chat sends/receives; queue add/select works; presence + voice render.
- [ ] **Switching mobile tabs does NOT reload the video or drop a joined voice call.**
- [ ] Desktop: theater / focus / split unchanged; **switching modes preserves video + voice** (the latent remount bug is gone).
- [ ] Tab + view-mode choices persist across reload (per-browser).
- [ ] Install: desktop Chrome shows "Install app"; installs to a standalone window; app icon + name correct.
- [ ] Offline: killing the network on a navigation shows `offline.html`.
- [ ] iOS: "Add to Home Screen" uses the apple-touch-icon; standalone launch opens `/dashboard`; notch-safe (`viewport-fit: cover`).
- [ ] Host **and** viewer on two devices: sync, reactions, voice all unaffected.

## Follow-ups / known limits
- **B2 — voice mic on mobile Safari** (`NotAllowedError`) still open; surfaced again
  by this phase since mobile is now first-class. Needs a real permission-request flow
  + user-facing error.
- **"Pinned" video on mobile = top-of-column, not `position: sticky`.** If testers
  want the video to stay on-screen while chat scrolls, add a mobile `sticky` to the
  stage (watch z-index vs. the reaction overlay + fullscreen).
- The empty side-rail on the mobile Queue tab leaves ~1rem of trailing grid gap —
  cosmetic, negligible.
- Service worker is intentionally minimal (no offline app shell, no push). Revisit if
  we want true offline browsing or notifications.

---

# Phase 5.4.1 — Combined "People" Panel (Watching + Voice in one)

**Status:** 🔄 Static checks green (typecheck · lint · build) — **awaiting two-device live verification.** Presentation-only follow-up to 5.4.
**Live:** same as above (deploys on push to `main`).

## Goal
Host feedback after the 5.4 mobile pass: under the mobile **People** tab the
"Watching" box and the "Voice" box were two stacked panels. Merge them into **one
clean interface** — every viewer is a single row with a **mic icon at the far end
(opposite the name)** that toggles the mic on/off — and move the **Join voice chat**
button **directly below** the roster. The push-to-talk / open-mic mode selector
becomes a **future voice settings** concern, not an in-room control.

## Decisions locked (via question prompt)
- **Scope = everywhere.** The one combined panel is used in **both** the mobile People
  tab **and** the desktop side rail — not a mobile-only variant. This keeps the 5.4
  one-fixed-DOM invariant intact: the LiveKit voice call (`useVoiceRoom`) still mounts
  **exactly once**, so layout/tab switches never drop the call.
- **Mic default = open-mic, joined muted.** You join voice silent; tap your own mic
  icon to start talking (and again to mute). No PTT in the room UI for now.

## The merge — how presence and voice line up
Two independent sources, joined by id:
- **Presence** (socket `room:presence`) is the **master roster** — who's in the room,
  display name, away flag, headcount. This drives the rows.
- **Voice** (`useVoiceRoom` → LiveKit participants) supplies per-person mic + speaking
  state, but **only once you've joined** (LiveKit only reports the call roster to a
  connected client).

They join cleanly because **LiveKit identity === Watch Party userId**
(`lib/livekit.ts` sets `identity: userId`). PeoplePanel builds
`voiceById = new Map(participants.map(p => [p.identity, p]))` and each roster row looks
up its live voice state in O(1). A viewer who's in the room but not on the call simply
has no voice entry → **no mic cell** (they're "just watching").

## What was built
**New `components/room/PeoplePanel.tsx`** — folds the old PresencePanel + VoicePanel
into one `Panel title="Watching"`:
- **Roster rows:** presence dot (success / muted-when-away) · truncated name (gold +
  "(you)" for self) · `away` tag · **`MicCell` at the far right**.
- **`MicCell`** (per-row mic affordance), four states:
  - *not on the call* → renders nothing.
  - *you, muted by host* → a locked, non-interactive danger off-icon ("Muted by host").
  - *you* → a **button** toggling open-mic (`setOpenMicEnabled`), success-tinted when on.
  - *someone else* → read-only indicator; **highlights success while they're speaking**,
    dim when on, muted when off.
  - **Speaking ring** — anyone actively picking up sound (you included) gets a green
    ring around their mic icon: the live "voice is working" cue. Gated on mic-on and
    fades via CSS `transition`. **Detection is dual-source:** others use LiveKit's
    server `ActiveSpeakersChanged` (`isSpeaking`); your OWN ring is driven by a
    **local Web Audio level poll** (`createAudioAnalyser` on the mic track, rAF loop,
    threshold 0.02) because the server event is debounced + round-trips and visibly
    lagged your own voice. The local flag is merged onto the local participant in
    `useVoiceRoom` so the UI stays a single `isSpeaking` read.
- **Below the roster:** the voice controls — `Join voice chat` (→ `Joining…` /
  `Reconnecting…`), or when connected a short status line + a `Leave` button; voice
  errors surface here. Voice-disabled / view-only show a one-line note instead of a
  button. Then the viewer-only **Step away / I'm back** toggle.
- Kept `publishRoomPresenceCount(snapshot.count)` on every presence event — the
  RoomHeadcountBadge in the room header subscribes to it.

**`lib/use-voice-room.ts`** — default `mode` flipped `"ptt"` → `"open"` (join muted,
`openMicEnabled` stays `false`). **All PTT machinery kept** (keyboard handler, on-screen
press/release, `pttKeyLabel`) — it early-returns while `mode !== "ptt"`, ready to re-arm
from a future voice settings page.

**`components/room/RoomShell.tsx`** — `presenceNode` + `voiceNode` replaced by one
`peopleNode = <PeoplePanel … />` (now also takes `roomId`, `voiceEnabled`, `isMicMuted`,
`isViewOnly`). The people slot in the rail renders the single node; `peopleLgClass`
simplified — **split** no longer needs the side-by-side 2-col (one panel now), so it
stacks above chat like theater. Still one fixed DOM; still pure-CSS mode/tab switches.

**Deleted:** `components/room/PresencePanel.tsx` · `components/room/VoicePanel.tsx`
(only RoomShell referenced them).

## Files touched
**New:** `components/room/PeoplePanel.tsx`
**Modified:** `components/room/RoomShell.tsx` · `lib/use-voice-room.ts` · `PLAN.md` ·
`journal/PHASE_5_4_MOBILE_PWA.md` · `journal/HANDOFF.md`
**Deleted:** `components/room/PresencePanel.tsx` · `components/room/VoicePanel.tsx`

## Verification
- ✅ `npm run typecheck` clean · `npm run lint` clean · `npm run build` clean
  (all 14 routes; `/room/[code]` builds).
- ⚠️ Room UI can't be exercised locally (needs authed session + socket + DB), so
  behavior is verified by build/type/lint + reasoning, then live. **Two-device live
  verification is the gate.**

### Live checklist (real phone + desktop)
- [ ] People panel shows ONE box: roster with a mic icon at the right of each name.
- [ ] Before joining voice: no mic icons (you can't see the call roster yet); the
      `Join voice chat` button sits directly below the roster.
- [ ] Tap `Join voice chat` → you join **muted**; your row's mic icon appears (off).
- [ ] Tap **your** mic icon → you go live (icon turns on); tap again → muted.
- [ ] Other participants' mic icons reflect their state and **highlight while they talk**.
- [ ] A green **ring** appears around any mic icon (yours + others') while sound is being
      picked up and clears when they stop — the "voice is working" cue.
- [ ] Host-muted member sees a locked off-icon ("Muted by host"), can't toggle.
- [ ] `Leave` drops the call; `Step away` / `I'm back` still works (viewer only).
- [ ] **Switching mobile tabs / desktop view modes does NOT drop a joined voice call**
      (the panel — and the voice hook — mounts once everywhere).
- [ ] Desktop rail (theater + split) shows the same one combined panel above chat.
- [ ] Voice-disabled room and view-only member each show the right note, no button.

## Follow-ups / known limits
- **PTT / open-mic selector now lives nowhere in-room** — intentionally deferred to a
  future **voice settings page**. The hook still supports both modes.
- **B2 — voice mic on mobile Safari** (`NotAllowedError`) still open; even more central
  now that the mic toggle is the primary voice control. Needs a real permission flow.
- Pre-join we can't show who else is already on the call (LiveKit only reports the
  roster to a connected client). Acceptable; a socket-level voice presence would be a
  larger change.
