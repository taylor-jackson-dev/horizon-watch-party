# Phase 5.4 — Mobile-Responsive + PWA (Manifest · Service Worker · Install)

**Status:** 🔄 Static checks green (typecheck · lint · build) — **awaiting two-device live verification.** Not marked complete until confirmed on a real phone + desktop vs. the deployed app.
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
