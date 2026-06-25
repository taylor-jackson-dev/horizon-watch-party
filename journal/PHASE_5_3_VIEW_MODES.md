# Phase 5.3 — View Modes (Theater · Focus · Split + Fullscreen Chat Overlay)

**Status:** 🔄 Implemented — static checks green (typecheck · lint · build); **pending live two-device verification.**
**Live:** web `https://water-party-private-repo.vercel.app` · socket on Railway (deploys on push to `main`).

---

## Goal

Give the watch room selectable **view modes** so users can shape the room around
what they're doing — lean back and watch, lock onto the screen, or chat-forward.
Per the brief: **theater rail, split-view toggle, fullscreen chat overlay.**
Locked with the user (via question prompt): **3 segmented presets** (not composable
toggles), control lives on the **stage toolbar.**

Presentation-only, in the 5.2 spirit: **zero sync / voice / chat logic touched.**

## What was built

**Engine (RoomShell)**
- `viewMode: "theater" | "focus" | "split"` + `fsChatOpen: boolean`, both persisted
  to `localStorage` (`wp:viewmode`, `wp:fschat`) following the existing `wp:debug`
  convention. **SSR-safe:** seed to defaults for a stable first paint, then hydrate
  from storage in a mount effect (no hydration mismatch).
- `gridColsClass` drives the root grid template per mode; the social panels are
  built once as nodes and slotted into different positions per mode (only one branch
  mounts each on a given render — no duplicate-instance concern).

**Stage toolbar (top-right of the player stage)**
- Relocated from bottom-right → **top-right** so it clears YouTube's own bottom
  control bar *and* the bottom-right reaction picker.
- Not fullscreen: a segmented **Theater / Focus / Split** control (gold = active).
- Fullscreen: a **chat-overlay toggle** (speech bubble) + the fullscreen button.
- Wrapper is `pointer-events-none`; only the buttons capture clicks, so dead space
  over the video stays clickable for YouTube.

**The three layouts**
- **Theater** (default) — stage + queue (left) · sticky social rail
  presence/voice/chat (right, 300px). Identical to the pre-5.3 layout.
- **Focus** — single column, stage spans the full content width, **no rail**
  ("lights down"). Queue stays below. Chat/presence reachable by switching modes
  or via the fullscreen overlay.
- **Split** — stage + an **enlarged chat** column (right, `minmax(340px,420px)`);
  queue + presence + voice **tuck under the stage** so chat owns the right side.

**Fullscreen chat overlay**
- A second, **translucent + compact** `ChatPanel` rendered **inside the stage
  element** so it's visible in native fullscreen (which only renders the stage
  subtree) and in the CSS-pin fallback (iOS). Docked top-right under the control
  row; toggled by the FS chat button and remembered across sessions.
- When the overlay is open, the **reaction picker shifts to the bottom-left** so it
  isn't hidden behind the chat.

## Primitive changes (all presentation-only, backward-compatible defaults)
- `components/ui/icons.tsx` — `LayoutRailIcon`, `LayoutFullIcon`, `LayoutSplitIcon`,
  `ChatBubbleIcon`.
- `ReactionPicker` — `align?: "left" | "right"` (default `"right"`).
- `ChatPanel` — `compact?` (drops the marquee header + status badges) and
  `panelClassName?` (forwarded to `Panel` for the overlay's translucency).

## Why the fullscreen overlay is a second instance (not a portal)
The shared `socket` is the single source of chat events; each `ChatPanel` dedupes
incoming messages by id, and a send is a discrete socket emit from whichever input
was used — so two mounted panels can't double-send. Reusing the one instance via a
portal would preserve scroll but add ref/target-timing complexity for a feature
toggled rarely. The cost of two instances is one extra history GET + one extra
`chat:message` listener while fullscreen — negligible — in exchange for much simpler,
robustly-correct code.

## Decisions locked
- **3 segmented presets**, not composable toggles (cleanest mental model).
- **Stage-toolbar** control (clusters with fullscreen; visible in FS too).
- **Persist** the last mode per browser.
- **Mobile/responsive polish deferred to 5.4** — modes are an `lg+` concern; below
  `lg` every mode stacks to a single column (today's mobile behavior).

## Files touched
**New:** `journal/PHASE_5_3_VIEW_MODES.md`
**Modified:** `components/room/RoomShell.tsx` · `components/room/ChatPanel.tsx` ·
`components/room/ReactionPicker.tsx` · `components/ui/icons.tsx` · `PLAN.md`
(backlog capture — room banner frames)

## Verification
- ✅ `npm run typecheck` clean · `npm run lint` clean · `npm run build` clean
  (all 13 routes compiled; `/room/[code]` builds).
- ⏳ **Live two-device pass pending.** Suggested checklist:
  - [ ] Stage segmented control switches Theater / Focus / Split; active state reads.
  - [ ] **Theater** = the familiar layout (rail right, sticky under the top bar).
  - [ ] **Focus** = stage full-width, no rail; queue still below.
  - [ ] **Split** = wide chat on the right; queue/presence/voice under the stage.
  - [ ] Choice **persists** across reload (and is per-browser).
  - [ ] **Fullscreen** → chat-overlay toggle appears; chat overlays translucent on
        the video; reaction picker moves to bottom-left; reactions still float.
  - [ ] Overlay chat **sends + receives** live; rail chat stays in sync.
  - [ ] Host **and** viewer, on two devices: playback sync, reactions, voice all
        unaffected by the layout changes.
  - [ ] iOS CSS-fullscreen path: overlay shows and is usable.

## Follow-ups / known limits
- **Focus hides chat entirely** by design; reached via a mode switch or the FS
  overlay. Revisit if testers want a peek-chat affordance in Focus.
- Two `ChatPanel` instances coexist while fullscreen (rail one hidden, overlay one
  shown) — see rationale above.
- **Mobile polish = 5.4.** Split's under-stage panels can get tall on phones; the
  responsive pass will address stacking + a mobile-appropriate mode control.
