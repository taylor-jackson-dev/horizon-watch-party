# Phase 5.2 — Dark Cinema Design System + Layout Overhaul

**Status:** ✅ Complete — verified live on two devices (2026-06-24)
**Live:** web `https://water-party-private-repo.vercel.app` · socket on Railway

---

## Goal

Replace the ad-hoc styling with a real **dark cinema design system** and overhaul
the layout. Per the design brief: a *standard modern movie-theater* default
("Cinema") — bold theatrical type + soft shadows/glow, dim auditorium lighting —
built so **future color control** and **insertable theme skins** drop in without a
rewrite. This phase ships the theming **engine + primitives + layout shell**;
premium cosmetic skins are deferred to Phase 6.

Scope chosen (locked with the user): **in-house primitives, no new deps** ·
**full layout overhaul** (app chrome, page containers, real landing, room shell).

## Architecture — why it's built to swap

The whole engine is **CSS custom properties keyed by `data-` attributes on
`<html>`**, so a theme or lighting change is an attribute flip, never a code change:

- **Colors as space-separated RGB channels** — `--wp-bg: 12 12 14` — referenced via
  `rgb(var(--wp-token) / <alpha-value>)` in `tailwind.config.ts`. This is the key
  trick: it keeps Tailwind's opacity modifiers (`bg-surface/40`, `ring-gold/30`)
  working against runtime variables. Change a channel triple → every utility that
  uses it re-tints instantly.
- **Theme axis** — tokens live on `:root, [data-theme="cinema"]`. A new skin is just
  another `[data-theme="…"]` block overriding the same names. Nothing else changes.
- **Lighting axis** — `[data-lighting="dim"|"normal"]` drives `--wp-vignette` /
  `--wp-ambient`, consumed by the body's radial-gradient auditorium vignette.
  This is the seam the "possible color control for future iterations" request
  rides on — lighting is already a separate, swappable dimension.
- **Legacy `brand-*` aliases** kept in the Tailwind theme, mapped to the same vars,
  so pre-existing markup themes for free and migration was low-risk.

## What was built

**Engine**
1. `app/globals.css` (rewritten) — token block on `:root, [data-theme="cinema"]`
   (bg/surface/elevated/overlay, border(+strong), gold(+bright/dim/on), text/muted,
   danger/success/warning, glow, fonts, radius); `[data-lighting]` axis; body with
   the dim radial vignette; `.font-display`; `.card`/`.btn-*`/`.input` restyled onto
   tokens. **Preserved verbatim:** the `wp-react-float` keyframes (reactions) and the
   `.wp-player-stage` / `.wp-fs-css` fullscreen blocks — both load-bearing.
2. `tailwind.config.ts` (rewritten) — `v(token) => rgb(var(--wp-${token}) /
   <alpha-value>)`; semantic color scale + `brand.*` aliases; `font-sans`/`display`
   → CSS vars; `shadow-panel|glow|screen`; `glow-pulse` animation.
3. `app/layout.tsx` — self-hosted `next/font/google` (Inter → `--font-sans`, Oswald
   → `--font-display`); `<html data-theme="cinema" data-lighting="dim">`.
4. `lib/cn.ts` — `cn() = twMerge(clsx(...))`.

**In-house primitives** (`components/ui/`, no new deps)
- `Button.tsx` — hand-rolled `buttonVariants()` (variant × size), `Button` forwardRef.
- `Panel.tsx` — the cinema section: marquee header (display, uppercase, tracked) +
  gold icon + action slot + body; `flush`/`scroll`/`bodyClassName` knobs.
- `Card.tsx`, `Input.tsx`, `Badge.tsx` (tones incl. `warning`, added this phase),
  `icons.tsx` (inline SVG set), `index.ts` barrel.

**Layout shell** (`components/layout/`)
- `TopBar.tsx` (sticky `h-14`, blurred, wordmark + nav) · `UserMenu.tsx` (avatar
  dropdown, outside-click/Escape, sign-out) · `AppShell.tsx` (TopBar + centered
  container, `narrow|default|wide`). `app/actions/auth.ts` — `signOutAction`.

**Pages restyled**
- `app/page.tsx` — real cinematic landing (hero + faux "screen" + feature cards).
- `app/dashboard/page.tsx`, `app/settings/page.tsx`, `app/(auth)/signin/page.tsx`,
  `components/room/DashboardActions.tsx` — onto AppShell + primitives + tokens.

**Room overhaul** (presentation only — **zero** sync/voice/chat logic touched)
- `RoomShell.tsx` — theater stage gets `shadow-screen` + ring (on the stage box,
  **not** `overflow-hidden`: the frame already clips, and clipping the stage would
  kill the upward-floating reactions); inline fullscreen SVGs → `Maximize/MinimizeIcon`;
  "Now playing" marquee label; `SocketStatusLine` onto tokens; rail sticky offset
  bumped to `lg:top-20` to clear the new sticky TopBar.
- `QueuePanel.tsx` → `Panel` ("Up next") + `Input`/`Button` + icon row actions
  (play/▲▼/remove); capacity badge goes `warning` when full. add/remove/move
  handlers preserved verbatim.
- `PresencePanel.tsx`, `VoicePanel.tsx`, `ChatPanel.tsx` → `Panel` primitive; all
  hooks/effects/socket handlers untouched.
- `VideoPlayer.tsx` — placeholder token swap only.
- `app/room/[code]/page.tsx` → `AppShell width="wide"` + display header + Badges
  (role/code/private/status).

## Decisions locked

- **Engine now, skins later.** Only the default "Cinema" theme ships in 5.2. The
  `data-theme` seam means Phase 6 premium skins are additive (new blocks), and a
  future user-facing color/lighting control writes `data-*` attributes — no refactor.
- **In-house, no new deps** — hand-rolled `buttonVariants` (no cva), inline SVG
  icons (no icon lib).
- **`brand-*` aliases retained** to de-risk the migration; can be pruned later.

## Problems hit + resolutions

- `Badge` had no `warning` tone but the queue-full state wanted amber (not red) —
  added a `warning` tone backed by the existing `--wp-warning` token rather than
  abusing `danger`.
- Theater treatment vs. floating reactions: `overflow-hidden` on the stage would
  clip reactions mid-float → put rounding/clip on the inner frame (already there)
  and only `shadow-screen`/ring on the stage; gated those decorative classes off
  while fullscreen.
- New sticky TopBar would overlap the room's `lg:sticky` rail → rail offset
  `top-4` → `top-20`, height `100vh-8rem` → `100vh-6rem`.

## Files touched

**New:** `lib/cn.ts` · `lib/room-presence-store.ts` ·
`components/ui/{Button,Panel,Card,Input,Badge,icons,index}` ·
`components/layout/{AppShell,TopBar,UserMenu}` ·
`components/room/RoomHeadcountBadge.tsx` · `app/actions/auth.ts`
**Modified:** `app/globals.css` · `tailwind.config.ts` · `app/layout.tsx` ·
`app/page.tsx` · `app/dashboard/page.tsx` · `app/settings/page.tsx` ·
`app/(auth)/signin/page.tsx` · `app/room/[code]/page.tsx` ·
`components/room/{RoomShell,QueuePanel,PresencePanel,VoicePanel,ChatPanel,VideoPlayer,DashboardActions}`

## Verification

- ✅ `npm run typecheck` clean · `npm run lint` clean · `npm run build` clean
  (all routes compiled, fonts self-hosted, SSR fine).
- ✅ **Live two-device visual pass (2026-06-24)** — landing, sign-in, dashboard,
  settings, and the room all confirmed on two devices: design, fonts, headers,
  icons, stage glow, sticky rail under the top bar, queue/chat/voice panels,
  fullscreen, and floating reactions all hold.
- 🐞 **One bug found + fixed during the pass:** the room header showed a perpetual
  **WAITING** — it rendered `room.status`, a lifecycle enum nothing transitions —
  where users expected the headcount. Replaced with a live **"N/capacity watching"**
  badge fed by the same `room:presence` snapshots PresencePanel receives, bridged
  through a tiny module pub/sub (`lib/room-presence-store.ts` → `RoomHeadcountBadge`)
  so the server-rendered header reads the socket-driven count without a second socket
  or touching the load-bearing sync code in RoomShell. Re-verified live on two devices.

## Follow-ups / known limits

- `brand-*` Tailwind aliases still present — prune once confident nothing depends
  on them.
- Color/lighting **control UI** not built (engine supports it; deferred with skins).
- Mobile/responsive polish is **5.4**; this phase didn't audit small screens.
- **B2** (voice mic on mobile Safari `NotAllowedError`) still open.
