# Phase 2 — Room System

> **Status:** Complete
> **Commit:** `0c4f70f` — Phase 2 — Room System
> **Dates:** 2026-05-27

## Goal

Make rooms a real thing: users can create, share a join code, join, and see their memberships. Host vs. viewer roles are enforced server-side. Capacity gates honor tier.

## What was built

### REST API (auth-required, zod-validated)

| Endpoint | Behavior |
|---|---|
| `POST /api/rooms` | Create room; nanoid-8 join code (confusable-free alphabet), host auto-added as `RoomMember.HOST`; private-room password gated to premium tier and bcrypt-hashed |
| `GET /api/rooms` | List my memberships (ordered by joinedAt desc, includes LEFT rooms for history) |
| `GET /api/rooms/[id]` | Read room details — must be ACTIVE/LEFT member, not BANNED |
| `PATCH /api/rooms/[id]` | Update room settings — host-only; capacity clamped to tier max |
| `POST /api/rooms/join` | Join by code; enforces capacity, BANNED rejection, password match for private rooms; idempotent rejoin (LEFT → ACTIVE) |
| `POST /api/rooms/[id]/leave` | Soft leave (status=LEFT, leftAt=now); host blocked — "close the room instead" |

### Shared utilities

- `lib/rooms.ts` — `generateUniqueJoinCode()` (nanoid with collision retry on UNIQUE index), `maxCapacityForTier`, `isHostRole`, shared `roomPublicSelect` Prisma projection
- `lib/validations/room.ts` — Zod schemas: `createRoomSchema`, `updateRoomSchema`, `joinRoomSchema`
- `lib/api.ts` — `requireUser()` auth helper, standardized 400/403/404/409 response builders, `zodErrorResponse`

### Minimal UI to exercise the API

- `/signin` page — working Google OAuth button using a Server Action that calls `signIn("google", ...)`
- `/dashboard` — server-renders my memberships, client component (`DashboardActions`) has Create + Join-by-code forms that call the REST API
- `/room/[code]` — server-renders room details + my membership info; shows the join code prominently for sharing

## Decisions locked

- **REST under `/api/rooms`** (not Server Actions) — keeps an explicit API surface for future mobile app and browser extension to call. UI calls the same endpoints rather than going through bespoke server actions.
- **Zod on every endpoint** — type-safe, runtime-validated. Schemas live in `lib/validations/`.
- **Minimal UI to exercise the API end-to-end** — lets us click through the whole flow in browser; defers polished UI to Phase 5.

## Problems hit and how they were resolved

1. **`'_members' is assigned a value but never used` lint error.** In the GET `/api/rooms/[id]` handler I destructured to strip `members` from the response: `const { members: _members, ...roomFields } = room;`. Next's ESLint config doesn't honor the underscore-prefix convention. Refactored so `members` is actually consumed: `const { members, ...roomFields } = room; const membership = members[0];`.

2. **`tier: string` failing tier comparisons.** API code wants to check `if (user.tier === "PREMIUM")`. After the Phase 1 tightening of `session.user.tier` to the `UserTier` enum, this compiled cleanly across `app/api/rooms/route.ts` and `app/api/rooms/[id]/route.ts`.

3. **Landing page `Sign In` → 404.** Linked to `/auth/signin`; the `(auth)` route group is parens-only — URL is `/signin`. Fixed.

## Files added

```
app/api/rooms/route.ts                      # POST + GET
app/api/rooms/[id]/route.ts                 # GET + PATCH
app/api/rooms/join/route.ts                 # POST
app/api/rooms/[id]/leave/route.ts           # POST
lib/rooms.ts                                # joinCode gen, capacity helpers, shared select
lib/validations/room.ts                     # zod schemas
lib/api.ts                                  # auth helper, error responses
components/room/DashboardActions.tsx        # client forms — Create + Join
app/dashboard/page.tsx                      # full server-rendered dashboard
app/room/[code]/page.tsx                    # room detail page
app/(auth)/signin/page.tsx                  # Google OAuth button
```

## Verification

- All four endpoints return 401 without a session (curl)
- `/signin` → click Google → land on `/dashboard`
- Create room → redirect to `/room/<code>` showing as HOST
- Refresh dashboard → new room appears in the list
- Copy join code → paste into Join form → land back on room page (already a member, no error)
- Bogus join code → "Room not found"

## Phase 2 — design choices worth knowing

- **Confusable-free alphabet** for join codes: excludes `0/O/1/I/l`. Easier to share verbally.
- **Capacity check at join time only.** Active count comes from `RoomMember.status = ACTIVE`. Removing a user (kick) drops them to KICKED → frees a slot.
- **Reorder uses no DB unique constraint** on `(roomId, position)` — `@@index([roomId, position])` only. Lets us update positions in any order in a transaction without conflicts.
- **`bcrypt.hash(password, 10)` for private rooms.** Password column is nullable; only set when `isPrivate = true`.

## What this enabled

Phase 3 builds on top of `Room` + `RoomMember` for the queue API (3.1), the socket server's host validation (3.2), and the per-room playback channel (3.3). The `?asViewer=1` testing override added in Phase 3 also relies on the room page already being structured to take `isHost` as a prop.
