# Phase 5.1 — Socket Reconnect Reliability

**Status:** ✅ Shipped + verified live on two devices (2026-06-24)
**Commits:** `8da31b5` (fix) + this journal
**Live:** web `https://water-party-private-repo.vercel.app` · socket on Railway

---

## Goal

Kill the friend-test "refresh fixes it" bug: after a brief network drop, the
video, chat, queue, and presence all stopped updating until a manual page
refresh. Make the real-time layer self-heal across transport reconnects.

## Root cause

socket.io reconnects the transport automatically, but the client only emitted
the application-level `room:join` **once on mount** (`useRoomSocket` setup). The
server binds room membership and **every broadcast** to `socket.join(channel)`
(`server/socket-server.ts` `room:join`), and a reconnect produces a brand-new
server-side socket (fresh `socket.id`, empty `data.rooms`) that was never
re-joined. So `video:state`, `chat:message`, `queue:changed`, and `room:presence`
silently stopped reaching the reconnected client. Refresh re-ran the join — which
is exactly why refresh "fixed" it.

Compounding factor: the socket JWT TTL is 1h. Even with re-join, a reconnect
during a long (multi-hour) session would fail the handshake because socket.io
re-sent the original, now-expired token.

## What was built

1. **`lib/use-room-socket.ts`** (rewritten)
   - Re-emit `room:join` on **every** `connect` (initial + reconnect) via a single
     `joinRoom()` routine.
   - Mint a **fresh token per attempt** via socket.io's `auth` callback (hits
     `/api/socket/token` before each connect/reconnect) → survives the 1h TTL on
     long sessions / phone sleep.
   - Expose **`syncEpoch`** — increments on each successful join (1 = initial,
     ≥2 = reconnect) so consumers can reconcile what they missed.
   - Honest status via manager events (`reconnect_attempt` → connecting,
     `reconnect_failed` → error); `reconnectionAttempts` raised to 20 with capped
     backoff; `forceNew` so each mount owns its Manager. socketUrl now read
     directly from `NEXT_PUBLIC_SOCKET_URL` (no token-endpoint round-trip).
2. **`components/room/RoomShell.tsx`**
   - Reconcile effect on `syncEpoch ≥ 2`, guarded by a `lastReconciledEpoch` ref
     so it only fires on real reconnects (not on `emitState`/`refresh` identity
     churn): refetch the queue; **host** re-emits authoritative state, **viewer**
     requests sync; restore the step-away flag (server clears it on a fresh
     presence entry). Passes `syncEpoch` to ChatPanel.
3. **`components/room/ChatPanel.tsx`**
   - On `syncEpoch ≥ 2`, refetch the recent message window and merge by id
     (`mergeMessagesById`) to heal messages missed while offline.
   - Presence needs no client change — it self-heals via the server's re-join →
     `broadcastPresence`.

## Why it's correct (ordering)

The server drops `video:state` / `video:request-sync` / `queue:changed` from
sockets not in the channel. The reconcile only runs after `syncEpoch` bumps, and
`syncEpoch` only bumps **inside the `room:join` ack** — so room membership is
always restored before any reconcile emit. The host's emit also refreshes the
server's `roomStates` cache, so a reconnecting viewer's `request-sync` returns
fresh state.

## Decisions locked — Phase 5 re-scope (2026-06-24)

Friend-test feedback reshaped Phase 5. New sequence (each sub-phase closed with
the journal + two-device-verify ritual):

- **5.1** Sync reliability hotfix ✅ (this).
- **5.2** Dark cinema design system + layout overhaul (next). Build the theming
  *engine* here; premium skins land in Phase 6.
- **5.3** View modes — theater rail, split-view toggle, fullscreen chat overlay.
- **5.4** Mobile-responsive + PWA (manifest + service worker).
- **5.5** Invite link for public rooms (shareable link + copy/native-share).
- **5.6** Delight — spotlight reactions + catch-up summary.

**Deferred:** local video upload (player is YouTube-only; own phase later); the
full sync **watchdog/diagnostics** layer (error-code taxonomy, periodic reconcile,
manual-reconnect UI — the durable successor to this hotfix); live polls; premium
theme skins (→ Phase 6); full friends-list invite (needs a social graph → Phase 9).

## Problems hit + resolutions

- Reconcile effect re-fired on `emitState`/`refresh` identity changes during
  normal playback → guarded with a `lastReconciledEpoch` ref so it acts only when
  the epoch actually advances.
- Token expiry on long-session reconnect → moved minting into the `auth` callback
  (per-attempt) instead of a one-time fetch.

## Files touched

- `lib/use-room-socket.ts`
- `components/room/RoomShell.tsx`
- `components/room/ChatPanel.tsx`

## Verification — passed (two devices, host + viewer, live app)

- Baseline play/pause/seek/chat/reactions/queue/presence intact.
- Viewer offline blip (DevTools offline / phone lock) → heals without refresh.
- Host offline blip → controls propagate again after reconnect.
- Chat sent while a viewer was offline → appears on reconnect (merged).
- Step-away survives a reconnect.
- Not exercised in a short pass: the >1h token re-mint (only matters on
  multi-hour sessions) — covered by code, to be observed on a real movie night.

## Follow-ups / known limits

- After 20 failed reconnect attempts the status goes "error" and socket.io stops;
  a manual-reconnect button + infinite retry belongs in the deferred watchdog slice.
- **B2** (voice mic on mobile Safari `NotAllowedError`) still open.
