# Phase 5.5 — Invite Link (shareable link · copy / native-share · auto-join)

**Status:** ✅ static-green (typecheck · lint · build) — **awaiting two-device live verify.**
**Live:** web `https://water-party-private-repo.vercel.app` · socket on Railway (deploys on push to `main`).

---

## Goal

Make joining a room a single tap on a link instead of "type this 8-char code into
the dashboard form." Per the brief: a **shareable invite link for public rooms**
with **copy + native-share**. The link *is* the room URL (`/room/<code>`) — opening
it gets you into the room.

## Decisions locked (via question prompt)
- **Join flow = auto-join instantly.** Opening an invite link to a **public** room
  you're not in joins you and drops you straight into the room — no intermediate
  "Join" button. The link is the existing room URL (no new route).
- **Share control = room header + dashboard.** A copy/share button sits in the room
  header (for anyone inside) **and** on each room card in the lobby.
- **Private rooms = link works, asks for password.** The same link works for private
  (premium) rooms; the recipient lands on a join card that prompts for the room
  password before entering. A clean superset of the public case.

## The architectural core — reuse the join API, and join on the *client*

Two deliberate choices keep this small and correct:

1. **No new join logic.** `/api/rooms/join` already enforces everything that matters
   — capacity, banned, ended/closed, private-password check, and ACTIVE/LEFT
   reactivation. The invite flow **reuses it verbatim**. No new API route, **no DB
   migration**, no duplicated gate logic. The room page already fetches the room
   (name, isPrivate, capacity, headcount, status) *before* the membership check, so a
   non-member render has everything it needs with no extra query.

2. **Auto-join runs client-side (effect on mount), NOT server-side during render.**
   This is the load-bearing decision. Next.js **prefetches `<Link>`s** — the
   dashboard "Open" link, any link to a room. If the room page joined the user
   *during server render*, a prefetch (or a hover) would silently enroll people into
   rooms they never clicked. So `JoinGate` is a client component that fires the join
   in a mount effect: it only runs on a real navigation, never on prefetch. The
   server render for a non-member is side-effect-free (it just emits the gate markup).

3. **Invite URL = `window.location.origin` + `/room/<code>`**, built in the click
   handler of the (client) share button. No coupling to `NEXT_PUBLIC_APP_URL`; works
   identically on localhost, the Vercel URL, and any future custom domain.

## What was built

**New `components/room/InviteShareButton.tsx`** (client, reusable) — one button used
in both placements. On click: prefers `navigator.share({title,text,url})` (the native
share sheet on mobile); if there's no share API (most desktops) it copies the URL via
`navigator.clipboard` and flashes a **"Copied!"** state (CheckIcon, 2s) instead.
Cancelling the native sheet (`AbortError`) is swallowed; a non-abort share failure
falls through to copy. Props: `joinCode`, `roomName`, `size`/`variant`/`label`.

**New `components/room/JoinGate.tsx`** (client) — what a non-member sees on an invite
link, replacing the old dead-end card:
- **Public room:** auto-calls `/api/rooms/join` on mount (a `useRef` guard makes it
  fire once, incl. React StrictMode dev double-invoke), showing a themed
  "Joining <room>…" spinner, then `router.refresh()` so the server component
  re-renders the page **as a member** (→ RoomShell). The spinner stays up through the
  refresh — no flash.
- **Private room:** a "Join <room> · this room is private" card with a password input
  → `join(password)`; wrong password / errors shown inline; Cancel → lobby.
- **Failure states:** at-capacity / ended / banned / network errors come straight from
  the join API and render with a **Try again** + **Back to the lobby** fallback. Ended
  rooms short-circuit to a "This room has ended" card (no auto-join attempt).

**`app/room/[code]/page.tsx`** — non-members now get `<JoinGate>` instead of the
"go type the code on the dashboard" card; a `BANNED` member gets a clear "access
revoked" card; and `<InviteShareButton>` is added to the room header (members only).
Added `isBanned` + `isEnded` derivations.

**`app/dashboard/page.tsx`** — each room card's action row now has
`<InviteShareButton>` next to **Open** (wrapped in a `shrink-0` flex group).

**`components/ui/icons.tsx`** — added `CheckIcon` (the "Copied!" affordance).

## Files touched
**New:** `components/room/InviteShareButton.tsx` · `components/room/JoinGate.tsx` ·
`journal/PHASE_5_5_INVITE_LINK.md`
**Modified:** `app/room/[code]/page.tsx` · `app/dashboard/page.tsx` ·
`components/ui/icons.tsx` · `PLAN.md` · `journal/HANDOFF.md`

## Verification
- ✅ `npm run typecheck` clean · `npm run lint` clean · `npm run build` clean
  (all 14 routes; `/room/[code]` + `/dashboard` build).
- ⚠️ Room/dashboard UI can't be exercised locally (authed session + socket + DB, and
  the phone can't reach localhost). Behavior verified by build/type/lint + reasoning,
  then live. **Two-device live verification is the gate.**

### Live checklist (real phone + desktop, two accounts)
- [ ] In a room, the header shows an **Invite** button; on the dashboard each room
      card shows one next to **Open**.
- [ ] Desktop: clicking Invite **copies** the link and flashes "Copied!"; the copied
      URL is `https://…/room/<code>`.
- [ ] Phone: tapping Invite opens the **native share sheet** (Messages/WhatsApp/etc).
- [ ] **Account B (not a member) opens a public room link → lands straight in the room**
      (brief "Joining…", no code typing, no dashboard detour).
- [ ] Account B then appears in the host's People roster / headcount (presence works).
- [ ] **Private room:** opening the link shows a password card; correct password →
      enters; wrong password → inline error; no password → can't get in.
- [ ] Full room link → "Room is at capacity" with Back to the lobby (no membership).
- [ ] A signed-out person opening the link → sign-in → bounced back to the link →
      auto-joins (public) / password card (private).
- [ ] Re-opening a link you've already joined just opens the room (no re-join glitch).
- [ ] Sync / chat / reactions / voice all still work for the invited viewer.

## Follow-ups / known limits
- **B2 — voice mic on mobile Safari** (`NotAllowedError`) still open (unchanged here).
- **Pre-join preview is intentionally minimal.** Public links don't show a "you're
  invited to <room>" preview screen — by lock decision they auto-join. (The room name
  *is* shown for private links and in the "Joining…" spinner.)
- **Private invite still needs the password out-of-band.** We don't embed secrets in
  the URL; the link only saves typing the code, not the password. Correct by design.
- A shared link to an `ENDED`/closed room shows the ended card — there's no "re-open"
  affordance (host re-open is a later concern).
